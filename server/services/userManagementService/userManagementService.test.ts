import { createHash } from 'node:crypto';
import { vi } from 'vitest';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import UserManagementService from './userManagementService.js';

describe('UserManagementService #generatePasswordResetTokenForUser', () => {
  const testWithUsers = makeTransactionalTestWithFixture(async ({ deps }) => {
    const local = await createOrg(deps);
    const foreign = await createOrg(deps);
    const { user } = await createUser(deps.KyselyPg, local.org.id);
    const { user: foreignUser } = await createUser(
      deps.KyselyPg,
      foreign.org.id,
    );
    const sendEmail = vi.fn(async () => true);
    const service = new UserManagementService(deps.KyselyPg, sendEmail, {
      uiUrl: 'https://example.invalid',
    });
    const initialToken = await service.generatePasswordResetTokenForUser({
      userId: user.id,
      invokerOrgId: user.orgId,
    });
    await service.generatePasswordResetTokenForUser({
      userId: foreignUser.id,
      invokerOrgId: foreignUser.orgId,
    });
    const snapshot = async () =>
      deps.KyselyPg.selectFrom('user_management_service.password_reset_tokens')
        .selectAll()
        .where('user_id', 'in', [user.id, foreignUser.id])
        .orderBy('user_id')
        .execute();
    return { service, user, foreignUser, initialToken, snapshot, sendEmail };
  });

  testWithUsers(
    'replaces only the target user token and stores its hash',
    async ({
      service,
      user,
      foreignUser,
      initialToken,
      snapshot,
      sendEmail,
    }) => {
      const before = await snapshot();
      const replacement = await service.generatePasswordResetTokenForUser({
        userId: user.id,
        invokerOrgId: user.orgId,
      });
      expect(replacement).toMatch(/^[a-f0-9]{64}$/);
      expect(replacement).not.toBe(initialToken);
      const after = await snapshot();
      expect(after.filter((row) => row.user_id === user.id)).toEqual([
        expect.objectContaining({
          org_id: user.orgId,
          hashed_token: createHash('sha256').update(replacement).digest('hex'),
        }),
      ]);
      expect(after.filter((row) => row.user_id === foreignUser.id)).toEqual(
        before.filter((row) => row.user_id === foreignUser.id),
      );
      expect(sendEmail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          to: user.email,
          html: expect.stringContaining(replacement),
        }),
      );
    },
  );

  for (const target of ['missing', 'foreign'] as const) {
    testWithUsers(
      `rejects a ${target} user without replacing any reset token`,
      async ({ service, user, foreignUser, snapshot, sendEmail }) => {
        const before = await snapshot();
        const delivered = sendEmail.mock.calls.length;
        await expect(
          service.generatePasswordResetTokenForUser({
            userId: target === 'foreign' ? foreignUser.id : 'missing-user',
            invokerOrgId: user.orgId,
          }),
        ).rejects.toThrow(
          target === 'foreign'
            ? 'can only reset passwords for users in your organization'
            : 'User not found',
        );
        expect(await snapshot()).toEqual(before);
        expect(sendEmail.mock.calls).toHaveLength(delivered);
      },
    );
  }
});
