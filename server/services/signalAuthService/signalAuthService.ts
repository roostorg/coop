import { and, eq } from 'drizzle-orm';
import { type ReadonlyDeep } from 'type-fest';

import { inject } from '../../iocContainer/utils.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import { jsonParse, type JsonOf } from '../../utils/encoding.js';
import { type NonEmptyString } from '../../utils/typescript-types.js';
import { Integration } from '../signalsService/index.js';

export type GetCredentials<T extends ConfigurableIntegration> = (
  orgId: string,
) => Promise<ReadonlyDeep<CredentialTypes[T]> | undefined>;

// Shared “interface” allowing CRUD functionality for 3rd party API credentials.
// For now, these CRUD operations accept orgId as an argument, rather than the
// ID of the API credential config object stored in the DB. We assume that each
// org has exactly one API credential config per integration, so (org_id,
// integration) is a valid unique identifier.
export type Credentials<T extends ConfigurableIntegration> = {
  get(orgId: string): Promise<CredentialTypes[T] | undefined>;
  set(orgId: string, args: CredentialTypes[T]): Promise<CredentialTypes[T]>;
  delete(orgId: string): Promise<void>;
};

export type GoogleContentSafetyCredential = { apiKey: string };
// `csamClassifierApiKey` authenticates OpenAI's Novel CSAM Classifier API.
// It is issued separately from the regular OpenAI API key, via an approval
// process that happens outside Coop.
export type OpenAICredential = {
  apiKey: string;
  csamClassifierApiKey?: string;
};
export type ZentropiModel = 'COPE_LATEST' | 'COPE_B_A4B' | 'COPE_B_S1';
// `id` is the Zentropi labeler version ID. Its parent `labelerId` is optional;
// GraphQL clients can explicitly clear it with null. Without a `model`,
// Zentropi uses its default model.
export type ZentropiLabelerVersion = {
  id: string;
  label: string;
  labelerId?: string | null;
  model?: ZentropiModel | null;
};
export type ZentropiCredential = {
  apiKey: string;
  labelerVersions?: ZentropiLabelerVersion[];
};
export type ClarifaiApiCredential = { apiKey: NonEmptyString };
export type ClarifaiModelType = 'IMAGE' | 'TEXT';
export type ClarifaiPATCredential = {
  pat: NonEmptyString;
  appId: NonEmptyString;
  userId: NonEmptyString;
};

// Assume Integrations is a union of literal string integration names. This type
// is the only place where you have to manually make the mapping from
// integration name to credentials type.
export type CredentialTypes = {
  [Integration.GOOGLE_CONTENT_SAFETY_API]: GoogleContentSafetyCredential;
  [Integration.OPEN_AI]: OpenAICredential;
  [Integration.ZENTROPI]: ZentropiCredential;
};

// Both our internal Integration enum and the external GQL enum include some
// options that aren't supported yet (e.g., AKISMET). Plus, even some options
// that are supported might not allow users to save their own API keys (if we
// always use a Coop-provided key), so we need this list of "configurable"
// integrations that only includes the subset of the Integrations enum for which
// users can provide their own keys.
export const configurableIntegrations = [
  Integration.GOOGLE_CONTENT_SAFETY_API,
  Integration.OPEN_AI,
  Integration.ZENTROPI,
] as const;

/**
 * A configurable integration is one for which end users can save their own
 * configuration (namely, their own API keys).
 */
export type ConfigurableIntegration = (typeof configurableIntegrations)[number];

export function isConfigurableIntegration(
  it: unknown,
): it is ConfigurableIntegration {
  return configurableIntegrations.includes(it as ConfigurableIntegration);
}

// By mapping over ConfigurableIntegrations, rather than the keys of CredentialTypes,
// we're making the type require an implementation for every integration
export type CredentialImplementations = {
  [K in ConfigurableIntegration]: Credentials<K>;
};

/**
 * Takes care of all CRUD operations for API credentials used to
 * authenticate/authorize an org to call a third party.
 *
 * Note that this service doesn't use any caching or eventual consitency (at
 * least for now), as different consumers may have different consistency needs
 * (e.g., the dashboard vs the signal execution service), and can add their own
 * caching accordingly.
 */
class SignalAuthService {
  private implementations: CredentialImplementations;
  private pg: CoopDb;

  constructor(pg: CoopDb) {
    this.pg = pg;
    this.implementations = makeImplementations(pg);
  }

  async get<T extends ConfigurableIntegration>(
    integration: T,
    orgId: string,
  ): Promise<CredentialTypes[T] | undefined> {
    return this.implementations[integration].get(orgId);
  }

