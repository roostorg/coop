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

describe('UserManagementService #deleteInvite', () => {
  const testWithInvite = makeTransactionalTestWithFixture(async ({ deps }) => {
    const local = await createOrg(deps);
    const foreign = await createOrg(deps);
    // Seeds the org's system roles, which invites reference.
    await createUser(deps.KyselyPg, local.org.id);
    const service = new UserManagementService(deps.KyselyPg, vi.fn(), {
      uiUrl: 'https://example.invalid',
    });
    await service.createInviteUserToken({
      email: 'invitee@example.invalid',
      role: 'MODERATOR',
      orgId: local.org.id,
    });
    const [invite] = await service.getPendingInvites(local.org.id);
    return {
      service,
      invite,
      orgId: local.org.id,
      foreignOrgId: foreign.org.id,
    };
  });

  testWithInvite(
    'returns false unless the invite is deleted',
    async ({ service, invite, orgId, foreignOrgId }) => {
      expect(
        await service.deleteInvite(
          String(Number(invite.id) + 1_000_000),
          orgId,
        ),
      ).toBe(false);
      expect(await service.deleteInvite(invite.id, foreignOrgId)).toBe(false);
      expect(await service.getPendingInvites(orgId)).toHaveLength(1);

      expect(await service.deleteInvite(invite.id, orgId)).toBe(true);
      expect(await service.getPendingInvites(orgId)).toEqual([]);
    },
  );
});
