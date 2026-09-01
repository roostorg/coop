import { type Kysely } from 'kysely';

import { type CombinedPg } from '../../services/combinedDbTypes.js';
import {
  getPermissionGroups,
  getPermissionsForRole,
  SystemRoleDefaults,
  UserPermission,
  UserRole,
  type PermissionGroup,
} from '../../services/userManagementService/index.js';
import { makeKyselyTransactionWithRetry } from '../../utils/kyselyTransactionWithRetry.js';

type RolesKysely = Kysely<CombinedPg>;

/** Inserts any missing system roles and their initial permissions for an org. */
export async function seedSystemRolesForOrg(
  kysely: RolesKysely,
  orgId: string,
): Promise<void> {
  await makeKyselyTransactionWithRetry(kysely)(async (tx) => {
    const insertedRoles = await tx
      .insertInto('public.roles')
      .values(
        Object.values(UserRole).map((roleKey) => ({
          org_id: orgId,
          key: roleKey,
          display_name: SystemRoleDefaults[roleKey].displayName,
          description: SystemRoleDefaults[roleKey].description,
          is_system: true,
        })),
      )
      .onConflict((oc) => oc.columns(['org_id', 'key']).doNothing())
      .returning(['id', 'key'])
      .execute();

    const permissions = insertedRoles.flatMap(({ id, key }) =>
      getPermissionsForRole(key).map((permission) => ({
        role_id: id,
        permission,
      })),
    );
    if (permissions.length > 0) {
      await tx
        .insertInto('public.role_permissions')
        .values(permissions)
        .execute();
    }
  });
}

/** GraphQL `Role` parent shape returned to the role-editor UI. */
export type RoleParent = {
  id: string;
  key: UserRole;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  permissions: UserPermission[];
  /** Approved (non-rejected) users in the org assigned to this role. */
  userCount: number;
};

type RoleRow = {
  id: string;
  key: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
};

/** Lists every persisted system role for an org. */
export async function kyselyListRolesForOrg(
  kysely: RolesKysely,
  orgId: string,
): Promise<RoleParent[]> {
  const persistedRows: ReadonlyArray<RoleRow> = await kysely
    .selectFrom('public.roles')
    .select(['id', 'key', 'display_name', 'description', 'is_system'])
    .where('org_id', '=', orgId)
    .where('is_system', '=', true)
    .execute();

  const persistedIds = persistedRows.map((r) => r.id);

  const permissionRows: ReadonlyArray<{
    role_id: string;
    permission: string;
  }> =
    persistedIds.length === 0
      ? []
      : await kysely
          .selectFrom('public.role_permissions')
          .select(['role_id', 'permission'])
          .where('role_id', 'in', persistedIds)
          .execute();

  const permissionsByRoleId = new Map<string, UserPermission[]>();
  for (const row of permissionRows) {
    if (!isUserPermission(row.permission)) {
      continue;
    }
    const arr = permissionsByRoleId.get(row.role_id) ?? [];
    arr.push(row.permission);
    permissionsByRoleId.set(row.role_id, arr);
  }

  const persistedByKey = new Map<string, RoleRow>();
  for (const row of persistedRows) {
    persistedByKey.set(row.key, row);
  }

  for (const roleKey of Object.values(UserRole)) {
    if (!persistedByKey.has(roleKey)) {
      throw new Error(`Missing persisted system role: ${roleKey}`);
    }
  }

  const userCountRows = await countApprovedUsersByRole(kysely, orgId);
  const userCountsByRole = new Map<string, number>();
  for (const r of userCountRows) {
    userCountsByRole.set(r.roleId, r.count);
  }

  return Object.values(UserRole).map((roleKey) => {
    const row = persistedByKey.get(roleKey)!;
    return {
      id: row.id,
      key: roleKey,
      displayName: row.display_name,
      description: row.description,
      isSystem: row.is_system,
      permissions: permissionsByRoleId.get(row.id) ?? [],
      userCount: userCountsByRole.get(row.id) ?? 0,
    };
  });
}

