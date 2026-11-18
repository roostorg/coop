import { type ReadonlyDeep } from 'type-fest';

import { inject } from '../../iocContainer/utils.js';
import {
  type Prisma,
  type PrismaPgClient,
} from '../../storage/prisma/index.js';
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
  private pg: PrismaPgClient;

  constructor(pg: PrismaPgClient) {
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
    const row = await this.pg.integration_configs.findUnique({
      select: { config: true },
      where: {
        org_id_integration_id: { org_id: orgId, integration_id: integrationId },
      },
    });
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
    // `Record<string, unknown>` isn't assignable to Prisma's JSON input type;
    // the value is caller-supplied JSON config.
    const configJson = config as Prisma.InputJsonObject;
    await this.pg.integration_configs.upsert({
      where: {
        org_id_integration_id: { org_id: orgId, integration_id: integrationId },
      },
      create: {
        org_id: orgId,
        integration_id: integrationId,
        config: configJson,
      },
      update: { config: configJson },
    });
    return config;
  }
}

export default inject(['PrismaPg'], SignalAuthService);
export { type SignalAuthService };

// Returns the whole CredentialImplementations object inline, with the
// implementations for all the integrations, which might seem like a lot, but
// saves us from having a lot of boilerplate with private bottle services and
// separate dependency lists for each integration.
function makeImplementations(pg: PrismaPgClient): CredentialImplementations {
  return {
    [Integration.GOOGLE_CONTENT_SAFETY_API]: {
      get: async (orgId: string) => {
        const row = await pg.google_content_safety_configs.findUnique({
          select: { api_key: true },
          where: { org_id: orgId },
        });
        return row == null ? undefined : { apiKey: row.api_key };
      },
      set: async (orgId: string, credential: GoogleContentSafetyCredential) => {
        const row = await pg.google_content_safety_configs.upsert({
          select: { api_key: true },
          where: { org_id: orgId },
          create: { org_id: orgId, api_key: credential.apiKey },
          update: { api_key: credential.apiKey },
        });
        return { apiKey: row.api_key };
      },
      delete: async (orgId: string) => {
        await pg.google_content_safety_configs.deleteMany({
          where: { org_id: orgId },
        });
      },
    },
    [Integration.OPEN_AI]: {
      get: async (orgId: string) => {
        const row = await pg.open_ai_configs.findUnique({
          select: { api_key: true, csam_classifier_api_key: true },
          where: { org_id: orgId },
        });
        if (row == null) return undefined;
        return {
          apiKey: row.api_key,
          csamClassifierApiKey: row.csam_classifier_api_key ?? undefined,
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
        const row = await pg.open_ai_configs.upsert({
          select: { api_key: true, csam_classifier_api_key: true },
          where: { org_id: orgId },
          create: {
            org_id: orgId,
            api_key: credential.apiKey,
            csam_classifier_api_key: csamProvided ? csamValue : null,
          },
          update: {
            api_key: credential.apiKey,
            ...(csamProvided ? { csam_classifier_api_key: csamValue } : {}),
          },
        });
        return {
          apiKey: row.api_key,
          csamClassifierApiKey: row.csam_classifier_api_key ?? undefined,
        };
      },
      delete: async (orgId: string) => {
        await pg.open_ai_configs.deleteMany({ where: { org_id: orgId } });
      },
    },
    [Integration.ZENTROPI]: {
      get: async (orgId: string) => {
        const row = await pg.zentropi_configs.findUnique({
          select: { api_key: true, labeler_versions: true },
          where: { org_id: orgId },
        });
        if (row == null) return undefined;
        const labelerVersions = row.labeler_versions;
        return {
          apiKey: row.api_key,
          labelerVersions: Array.isArray(labelerVersions)
            ? (labelerVersions as ZentropiLabelerVersion[])
            : typeof labelerVersions === 'string'
              ? jsonParse(labelerVersions as JsonOf<ZentropiLabelerVersion[]>)
              : [],
        };
      },
      set: async (orgId: string, credential: ZentropiCredential) => {
        // Kysely sent JSON text, which Postgres parsed into a jsonb array;
        // Prisma takes the array itself (a string would be stored as a JSON
        // string). Optional `labelerId`/`model` keys may be undefined, which
        // JSON serialization drops either way.
        const labelerVersionsJson = (credential.labelerVersions ??
          []) as Prisma.InputJsonArray;
        const row = await pg.zentropi_configs.upsert({
          select: { api_key: true, labeler_versions: true },
          where: { org_id: orgId },
          create: {
            org_id: orgId,
            api_key: credential.apiKey,
            labeler_versions: labelerVersionsJson,
          },
          update: {
            api_key: credential.apiKey,
            labeler_versions: labelerVersionsJson,
          },
        });
        const returnedVersions = row.labeler_versions;
        return {
          apiKey: row.api_key,
          labelerVersions: Array.isArray(returnedVersions)
            ? (returnedVersions as ZentropiLabelerVersion[])
            : typeof returnedVersions === 'string'
              ? jsonParse(returnedVersions as JsonOf<ZentropiLabelerVersion[]>)
              : [],
        };
      },
      delete: async (orgId: string) => {
        await pg.zentropi_configs.deleteMany({ where: { org_id: orgId } });
      },
    },
  };
}
