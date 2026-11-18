import { and, asc, eq } from 'drizzle-orm';
import { uid } from 'uid';

import {
  getPermissionsForRole,
  SystemRoleDefaults,
  UserRole,
} from '../../services/userManagementService/index.js';
import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import {
  kyselyListRolesForOrg,
  kyselyRenameRole,
  kyselyUpdateRolePermissions,
  seedSystemRolesForOrg,
} from './rolePersistence.js';
import { kyselyUserInsert } from './userKyselyPersistence.js';

const { roles: rolesTable, rolePermissions, users, inviteUserTokens } = schema;

describe('seedSystemRolesForOrg', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        DrizzlePg: deps.DrizzlePg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    const roles = await deps.DrizzlePg.select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.orgId, org.id));
    expect(roles).toEqual([]);
    return { org };
  });

  testWithFixture(
    'persists every system role for a fresh organization',
    async ({ deps, org }) => {
      await seedSystemRolesForOrg(deps.DrizzlePg, org.id);

      const roles = await deps.DrizzlePg.select({ key: rolesTable.key })
        .from(rolesTable)
        .where(eq(rolesTable.orgId, org.id));
      expect(roles.map(({ key }) => key).sort()).toEqual(
        Object.values(UserRole).sort(),
      );
    },
  );

  testWithFixture(
    'links a subsequently inserted admin user to the persisted admin role',
    async ({ deps, org }) => {
      await seedSystemRolesForOrg(deps.DrizzlePg, org.id);
      const userId = uid();
      await kyselyUserInsert({
        db: deps.DrizzlePg,
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

      const [user] = await deps.DrizzlePg.select({ roleId: users.roleId })
        .from(users)
        .where(eq(users.id, userId));
      const [adminRole] = await deps.DrizzlePg.select({ id: rolesTable.id })
        .from(rolesTable)
        .where(
          and(eq(rolesTable.orgId, org.id), eq(rolesTable.key, UserRole.ADMIN)),
        );

      expect(user.roleId).not.toBeNull();
      expect(user.roleId).toBe(adminRole.id);
    },
  );

  testWithFixture(
    'persists default metadata and permissions for each role',
    async ({ deps, org }) => {
      await seedSystemRolesForOrg(deps.DrizzlePg, org.id);

      const roles = await deps.DrizzlePg.select()
        .from(rolesTable)
        .where(eq(rolesTable.orgId, org.id));
      for (const roleKey of Object.values(UserRole)) {
        const role = roles.find(({ key }) => key === roleKey);
        expect(role).toMatchObject({
          key: roleKey,
          displayName: SystemRoleDefaults[roleKey].displayName,
          description: SystemRoleDefaults[roleKey].description,
          isSystem: true,
        });
        const permissions = await deps.DrizzlePg.select({
          permission: rolePermissions.permission,
        })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, role!.id));
        expect(permissions.map(({ permission }) => permission).sort()).toEqual(
          [...getPermissionsForRole(roleKey)].sort(),
        );
      }
    },
  );

  testWithFixture(
    'preserves an existing role while inserting missing roles',
    async ({ deps, org }) => {
      const [admin] = await deps.DrizzlePg.insert(rolesTable)
        .values({
          orgId: org.id,
          key: UserRole.ADMIN,
          displayName: 'Edited admin',
          description: 'Custom description',
          isSystem: true,
        })
        .returning({ id: rolesTable.id });
      await deps.DrizzlePg.insert(rolePermissions).values({
        roleId: admin.id,
        permission: 'MANAGE_ORG',
      });

      await seedSystemRolesForOrg(deps.DrizzlePg, org.id);

      const roles = await deps.DrizzlePg.select({
        id: rolesTable.id,
        key: rolesTable.key,
        displayName: rolesTable.displayName,
        description: rolesTable.description,
      })
        .from(rolesTable)
        .where(eq(rolesTable.orgId, org.id));
      expect(roles).toHaveLength(Object.values(UserRole).length);
      expect(roles.find(({ key }) => key === UserRole.ADMIN)).toEqual({
        id: admin.id,
        key: UserRole.ADMIN,
        displayName: 'Edited admin',
        description: 'Custom description',
      });
      const adminPermissions = await deps.DrizzlePg.select({
        permission: rolePermissions.permission,
      })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, admin.id));
      expect(adminPermissions).toEqual([{ permission: 'MANAGE_ORG' }]);
      for (const roleKey of Object.values(UserRole).filter(
        (key) => key !== UserRole.ADMIN,
      )) {
        const role = roles.find(({ key }) => key === roleKey)!;
        const permissions = await deps.DrizzlePg.select({
          permission: rolePermissions.permission,
        })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, role.id));
        expect(permissions.map(({ permission }) => permission).sort()).toEqual(
          [...getPermissionsForRole(roleKey)].sort(),
        );
      }
    },
  );

  testWithFixture('is a no-op when invoked again', async ({ deps, org }) => {
    await seedSystemRolesForOrg(deps.DrizzlePg, org.id);
    const readState = async () => ({
      roles: await deps.DrizzlePg.select()
        .from(rolesTable)
        .where(eq(rolesTable.orgId, org.id))
        .orderBy(asc(rolesTable.key)),
      permissions: await deps.DrizzlePg.select({
        roleId: rolePermissions.roleId,
        permission: rolePermissions.permission,
      })
        .from(rolePermissions)
        .innerJoin(rolesTable, eq(rolesTable.id, rolePermissions.roleId))
        .where(eq(rolesTable.orgId, org.id))
        .orderBy(asc(rolePermissions.roleId), asc(rolePermissions.permission)),
    });
    const before = await readState();

    await seedSystemRolesForOrg(deps.DrizzlePg, org.id);

    expect(await readState()).toEqual(before);
  });
});

