import { uid } from 'uid';

import {
  getPermissionsForRole,
  SystemRoleDefaults,
  UserRole,
} from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import {
  kyselyListRolesForOrg,
  kyselyRenameRole,
  kyselyUpdateRolePermissions,
  seedSystemRolesForOrg,
} from './rolePersistence.js';
import { kyselyUserInsert } from './userKyselyPersistence.js';

describe('seedSystemRolesForOrg', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    const roles = await deps.KyselyPg.selectFrom('public.roles')
      .select('id')
      .where('org_id', '=', org.id)
      .execute();
    expect(roles).toEqual([]);
    return { org };
  });

  testWithFixture(
    'persists every system role for a fresh organization',
    async ({ deps, org }) => {
      await seedSystemRolesForOrg(deps.KyselyPg, org.id);

      const roles = await deps.KyselyPg.selectFrom('public.roles')
        .select('key')
        .where('org_id', '=', org.id)
        .execute();
      expect(roles.map(({ key }) => key).sort()).toEqual(
        Object.values(UserRole).sort(),
      );
    },
  );

  testWithFixture(
    'links a subsequently inserted admin user to the persisted admin role',
    async ({ deps, org }) => {
      await seedSystemRolesForOrg(deps.KyselyPg, org.id);
      const userId = uid();
      await kyselyUserInsert({
        db: deps.KyselyPg,
        id: userId,
        orgId: org.id,
        email: `${uid()}@example.com`,
        firstName: 'Org',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        password: null,
        loginMethods: ['saml'],
        approvedByAdmin: true,
      });

      const user = await deps.KyselyPg.selectFrom('public.users')
        .select('role_id')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      const adminRole = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .executeTakeFirstOrThrow();

      expect(user.role_id).not.toBeNull();
      expect(user.role_id).toBe(adminRole.id);
    },
  );

  testWithFixture(
    'persists default metadata and permissions for each role',
    async ({ deps, org }) => {
      await seedSystemRolesForOrg(deps.KyselyPg, org.id);

      const roles = await deps.KyselyPg.selectFrom('public.roles')
        .select(['id', 'key', 'display_name', 'description', 'is_system'])
        .where('org_id', '=', org.id)
        .execute();
      for (const roleKey of Object.values(UserRole)) {
        const role = roles.find(({ key }) => key === roleKey);
        expect(role).toMatchObject({
          key: roleKey,
          display_name: SystemRoleDefaults[roleKey].displayName,
          description: SystemRoleDefaults[roleKey].description,
          is_system: true,
        });
        const permissions = await deps.KyselyPg.selectFrom(
          'public.role_permissions',
        )
          .select('permission')
          .where('role_id', '=', role!.id)
          .execute();
        expect(permissions.map(({ permission }) => permission).sort()).toEqual(
          [...getPermissionsForRole(roleKey)].sort(),
        );
      }
    },
  );

  testWithFixture(
    'preserves an existing role while inserting missing roles',
    async ({ deps, org }) => {
      const admin = await deps.KyselyPg.insertInto('public.roles')
        .values({
          org_id: org.id,
          key: UserRole.ADMIN,
          display_name: 'Edited admin',
          description: 'Custom description',
          is_system: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await deps.KyselyPg.insertInto('public.role_permissions')
        .values({ role_id: admin.id, permission: 'MANAGE_ORG' })
        .execute();

      await seedSystemRolesForOrg(deps.KyselyPg, org.id);

      const roles = await deps.KyselyPg.selectFrom('public.roles')
        .select(['id', 'key', 'display_name', 'description'])
        .where('org_id', '=', org.id)
        .execute();
      expect(roles).toHaveLength(Object.values(UserRole).length);
      expect(roles.find(({ key }) => key === UserRole.ADMIN)).toEqual({
        id: admin.id,
        key: UserRole.ADMIN,
        display_name: 'Edited admin',
        description: 'Custom description',
      });
      const adminPermissions = await deps.KyselyPg.selectFrom(
        'public.role_permissions',
      )
        .select('permission')
        .where('role_id', '=', admin.id)
        .execute();
      expect(adminPermissions).toEqual([{ permission: 'MANAGE_ORG' }]);
      for (const roleKey of Object.values(UserRole).filter(
        (key) => key !== UserRole.ADMIN,
      )) {
        const role = roles.find(({ key }) => key === roleKey)!;
        const permissions = await deps.KyselyPg.selectFrom(
          'public.role_permissions',
        )
          .select('permission')
          .where('role_id', '=', role.id)
          .execute();
        expect(permissions.map(({ permission }) => permission).sort()).toEqual(
          [...getPermissionsForRole(roleKey)].sort(),
        );
      }
    },
  );

  testWithFixture('is a no-op when invoked again', async ({ deps, org }) => {
    await seedSystemRolesForOrg(deps.KyselyPg, org.id);
    const readState = async () => ({
      roles: await deps.KyselyPg.selectFrom('public.roles')
        .selectAll()
        .where('org_id', '=', org.id)
        .orderBy('key')
        .execute(),
      permissions: await deps.KyselyPg.selectFrom('public.role_permissions')
        .innerJoin('public.roles', 'public.roles.id', 'role_id')
        .select(['role_id', 'permission'])
        .where('org_id', '=', org.id)
        .orderBy('role_id')
        .orderBy('permission')
        .execute(),
    });
    const before = await readState();

    await seedSystemRolesForOrg(deps.KyselyPg, org.id);

    expect(await readState()).toEqual(before);
  });
});

