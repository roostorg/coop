/* eslint-disable max-lines */
import { type Kysely } from 'kysely';

import { inject } from '../../iocContainer/utils.js';
import { type Cached } from '../../utils/caching.js';
import { type JsonOf } from '../../utils/encoding.js';
import { jsonParse, jsonStringify } from '../../utils/encoding.js';
import { type NonEmptyString } from '../../utils/typescript-types.js';
import { Integration } from '../signalsService/index.js';
import { type SignalAuthServicePg } from './dbTypes.js';

export type CachedGetCredentials<T extends ConfigurableIntegration> = Cached<
  Credentials<T>['get']
>;

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
export type OpenAICredential = { apiKey: string };
export type ZentropiLabelerVersion = { id: string; label: string };
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
  private pg: Kysely<SignalAuthServicePg>;

  constructor(pg: Kysely<SignalAuthServicePg>) {
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
      return c != null ? { apiKey: c.apiKey } : undefined;
    }
    if (integrationId === Integration.ZENTROPI) {
      const c = await this.get(Integration.ZENTROPI, orgId);
      return c != null ? { apiKey: c.apiKey, labelerVersions: c.labelerVersions } : undefined;
    }
    const row = await this.pg
      .selectFrom('signal_auth_service.integration_configs')
      .select(['config'])
      .where('org_id', '=', orgId)
      .where('integration_id', '=', integrationId)
      .executeTakeFirst();
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
      await this.set(Integration.OPEN_AI, orgId, { apiKey });
      return { apiKey };
    }
    if (integrationId === Integration.ZENTROPI) {
      const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
      const labelerVersions = Array.isArray(config.labelerVersions)
        ? (config.labelerVersions as ZentropiLabelerVersion[])
        : [];
      await this.set(Integration.ZENTROPI, orgId, { apiKey, labelerVersions });
      return { apiKey, labelerVersions };
    }
    await this.pg
      .insertInto('signal_auth_service.integration_configs')
      .values({
        org_id: orgId,
        integration_id: integrationId,
        config,
      })
      .onConflict((oc) =>
        oc.columns(['org_id', 'integration_id']).doUpdateSet({ config }),
      )
      .execute();
    return config;
  }
}

export default inject(['KyselyPg'], SignalAuthService);
export { type SignalAuthService };

// Returns the whole CredentialImplementations object inline, with the
// implementations for all the integrations, which might seem like a lot, but
// saves us from having a lot of boilerplate with private bottle services and
// separate dependency lists for each integration.
function makeImplementations(
  pg: Kysely<SignalAuthServicePg>,
): CredentialImplementations {
  return {
    [Integration.GOOGLE_CONTENT_SAFETY_API]: {
      get: async (orgId: string) => {
        return pg
          .selectFrom('signal_auth_service.google_content_safety_configs')
          .select(['api_key as apiKey'])
          .where('org_id', '=', orgId)
          .executeTakeFirst();
      },
      set: async (orgId: string, credential: GoogleContentSafetyCredential) => {
        return pg
          .insertInto('signal_auth_service.google_content_safety_configs')
          .values([
            {
              org_id: orgId,
              api_key: credential.apiKey,
            },
          ])
          .onConflict((oc) =>
            oc.column('org_id').doUpdateSet({ api_key: credential.apiKey }),
          )
          .returning(['api_key as apiKey'])
          .executeTakeFirstOrThrow();
      },
      delete: async (orgId: string) => {
        await pg
          .deleteFrom('signal_auth_service.google_content_safety_configs')
          .where('org_id', '=', orgId)
          .executeTakeFirst();
      },
    },
    [Integration.OPEN_AI]: {
      get: async (orgId: string) => {
        return pg
          .selectFrom('signal_auth_service.open_ai_configs')
          .select(['api_key as apiKey'])
          .where('org_id', '=', orgId)
          .executeTakeFirst();
      },
      set: async (orgId: string, credential: OpenAICredential) => {
        return pg
          .insertInto('signal_auth_service.open_ai_configs')
          .values([
            {
              org_id: orgId,
              api_key: credential.apiKey,
            },
          ])
          .onConflict((oc) =>
            oc.column('org_id').doUpdateSet({ api_key: credential.apiKey }),
          )
          .returning(['api_key as apiKey'])
          .executeTakeFirstOrThrow();
      },
      delete: async (orgId: string) => {
        await pg
          .deleteFrom('signal_auth_service.open_ai_configs')
          .where('org_id', '=', orgId)
          .executeTakeFirst();
      },
    },
    [Integration.ZENTROPI]: {
      get: async (orgId: string) => {
        const row = await pg
          .selectFrom('signal_auth_service.zentropi_configs')
          .select(['api_key', 'labeler_versions'])
          .where('org_id', '=', orgId)
          .executeTakeFirst();
        if (row == null) return undefined;
        const labelerVersions = row.labeler_versions;
        return {
          apiKey: row.api_key,
          labelerVersions: Array.isArray(labelerVersions)
            ? (labelerVersions as ZentropiLabelerVersion[])
            : typeof labelerVersions === 'string'
              ? (jsonParse(labelerVersions as JsonOf<ZentropiLabelerVersion[]>))
              : [],
        };
      },
      set: async (orgId: string, credential: ZentropiCredential) => {
        const labelerVersionsJson = jsonStringify(
          credential.labelerVersions ?? [],
        );
        const row = await pg
          .insertInto('signal_auth_service.zentropi_configs')
          .values([
            {
              org_id: orgId,
              api_key: credential.apiKey,
              labeler_versions: labelerVersionsJson,
            },
          ])
          .onConflict((oc) =>
            oc.column('org_id').doUpdateSet({
              api_key: credential.apiKey,
              labeler_versions: labelerVersionsJson,
            }),
          )
          .returning(['api_key', 'labeler_versions'])
          .executeTakeFirstOrThrow();
        const returnedVersions = row.labeler_versions;
        return {
          apiKey: row.api_key,
          labelerVersions: Array.isArray(returnedVersions)
            ? (returnedVersions as ZentropiLabelerVersion[])
            : typeof returnedVersions === 'string'
              ? (jsonParse(returnedVersions as JsonOf<ZentropiLabelerVersion[]>))
              : [],
        };
      },
      delete: async (orgId: string) => {
        await pg
          .deleteFrom('signal_auth_service.zentropi_configs')
          .where('org_id', '=', orgId)
          .executeTakeFirst();
      },
    },
  };
}
