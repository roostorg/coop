import { AuthenticationError } from 'apollo-server-express';

import { isConfigurableIntegration } from '../../services/signalAuthService/index.js';
import { Integration } from '../../services/signalsService/index.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import {
  makeIntegrationConfigUnsupportedIntegrationError,
  type TIntegrationCredential,
} from '../datasources/IntegrationApi.js';
import {
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

  type ZentropiIntegrationApiCredential {
    apiKey: String!
  }

  union IntegrationApiCredential =
      GoogleContentSafetyApiIntegrationApiCredential
    | OpenAiIntegrationApiCredential
    | ZentropiIntegrationApiCredential

  type IntegrationConfig {
    name: Integration!
    apiCredential: IntegrationApiCredential!
  }

  input GoogleContentSafetyApiIntegrationApiCredentialInput {
    apiKey: String!
  }

  input OpenAiIntegrationApiCredentialInput {
    apiKey: String!
  }

  input ZentropiIntegrationApiCredentialInput {
    apiKey: String!
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
    integrationConfig(name: Integration!): IntegrationConfigQueryResponse!
  }

  type Mutation {
    setIntegrationConfig(
      input: SetIntegrationConfigInput!
    ): SetIntegrationConfigResponse!
  }
`;

const IntegrationApiCredential: ResolverMap<TIntegrationCredential> = {
  __resolveType(it) {
    const integrationName = it.name;
    switch (integrationName) {
      case Integration.GOOGLE_CONTENT_SAFETY_API:
        return 'GoogleContentSafetyApiIntegrationApiCredential';
      case Integration.OPEN_AI:
        return 'OpenAiIntegrationApiCredential';
      case Integration.ZENTROPI:
        return 'ZentropiIntegrationApiCredential';
      default:
        // TypeScript can't verify exhaustiveness here because GQL enum includes
        assertUnreachable(
          integrationName,
          `Unsupported integration: ${integrationName}`,
        );
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

      if (!isConfigurableIntegration(name)) {
        throw makeIntegrationConfigUnsupportedIntegrationError({
          shouldErrorSpan: true,
        });
      }

      const config = await context.dataSources.integrationAPI.getConfig(
        user.orgId,
        name,
      );

      return gqlSuccessResult({ config }, 'IntegrationConfigSuccessResult');
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, 'IntegrationConfigUnsupportedIntegrationError')
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
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
        { config: newConfig },
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
  Query,
  Mutation,
};

export { typeDefs, resolvers };
