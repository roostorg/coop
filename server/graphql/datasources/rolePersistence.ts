import { and, count, eq, inArray } from 'drizzle-orm';

import {
  getPermissionGroups,
  getPermissionsForRole,
  SystemRoleDefaults,
  UserPermission,
  UserRole,
  type PermissionGroup,
} from '../../services/userManagementService/index.js';
import {
  schema,
  transactionWithRetry,
  type CoopDb,
  type CoopDbOrTx,
} from '../../storage/postgres/drizzle.js';

const { roles, rolePermissions, users } = schema;

/** Inserts any missing system roles and their initial permissions for an org. */
export async function seedSystemRolesForOrg(
  db: CoopDb,
  orgId: string,
): Promise<void> {
  await transactionWithRetry(db, async (tx) => {
    const insertedRoles = await tx
      .insert(roles)
      .values(
        Object.values(UserRole).map((roleKey) => ({
          orgId,
          key: roleKey,
          displayName: SystemRoleDefaults[roleKey].displayName,
          description: SystemRoleDefaults[roleKey].description,
          isSystem: true,
        })),
      )
      .onConflictDoNothing({ target: [roles.orgId, roles.key] })
      .returning({ id: roles.id, key: roles.key });

    const permissions = insertedRoles.flatMap(({ id, key }) =>
      getPermissionsForRole(key).map((permission) => ({
        roleId: id,
        permission,
      })),
    );
    if (permissions.length > 0) {
      await tx.insert(rolePermissions).values(permissions);
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
  displayName: string;
  description: string | null;
  isSystem: boolean;
};

const ROLE_FIELDS = {
  id: roles.id,
  key: roles.key,
  displayName: roles.displayName,
  description: roles.description,
  isSystem: roles.isSystem,
};

/** Lists every persisted system role for an org. */
export async function kyselyListRolesForOrg(
  db: CoopDbOrTx,
  orgId: string,
): Promise<RoleParent[]> {
  const persistedRows: ReadonlyArray<RoleRow> = await db
    .select(ROLE_FIELDS)
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.isSystem, true)));

  const persistedIds = persistedRows.map((r) => r.id);

  const permissionRows: ReadonlyArray<{
    roleId: string;
    permission: string;
  }> =
    persistedIds.length === 0
      ? []
      : await db
          .select({
            roleId: rolePermissions.roleId,
            permission: rolePermissions.permission,
          })
          .from(rolePermissions)
          .where(inArray(rolePermissions.roleId, persistedIds));

  const permissionsByRoleId = new Map<string, UserPermission[]>();
  for (const row of permissionRows) {
    if (!isUserPermission(row.permission)) {
      continue;
    }
    const arr = permissionsByRoleId.get(row.roleId) ?? [];
    arr.push(row.permission);
    permissionsByRoleId.set(row.roleId, arr);
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

  const userCountRows = await countApprovedUsersByRole(db, orgId);
  const userCountsByRole = new Map<string, number>();
  for (const r of userCountRows) {
    userCountsByRole.set(r.roleId, r.count);
  }

  return Object.values(UserRole).map((roleKey) => {
    const row = persistedByKey.get(roleKey)!;
    return {
      id: row.id,
      key: roleKey,
      displayName: row.displayName,
      description: row.description,
      isSystem: row.isSystem,
      permissions: permissionsByRoleId.get(row.id) ?? [],
      userCount: userCountsByRole.get(row.id) ?? 0,
    };
  });
}

async function countApprovedUsersByRole(
  db: CoopDbOrTx,
  orgId: string,
): Promise<ReadonlyArray<{ roleId: string; count: number }>> {
  // Drizzle's `count()` already maps the bigint result to a number.
  return db
    .select({ roleId: roles.id, count: count() })
    .from(users)
    .innerJoin(
      roles,
      and(eq(roles.id, users.roleId), eq(roles.orgId, users.orgId)),
    )
    .where(
      and(
        eq(users.orgId, orgId),
        eq(roles.orgId, orgId),
        eq(users.rejectedByAdmin, false),
      ),
    )
    .groupBy(roles.id);
}

/**
 * Atomically replaces the permission set for `(orgId, roleKey)`.
 */
export async function kyselyUpdateRolePermissions(
  db: CoopDb,
  opts: {
    orgId: string;
    roleKey: UserRole;
    permissions: readonly UserPermission[];
  },
): Promise<RoleParent> {
  const { orgId, roleKey, permissions } = opts;
  return transactionWithRetry(db, async (tx) => {
    const roleId = await getSystemRoleId(tx, { orgId, roleKey });
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissions.length > 0) {
      const dedupedPermissions = Array.from(new Set(permissions));
      await tx
        .insert(rolePermissions)
        .values(
          dedupedPermissions.map((permission) => ({ roleId, permission })),
        );
    }
    return readRoleAfterWrite(tx, { orgId, roleKey, roleId });
  });
}

/**
 * Renames a role's display name and optionally its description.
 */
export async function kyselyRenameRole(
  db: CoopDb,
  opts: {
    orgId: string;
    roleKey: UserRole;
    displayName: string;
    description?: string | null;
  },
): Promise<RoleParent> {
  const { orgId, roleKey, displayName, description } = opts;
  return transactionWithRetry(db, async (tx) => {
    const roleId = await getSystemRoleId(tx, { orgId, roleKey });
    await tx
      .update(roles)
      .set({
        displayName,
        ...(description !== undefined ? { description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(roles.id, roleId));
    return readRoleAfterWrite(tx, { orgId, roleKey, roleId });
  });
}

export function kyselyGetPermissionGroups(): readonly PermissionGroup[] {
  return getPermissionGroups();
}

async function getSystemRoleId(
  tx: CoopDbOrTx,
  opts: { orgId: string; roleKey: UserRole },
): Promise<string> {
  const existing = (
    await tx
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.orgId, opts.orgId),
          eq(roles.key, opts.roleKey),
          eq(roles.isSystem, true),
        ),
      )
      .limit(1)
  ).at(0);
  if (existing === undefined) {
    throw new Error(`No system role ${opts.roleKey} for org ${opts.orgId}`);
  }
  return existing.id;
}

async function readRoleAfterWrite(
  tx: CoopDbOrTx,
  opts: { orgId: string; roleKey: UserRole; roleId: string },
): Promise<RoleParent> {
  const row = (
    await tx
      .select(ROLE_FIELDS)
      .from(roles)
      .where(eq(roles.id, opts.roleId))
      .limit(1)
  ).at(0);
  if (row === undefined) {
    throw new Error(`Role ${opts.roleId} not found`);
  }
  const permissionRows = await tx
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, opts.roleId));
  const permissions = permissionRows
    .map((p) => p.permission)
    .filter(isUserPermission);
  const counts = await countApprovedUsersByRole(tx, opts.orgId);
  const userCount = counts.find((c) => c.roleId === opts.roleId)?.count ?? 0;
  return {
    id: row.id,
    key: opts.roleKey,
    displayName: row.displayName,
    description: row.description,
    isSystem: row.isSystem,
    permissions,
    userCount,
  };
}

function isUserPermission(value: string): value is UserPermission {
  return (Object.values(UserPermission) as string[]).includes(value);
}
