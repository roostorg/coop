import { type Kysely } from 'kysely';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
} from '../../services/userManagementService/index.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { type GQLMutationSignUpArgs } from '../generated.js';
import UserAPI from './UserApi.js';
import { type GraphQLUserParent } from './userKyselyPersistence.js';

// UserAPI is constructed with five injected dependencies, but the
// password-length guard paths exercised in this file only reach `kyselyPg`.
// Stub the other four here with a single typed `never` so no call site needs
// to repeat the cast (and none of them reach for `any`).
function makeUserAPIForGuardTest(kyselyPg: Dependencies['KyselyPg']) {
  const unusedDep = undefined as never;
  return new UserAPI(kyselyPg, unusedDep, unusedDep, unusedDep, unusedDep);
}

// changePassword only touches the injected Kysely instance (for the user
// update + session deletion); the other constructor deps are unused here.
function makeMockKyselyPg() {
  const updateExecuteTakeFirst = jest.fn();
  const updateBuilder = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    executeTakeFirst: updateExecuteTakeFirst,
  };

  const deleteWhere = jest.fn();
  const deleteBuilder = { where: deleteWhere, execute: jest.fn() };
  deleteWhere.mockReturnValue(deleteBuilder);
  deleteBuilder.execute.mockResolvedValue([]);

  const updateTable = jest.fn().mockReturnValue(updateBuilder);
  const deleteFrom = jest.fn().mockReturnValue(deleteBuilder);

  // changePassword runs inside makeKyselyTransactionWithRetry, which calls
  // `kysely.transaction().execute(cb)`. Run the callback against this same mock.
  const transaction = jest.fn().mockReturnValue({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test trx stub
    execute: (cb: (trx: any) => unknown) => cb(kyselyPg),
  });

  const kyselyPg = {
    updateTable,
    deleteFrom,
    transaction,
  } as unknown as Kysely<any>;
  return { kyselyPg, updateExecuteTakeFirst, deleteFrom, deleteWhere };
}

describe('UserAPI', () => {
  describe('#changePassword', () => {
    const testWithFixtures = makeTestWithFixture(() => ({}));

    beforeEach(() => {
      jest.clearAllMocks();
    });

    testWithFixtures(
      'invalidates the user other sessions but preserves the caller session',
      async () => {
        const currentPassword = 'current-password';
        const userId = 'user-123';
        const currentSid = 'sid-abc';
        const passwordHash = await hashPassword(currentPassword);

        const { kyselyPg, updateExecuteTakeFirst, deleteFrom, deleteWhere } =
          makeMockKyselyPg();

        // kyselyUserUpdate succeeds (returns a non-undefined row).
        updateExecuteTakeFirst.mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          password: 'new-hash',
          first_name: 'Test',
          last_name: 'User',
          org_id: 'org-456',
          role: 'ADMIN',
          approved_by_admin: true,
          rejected_by_admin: false,
          login_methods: ['password'],
          permissions: [],
          created_at: new Date(),
          updated_at: new Date(),
        });

        const sut = makeUserAPIForGuardTest(kyselyPg);

        const user = {
          id: userId,
          loginMethods: ['password'],
          password: passwordHash,
        } as unknown as GraphQLUserParent;

        await sut.changePassword(
          user,
          { currentPassword, newPassword: 'a'.repeat(MIN_PASSWORD_LENGTH) },
          currentSid,
        );

        // The caller's own session is preserved; all others are invalidated.
        expect(deleteFrom).toHaveBeenCalledWith('public.session');
        expect(deleteWhere).toHaveBeenCalledWith('sid', '!=', currentSid);
      },
    );

    testWithFixtures(
      'rejects a new password shorter than the minimum without writing',
      async () => {
        const currentPassword = 'current-password';
        const passwordHash = await hashPassword(currentPassword);

        const { kyselyPg, updateExecuteTakeFirst, deleteFrom } =
          makeMockKyselyPg();

        const sut = makeUserAPIForGuardTest(kyselyPg);

        const user = {
          id: 'user-123',
          loginMethods: ['password'],
          password: passwordHash,
        } as unknown as GraphQLUserParent;

        await expect(
          sut.changePassword(
            user,
            {
              currentPassword,
              newPassword: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
            },
            'sid-abc',
          ),
        ).rejects.toThrow(`at least ${MIN_PASSWORD_LENGTH} characters`);

        // No password write, no session purge.
        expect(updateExecuteTakeFirst).not.toHaveBeenCalled();
        expect(deleteFrom).not.toHaveBeenCalled();
      },
    );
  });

  describe('#signUp', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('rejects a password shorter than the minimum', async () => {
      const { kyselyPg } = makeMockKyselyPg();

      const sut = makeUserAPIForGuardTest(kyselyPg);

      const args: GQLMutationSignUpArgs = {
        input: {
          email: 'new@example.com',
          password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
          firstName: 'New',
          lastName: 'User',
          orgId: 'org-456',
          role: 'ADMIN',
          loginMethod: 'PASSWORD',
        },
      };

      await expect(sut.signUp(args, undefined)).rejects.toThrow(
        `at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    });
  });
});
