import { and, eq, inArray, sql } from 'drizzle-orm';
import { Kysely, sql as kyselySql } from 'kysely';

import { type LoginMethod } from '../../services/coreAppTables.js';
import {
  type UserPermission,
  type UserRole,
} from '../../services/userManagementService/index.js';
import { schema, type CoopDbOrTx } from '../../storage/postgres/drizzle.js';
import {
  validateUserCreateInput,
  validateUserUpdatePatch,
} from './userValidation.js';

const { users, roles, rolePermissions, usersAndFavoriteRules } = schema;

// Resolves `(orgId, role)` to the matching `public.roles.id` for the
// authoritative `public.users.role_id` assignment.
async function lookupSystemRoleIdForUserRow(
  db: UsersDb,
  opts: { orgId: string; role: UserRole },
): Promise<string> {
  const row = (
    await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.orgId, opts.orgId),
          eq(roles.key, opts.role),
          eq(roles.isSystem, true),
        ),
      )
      .limit(1)
  ).at(0);
  if (row === undefined) {
    throw new Error(`No system role ${opts.role} for org ${opts.orgId}`);
  }
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

/** A Drizzle db handle or open transaction. */
export type UsersDb = CoopDbOrTx;

// The role key and effective permission set, inlined as correlated subqueries
// (rather than a JOIN) so the same column list works for SELECT and for
// INSERT/UPDATE ... RETURNING.
const roleKey = sql<UserRole>`(
  SELECT ${roles.key} FROM ${roles} WHERE ${roles.id} = ${users.roleId}
)`;

const permissionsArray = sql<UserPermission[]>`(
  SELECT COALESCE(array_agg(${rolePermissions.permission}), ARRAY[]::varchar[])
  FROM ${rolePermissions}
  WHERE ${rolePermissions.roleId} = ${users.roleId}
)`;

const USER_FIELDS = {
  id: users.id,
  email: users.email,
  password: users.password,
  firstName: users.firstName,
  lastName: users.lastName,
  approvedByAdmin: users.approvedByAdmin,
  rejectedByAdmin: users.rejectedByAdmin,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  orgId: users.orgId,
  role: roleKey,
  // Drizzle parses the `login_method_enum[]` array literal itself (raw
  // node-postgres returns it as a `"{password,saml}"` string).
  loginMethods: users.loginMethods,
  permissions: permissionsArray,
};

type UserRow = {
  id: string;
  email: string;
  password: string | null;
  firstName: string;
  lastName: string;
  approvedByAdmin: boolean | null;
  rejectedByAdmin: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  orgId: string;
  role: UserRole;
  loginMethods: LoginMethod[];
  permissions: UserPermission[];
};

function rowToGraphQLUserParent(row: UserRow): GraphQLUserParent {
  const { permissions, ...rest } = row;
  return {
    ...rest,
    // Both columns default to false; the model types them nullable because
    // they lack a NOT NULL constraint.
    approvedByAdmin: row.approvedByAdmin ?? false,
    rejectedByAdmin: row.rejectedByAdmin ?? false,
    getPermissions() {
      return [...permissions];
    },
  };
}

// `server/api.ts` passes its Kysely handle to `kyselyUserFindById` (passport
// deserializeUser) and, via `resolveSamlUser`, `kyselyUserFindByEmailAndOrg`.
// That file needs human approval to change, so those two keep a Kysely path
// until it passes `DrizzlePg` instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LegacyKysely = Kysely<any>;