describe('role persistence', () => {
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
    'lists roles in canonical order with their metadata and permissions',
    async ({ deps, org }) => {
      const [admin] = await deps.DrizzlePg.select({ id: rolesTable.id })
        .from(rolesTable)
        .where(
          and(eq(rolesTable.orgId, org.id), eq(rolesTable.key, UserRole.ADMIN)),
        );
      await deps.DrizzlePg.update(rolesTable)
        .set({
          displayName: 'Persisted administrator',
          description: 'Persisted description',
        })
        .where(eq(rolesTable.id, admin.id));
      await deps.DrizzlePg.delete(rolePermissions).where(
        eq(rolePermissions.roleId, admin.id),
      );
      await deps.DrizzlePg.insert(rolePermissions).values({
        roleId: admin.id,
        permission: 'MANAGE_ORG',
      });
      await deps.DrizzlePg.insert(rolesTable).values({
        orgId: org.id,
        key: 'UNKNOWN_ROLE',
        displayName: 'Unknown role',
        description: null,
        isSystem: true,
      });

      const roles = await kyselyListRolesForOrg(deps.DrizzlePg, org.id);

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
    'counts approved and pending non-rejected users by their persisted role ID',
    async ({ deps, org }) => {
      const insertUser = async (
        role: UserRole,
        approvedByAdmin: boolean,
        rejectedByAdmin: boolean,
      ) =>
        kyselyUserInsert({
          db: deps.DrizzlePg,
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

      const roles = await kyselyListRolesForOrg(deps.DrizzlePg, org.id);

      expect(roles.find(({ key }) => key === UserRole.ADMIN)?.userCount).toBe(
        1,
      );
      expect(
        roles.find(({ key }) => key === UserRole.MODERATOR)?.userCount,
      ).toBe(1);
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
        db: deps.DrizzlePg,
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
      const [adminRole] = await deps.DrizzlePg.select({ id: rolesTable.id })
        .from(rolesTable)
        .where(
          and(eq(rolesTable.orgId, org.id), eq(rolesTable.key, UserRole.ADMIN)),
        );
      const [inviteId] = await deps.DrizzlePg.insert(inviteUserTokens)
        .values({
          token: uid(),
          email: `${uid()}@example.com`,
          roleId: adminRole.id,
          orgId: org.id,
        })
        .returning({ id: inviteUserTokens.id });

      const renamed = await kyselyRenameRole(deps.DrizzlePg, {
        orgId: org.id,
        roleKey: UserRole.ADMIN,
        displayName: 'Organization owner',
      });
      const updated = await kyselyUpdateRolePermissions(deps.DrizzlePg, {
        orgId: org.id,
        roleKey: UserRole.ADMIN,
        permissions: [],
      });

      expect(renamed.userCount).toBe(1);
      expect(updated.userCount).toBe(1);
      expect(updated.permissions).toEqual([]);
      expect(
        await deps.DrizzlePg.select({ roleId: users.roleId })
          .from(users)
          .where(eq(users.id, userId)),
      ).toEqual([{ roleId: adminRole.id }]);
      expect(
        await deps.DrizzlePg.select({ roleId: inviteUserTokens.roleId })
          .from(inviteUserTokens)
          .where(eq(inviteUserTokens.id, inviteId.id)),
      ).toEqual([{ roleId: adminRole.id }]);
    },
  );
});
