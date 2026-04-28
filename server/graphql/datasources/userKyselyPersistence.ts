import { type Kysely, sql } from 'kysely';

import {
  getPermissionsForRole,
  type UserPermission,
  type UserRole,
} from '../../models/types/permissioning.js';
import {
  type CoreAppTablesPg,
  type LoginMethod,
} from '../../services/coreAppTables.js';
import {
  validateUserCreateInput,
  validateUserUpdatePatch,
} from './userValidation.js';

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

type UsersDb = Kysely<CoreAppTablesPg>;

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
      return getPermissionsForRole(row.role);
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
      approved_by_admin: opts.approvedByAdmin ?? false,
      rejected_by_admin: opts.rejectedByAdmin ?? false,
      login_methods: [...opts.loginMethods],
      created_at: now,
      updated_at: now,
    })
    .returning(USER_COLUMNS)
    .returning(loginMethodsAsTextArray)
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