  async set<T extends ConfigurableIntegration>(
    integration: T,
    orgId: string,
    args: CredentialTypes[T],
  ): Promise<CredentialTypes[T]> {
    return this.implementations[integration].set(orgId, args);
  }

  async delete<T extends ConfigurableIntegration>(
    integration: T,
    orgId: string,
  ): Promise<void> {
    await this.implementations[integration].delete(orgId);
  }

  /**
   * Get stored config by string integration id. For built-ins uses legacy tables;
   * for plugin integrations uses the generic integration_configs table.
   */
  async getByIntegrationId(
    integrationId: string,
    orgId: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (integrationId === Integration.GOOGLE_CONTENT_SAFETY_API) {
      const c = await this.get(Integration.GOOGLE_CONTENT_SAFETY_API, orgId);
      return c != null ? { apiKey: c.apiKey } : undefined;
    }
    if (integrationId === Integration.OPEN_AI) {
      const c = await this.get(Integration.OPEN_AI, orgId);
      return c != null
        ? { apiKey: c.apiKey, csamClassifierApiKey: c.csamClassifierApiKey }
        : undefined;
    }
    if (integrationId === Integration.ZENTROPI) {
      const c = await this.get(Integration.ZENTROPI, orgId);
      return c != null
        ? { apiKey: c.apiKey, labelerVersions: c.labelerVersions }
        : undefined;
    }
    const { integrationConfigs } = schema;
    const row = (
      await this.pg
        .select({ config: integrationConfigs.config })
        .from(integrationConfigs)
        .where(
          and(
            eq(integrationConfigs.orgId, orgId),
            eq(integrationConfigs.integrationId, integrationId),
          ),
        )
        .limit(1)
    ).at(0);
    if (row == null) return undefined;
    const config = row.config;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-assertion -- DB JSON type can be null; cast for API shape
    return config != null ? (config as Record<string, unknown>) : undefined;
  }

  /**
   * Set stored config by string integration id. For built-ins uses legacy tables;
   * for plugin integrations uses the generic integration_configs table.
   */
  async setByIntegrationId(
    integrationId: string,
    orgId: string,
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (integrationId === Integration.GOOGLE_CONTENT_SAFETY_API) {
      const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
      await this.set(Integration.GOOGLE_CONTENT_SAFETY_API, orgId, { apiKey });
      return { apiKey };
    }
    if (integrationId === Integration.OPEN_AI) {
      const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
      const csamClassifierApiKey =
        typeof config.csamClassifierApiKey === 'string'
          ? config.csamClassifierApiKey
          : undefined;
      // Return the persisted row, not the input: an omitted CSAM key preserves
      // the stored one, so the saved value can differ from what was passed.
      return this.set(Integration.OPEN_AI, orgId, {
        apiKey,
        csamClassifierApiKey,
      });
    }
    if (integrationId === Integration.ZENTROPI) {
      const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
      const labelerVersions = Array.isArray(config.labelerVersions)
        ? (config.labelerVersions as ZentropiLabelerVersion[])
        : [];
      await this.set(Integration.ZENTROPI, orgId, { apiKey, labelerVersions });
      return { apiKey, labelerVersions };
    }
    const { integrationConfigs } = schema;
    await this.pg
      .insert(integrationConfigs)
      .values({ orgId, integrationId, config })
      .onConflictDoUpdate({
        target: [integrationConfigs.orgId, integrationConfigs.integrationId],
        set: { config },
      });
    return config;
  }
}

export default inject(['DrizzlePg'], SignalAuthService);
export { type SignalAuthService };

