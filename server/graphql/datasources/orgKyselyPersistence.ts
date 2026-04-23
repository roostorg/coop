import { type Kysely } from 'kysely';

import { type CoreAppTablesPg } from '../../services/coreAppTables.js';

/**
 * GraphQL `Org` parent shape. Field resolvers only read `id` from this; the
 * remaining columns are exposed for callers that need them (e.g. the invite
 * email uses `org.name`). Intentionally mirrors the columns on `public.orgs`
 * that are exposed via GraphQL — no Sequelize associations.
 */
export type GraphQLOrgParent = {
  id: string;
  name: string;
  email: string;
  websiteUrl: string;
  onCallAlertEmail: string | null;
};

/**
 * Functions in this module only touch `public.orgs`; typing the param as
 * `Kysely<CoreAppTablesPg>` lets callers pass either `Dependencies['KyselyPg']`
 * (`Kysely<any>`) or a more specific `Kysely<CombinedPg>` without casting.
 */
type OrgsDb = Kysely<CoreAppTablesPg>;

function rowToGraphQLOrgParent(row: {
  id: string;
  name: string;
  email: string;
  website_url: string;
  on_call_alert_email: string | null;
}): GraphQLOrgParent {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    websiteUrl: row.website_url,
    onCallAlertEmail: row.on_call_alert_email,
  };
}

export async function kyselyOrgFindById(
  db: OrgsDb,
  id: string,
): Promise<GraphQLOrgParent | undefined> {
  const row = await db
    .selectFrom('public.orgs')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return row === undefined ? undefined : rowToGraphQLOrgParent(row);
}

export async function kyselyOrgFindByName(
  db: OrgsDb,
  name: string,
): Promise<GraphQLOrgParent | undefined> {
  const row = await db
    .selectFrom('public.orgs')
    .selectAll()
    .where('name', '=', name)
    .executeTakeFirst();
  return row === undefined ? undefined : rowToGraphQLOrgParent(row);
}

export async function kyselyOrgFindByEmail(
  db: OrgsDb,
  email: string,
): Promise<GraphQLOrgParent | undefined> {
  const row = await db
    .selectFrom('public.orgs')
    .selectAll()
    .where('email', '=', email)
    .executeTakeFirst();
  return row === undefined ? undefined : rowToGraphQLOrgParent(row);
}

export async function kyselyOrgFindAll(
  db: OrgsDb,
): Promise<GraphQLOrgParent[]> {
  const rows = await db
    .selectFrom('public.orgs')
    .selectAll()
    .orderBy('name', 'asc')
    .execute();
  return rows.map(rowToGraphQLOrgParent);
}

export async function kyselyOrgInsert(opts: {
  db: OrgsDb;
  id: string;
  email: string;
  name: string;
  websiteUrl: string;
  // `api_key_id` is nullable in the schema and was optional on the Sequelize
  // model. Keep it optional here so callers that don't yet have an API key
  // (e.g. legacy fixtures) can still insert.
  apiKeyId?: string | null;
  onCallAlertEmail?: string | null;
}): Promise<GraphQLOrgParent> {
  const now = new Date();
  const row = await opts.db
    .insertInto('public.orgs')
    .values({
      id: opts.id,
      email: opts.email,
      name: opts.name,
      website_url: opts.websiteUrl,
      api_key_id: opts.apiKeyId ?? null,
      created_at: now,
      updated_at: now,
      on_call_alert_email: opts.onCallAlertEmail ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return rowToGraphQLOrgParent(row);
}

export async function kyselyOrgUpdate(
  db: OrgsDb,
  orgId: string,
  patch: {
    name?: string | null;
    email?: string | null;
    websiteUrl?: string | null;
    onCallAlertEmail?: string | null;
  },
): Promise<GraphQLOrgParent | undefined> {
  // Mirror the previous Sequelize behavior: only set non-null fields, and
  // treat empty `websiteUrl` as "no change". `onCallAlertEmail` is the one
  // exception — `null` is a meaningful value (clear the alert email), so we
  // distinguish `null` (clear) from `undefined` (skip).
  const update: {
    name?: string;
    email?: string;
    website_url?: string;
    on_call_alert_email?: string | null;
    updated_at: Date;
  } = { updated_at: new Date() };

  if (patch.name != null) {
    update.name = patch.name;
  }
  if (patch.email != null) {
    update.email = patch.email;
  }
  if (patch.websiteUrl != null && patch.websiteUrl !== '') {
    update.website_url = patch.websiteUrl;
  }
  if (patch.onCallAlertEmail !== undefined) {
    update.on_call_alert_email = patch.onCallAlertEmail;
  }

  const row = await db
    .updateTable('public.orgs')
    .set(update)
    .where('id', '=', orgId)
    .returningAll()
    .executeTakeFirst();

  return row === undefined ? undefined : rowToGraphQLOrgParent(row);
}

export async function kyselyOrgDeleteById(
  db: OrgsDb,
  orgId: string,
): Promise<void> {
  await db.deleteFrom('public.orgs').where('id', '=', orgId).execute();
}
