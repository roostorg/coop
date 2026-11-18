import {
  getPermissionGroups,
  getPermissionsForRole,
  SystemRoleDefaults,
  UserPermission,
  UserRole,
  type PermissionGroup,
} from '../../services/userManagementService/index.js';
import {
  type PrismaPgClient,
  type PrismaPgQueryable,
} from '../../storage/prisma/index.js';
import { makePrismaTransactionWithRetry } from '../../utils/prismaTransactionWithRetry.js';

/** Inserts any missing system roles and their initial permissions for an org. */
export async function seedSystemRolesForOrg(
  prisma: PrismaPgClient,
  orgId: string,
): Promise<void> {
  await makePrismaTransactionWithRetry(prisma)(async (tx) => {
    // ON CONFLICT DO NOTHING ... RETURNING: only newly inserted roles come back.
    const insertedRoles = await tx.roles.createManyAndReturn({
      data: Object.values(UserRole).map((roleKey) => ({
        org_id: orgId,
        key: roleKey,
        display_name: SystemRoleDefaults[roleKey].displayName,
        description: SystemRoleDefaults[roleKey].description,
        is_system: true,
      })),
      skipDuplicates: true,
      select: { id: true, key: true },
    });

    const permissions = insertedRoles.flatMap(({ id, key }) =>
      // `key` is one of the `UserRole` values inserted above.
      getPermissionsForRole(key as UserRole).map((permission) => ({
        role_id: id,
        permission,
      })),
    );
    if (permissions.length > 0) {
      await tx.role_permissions.createMany({ data: permissions });
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

const ROLE_ROW_SELECT = {
  id: true,
  key: true,
  display_name: true,
  description: true,
  is_system: true,
} as const;

/** Lists every persisted system role for an org. */
export async function kyselyListRolesForOrg(
  prisma: PrismaPgQueryable,
  orgId: string,
): Promise<RoleParent[]> {
  const persistedRows: ReadonlyArray<RoleRow> = await prisma.roles.findMany({
    select: ROLE_ROW_SELECT,
    where: { org_id: orgId, is_system: true },
  });

  const persistedIds = persistedRows.map((r) => r.id);

  const permissionRows: ReadonlyArray<{
    role_id: string;
    permission: string;
  }> =
    persistedIds.length === 0
      ? []
      : await prisma.role_permissions.findMany({
          select: { role_id: true, permission: true },
          where: { role_id: { in: persistedIds } },
        });

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

  const userCountRows = await countApprovedUsersByRole(prisma, orgId);
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
  prisma: PrismaPgQueryable,
  orgId: string,
): Promise<ReadonlyArray<{ roleId: string; count: number }>> {
  // Grouping users by `role_id` with a relation filter on the role's org is
  // equivalent to users JOIN roles ON (id, org_id) ... GROUP BY roles.id.
  const rows = await prisma.users.groupBy({
    by: ['role_id'],
    where: {
      org_id: orgId,
      rejected_by_admin: false,
      roles: { org_id: orgId },
    },
    _count: { _all: true },
  });
  return rows.map((r) => ({ roleId: r.role_id, count: r._count._all }));
}

/**
 * Atomically replaces the permission set for `(orgId, roleKey)`.
 */
export async function kyselyUpdateRolePermissions(
  prisma: PrismaPgClient,
  opts: {
    orgId: string;
    roleKey: UserRole;
    permissions: readonly UserPermission[];
  },
): Promise<RoleParent> {
  const { orgId, roleKey, permissions } = opts;
  return makePrismaTransactionWithRetry(prisma)(async (tx) => {
    const roleId = await getSystemRoleId(tx, { orgId, roleKey });
    await tx.role_permissions.deleteMany({ where: { role_id: roleId } });
    if (permissions.length > 0) {
      const dedupedPermissions = Array.from(new Set(permissions));
      await tx.role_permissions.createMany({
        data: dedupedPermissions.map((permission) => ({
          role_id: roleId,
          permission,
        })),
      });
    }
    return readRoleAfterWrite(tx, { orgId, roleKey, roleId });
  });
}

/**
 * Renames a role's display name and optionally its description.
 */
export async function kyselyRenameRole(
  prisma: PrismaPgClient,
  opts: {
    orgId: string;
    roleKey: UserRole;
    displayName: string;
    description?: string | null;
  },
): Promise<RoleParent> {
  const { orgId, roleKey, displayName, description } = opts;
  return makePrismaTransactionWithRetry(prisma)(async (tx) => {
    const roleId = await getSystemRoleId(tx, { orgId, roleKey });
    await tx.roles.updateMany({
      data: {
        display_name: displayName,
        ...(description !== undefined ? { description } : {}),
        updated_at: new Date(),
      },
      where: { id: roleId },
    });
    return readRoleAfterWrite(tx, { orgId, roleKey, roleId });
  });
}

export function kyselyGetPermissionGroups(): readonly PermissionGroup[] {
  return getPermissionGroups();
}

async function getSystemRoleId(
  tx: PrismaPgQueryable,
  opts: { orgId: string; roleKey: UserRole },
): Promise<string> {
  const existing = await tx.roles.findFirstOrThrow({
    select: { id: true },
    where: { org_id: opts.orgId, key: opts.roleKey, is_system: true },
  });
  return existing.id;
}

async function readRoleAfterWrite(
  tx: PrismaPgQueryable,
  opts: { orgId: string; roleKey: UserRole; roleId: string },
): Promise<RoleParent> {
  const row = await tx.roles.findUniqueOrThrow({
    select: ROLE_ROW_SELECT,
    where: { id: opts.roleId },
  });
  const permissionRows = await tx.role_permissions.findMany({
    select: { permission: true },
    where: { role_id: opts.roleId },
  });
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