async function countApprovedUsersByRole(
  kysely: RolesKysely,
  orgId: string,
): Promise<ReadonlyArray<{ roleId: string; count: number }>> {
  const rows = await kysely
    .selectFrom('public.users as users')
    .innerJoin('public.roles as roles', (join) =>
      join
        .onRef('roles.id', '=', 'users.role_id')
        .onRef('roles.org_id', '=', 'users.org_id'),
    )
    .select((eb) => [
      'roles.id as roleId',
      eb.fn.countAll<string>().as('count'),
    ])
    .where('users.org_id', '=', orgId)
    .where('roles.org_id', '=', orgId)
    .where('users.approved_by_admin', '=', true)
    .where('users.rejected_by_admin', '=', false)
    .groupBy('roles.id')
    .execute();
  return rows.map((r) => ({ roleId: r.roleId, count: Number(r.count) }));
}

/**
 * Atomically replaces the permission set for `(orgId, roleKey)`.
 */
export async function kyselyUpdateRolePermissions(
  kysely: RolesKysely,
  opts: {
    orgId: string;
    roleKey: UserRole;
    permissions: readonly UserPermission[];
  },
): Promise<RoleParent> {
  const { orgId, roleKey, permissions } = opts;
  return makeKyselyTransactionWithRetry(kysely)(async (tx) => {
    const roleId = await getSystemRoleId(tx, { orgId, roleKey });
    await tx
      .deleteFrom('public.role_permissions')
      .where('role_id', '=', roleId)
      .execute();
    if (permissions.length > 0) {
      const dedupedPermissions = Array.from(new Set(permissions));
      await tx
        .insertInto('public.role_permissions')
        .values(
          dedupedPermissions.map((permission) => ({
            role_id: roleId,
            permission,
          })),
        )
        .execute();
    }
    return readRoleAfterWrite(tx, { orgId, roleKey, roleId });
  });
}

/**
 * Renames a role's display name and optionally its description.
 */
export async function kyselyRenameRole(
  kysely: RolesKysely,
  opts: {
    orgId: string;
    roleKey: UserRole;
    displayName: string;
    description?: string | null;
  },
): Promise<RoleParent> {
  const { orgId, roleKey, displayName, description } = opts;
  return makeKyselyTransactionWithRetry(kysely)(async (tx) => {
    const roleId = await getSystemRoleId(tx, { orgId, roleKey });
    await tx
      .updateTable('public.roles')
      .set({
        display_name: displayName,
        ...(description !== undefined ? { description } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', roleId)
      .execute();
    return readRoleAfterWrite(tx, { orgId, roleKey, roleId });
  });
}

export function kyselyGetPermissionGroups(): readonly PermissionGroup[] {
  return getPermissionGroups();
}

async function getSystemRoleId(
  tx: RolesKysely,
  opts: { orgId: string; roleKey: UserRole },
): Promise<string> {
  const existing = await tx
    .selectFrom('public.roles')
    .select('id')
    .where('org_id', '=', opts.orgId)
    .where('key', '=', opts.roleKey)
    .where('is_system', '=', true)
    .executeTakeFirstOrThrow();
  return existing.id;
}

async function readRoleAfterWrite(
  tx: RolesKysely,
  opts: { orgId: string; roleKey: UserRole; roleId: string },
): Promise<RoleParent> {
  const row = await tx
    .selectFrom('public.roles')
    .select(['id', 'key', 'display_name', 'description', 'is_system'])
    .where('id', '=', opts.roleId)
    .executeTakeFirstOrThrow();
  const permissionRows = await tx
    .selectFrom('public.role_permissions')
    .select('permission')
    .where('role_id', '=', opts.roleId)
    .execute();
  const permissions = permissionRows
    .map((p) => p.permission)
    .filter(isUserPermission);
  const counts = await countApprovedUsersByRole(tx, opts.orgId);
  const userCount = counts.find((c) => c.roleId === opts.roleId)?.count ?? 0;
  return {
    id: row.id,
    key: opts.roleKey,
    displayName: row.display_name,
    description: row.description,
    isSystem: row.is_system,
    permissions,
    userCount,
  };
}

function isUserPermission(value: string): value is UserPermission {
  return (Object.values(UserPermission) as string[]).includes(value);
}
