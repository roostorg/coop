import { type Kysely } from 'kysely';

import { hashPassword } from '../../services/userManagementService/index.js';
import { makeTestWithFixture } from '../../test/utils.js';
import UserAPI from './UserApi.js';
import { type GraphQLUserParent } from './userKyselyPersistence.js';

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

        // Remaining constructor deps are unused by changePassword.
        const sut = new UserAPI(
          kyselyPg,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused mock dep
          {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused mock dep
          {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused mock dep
          {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused mock dep
          {} as any,
        );

        const user = {
          id: userId,
          loginMethods: ['password'],
          password: passwordHash,
        } as unknown as GraphQLUserParent;

        await sut.changePassword(
          user,
          { currentPassword, newPassword: 'new-password' },
          currentSid,
        );

        // The caller's own session is preserved; all others are invalidated.
        expect(deleteFrom).toHaveBeenCalledWith('public.session');
        expect(deleteWhere).toHaveBeenCalledWith('sid', '!=', currentSid);
      },
    );
  });
});
