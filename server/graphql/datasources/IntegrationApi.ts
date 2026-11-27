import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';

import '../../services/signalAuthService/index.js';

import { getIntegrationRegistry } from '../../services/integrationRegistry/index.js';
import type { CredentialTypes } from '../../services/signalAuthService/index.js';
import { Integration } from '../../services/signalsService/index.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { type GQLSetIntegrationConfigInput } from '../generated.js';
import {
  modelCardsFor,
  type IntegrationManifestEntry,
  type ModelCard,
} from './integrationManifests.js';

export type TIntegrationConfigWithMetadata = Readonly<{
  name: string;
  apiCredential: Readonly<Record<string, unknown>>;
  /** Whether a credential with a value has been saved for this integration. */
  configured: boolean;
  modelCard: ModelCard;
  modelCards: readonly ModelCard[];
  modelCardLearnMoreUrl?: string;
  title: string;
  docsUrl: string;
  requiresConfig: boolean;
  logoUrl?: string;
  logoWithBackgroundUrl?: string;
}>;

/**
 * Whether a stored credential actually carries a value, so the catalog can show
 * a non-secret "configured" status without shipping API keys to the client.
 */
function isBlankCredentialValue(value: unknown): boolean {
  return (
    value == null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function credentialIsConfigured(
  integrationId: string,
  credential: Record<string, unknown>,
  manifest: IntegrationManifestEntry,
): boolean {
  switch (integrationId) {
    case Integration.GOOGLE_CONTENT_SAFETY_API:
    case Integration.ZENTROPI:
      return (
        typeof credential.apiKey === 'string' && credential.apiKey.length > 0
      );
    case Integration.OPEN_AI:
      // The Moderation API key and the CSAM Classifier key are independent
      // (possibly different OpenAI orgs); either one alone means configured.
      return (
        (typeof credential.apiKey === 'string' &&
          credential.apiKey.length > 0) ||
        (typeof credential.csamClassifierApiKey === 'string' &&
          credential.csamClassifierApiKey.length > 0)
      );
    default: {
      // Plugins declare their form; configured means every required field has
      // a value. Plugins without required fields count any saved value.
      const required = (manifest.configurationFields ?? []).filter(
        (field) => field.required,
      );
      if (required.length === 0) {
        return Object.values(credential).some(
          (value) => !isBlankCredentialValue(value),
        );
      }
      return required.every(
        (field) => !isBlankCredentialValue(credential[field.key]),
      );
    }
  }
}

function defaultCredentialForIntegrationId(
  integrationId: string,
): Record<string, unknown> {
  switch (integrationId) {
    case Integration.GOOGLE_CONTENT_SAFETY_API:
    case Integration.OPEN_AI:
      return { apiKey: '', csamClassifierApiKey: '' };
    case Integration.ZENTROPI:
      return { apiKey: '', labelerVersions: [] };
    default:
      return {};
  }
}

function mergeManifest(
  integrationId: string,
  apiCredential: Record<string, unknown>,
  manifest: IntegrationManifestEntry,
): TIntegrationConfigWithMetadata {
  return {
    name: integrationId,
    apiCredential: { ...apiCredential, name: integrationId },
    configured: credentialIsConfigured(integrationId, apiCredential, manifest),
    modelCard: manifest.modelCard,
    modelCards: modelCardsFor(manifest),
    modelCardLearnMoreUrl: manifest.modelCardLearnMoreUrl,
    title: manifest.title,
    docsUrl: manifest.docsUrl,
    requiresConfig: manifest.requiresConfig,
    logoUrl: manifest.logoUrl,
    logoWithBackgroundUrl: manifest.logoWithBackgroundUrl,
  };
}

/**
 * TODO: this whole class should probably be merged into the signal auth service.
 */
class IntegrationAPI {
  constructor(
    private readonly signalAuthService: Dependencies['SignalAuthService'],
  ) {}

  async setConfig(
    params: GQLSetIntegrationConfigInput,
    orgId: string,
  ): Promise<TIntegrationConfigWithMetadata> {
    const { apiCredential } = params;

    if (apiCredential.googleContentSafetyApi) {
      return this.setConfigByIntegrationId(
        'GOOGLE_CONTENT_SAFETY_API',
        { apiKey: apiCredential.googleContentSafetyApi.apiKey },
        orgId,
      );
    }
    if (apiCredential.openAi) {
      return this.setConfigByIntegrationId(
        'OPEN_AI',
        {
          apiKey: apiCredential.openAi.apiKey,
          csamClassifierApiKey:
            apiCredential.openAi.csamClassifierApiKey ?? undefined,
        },
        orgId,
      );
    }
    if (apiCredential.zentropi) {
      return this.setConfigByIntegrationId(
        'ZENTROPI',
        {
          apiKey: apiCredential.zentropi.apiKey,
          labelerVersions: [...(apiCredential.zentropi.labelerVersions ?? [])],
        } satisfies CredentialTypes['ZENTROPI'],
        orgId,
      );
    }

    throw new Error('No credentials provided');
  }

  async setConfigByIntegrationId(
    integrationId: string,
    credential: Record<string, unknown>,
    orgId: string,
  ): Promise<TIntegrationConfigWithMetadata> {
    const registry = getIntegrationRegistry();
    const manifest = registry.getManifest(integrationId);
    if (manifest == null) {
      throw new Error(`Unknown integration: ${integrationId}`);
    }
    const newCredential = await this.signalAuthService.setByIntegrationId(
      integrationId,
      orgId,
      credential,
    );
    return mergeManifest(integrationId, newCredential, manifest);
  }

  async getConfig(
    orgId: string,
    integrationId: string,
  ): Promise<TIntegrationConfigWithMetadata | undefined> {
    const registry = getIntegrationRegistry();
    const manifest = registry.getManifest(integrationId);
    if (manifest == null) return undefined;
    const credential = await this.signalAuthService.getByIntegrationId(
      integrationId,
      orgId,
    );
    if (credential == null) return undefined;
    return mergeManifest(integrationId, credential, manifest);
  }

  async getConfigWithMetadata(
    orgId: string,
    integrationId: string,
  ): Promise<TIntegrationConfigWithMetadata> {
    const registry = getIntegrationRegistry();
    const manifest = registry.getManifest(integrationId);
    if (manifest == null) {
      throw new Error(`Unknown integration: ${integrationId}`);
    }
    const credential = await this.signalAuthService.getByIntegrationId(
      integrationId,
      orgId,
    );
    const apiCredential =
      credential ?? defaultCredentialForIntegrationId(integrationId);
    return mergeManifest(integrationId, apiCredential, manifest);
  }

  getAvailableIntegrations() {
    return getIntegrationRegistry().getAvailableIntegrations();
  }

  async getAllIntegrationConfigs(
    orgId: string,
  ): Promise<TIntegrationConfigWithMetadata[]> {
    const ids = getIntegrationRegistry().getConfigurableIds();
    return Promise.all(
      ids.map(async (integrationId) =>
        this.getConfigWithMetadata(orgId, integrationId),
      ),
    );
  }
}

export default inject(['SignalAuthService'], IntegrationAPI);
export type { IntegrationAPI };

export type IntegrationErrorType =
  | 'IntegrationConfigTooManyCredentialsError'
  | 'IntegrationConfigUnsupportedIntegrationError'
  | 'IntegrationNoInputCredentialsError'
  | 'IntegrationEmptyInputCredentialsError';

export const makeIntegrationConfigUnsupportedIntegrationError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'This integration type is not supported.',
    name: 'IntegrationConfigUnsupportedIntegrationError',
    ...data,
  });