async function legacyKyselyUserFind(
  db: LegacyKysely,
  filter: { id: string } | { email: string; orgId: string },
): Promise<GraphQLUserParent | undefined> {
  let query = db
    .selectFrom('public.users')
    .select([
      'id',
      'email',
      'password',
      'first_name as firstName',
      'last_name as lastName',
      'approved_by_admin as approvedByAdmin',
      'rejected_by_admin as rejectedByAdmin',
      'created_at as createdAt',
      'updated_at as updatedAt',
      'org_id as orgId',
    ])
    .select(
      kyselySql<UserRole>`(
        SELECT public.roles.key FROM public.roles
        WHERE public.roles.id = public.users.role_id
      )`.as('role'),
    )
    // node-postgres has no parser for enum arrays; `text[]` it does parse.
    .select(kyselySql<LoginMethod[]>`login_methods::text[]`.as('loginMethods'))
    .select(
      kyselySql<UserPermission[]>`(
        SELECT COALESCE(array_agg(rp.permission), ARRAY[]::varchar[])
        FROM public.role_permissions rp
        WHERE rp.role_id = public.users.role_id
      )`.as('permissions'),
    );
  query =
    'id' in filter
      ? query.where('id', '=', filter.id)
      : query
          .where('email', '=', filter.email)
          .where('org_id', '=', filter.orgId);
  const row: UserRow | undefined = await query.executeTakeFirst();
  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindById(
  db: UsersDb | LegacyKysely,
  id: string,
): Promise<GraphQLUserParent | undefined> {
  if (db instanceof Kysely) {
    return legacyKyselyUserFind(db, { id });
  }
  const row = (
    await db.select(USER_FIELDS).from(users).where(eq(users.id, id)).limit(1)
  ).at(0);
  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByIdAndOrg(
  db: UsersDb,
  opts: { id: string; orgId: string },
): Promise<GraphQLUserParent | undefined> {
  const row = (
    await db
      .select(USER_FIELDS)
      .from(users)
      .where(and(eq(users.id, opts.id), eq(users.orgId, opts.orgId)))
      .limit(1)
  ).at(0);
  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByEmail(
  db: UsersDb,
  email: string,
): Promise<GraphQLUserParent | undefined> {
  const row = (
    await db
      .select(USER_FIELDS)
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
  ).at(0);
  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserFindByEmailAndOrg(
  db: UsersDb | LegacyKysely,
  opts: { email: string; orgId: string },
): Promise<GraphQLUserParent | undefined> {
  if (db instanceof Kysely) {
    return legacyKyselyUserFind(db, opts);
  }
  const row = (
    await db
      .select(USER_FIELDS)
      .from(users)
      .where(and(eq(users.email, opts.email), eq(users.orgId, opts.orgId)))
      .limit(1)
  ).at(0);
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
    .select(USER_FIELDS)
    .from(users)
    .where(inArray(users.id, [...ids]));
  return rows.map(rowToGraphQLUserParent);
}

export async function kyselyUserListByOrg(
  db: UsersDb,
  orgId: string,
): Promise<GraphQLUserParent[]> {
  const rows = await db
    .select(USER_FIELDS)
    .from(users)
    .where(eq(users.orgId, orgId));
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
  const [row] = await opts.db
    .insert(users)
    .values({
      id: opts.id,
      orgId: opts.orgId,
      email: opts.email,
      password: opts.password,
      firstName: opts.firstName,
      lastName: opts.lastName,
      roleId,
      approvedByAdmin: opts.approvedByAdmin ?? false,
      rejectedByAdmin: opts.rejectedByAdmin ?? false,
      loginMethods: [...opts.loginMethods],
      createdAt: now,
      updatedAt: now,
    })
    .returning(USER_FIELDS);
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
  const update: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

  if (patch.email != null) {
    update.email = patch.email;
  }
  if (patch.firstName != null) {
    update.firstName = patch.firstName;
  }
  if (patch.lastName != null) {
    update.lastName = patch.lastName;
  }
  if (patch.role != null) {
    // Resolve the role's org via the user row first; the patch doesn't
    // carry orgId, and roles are scoped per org.
    const userOrg = (
      await db
        .select({ orgId: users.orgId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    ).at(0);
    if (userOrg === undefined) {
      return undefined;
    }
    update.roleId = await lookupSystemRoleIdForUserRow(db, {
      orgId: userOrg.orgId,
      role: patch.role,
    });
  }
  if (patch.password !== undefined) {
    update.password = patch.password;
  }
  if (patch.approvedByAdmin != null) {
    update.approvedByAdmin = patch.approvedByAdmin;
  }
  if (patch.rejectedByAdmin != null) {
    update.rejectedByAdmin = patch.rejectedByAdmin;
  }

  const row = (
    await db
      .update(users)
      .set(update)
      .where(eq(users.id, userId))
      .returning(USER_FIELDS)
  ).at(0);

  return row === undefined ? undefined : rowToGraphQLUserParent(row);
}

export async function kyselyUserDeleteById(
  db: UsersDb,
  userId: string,
): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
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
    .select({ ruleId: usersAndFavoriteRules.ruleId })
    .from(usersAndFavoriteRules)
    .where(eq(usersAndFavoriteRules.userId, userId));
  return rows.map((r) => r.ruleId);
}

export async function kyselyUserAddFavoriteRule(
  db: UsersDb,
  userId: string,
  ruleId: string,
): Promise<void> {
  // `onConflictDoNothing()` matches Sequelize's `addFavoriteRules` semantics
  // when a favorite already exists (the composite PK on (user_id, rule_id) is
  // what de-duplicates).
  await db
    .insert(usersAndFavoriteRules)
    .values({ userId, ruleId, updatedAt: new Date() })
    .onConflictDoNothing({
      target: [usersAndFavoriteRules.userId, usersAndFavoriteRules.ruleId],
    });
}

export async function kyselyUserRemoveFavoriteRule(
  db: UsersDb,
  userId: string,
  ruleId: string,
): Promise<void> {
  await db
    .delete(usersAndFavoriteRules)
    .where(
      and(
        eq(usersAndFavoriteRules.userId, userId),
        eq(usersAndFavoriteRules.ruleId, ruleId),
      ),
    );
}
