import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { uid } from 'uid';

// This integration fixture intentionally exercises the production role seeder.
// eslint-disable-next-line import/no-restricted-paths
import { seedSystemRolesForOrg } from '../../graphql/datasources/rolePersistence.js';
// This integration fixture calls the GraphQL datasource with its generated enum.
// eslint-disable-next-line no-restricted-syntax, import/no-restricted-paths
import { GQLUserRole } from '../../graphql/generated.js';
import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { UserPermission, UserRole } from './permissioning.js';

const { inviteUserTokens, roles, users } = schema;

describe('UserManagementService role persistence', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        DrizzlePg: deps.DrizzlePg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    await seedSystemRolesForOrg(deps.DrizzlePg, org.id);
    return { org };
  });

  testWithFixture(
    'creates and reads invites through their organization role ID',
    async ({ deps, org }) => {
      const email = faker.internet.email();
      const token = await deps.UserManagementService.createInviteUserToken({
        email,
        role: UserRole.ANALYST,
        orgId: org.id,
      });

      const [persisted] = await deps.DrizzlePg.select({
        roleId: inviteUserTokens.roleId,
        key: roles.key,
      })
        .from(inviteUserTokens)
        .innerJoin(roles, eq(roles.id, inviteUserTokens.roleId))
        .where(eq(inviteUserTokens.token, token));
      expect(persisted.roleId).not.toBeNull();
      expect(persisted.key).toBe(UserRole.ANALYST);
      await expect(
        deps.UserManagementService.getInviteUserToken({ token }),
      ).resolves.toMatchObject({
        email,
        orgId: org.id,
        role: UserRole.ANALYST,
      });
      await expect(
        deps.UserManagementService.getPendingInvites(org.id),
      ).resolves.toEqual([
        expect.objectContaining({ email, role: UserRole.ANALYST }),
      ]);
    },
  );

  testWithFixture(
    'signs up with a role-ID-backed invite and consumes its token',
    async ({ deps, org }) => {
      const email = faker.internet.email();
      const token = await deps.UserManagementService.createInviteUserToken({
        email,
        role: UserRole.ANALYST,
        orgId: org.id,
      });
      const input = {
        email,
        firstName: 'Invited',
        lastName: 'User',
        inviteUserToken: token,
        loginMethod: 'SAML' as const,
        orgId: org.id,
      };

      await expect(
        deps.UserAPIDataSource.signUp(
          { input: { ...input, role: GQLUserRole.Admin } },
          undefined,
        ),
      ).rejects.toThrow('Invalid invite token');

      const user = await deps.UserAPIDataSource.signUp(
        { input: { ...input, role: GQLUserRole.Analyst } },
        undefined,
      );
      expect(user).toMatchObject({
        email,
        orgId: org.id,
        role: UserRole.ANALYST,
      });
      expect(user.id).toEqual(expect.any(String));
      await expect(
        deps.UserManagementService.getInviteUserToken({ token }),
      ).resolves.toBeNull();
    },
  );

  testWithFixture(
    'updates a user through the organization role ID and round-trips its key',
    async ({ deps, org }) => {
      const userId = uid();
      const [adminRole] = await deps.DrizzlePg.select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.orgId, org.id), eq(roles.key, UserRole.ADMIN)));
      const now = new Date();
      await deps.DrizzlePg.insert(users).values({
        id: userId,
        orgId: org.id,
        email: faker.internet.email(),
        firstName: 'Role',
        lastName: 'User',
        roleId: adminRole.id,
        loginMethods: ['saml'],
        password: null,
        approvedByAdmin: true,
        rejectedByAdmin: false,
        createdAt: now,
        updatedAt: now,
      });

      await deps.UserManagementService.updateUserRole({
        userId,
        newRole: UserRole.ANALYST,
        orgId: org.id,
        invoker: {
          userId: uid(),
          orgId: org.id,
          permissions: [UserPermission.MANAGE_USERS],
        },
      });

      const [analystRole] = await deps.DrizzlePg.select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.orgId, org.id), eq(roles.key, UserRole.ANALYST)));
      const [persistedUser] = await deps.DrizzlePg.select({
        roleId: users.roleId,
      })
        .from(users)
        .where(eq(users.id, userId));
      expect(persistedUser.roleId).toBe(analystRole.id);

      await expect(
        deps.UserManagementService.getUsersForOrg(org.id),
      ).resolves.toEqual([
        expect.objectContaining({ id: userId, role: UserRole.ANALYST }),
      ]);
    },
  );
});
