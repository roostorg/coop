import { eq } from 'drizzle-orm';

import { schema, type CoopDbOrTx } from '../../storage/postgres/drizzle.js';
import {
  validateOrgCreateInput,
  validateOrgUpdatePatch,
} from './orgValidation.js';

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

type OrgsDb = CoopDbOrTx;

const { orgs } = schema;

const ORG_FIELDS = {
  id: orgs.id,
  name: orgs.name,
  email: orgs.email,
  websiteUrl: orgs.websiteUrl,
  onCallAlertEmail: orgs.onCallAlertEmail,
};

export async function kyselyOrgFindById(
  db: OrgsDb,
  id: string,
): Promise<GraphQLOrgParent | undefined> {
  const row = (
    await db.select(ORG_FIELDS).from(orgs).where(eq(orgs.id, id)).limit(1)
  ).at(0);
  return row;
}

export async function kyselyOrgFindByName(
  db: OrgsDb,
  name: string,
): Promise<GraphQLOrgParent | undefined> {
  const row = (
    await db.select(ORG_FIELDS).from(orgs).where(eq(orgs.name, name)).limit(1)
  ).at(0);
  return row;
}

export async function kyselyOrgFindByEmail(
  db: OrgsDb,
  email: string,
): Promise<GraphQLOrgParent | undefined> {
  const row = (
    await db.select(ORG_FIELDS).from(orgs).where(eq(orgs.email, email)).limit(1)
  ).at(0);
  return row;
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
  // Defense-in-depth so non-GraphQL callers (fixtures, scripts) can't insert
  // invalid rows; user-facing validation lives in `OrgAPI`.
  const validation = validateOrgCreateInput({
    name: opts.name,
    email: opts.email,
    websiteUrl: opts.websiteUrl,
    onCallAlertEmail: opts.onCallAlertEmail,
  });
  if (!validation.ok) {
    throw new Error(
      `kyselyOrgInsert invariant violated: ${validation.failure.field}: ${validation.failure.message}`,
    );
  }

  const now = new Date();
  const [row] = await opts.db
    .insert(orgs)
    .values({
      id: opts.id,
      email: opts.email,
      name: opts.name,
      websiteUrl: opts.websiteUrl,
      apiKeyId: opts.apiKeyId ?? null,
      createdAt: now,
      updatedAt: now,
      onCallAlertEmail: opts.onCallAlertEmail ?? null,
    })
    .returning(ORG_FIELDS);
  return row;
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
  const validation = validateOrgUpdatePatch(patch);
  if (!validation.ok) {
    throw new Error(
      `kyselyOrgUpdate invariant violated: ${validation.failure.field}: ${validation.failure.message}`,
    );
  }

  // `onCallAlertEmail` is intentionally the only field where `null` is set
  // on the row (clears the value); other fields treat `null` as skip.
  const update: Partial<typeof orgs.$inferInsert> = { updatedAt: new Date() };

  if (patch.name != null) {
    update.name = patch.name;
  }
  if (patch.email != null) {
    update.email = patch.email;
  }
  if (patch.websiteUrl != null && patch.websiteUrl !== '') {
    update.websiteUrl = patch.websiteUrl;
  }
  if (patch.onCallAlertEmail !== undefined) {
    update.onCallAlertEmail = patch.onCallAlertEmail;
  }

  const row = (
    await db
      .update(orgs)
      .set(update)
      .where(eq(orgs.id, orgId))
      .returning(ORG_FIELDS)
  ).at(0);

  return row;
}

export async function kyselyOrgDeleteById(
  db: OrgsDb,
  orgId: string,
): Promise<void> {
  await db.delete(orgs).where(eq(orgs.id, orgId));
}
