import { type LoginMethod } from '../../services/coreAppTables.js';
import {
  type UserPermission,
  type UserRole,
} from '../../services/userManagementService/index.js';
import { Prisma, type PrismaPgQueryable } from '../../storage/prisma/index.js';
import {
  validateUserCreateInput,
  validateUserUpdatePatch,
} from './userValidation.js';

// Resolves `(orgId, role)` to the matching `public.roles.id` for the
// authoritative `public.users.role_id` assignment.
async function lookupSystemRoleIdForUserRow(
  db: UsersDb,
  opts: { orgId: string; role: UserRole },
): Promise<string> {
  const row = await db.roles.findFirstOrThrow({
    select: { id: true },
    where: { org_id: opts.orgId, key: opts.role, is_system: true },
  });
  return row.id;
}

/**
 * GraphQL `User` parent shape. Mirrors the columns on `public.users` plus a
 * `getPermissions()` helper that resolvers call (e.g. in permission checks
 * and in `UserResolvers.permissions`). Intentionally mirrors the public
 * surface of the now-removed Sequelize `User` instance for a drop-in swap.
 *
 * `password` is included because the Passport local strategy needs it for
 * `passwordMatchesHash`; resolvers must not leak it to clients.
 */
export type GraphQLUserParent = {
  id: string;
  email: string;
  password: string | null;
  firstName: string;
  lastName: string;
  orgId: string;
  role: UserRole;
  approvedByAdmin: boolean;
  rejectedByAdmin: boolean;
  loginMethods: LoginMethod[];
  createdAt: Date;
  updatedAt: Date;
  getPermissions(): UserPermission[];
};

// Accepts the root client or a transaction client so callers inside a
// transaction (e.g. `UserAPI.changePassword`) share it.
export type UsersDb = PrismaPgQueryable;

// `roles.key` and its permissions are loaded through the `role_id` relation in
// the same Prisma query, standing in for the correlated subqueries the user
// row used to carry.
const USER_SELECT = {
  id: true,
  email: true,
  password: true,
  first_name: true,
  last_name: true,
  approved_by_admin: true,
  rejected_by_admin: true,
  created_at: true,
  updated_at: true,
  org_id: true,
  login_methods: true,
  roles: {
    select: { key: true, role_permissions: { select: { permission: true } } },
  },
} satisfies Prisma.usersSelect;

type UserRow = Prisma.usersGetPayload<{ select: typeof USER_SELECT }>;

function rowToGraphQLUserParent(row: UserRow): GraphQLUserParent {
  // Prisma types these strings as plain `string`; the DB holds the same
  // values the old `sql<UserRole>` / `sql<UserPermission[]>` casts asserted.
  const permissions = row.roles.role_permissions.map(
    (p) => p.permission as UserPermission,
  );
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    firstName: row.first_name,
    lastName: row.last_name,
    orgId: row.org_id,
    role: row.roles.key,
    // Nullable in the DB (no NOT NULL constraint), so Prisma types them
    // `boolean | null`; the Kysely types asserted `boolean`.
    approvedByAdmin: row.approved_by_admin as boolean,
    rejectedByAdmin: row.rejected_by_admin as boolean,
    loginMethods: row.login_methods,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    getPermissions() {
      return [...permissions];
    },
  };
}

