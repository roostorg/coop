import { sql, type Kysely } from 'kysely';

import { type CombinedPg } from '../../services/combinedDbTypes.js';
import { type LoginMethod } from '../../services/coreAppTables.js';
import {
  getPermissionsForRole,
  type UserPermission,
  type UserRole,
} from '../../services/userManagementService/index.js';
import {
  validateUserCreateInput,
  validateUserUpdatePatch,
} from './userValidation.js';

// Resolves `(orgId, role)` to the matching `public.roles.id` so writes to
// `public.users` / `public.invite_user_tokens` keep `role_id` in sync with
// the legacy `role` varchar. Returns `null` for orgs without seeded role
// rows; the read fallback handles them.
async function lookupSystemRoleIdForUserRow(
  db: UsersDb,
  opts: { orgId: string; role: UserRole },
): Promise<string | null> {
  const row = await db
    .selectFrom('public.roles')
    .select('id')
    .where('org_id', '=', opts.orgId)
    .where('key', '=', opts.role)
    .where('is_system', '=', true)
    .executeTakeFirst();
  return row?.id ?? null;
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

// Aligns with `ruleKyselyPersistence.ts`: persistence helpers operate on the
// full app schema. Lets fixtures and `kyselyCreateRule` callers share a single
// `Kysely<CombinedPg>` handle without running into Kysely's invariant generic.
type UsersDb = Kysely<CombinedPg>;

type UserRow = {
  id: string;
  email: string;
  password: string | null;
  first_name: string;
  last_name: string;
  role: UserRole;
  approved_by_admin: boolean;
  rejected_by_admin: boolean;
  login_methods: LoginMethod[];
  created_at: Date;
  updated_at: Date;
  org_id: string;
  permissions: UserPermission[] | null;
};

// `public.users.login_methods` is a `login_method_enum[]`. Node-postgres ships
// parsers for built-in array types (`text[]`, `int[]`, etc.) but not for
// user-defined enum arrays, so without an explicit cast we get the raw
// `"{password,saml}"` string back and GraphQL fails with
// "Expected Iterable, but did not find one for field User.loginMethods".
// Casting to `text[]` leans on the stock array parser and keeps the column
// type aligned with our `LoginMethod` union (validated before writes).
const loginMethodsAsTextArray = sql<LoginMethod[]>`login_methods::text[]`.as(
  'login_methods',
);

// Effective permission set as varchar[], inlined in the user-load query
// to avoid a follow-up round-trip. Correlated subquery (rather than LEFT
// JOIN) preserves the existing INSERT/UPDATE...RETURNING shape, which a
// JOIN would break by forcing GROUP BY across every selected column.
//
// NULL when `role_id` is unset (orgs not yet migrated to DB-backed roles
// fall back to `UserPermissionsForRole` defaults). An explicitly empty
// array means the role exists but has no permissions, which is a valid
// least-privilege state we MUST honor — falling back to defaults there
// would silently over-grant permissions.
const permissionsArray = sql<UserPermission[] | null>`(
  CASE
    WHEN public.users.role_id IS NULL THEN NULL
    ELSE (
      SELECT COALESCE(array_agg(rp.permission), ARRAY[]::varchar[])
      FROM public.role_permissions rp
      WHERE rp.role_id = public.users.role_id
    )
  END
)`.as('permissions');

const USER_COLUMNS = [
  'id',
  'email',
  'password',
  'first_name',
  'last_name',
  'role',
  'approved_by_admin',
  'rejected_by_admin',
  'created_at',
  'updated_at',
  'org_id',
] as const;

function rowToGraphQLUserParent(row: UserRow): GraphQLUserParent {
  // DB-backed permissions when the org has them (including an explicit
  // empty set, which means "least privilege" and must NOT escalate to
  // defaults). Only fall back when there's no role_id at all.
  const permissions = row.permissions ?? getPermissionsForRole(row.role);
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    firstName: row.first_name,
    lastName: row.last_name,
    orgId: row.org_id,
    role: row.role,
    approvedByAdmin: row.approved_by_admin,
    rejectedByAdmin: row.rejected_by_admin,
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
  const row = await db
    .selectFrom('public.users')
    .select(USER_COLUMNS)
    .select(loginMethodsAsTextArray)
    .select(permissionsArray)
    .where('id', '=', id)
    .executeTakeFirst();
  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByIdAndOrg(
  db: UsersDb,
  opts: { id: string; orgId: string },
): Promise<GraphQLUserParent | undefined> {
  const row = await db
    .selectFrom('public.users')
    .select(USER_COLUMNS)
    .select(loginMethodsAsTextArray)
    .select(permissionsArray)
    .where('id', '=', opts.id)
    .where('org_id', '=', opts.orgId)
    .executeTakeFirst();
  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByEmail(
  db: UsersDb,
  email: string,
): Promise<GraphQLUserParent | undefined> {
  const row = await db
    .selectFrom('public.users')
    .select(USER_COLUMNS)
    .select(loginMethodsAsTextArray)
    .select(permissionsArray)
    .where('email', '=', email)
    .executeTakeFirst();
  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByIds(
  db: UsersDb,
  ids: readonly string[],
): Promise<GraphQLUserParent[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db
    .selectFrom('public.users')
    .select(USER_COLUMNS)
    .select(loginMethodsAsTextArray)
    .select(permissionsArray)
    .where('id', 'in', ids)
    .execute();
  return rows.map(rowToGraphQLUserParent);
}

export async function kyselyUserListByOrg(
  db: UsersDb,
  orgId: string,
): Promise<GraphQLUserParent[]> {
  const rows = await db
    .selectFrom('public.users')
    .select(USER_COLUMNS)
    .select(loginMethodsAsTextArray)
    .select(permissionsArray)
    .where('org_id', '=', orgId)
    .execute();
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
  const row = await opts.db
    .insertInto('public.users')
    .values({
      id: opts.id,
      org_id: opts.orgId,
      email: opts.email,
      password: opts.password,
      first_name: opts.firstName,
      last_name: opts.lastName,
      role: opts.role,
      role_id: roleId,
      approved_by_admin: opts.approvedByAdmin ?? false,
      rejected_by_admin: opts.rejectedByAdmin ?? false,
      login_methods: [...opts.loginMethods],
      created_at: now,
      updated_at: now,
    })
    .returning(USER_COLUMNS)
    .returning(loginMethodsAsTextArray)
    .returning(permissionsArray)
    .executeTakeFirstOrThrow();
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
    role?: UserRole;
    role_id?: string | null;
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
    update.role = patch.role;
    // Resolve the role's org via the user row first; the patch doesn't
    // carry orgId, and roles are scoped per org.
    const userOrg = await db
      .selectFrom('public.users')
      .select('org_id')
      .where('id', '=', userId)
      .executeTakeFirst();
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

  const row = await db
    .updateTable('public.users')
    .set(update)
    .where('id', '=', userId)
    .returning(USER_COLUMNS)
    .returning(loginMethodsAsTextArray)
    .returning(permissionsArray)
    .executeTakeFirst();

  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserDeleteById(
  db: UsersDb,
  userId: string,
): Promise<void> {
  await db.deleteFrom('public.users').where('id', '=', userId).execute();
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
  const rows = await db
    .selectFrom('public.users_and_favorite_rules')
    .select('rule_id')
    .where('user_id', '=', userId)
    .execute();
  return rows.map((r) => r.rule_id);
}

export async function kyselyUserAddFavoriteRule(
  db: UsersDb,
  userId: string,
  ruleId: string,
): Promise<void> {
  // `onConflict().doNothing()` matches Sequelize's `addFavoriteRules` semantics
  // when a favorite already exists (the composite PK on (user_id, rule_id) is
  // what de-duplicates).
  const now = new Date();
  await db
    .insertInto('public.users_and_favorite_rules')
    .values({
      user_id: userId,
      rule_id: ruleId,
      updated_at: now,
    })
    .onConflict((oc) => oc.columns(['user_id', 'rule_id']).doNothing())
    .execute();
}

export async function kyselyUserRemoveFavoriteRule(
  db: UsersDb,
  userId: string,
  ruleId: string,
): Promise<void> {
  await db
    .deleteFrom('public.users_and_favorite_rules')
    .where('user_id', '=', userId)
    .where('rule_id', '=', ruleId)
    .execute();
}
