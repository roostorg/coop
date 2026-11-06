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
    const { user: other } = await createUser(deps.KyselyPg, foreign.org.id);
    const sendEmail = vi.fn(async () => true);
    const service = new UserManagementService(deps.KyselyPg, sendEmail, {
      uiUrl: 'https://example.invalid',
    });
    const tokens = [
      await service.generatePasswordResetTokenForUser({
        userId: user.id,
        invokerOrgId: user.orgId,
      }),
      await service.generatePasswordResetTokenForUser({
        userId: other.id,
        invokerOrgId: other.orgId,
      }),
    ];
    const snapshot = async () =>
      deps.KyselyPg.selectFrom('user_management_service.password_reset_tokens')
        .selectAll()
        .where('user_id', 'in', [user.id, other.id])
        .orderBy('user_id')
        .execute();
    return { service, user, other, tokens, snapshot, sendEmail };
  });

  testWithUsers(
    'replaces only the target user token and stores its hash',
    async ({ service, user, other, tokens, snapshot, sendEmail }) => {
      const before = await snapshot();
      const replacement = await service.generatePasswordResetTokenForUser({
        userId: user.id,
        invokerOrgId: user.orgId,
      });
      expect(replacement).toMatch(/^[a-f0-9]{64}$/);
      expect(replacement).not.toBe(tokens[0]);
      const after = await snapshot();
      expect(after.filter((row) => row.user_id === user.id)).toEqual([
        expect.objectContaining({
          org_id: user.orgId,
          hashed_token: createHash('sha256').update(replacement).digest('hex'),
        }),
      ]);
      expect(after.filter((row) => row.user_id === other.id)).toEqual(
        before.filter((row) => row.user_id === other.id),
      );
      expect(sendEmail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          to: user.email,
          html: expect.stringContaining(replacement),
        }),
      );
    },
  );

  for (const foreignUser of [false, true]) {
    testWithUsers(
      `rejects a ${foreignUser ? 'foreign' : 'missing'} user without replacing any reset token`,
      async ({ service, user, other, snapshot, sendEmail }) => {
        const before = await snapshot();
        const delivered = sendEmail.mock.calls.length;
        await expect(
          service.generatePasswordResetTokenForUser({
            userId: foreignUser ? other.id : 'missing-user',
            invokerOrgId: user.orgId,
          }),
        ).rejects.toThrow(
          foreignUser
            ? 'can only reset passwords for users in your organization'
            : 'User not found',
        );
        expect(await snapshot()).toEqual(before);
        expect(sendEmail.mock.calls).toHaveLength(delivered);
      },
    );
  }
});
