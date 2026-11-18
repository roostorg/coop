import { createHash } from 'node:crypto';
import { asc, inArray } from 'drizzle-orm';
import { vi } from 'vitest';

import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import UserManagementService from './userManagementService.js';

describe('UserManagementService #generatePasswordResetTokenForUser', () => {
  const testWithUsers = makeTransactionalTestWithFixture(async ({ deps }) => {
    const local = await createOrg(deps);
    const foreign = await createOrg(deps);
    const { user } = await createUser(deps.DrizzlePg, local.org.id);
    const { user: foreignUser } = await createUser(
      deps.DrizzlePg,
      foreign.org.id,
    );
    const sendEmail = vi.fn(async () => true);
    const service = new UserManagementService(deps.DrizzlePg, sendEmail, {
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
      deps.DrizzlePg.select()
        .from(schema.passwordResetTokens)
        .where(
          inArray(schema.passwordResetTokens.userId, [user.id, foreignUser.id]),
        )
        .orderBy(asc(schema.passwordResetTokens.userId));
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
      expect(after.filter((row) => row.userId === user.id)).toEqual([
        expect.objectContaining({
          orgId: user.orgId,
          hashedToken: createHash('sha256').update(replacement).digest('hex'),
        }),
      ]);
      expect(after.filter((row) => row.userId === foreignUser.id)).toEqual(
        before.filter((row) => row.userId === foreignUser.id),
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

describe('UserManagementService user interface settings', () => {
  const testWithUser = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(deps);
    const { user } = await createUser(deps.DrizzlePg, org.id);
    await deps.UserManagementService.upsertOrgDefaultUserInterfaceSettings({
      orgId: org.id,
    });
    return { user, service: deps.UserManagementService };
  });

  testWithUser(
    'round-trips chart configurations stored as jsonb[]',
    async ({ user, service }) => {
      // Quotes, commas and braces exercise the jsonb[] array-literal encoding.
      const mrtChartConfigurations = [
        { title: 'Jobs, "by queue" {all}', metric: 'JOBS' as const },
        { title: 'Second', metric: 'JOBS' as const },
      ];
      await service.upsertUserInterfaceSettings({
        userId: user.id,
        userInterfaceSettings: { mrtChartConfigurations },
      });

      const settings = await service.getUserInterfaceSettings({
        userId: user.id,
        orgId: user.orgId,
      });
      expect(settings.mrtChartConfigurations).toEqual(mrtChartConfigurations);
      // Unset moderator settings fall back to the org defaults.
      expect(settings).toMatchObject({
        moderatorSafetyGrayscale: true,
        moderatorSafetyBlurLevel: 2,
      });

      await service.upsertUserInterfaceSettings({
        userId: user.id,
        userInterfaceSettings: {
          moderatorSafetySettings: {
            moderatorSafetyMuteVideo: false,
            moderatorSafetyGrayscale: false,
            moderatorSafetyBlurLevel: 0,
            moderatorSafetySepia: true,
          },
        },
      });
      await expect(
        service.getUserInterfaceSettings({
          userId: user.id,
          orgId: user.orgId,
        }),
      ).resolves.toEqual({
        moderatorSafetyMuteVideo: false,
        moderatorSafetyGrayscale: false,
        moderatorSafetyBlurLevel: 0,
        moderatorSafetySepia: true,
        mrtChartConfigurations,
      });
    },
  );
});
