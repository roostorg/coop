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

type RolesKysely = Kysely<CombinedPg>;

/**
 * GraphQL `Role` parent shape returned to the role-editor UI. `id` is the
 * `public.roles.id` UUID when the org has a persisted row, otherwise `null`
 * (the row is materialized lazily on first save). `key` matches a
 * {@link UserRole} value and is the stable identifier the client sends back
 * on mutations.
 */
export type RoleParent = {
  id: string | null;
  key: UserRole;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  permissions: UserPermission[];
  /** True when this role is materialized from {@link SystemRoleDefaults} */
  /** plus {@link UserPermissionsForRole} rather than `public.roles`. */
  isFallback: boolean;
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

/**
 * Lists every system role for an org, merging persisted rows with the
 * static defaults so freshly created orgs (which haven't been seeded by
 * the role migration) still surface a complete role list. Permissions for
 * persisted rows come from `public.role_permissions`; missing rows fall
 * back to {@link UserPermissionsForRole}.
 */
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

  const persistedIds = persistedRows
    .filter((r): r is RoleRow & { id: string } => Boolean(r.id))
    .map((r) => r.id);

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

  // Count by legacy `role` string to cover users predating the role_id backfill.
  const userCountRows = await countApprovedUsersByRole(kysely, orgId);
  const userCountsByRole = new Map<string, number>();
  for (const r of userCountRows) {
    userCountsByRole.set(r.role, r.count);
  }

  return Object.values(UserRole).map((roleKey) => {
    const row = persistedByKey.get(roleKey);
    const defaults = SystemRoleDefaults[roleKey];
    const userCount = userCountsByRole.get(roleKey) ?? 0;
    if (row !== undefined) {
      // Persisted rows are authoritative; an empty set is a valid saved state.
      return {
        id: row.id,
        key: roleKey,
        displayName: row.display_name,
        description: row.description,
        isSystem: row.is_system,
        permissions: permissionsByRoleId.get(row.id) ?? [],
        isFallback: false,
        userCount,
      };
    }
    return {
      id: null,
      key: roleKey,
      displayName: defaults.displayName,
      description: defaults.description,
      isSystem: true,
      permissions: getPermissionsForRole(roleKey),
      isFallback: true,
      userCount,
    };
  });
}

async function countApprovedUsersByRole(
  kysely: RolesKysely,
  orgId: string,
): Promise<ReadonlyArray<{ role: string; count: number }>> {
  const rows = await kysely
    .selectFrom('public.users')
    .select((eb) => ['role', eb.fn.countAll<string>().as('count')])
    .where('org_id', '=', orgId)
    .where('rejected_by_admin', '=', false)
    .where('role', 'is not', null)
    .groupBy('role')
    .execute();
  return rows
    .filter((r): r is { role: string; count: string } => r.role != null)
    .map((r) => ({ role: r.role, count: Number(r.count) }));
}

/**
 * Atomically replaces the permission set for `(orgId, roleKey)`. Materializes
 * the `public.roles` row on first save and backfills `role_id` on existing
 * users/invites so the next load picks up the persisted permissions.
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
  return kysely.transaction().execute(async (tx) => {
    const roleId = await ensureSystemRoleRow(tx, { orgId, roleKey });
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
 * Materializes the `public.roles` row on first save.
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
  return kysely.transaction().execute(async (tx) => {
    const roleId = await ensureSystemRoleRow(tx, { orgId, roleKey });
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

async function ensureSystemRoleRow(
  tx: RolesKysely,
  opts: { orgId: string; roleKey: UserRole },
): Promise<string> {
  const existing = await tx
    .selectFrom('public.roles')
    .select('id')
    .where('org_id', '=', opts.orgId)
    .where('key', '=', opts.roleKey)
    .where('is_system', '=', true)
    .executeTakeFirst();
  if (existing !== undefined) {
    return existing.id;
  }

  const defaults = SystemRoleDefaults[opts.roleKey];
  const inserted = await tx
    .insertInto('public.roles')
    .values({
      org_id: opts.orgId,
      key: opts.roleKey,
      display_name: defaults.displayName,
      description: defaults.description,
      is_system: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  // Seed permissions from the static defaults so a freshly materialized
  // row never looks like an "explicitly empty" set to readers. Callers that
  // overwrite permissions (e.g. kyselyUpdateRolePermissions) delete these
  // before inserting their own.
  const seededPermissions = Array.from(
    new Set(getPermissionsForRole(opts.roleKey)),
  );
  if (seededPermissions.length > 0) {
    await tx
      .insertInto('public.role_permissions')
      .values(
        seededPermissions.map((permission) => ({
          role_id: inserted.id,
          permission,
        })),
      )
      .execute();
  }

  // Backfill role_id on rows where it's NULL; don't stomp existing links.
  await tx
    .updateTable('public.users')
    .set({ role_id: inserted.id })
    .where('org_id', '=', opts.orgId)
    .where('role', '=', opts.roleKey)
    .where('role_id', 'is', null)
    .execute();
  await tx
    .updateTable('public.invite_user_tokens')
    .set({ role_id: inserted.id })
    .where('org_id', '=', opts.orgId)
    .where('role', '=', opts.roleKey)
    .where('role_id', 'is', null)
    .execute();

  return inserted.id;
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
  const userCount = counts.find((c) => c.role === opts.roleKey)?.count ?? 0;
  return {
    id: row.id,
    key: opts.roleKey,
    displayName: row.display_name,
    description: row.description,
    isSystem: row.is_system,
    permissions,
    isFallback: false,
    userCount,
  };
}

function isUserPermission(value: string): value is UserPermission {
  return (Object.values(UserPermission) as string[]).includes(value);
}