describe('role persistence', () => {
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
    'lists persisted roles in canonical order with authoritative metadata, permissions, and IDs',
    async ({ deps, org }) => {
      const admin = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .executeTakeFirstOrThrow();
      await deps.KyselyPg.updateTable('public.roles')
        .set({
          display_name: 'Persisted administrator',
          description: 'Persisted description',
        })
        .where('id', '=', admin.id)
        .execute();
      await deps.KyselyPg.deleteFrom('public.role_permissions')
        .where('role_id', '=', admin.id)
        .execute();
      await deps.KyselyPg.insertInto('public.role_permissions')
        .values({ role_id: admin.id, permission: 'MANAGE_ORG' })
        .execute();
      await deps.KyselyPg.insertInto('public.roles')
        .values({
          org_id: org.id,
          key: 'UNKNOWN_ROLE',
          display_name: 'Unknown role',
          description: null,
          is_system: true,
        })
        .execute();

      const roles = await kyselyListRolesForOrg(deps.KyselyPg, org.id);

      expect(roles.map(({ key }) => key)).toEqual(Object.values(UserRole));
      expect(roles.every(({ id }) => typeof id === 'string')).toBe(true);
      expect(roles.find(({ key }) => key === UserRole.ADMIN)).toMatchObject({
        id: admin.id,
        displayName: 'Persisted administrator',
        description: 'Persisted description',
        permissions: ['MANAGE_ORG'],
      });
    },
  );

  testWithFixture(
    'returns an empty persisted permission set instead of role defaults',
    async ({ deps, org }) => {
      const role = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .executeTakeFirstOrThrow();
      await deps.KyselyPg.deleteFrom('public.role_permissions')
        .where('role_id', '=', role.id)
        .execute();

      const roles = await kyselyListRolesForOrg(deps.KyselyPg, org.id);

      expect(
        roles.find(({ key }) => key === UserRole.ADMIN)?.permissions,
      ).toEqual([]);
    },
  );

  testWithFixture(
    'rejects listing when an expected persisted system role is missing',
    async ({ deps, org }) => {
      await deps.KyselyPg.deleteFrom('public.roles')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .execute();

      await expect(
        kyselyListRolesForOrg(deps.KyselyPg, org.id),
      ).rejects.toThrow();
    },
  );

  testWithFixture(
    'rename rejects a missing role without inserting it',
    async ({ deps, org }) => {
      await deps.KyselyPg.deleteFrom('public.roles')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .execute();

      await expect(
        kyselyRenameRole(deps.KyselyPg, {
          orgId: org.id,
          roleKey: UserRole.ADMIN,
          displayName: 'Renamed admin',
        }),
      ).rejects.toThrow();
      const persisted = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .execute();
      expect(persisted).toEqual([]);
    },
  );

  testWithFixture(
    'permission update rejects a missing role without inserting it',
    async ({ deps, org }) => {
      await deps.KyselyPg.deleteFrom('public.roles')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .execute();

      await expect(
        kyselyUpdateRolePermissions(deps.KyselyPg, {
          orgId: org.id,
          roleKey: UserRole.ADMIN,
          permissions: [],
        }),
      ).rejects.toThrow();
      const persisted = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .execute();
      expect(persisted).toEqual([]);
    },
  );

  testWithFixture(
    'counts only approved, non-rejected users by their persisted role ID',
    async ({ deps, org }) => {
      const insertUser = async (
        role: UserRole,
        approvedByAdmin: boolean,
        rejectedByAdmin: boolean,
      ) =>
        kyselyUserInsert({
          db: deps.KyselyPg,
          id: uid(),
          orgId: org.id,
          email: `${uid()}@example.com`,
          firstName: 'Role',
          lastName: 'Member',
          role,
          password: null,
          loginMethods: ['saml'],
          approvedByAdmin,
          rejectedByAdmin,
        });
      await insertUser(UserRole.ADMIN, true, false);
      await insertUser(UserRole.MODERATOR, false, false);
      await insertUser(UserRole.EXTERNAL_MODERATOR, true, true);

      const roles = await kyselyListRolesForOrg(deps.KyselyPg, org.id);

      expect(roles.find(({ key }) => key === UserRole.ADMIN)?.userCount).toBe(
        1,
      );
      expect(
        roles.find(({ key }) => key === UserRole.MODERATOR)?.userCount,
      ).toBe(0);
      expect(
        roles.find(({ key }) => key === UserRole.EXTERNAL_MODERATOR)?.userCount,
      ).toBe(0);
    },
  );

  testWithFixture(
    'retains assignments and role-ID counts across metadata and permission changes',
    async ({ deps, org }) => {
      const userId = uid();
      await kyselyUserInsert({
        db: deps.KyselyPg,
        id: userId,
        orgId: org.id,
        email: `${uid()}@example.com`,
        firstName: 'Role',
        lastName: 'Member',
        role: UserRole.ADMIN,
        password: null,
        loginMethods: ['saml'],
        approvedByAdmin: true,
      });
      const adminRole = await deps.KyselyPg.selectFrom('public.roles')
        .select('id')
        .where('org_id', '=', org.id)
        .where('key', '=', UserRole.ADMIN)
        .executeTakeFirstOrThrow();
      const inviteId = await deps.KyselyPg.insertInto(
        'public.invite_user_tokens',
      )
        .values({
          token: uid(),
          email: `${uid()}@example.com`,
          role: UserRole.ADMIN,
          role_id: adminRole.id,
          org_id: org.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const renamed = await kyselyRenameRole(deps.KyselyPg, {
        orgId: org.id,
        roleKey: UserRole.ADMIN,
        displayName: 'Organization owner',
      });
      const updated = await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: org.id,
        roleKey: UserRole.ADMIN,
        permissions: [],
      });

      expect(renamed.userCount).toBe(1);
      expect(updated.userCount).toBe(1);
      expect(updated.permissions).toEqual([]);
      expect(
        await deps.KyselyPg.selectFrom('public.users')
          .select('role_id')
          .where('id', '=', userId)
          .executeTakeFirstOrThrow(),
      ).toEqual({ role_id: adminRole.id });
      expect(
        await deps.KyselyPg.selectFrom('public.invite_user_tokens')
          .select('role_id')
          .where('id', '=', inviteId.id)
          .executeTakeFirstOrThrow(),
      ).toEqual({ role_id: adminRole.id });
    },
  );
});
