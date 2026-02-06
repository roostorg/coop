import { DataSource } from 'apollo-datasource';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import {
  configurableIntegrations,
  type ConfigurableIntegration,
  type CredentialTypes,
} from '../../services/signalAuthService/index.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { type GQLSetIntegrationConfigInput } from '../generated.js';

export type TIntegrationConfig = {
  [K in keyof CredentialTypes]: {
    name: K;
    apiCredential: {
      name: K;
    } & CredentialTypes[K];
  };
}[ConfigurableIntegration];

export type TIntegrationCredential = TIntegrationConfig['apiCredential'];

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
  ): Promise<TIntegrationConfig> {
    const { apiCredential } = params;

    if (!apiCredential.openAi) {
      throw new Error('OpenAI credentials are required');
    }

    return this.__private__setConfig(
      'OPEN_AI',
      { apiKey: apiCredential.openAi.apiKey },
      orgId,
    );
  }

  async getConfig(
    orgId: string,
    integration: ConfigurableIntegration,
  ): Promise<TIntegrationConfig | undefined> {
    const credential = await this.signalAuthService.get(integration, orgId);
    if (credential == null) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      name: integration,
      apiCredential: { name: integration, ...credential },
    } as TIntegrationConfig;
  }

  async getAllIntegrationConfigs(orgId: string): Promise<TIntegrationConfig[]> {
    const allConfigs = await Promise.all(
      configurableIntegrations.map(async (integration) =>
        this.getConfig(orgId, integration),
      ),
    );
    return filterNullOrUndefined(allConfigs);
  }

  async __private__setConfig<T extends ConfigurableIntegration>(
    integration: T,
    credential: CredentialTypes[T],
    orgId: string,
  ): Promise<TIntegrationConfig> {
    // When we're updating an existing credentials object, we have an id available, representing
    // the credentials object we need to update. When no id is passed in, then we're creating
    // a new credentials object.
    const newCredential = await this.signalAuthService.set(
      integration,
      orgId,
      credential,
    );

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      name: integration,
      apiCredential: { name: integration, ...newCredential },
    } as TIntegrationConfig;
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
