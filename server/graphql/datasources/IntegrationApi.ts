import { DataSource } from 'apollo-datasource';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import '../../services/signalAuthService/index.js';
import { Integration } from '../../services/signalsService/index.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { getIntegrationRegistry } from '../../services/integrationRegistry/index.js';
import type {
  IntegrationManifestEntry,
  ModelCard,
} from './integrationManifests.js';
import { type GQLSetIntegrationConfigInput } from '../generated.js';

export type TIntegrationConfigWithMetadata = Readonly<{
  name: string;
  apiCredential: Readonly<Record<string, unknown>>;
  modelCard: ModelCard;
  modelCardLearnMoreUrl?: string;
  title: string;
  docsUrl: string;
  requiresConfig: boolean;
  logoUrl?: string;
  logoWithBackgroundUrl?: string;
}>;

function defaultCredentialForIntegrationId(
  integrationId: string,
): Record<string, unknown> {
  switch (integrationId) {
    case Integration.GOOGLE_CONTENT_SAFETY_API:
    case Integration.OPEN_AI:
      return { apiKey: '' };
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
    apiCredential,
    modelCard: manifest.modelCard,
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
class IntegrationAPI extends DataSource {
  constructor(
    private readonly signalAuthService: Dependencies['SignalAuthService'],
  ) {
    super();
  }

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
        { apiKey: apiCredential.openAi.apiKey },
        orgId,
      );
    }
    if (apiCredential.zentropi) {
      return this.setConfigByIntegrationId(
        'ZENTROPI',
        {
          apiKey: apiCredential.zentropi.apiKey,
          labelerVersions: [...(apiCredential.zentropi.labelerVersions ?? [])],
        },
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

export const makeIntegrationConfigTooManyCredentialsError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'This integration type expects a single api credential.',
    name: 'IntegrationConfigTooManyCredentialsError',
    ...data,
  });

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

export const makeIntegrationNoInputCredentialsError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title:
      'This integration config creation expects at least one API credential.',
    name: 'IntegrationNoInputCredentialsError',
    ...data,
  });

export const makeIntegrationEmptyInputCredentialsError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'This integration config creation expects no empty API credentials.',
    name: 'IntegrationEmptyInputCredentialsError',
    ...data,
  });
