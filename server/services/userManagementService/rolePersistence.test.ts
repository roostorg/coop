import { faker } from '@faker-js/faker';
import { uid } from 'uid';

// This integration fixture intentionally exercises the production role seeder.
// eslint-disable-next-line import/no-restricted-paths
import { seedSystemRolesForOrg } from '../../graphql/datasources/rolePersistence.js';
// This integration fixture calls the GraphQL datasource with its generated enum.
// eslint-disable-next-line no-restricted-syntax, import/no-restricted-paths
import { GQLUserRole } from '../../graphql/generated.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { UserPermission, UserRole } from './permissioning.js';

describe('UserManagementService role persistence', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    await seedSystemRolesForOrg(deps.KyselyPg, org.id);
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

      const persisted = await deps.KyselyPg.selectFrom(
        'public.invite_user_tokens',
      )
        .innerJoin('public.roles', 'public.roles.id', 'role_id')
        .select(['role_id', 'public.roles.key'])
        .where('token', '=', token)
        .executeTakeFirstOrThrow();
      expect(persisted.role_id).not.toBeNull();
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
    'rejects invite creation when the organization system role is missing',
    async ({ deps, org }) => {
      await deps.KyselyPg.deleteFrom('public.role_permissions')
        .where(
          'role_id',
          'in',
          deps.KyselyPg.selectFrom('public.roles')
            .select('id')
            .where('org_id', '=', org.id)
            .where('key', '=', UserRole.ANALYST),
        )
        .execute();
      await deps.KyselyPg.deleteFrom('public.roles')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ANALYST)
        .execute();

      await expect(
        deps.UserManagementService.createInviteUserToken({
          email: faker.internet.email(),
          role: UserRole.ANALYST,
          orgId: org.id,
        }),
      ).rejects.toThrow();
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
      const adminRole = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .executeTakeFirstOrThrow();
      await deps.KyselyPg.insertInto('public.users')
        .values({
          id: userId,
          org_id: org.id,
          email: faker.internet.email(),
          first_name: 'Role',
          last_name: 'User',
          role_id: adminRole.id,
          login_methods: ['saml'],
          password: null,
          approved_by_admin: true,
          rejected_by_admin: false,
        })
        .execute();

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

      const analystRole = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ANALYST)
        .executeTakeFirstOrThrow();
      const persistedUser = await deps.KyselyPg.selectFrom('public.users')
        .select('role_id')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      expect(persistedUser.role_id).toBe(analystRole.id);

      await expect(
        deps.UserManagementService.getUsersForOrg(org.id),
      ).resolves.toEqual([
        expect.objectContaining({ id: userId, role: UserRole.ANALYST }),
      ]);
    },
  );

  testWithFixture(
    'rejects role updates when the organization system role is missing',
    async ({ deps, org }) => {
      const userId = uid();
      const adminRole = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .executeTakeFirstOrThrow();
      await deps.KyselyPg.insertInto('public.users')
        .values({
          id: userId,
          org_id: org.id,
          email: faker.internet.email(),
          first_name: 'Existing',
          last_name: 'User',
          role_id: adminRole.id,
          login_methods: ['saml'],
          password: null,
          approved_by_admin: true,
          rejected_by_admin: false,
        })
        .execute();
      await deps.KyselyPg.deleteFrom('public.role_permissions')
        .where(
          'role_id',
          'in',
          deps.KyselyPg.selectFrom('public.roles')
            .select('id')
            .where('org_id', '=', org.id)
            .where('key', '=', UserRole.ANALYST),
        )
        .execute();
      await deps.KyselyPg.deleteFrom('public.roles')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ANALYST)
        .execute();

      await expect(
        deps.UserManagementService.updateUserRole({
          userId,
          newRole: UserRole.ANALYST,
          orgId: org.id,
          invoker: {
            userId: uid(),
            orgId: org.id,
            permissions: [UserPermission.MANAGE_USERS],
          },
        }),
      ).rejects.toThrow();

      const persistedUser = await deps.KyselyPg.selectFrom('public.users')
        .select('role_id')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      expect(persistedUser.role_id).toBe(adminRole.id);
    },
  );
});
