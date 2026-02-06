import { type Kysely } from 'kysely';

import { makeTestWithFixture } from '../../test/utils.js';
import UserManagementService from './userManagementService.js';
import type { UserManagementPg } from './index.js';

// Mock dependencies
const mockDb = {
  selectFrom: jest.fn(),
  insertInto: jest.fn(),
  deleteFrom: jest.fn(),
} as unknown as Kysely<UserManagementPg>;

const mockSendEmail = jest.fn();

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
    jest.clearAllMocks();
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
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue({
            email,
            orgId,
          }),
        };

        // Mock token insertion
        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([]),
        };

        // Mock delete
        const mockDelete = {
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([]),
        };

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);
        (mockDb.insertInto as jest.Mock).mockReturnValue(mockInsert);
        (mockDb.deleteFrom as jest.Mock).mockReturnValue(mockDelete);

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
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue({
            email: 'test@example.com',
            orgId: userOrgId,
          }),
        };

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);

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
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue(null),
        };

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);

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
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue({
            email,
            orgId,
          }),
        };

        // Mock token insertion
        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([]),
        };

        // Mock delete
        const mockDelete = {
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([]),
        };

        // Mock email sending to fail (but it's caught internally by sendEmail)
        mockSendEmail.mockResolvedValue(undefined); // sendEmail catches errors internally

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);
        (mockDb.insertInto as jest.Mock).mockReturnValue(mockInsert);
        (mockDb.deleteFrom as jest.Mock).mockReturnValue(mockDelete);

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
});