export async function kyselyUserFindById(
  db: UsersDb,
  id: string,
): Promise<GraphQLUserParent | undefined> {
  const row = await db.users.findFirst({
    select: USER_SELECT,
    where: { id },
  });
  return row === null ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByIdAndOrg(
  db: UsersDb,
  opts: { id: string; orgId: string },
): Promise<GraphQLUserParent | undefined> {
  const row = await db.users.findFirst({
    select: USER_SELECT,
    where: { id: opts.id, org_id: opts.orgId },
  });
  return row === null ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByEmail(
  db: UsersDb,
  email: string,
): Promise<GraphQLUserParent | undefined> {
  const row = await db.users.findFirst({
    select: USER_SELECT,
    where: { email },
  });
  return row === null ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByEmailAndOrg(
  db: UsersDb,
  opts: { email: string; orgId: string },
): Promise<GraphQLUserParent | undefined> {
  const row = await db.users.findFirst({
    select: USER_SELECT,
    where: { email: opts.email, org_id: opts.orgId },
  });
  return row === null ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByIds(
  db: UsersDb,
  ids: readonly string[],
): Promise<GraphQLUserParent[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db.users.findMany({
    select: USER_SELECT,
    where: { id: { in: [...ids] } },
  });
  return rows.map(rowToGraphQLUserParent);
}

export async function kyselyUserListByOrg(
  db: UsersDb,
  orgId: string,
): Promise<GraphQLUserParent[]> {
  const rows = await db.users.findMany({
    select: USER_SELECT,
    where: { org_id: orgId },
  });
  return rows.map(rowToGraphQLUserParent);
}

export async function kyselyUserInsert(opts: {
  db: UsersDb;
  id: string;
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password: string | null;
  loginMethods: readonly LoginMethod[];
  approvedByAdmin?: boolean;
  rejectedByAdmin?: boolean;
}): Promise<GraphQLUserParent> {
  // Defense-in-depth so non-GraphQL callers (fixtures, scripts) can't insert
  // invalid rows; user-facing validation lives in `UserAPI`.
  const validation = validateUserCreateInput({
    email: opts.email,
    firstName: opts.firstName,
    lastName: opts.lastName,
    role: opts.role,
    loginMethods: opts.loginMethods,
    password: opts.password,
  });
  if (!validation.ok) {
    throw new Error(
      `kyselyUserInsert invariant violated: ${validation.failure.field}: ${validation.failure.message}`,
    );
  }

  const roleId = await lookupSystemRoleIdForUserRow(opts.db, {
    orgId: opts.orgId,
    role: opts.role,
  });

  const now = new Date();
  const row = await opts.db.users.create({
    select: USER_SELECT,
    data: {
      id: opts.id,
      org_id: opts.orgId,
      email: opts.email,
      password: opts.password,
      first_name: opts.firstName,
      last_name: opts.lastName,
      role_id: roleId,
      approved_by_admin: opts.approvedByAdmin ?? false,
      rejected_by_admin: opts.rejectedByAdmin ?? false,
      login_methods: [...opts.loginMethods],
      created_at: now,
      updated_at: now,
    },
  });
  return rowToGraphQLUserParent(row);
}

export async function kyselyUserUpdate(
  db: UsersDb,
  userId: string,
  patch: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: UserRole | null;
    password?: string | null;
    approvedByAdmin?: boolean | null;
    rejectedByAdmin?: boolean | null;
  },
): Promise<GraphQLUserParent | undefined> {
  const validation = validateUserUpdatePatch(patch);
  if (!validation.ok) {
    throw new Error(
      `kyselyUserUpdate invariant violated: ${validation.failure.field}: ${validation.failure.message}`,
    );
  }

  // `password` is the only field where `null` is a meaningful set (clears
  // the column); other nullable fields treat `null` as "skip".
  const update: {
    email?: string;
    first_name?: string;
    last_name?: string;
    role_id?: string;
    password?: string | null;
    approved_by_admin?: boolean;
    rejected_by_admin?: boolean;
    updated_at: Date;
  } = { updated_at: new Date() };

  if (patch.email != null) {
    update.email = patch.email;
  }
  if (patch.firstName != null) {
    update.first_name = patch.firstName;
  }
  if (patch.lastName != null) {
    update.last_name = patch.lastName;
  }
  if (patch.role != null) {
    // Resolve the role's org via the user row first; the patch doesn't
    // carry orgId, and roles are scoped per org.
    const userOrg = await db.users.findUnique({
      select: { org_id: true },
      where: { id: userId },
    });
    if (userOrg == null) {
      return undefined;
    }
    update.role_id = await lookupSystemRoleIdForUserRow(db, {
      orgId: userOrg.org_id,
      role: patch.role,
    });
  }
  if (patch.password !== undefined) {
    update.password = patch.password;
  }
  if (patch.approvedByAdmin != null) {
    update.approved_by_admin = patch.approvedByAdmin;
  }
  if (patch.rejectedByAdmin != null) {
    update.rejected_by_admin = patch.rejectedByAdmin;
  }

  try {
    const row = await db.users.update({
      select: USER_SELECT,
      data: update,
      where: { id: userId },
    });
    return rowToGraphQLUserParent(row);
  } catch (e) {
    // `update` throws P2025 when no row matches; the contract here is
    // "undefined when the user is missing".
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2025'
    ) {
      return undefined;
    }
    throw e;
  }
}

export async function kyselyUserDeleteById(
  db: UsersDb,
  userId: string,
): Promise<void> {
  await db.users.deleteMany({ where: { id: userId } });
}

/**
 * Favorite rules join-table helpers. The Sequelize association used the
 * auto-generated `users_and_favorite_rules` join table; preserving that
 * exact schema means existing rows keep working during/after the cutover.
 */

export async function kyselyUserListFavoriteRuleIds(
  db: UsersDb,
  userId: string,
): Promise<string[]> {
  const rows = await db.users_and_favorite_rules.findMany({
    select: { rule_id: true },
    where: { user_id: userId },
  });
  return rows.map((r) => r.rule_id);
}

export async function kyselyUserAddFavoriteRule(
  db: UsersDb,
  userId: string,
  ruleId: string,
): Promise<void> {
  // `skipDuplicates` (ON CONFLICT DO NOTHING) matches Sequelize's
  // `addFavoriteRules` semantics when a favorite already exists (the
  // composite PK on (user_id, rule_id) is what de-duplicates).
  const now = new Date();
  await db.users_and_favorite_rules.createMany({
    data: { user_id: userId, rule_id: ruleId, updated_at: now },
    skipDuplicates: true,
  });
}

export async function kyselyUserRemoveFavoriteRule(
  db: UsersDb,
  userId: string,
  ruleId: string,
): Promise<void> {
  await db.users_and_favorite_rules.deleteMany({
    where: { user_id: userId, rule_id: ruleId },
  });
}
