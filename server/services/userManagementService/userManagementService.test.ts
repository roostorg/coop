import { type Kysely } from 'kysely';
import { vi, type Mock } from 'vitest';

import { makeTestWithFixture } from '../../test/utils.js';
import { MIN_PASSWORD_LENGTH } from './constants.js';
import type { UserManagementPg } from './index.js';
import UserManagementService from './userManagementService.js';

// Mock dependencies
const mockDb = {
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
  deleteFrom: vi.fn(),
  transaction: vi.fn(),
} as unknown as Kysely<UserManagementPg>;

const mockSendEmail = vi.fn();

const mockConfigService = {
  uiUrl: 'http://localhost:3000',
};

describe('UserManagementService', () => {
  const testWithFixtures = makeTestWithFixture(() => {
    const sut = new UserManagementService(
      mockDb,
      mockSendEmail,
      mockConfigService,
    );
    return { sut };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('#generatePasswordResetTokenForUser', () => {
    testWithFixtures(
      'should generate token and send email for valid user in same org',
      async ({ sut }) => {
        const userId = 'user-123';
        const orgId = 'org-456';
        const email = 'test@example.com';

        // Mock user lookup
        const mockSelect = {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue({
            email,
            orgId,
          }),
        };

        // Mock token insertion
        const mockInsert = {
          values: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        };

        // Mock delete
        const mockDelete = {
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        };

        (mockDb.selectFrom as Mock).mockReturnValue(mockSelect);
        (mockDb.insertInto as Mock).mockReturnValue(mockInsert);
        (mockDb.deleteFrom as Mock).mockReturnValue(mockDelete);

        const token = await sut.generatePasswordResetTokenForUser({
          userId,
          invokerOrgId: orgId,
        });

        // Verify token was generated (64 char hex string)
        expect(token).toMatch(/^[a-f0-9]{64}$/);

        // Verify email was sent
        expect(mockSendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: email,
            subject: '[Coop] Reset your password',
            html: expect.stringContaining('password reset'),
          }),
        );

        // Verify token was stored in database
        expect(mockDb.insertInto).toHaveBeenCalledWith(
          'user_management_service.password_reset_tokens',
        );
      },
    );

    testWithFixtures(
      'should throw UnauthorizedError when user is in different org',
      async ({ sut }) => {
        const userId = 'user-123';
        const userOrgId = 'org-456';
        const adminOrgId = 'org-789'; // Different org!

        // Mock user lookup
        const mockSelect = {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue({
            email: 'test@example.com',
            orgId: userOrgId,
          }),
        };

        (mockDb.selectFrom as Mock).mockReturnValue(mockSelect);

        await expect(
          sut.generatePasswordResetTokenForUser({
            userId,
            invokerOrgId: adminOrgId,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining(
              'can only reset passwords for users in your organization',
            ),
          }),
        );

        // Verify email was NOT sent
        expect(mockSendEmail).not.toHaveBeenCalled();
      },
    );

    testWithFixtures(
      'should throw NotFoundError when user does not exist',
      async ({ sut }) => {
        const userId = 'nonexistent-user';
        const orgId = 'org-456';

        // Mock user lookup returning null
        const mockSelect = {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(null),
        };

        (mockDb.selectFrom as Mock).mockReturnValue(mockSelect);

        await expect(
          sut.generatePasswordResetTokenForUser({
            userId,
            invokerOrgId: orgId,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('User not found'),
          }),
        );

        // Verify email was NOT sent
        expect(mockSendEmail).not.toHaveBeenCalled();
      },
    );

    testWithFixtures(
      'should continue if email sending fails (email errors are caught internally)',
      async ({ sut }) => {
        const userId = 'user-123';
        const orgId = 'org-456';
        const email = 'test@example.com';

        // Mock user lookup
        const mockSelect = {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue({
            email,
            orgId,
          }),
        };

        // Mock token insertion
        const mockInsert = {
          values: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        };

        // Mock delete
        const mockDelete = {
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        };

        // Mock email sending to fail (but it's caught internally by sendEmail)
        mockSendEmail.mockResolvedValue(undefined); // sendEmail catches errors internally

        (mockDb.selectFrom as Mock).mockReturnValue(mockSelect);
        (mockDb.insertInto as Mock).mockReturnValue(mockInsert);
        (mockDb.deleteFrom as Mock).mockReturnValue(mockDelete);

        // Should still return token - email service handles its own errors
        const token = await sut.generatePasswordResetTokenForUser({
          userId,
          invokerOrgId: orgId,
        });

        expect(token).toMatch(/^[a-f0-9]{64}$/);
        expect(mockSendEmail).toHaveBeenCalled();
      },
    );
  });

  describe('#resetPasswordForToken', () => {
    testWithFixtures(
      'invalidates all sessions for the user after resetting the password',
      async ({ sut }) => {
        const userId = 'user-123';

        // Valid, non-expired reset token.
        const mockSelect = {
          selectAll: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue({
            hashed_token: 'hashed',
            user_id: userId,
            org_id: 'org-456',
            created_at: new Date(),
          }),
        };

        const mockUpdate = {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        };

        const mockDelete = {
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        };

        (mockDb.selectFrom as Mock).mockReturnValue(mockSelect);
        (mockDb.updateTable as Mock).mockReturnValue(mockUpdate);
        (mockDb.deleteFrom as Mock).mockReturnValue(mockDelete);
        // Steps 2-4 run inside makeKyselyTransactionWithRetry, which calls
        // `pgQuery.transaction().execute(cb)`. Run the callback against mockDb.
        (mockDb.transaction as Mock).mockReturnValue({
          execute: (cb: (trx: typeof mockDb) => unknown) => cb(mockDb),
        });

        await sut.resetPasswordForToken({
          token: 'plaintext-token',
          newPassword: 'a'.repeat(MIN_PASSWORD_LENGTH),
        });

        // The password row is updated...
        expect(mockDb.updateTable).toHaveBeenCalledWith('public.users');
        // ...and the user's sessions are deleted so a phished session can't
        // outlive the reset.
        expect(mockDb.deleteFrom).toHaveBeenCalledWith('public.session');
      },
    );

    testWithFixtures(
      'rejects a password shorter than the minimum length',
      async ({ sut }) => {
        const mockSelect = {
          selectAll: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue({
            hashed_token: 'hashed',
            user_id: 'user-123',
            org_id: 'org-456',
            created_at: new Date(),
          }),
        };

        (mockDb.selectFrom as Mock).mockReturnValue(mockSelect);

        const tooShortPassword = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);

        await expect(
          sut.resetPasswordForToken({
            token: 'plaintext-token',
            newPassword: tooShortPassword,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining(
              `at least ${MIN_PASSWORD_LENGTH} characters`,
            ),
          }),
        );

        expect(mockDb.updateTable).not.toHaveBeenCalled();
      },
    );
  });
});