// Returns the whole CredentialImplementations object inline, with the
// implementations for all the integrations, which might seem like a lot, but
// saves us from having a lot of boilerplate with private bottle services and
// separate dependency lists for each integration.
function makeImplementations(pg: CoopDb): CredentialImplementations {
  const { googleContentSafetyConfigs, openAiConfigs, zentropiConfigs } = schema;
  return {
    [Integration.GOOGLE_CONTENT_SAFETY_API]: {
      get: async (orgId: string) => {
        const row = (
          await pg
            .select({ apiKey: googleContentSafetyConfigs.apiKey })
            .from(googleContentSafetyConfigs)
            .where(eq(googleContentSafetyConfigs.orgId, orgId))
            .limit(1)
        ).at(0);
        return row;
      },
      set: async (orgId: string, credential: GoogleContentSafetyCredential) => {
        const row = (
          await pg
            .insert(googleContentSafetyConfigs)
            .values({ orgId, apiKey: credential.apiKey })
            .onConflictDoUpdate({
              target: googleContentSafetyConfigs.orgId,
              set: { apiKey: credential.apiKey },
            })
            .returning({ apiKey: googleContentSafetyConfigs.apiKey })
        ).at(0);
        return returnedRow(row);
      },
      delete: async (orgId: string) => {
        await pg
          .delete(googleContentSafetyConfigs)
          .where(eq(googleContentSafetyConfigs.orgId, orgId));
      },
    },
    [Integration.OPEN_AI]: {
      get: async (orgId: string) => {
        const row = (
          await pg
            .select({
              apiKey: openAiConfigs.apiKey,
              csamClassifierApiKey: openAiConfigs.csamClassifierApiKey,
            })
            .from(openAiConfigs)
            .where(eq(openAiConfigs.orgId, orgId))
            .limit(1)
        ).at(0);
        if (row == null) return undefined;
        return {
          apiKey: row.apiKey,
          csamClassifierApiKey: row.csamClassifierApiKey ?? undefined,
        };
      },
      set: async (orgId: string, credential: OpenAICredential) => {
        // An omitted csamClassifierApiKey (undefined) preserves the stored key,
        // so updating only the moderation key does not drop it. An explicit
        // empty string clears it, stored as null.
        const csamProvided = credential.csamClassifierApiKey !== undefined;
        const csamValue =
          credential.csamClassifierApiKey != null &&
          credential.csamClassifierApiKey !== ''
            ? credential.csamClassifierApiKey
            : null;
        const inserted = (
          await pg
            .insert(openAiConfigs)
            .values({
              orgId,
              apiKey: credential.apiKey,
              csamClassifierApiKey: csamProvided ? csamValue : null,
            })
            .onConflictDoUpdate({
              target: openAiConfigs.orgId,
              set: {
                apiKey: credential.apiKey,
                ...(csamProvided ? { csamClassifierApiKey: csamValue } : {}),
              },
            })
            .returning({
              apiKey: openAiConfigs.apiKey,
              csamClassifierApiKey: openAiConfigs.csamClassifierApiKey,
            })
        ).at(0);
        const row = returnedRow(inserted);
        return {
          apiKey: row.apiKey,
          csamClassifierApiKey: row.csamClassifierApiKey ?? undefined,
        };
      },
      delete: async (orgId: string) => {
        await pg.delete(openAiConfigs).where(eq(openAiConfigs.orgId, orgId));
      },
    },
    [Integration.ZENTROPI]: {
      get: async (orgId: string) => {
        const row = (
          await pg
            .select({
              apiKey: zentropiConfigs.apiKey,
              labelerVersions: zentropiConfigs.labelerVersions,
            })
            .from(zentropiConfigs)
            .where(eq(zentropiConfigs.orgId, orgId))
            .limit(1)
        ).at(0);
        if (row == null) return undefined;
        const labelerVersions = row.labelerVersions;
        return {
          apiKey: row.apiKey,
          labelerVersions: Array.isArray(labelerVersions)
            ? (labelerVersions as ZentropiLabelerVersion[])
            : typeof labelerVersions === 'string'
              ? jsonParse(labelerVersions as JsonOf<ZentropiLabelerVersion[]>)
              : [],
        };
      },
      set: async (orgId: string, credential: ZentropiCredential) => {
        // Drizzle serializes jsonb itself; passing a pre-stringified value
        // would store a JSON string scalar instead of an array.
        const labelerVersions = credential.labelerVersions ?? [];
        const inserted = (
          await pg
            .insert(zentropiConfigs)
            .values({ orgId, apiKey: credential.apiKey, labelerVersions })
            .onConflictDoUpdate({
              target: zentropiConfigs.orgId,
              set: { apiKey: credential.apiKey, labelerVersions },
            })
            .returning({
              apiKey: zentropiConfigs.apiKey,
              labelerVersions: zentropiConfigs.labelerVersions,
            })
        ).at(0);
        const row = returnedRow(inserted);
        const returnedVersions = row.labelerVersions;
        return {
          apiKey: row.apiKey,
          labelerVersions: Array.isArray(returnedVersions)
            ? (returnedVersions as ZentropiLabelerVersion[])
            : typeof returnedVersions === 'string'
              ? jsonParse(returnedVersions as JsonOf<ZentropiLabelerVersion[]>)
              : [],
        };
      },
      delete: async (orgId: string) => {
        await pg
          .delete(zentropiConfigs)
          .where(eq(zentropiConfigs.orgId, orgId));
      },
    },
  };
}

// An upsert always returns its row; this narrows away `undefined` and throws
// like Kysely's executeTakeFirstOrThrow if it somehow didn't.
function returnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error('Upsert returned no row');
  }
  return row;
}
