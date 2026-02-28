import { AuthenticationError } from 'apollo-server-express';

import { getIntegrationRegistry } from '../../services/integrationRegistry/index.js';
import { Integration } from '../../services/signalsService/index.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import {
  makeIntegrationConfigUnsupportedIntegrationError,
} from '../datasources/IntegrationApi.js';
import type { TIntegrationConfigWithMetadata } from '../datasources/IntegrationApi.js';
import {
  type GQLIntegrationConfig,
  type GQLIntegrationMetadata,
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from '../generated.js';
import { type ResolverMap } from '../resolvers.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  enum Integration {
    AKISMET
    GOOGLE_CONTENT_SAFETY_API
    L1GHT
    MICROSOFT_AZURE_CONTENT_MODERATOR
    OOPSPAM
    OPEN_AI
    SIGHT_ENGINE
    TWO_HAT
    ZENTROPI
  }

  type GoogleContentSafetyApiIntegrationApiCredential {
    apiKey: String!
  }

  type OpenAiIntegrationApiCredential {
    apiKey: String!
  }

  type ZentropiLabelerVersion {
    id: String!
    label: String!
  }

  type ZentropiIntegrationApiCredential {
    apiKey: String!
    labelerVersions: [ZentropiLabelerVersion!]!
  }

  union IntegrationApiCredential =
      GoogleContentSafetyApiIntegrationApiCredential
    | OpenAiIntegrationApiCredential
    | ZentropiIntegrationApiCredential
    | PluginIntegrationApiCredential

  type ModelCardField {
    label: String!
    value: String!
  }

  type ModelCardSubsection {
    title: String!
    fields: [ModelCardField!]!
  }

  type ModelCardSection {
    id: String!
    title: String!
    subsections: [ModelCardSubsection!]
    fields: [ModelCardField!]
  }

  type ModelCard {
    modelName: String!
    version: String!
    releaseDate: String
    sections: [ModelCardSection!]
  }

  type IntegrationMetadata {
    name: String!
    title: String!
    docsUrl: String!
    requiresConfig: Boolean!
    logoUrl: String
    logoWithBackgroundUrl: String
  }

  type PluginIntegrationApiCredential {
    credential: JSONObject!
  }

  type IntegrationConfig {
    name: String!
    apiCredential: IntegrationApiCredential!
    modelCard: ModelCard!
    modelCardLearnMoreUrl: String
    title: String!
    docsUrl: String!
    requiresConfig: Boolean!
    logoUrl: String
    logoWithBackgroundUrl: String
  }

  input GoogleContentSafetyApiIntegrationApiCredentialInput {
    apiKey: String!
  }

  input OpenAiIntegrationApiCredentialInput {
    apiKey: String!
  }

  input ZentropiLabelerVersionInput {
    id: String!
    label: String!
  }

  input ZentropiIntegrationApiCredentialInput {
    apiKey: String!
    labelerVersions: [ZentropiLabelerVersionInput!]
  }

  input IntegrationApiCredentialInput {
    googleContentSafetyApi: GoogleContentSafetyApiIntegrationApiCredentialInput
    openAi: OpenAiIntegrationApiCredentialInput
    zentropi: ZentropiIntegrationApiCredentialInput
  }

  input SetIntegrationConfigInput {
    apiCredential: IntegrationApiCredentialInput!
  }

  type SetIntegrationConfigSuccessResponse {
    config: IntegrationConfig!
  }

  type IntegrationNoInputCredentialsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type IntegrationConfigTooManyCredentialsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type IntegrationEmptyInputCredentialsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union SetIntegrationConfigResponse =
      SetIntegrationConfigSuccessResponse
    | IntegrationConfigTooManyCredentialsError
    | IntegrationNoInputCredentialsError
    | IntegrationEmptyInputCredentialsError

  type IntegrationConfigSuccessResult {
    config: IntegrationConfig
  }

  type IntegrationConfigUnsupportedIntegrationError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union IntegrationConfigQueryResponse =
      IntegrationConfigSuccessResult
    | IntegrationConfigUnsupportedIntegrationError

  type Query {
    integrationConfig(name: String!): IntegrationConfigQueryResponse!
    availableIntegrations: [IntegrationMetadata!]!
  }

  input SetPluginIntegrationConfigInput {
    integrationId: String!
    credential: JSONObject!
  }

  type Mutation {
    setIntegrationConfig(
      input: SetIntegrationConfigInput!
    ): SetIntegrationConfigResponse!
    setPluginIntegrationConfig(
      input: SetPluginIntegrationConfigInput!
    ): SetIntegrationConfigResponse!
  }
`;

const IntegrationApiCredential: ResolverMap<TIntegrationConfigWithMetadata['apiCredential']> = {
  __resolveType(it) {
    const integrationName = (it as { name?: string }).name ?? '';
    switch (integrationName) {
      case Integration.GOOGLE_CONTENT_SAFETY_API:
        return 'GoogleContentSafetyApiIntegrationApiCredential';
      case Integration.OPEN_AI:
        return 'OpenAiIntegrationApiCredential';
      case Integration.ZENTROPI:
        return 'ZentropiIntegrationApiCredential';
      default:
        return 'PluginIntegrationApiCredential';
    }
  },
};

const Query: GQLQueryResolvers = {
  async integrationConfig(_, { name }, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('Unauthenticated User');
      }

      if (!getIntegrationRegistry().has(name)) {
        throw makeIntegrationConfigUnsupportedIntegrationError({
          shouldErrorSpan: true,
        });
      }

      const config =
        await context.dataSources.integrationAPI.getConfigWithMetadata(
          user.orgId,
          name,
        );

      return gqlSuccessResult(
        { config: config as GQLIntegrationConfig },
        'IntegrationConfigSuccessResult',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, 'IntegrationConfigUnsupportedIntegrationError')
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async availableIntegrations(_, __, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }
    return context.dataSources.integrationAPI.getAvailableIntegrations() as GQLIntegrationMetadata[];
  },
};

const PluginIntegrationApiCredential = {
  credential(it: TIntegrationConfigWithMetadata['apiCredential']) {
    return it as Record<string, unknown>;
  },
};

const Mutation: GQLMutationResolvers = {
  async setIntegrationConfig(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('Unauthenticated User');
      }
      const newConfig = await context.dataSources.integrationAPI.setConfig(
        params.input,
        user.orgId,
      );

      return gqlSuccessResult(
        { config: newConfig as GQLIntegrationConfig },
        'SetIntegrationConfigSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'IntegrationConfigTooManyCredentialsError',
          'IntegrationNoInputCredentialsError',
          'IntegrationEmptyInputCredentialsError',
        ])
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async setPluginIntegrationConfig(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('Unauthenticated User');
      }
      const newConfig =
        await context.dataSources.integrationAPI.setConfigByIntegrationId(
          params.input.integrationId,
          params.input.credential as Record<string, unknown>,
          user.orgId,
        );

      return gqlSuccessResult(
        { config: newConfig as GQLIntegrationConfig },
        'SetIntegrationConfigSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'IntegrationConfigTooManyCredentialsError',
          'IntegrationNoInputCredentialsError',
          'IntegrationEmptyInputCredentialsError',
        ])
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
};

const resolvers = {
  IntegrationApiCredential,
  PluginIntegrationApiCredential,
  Query,
  Mutation,
};

export { typeDefs, resolvers };
