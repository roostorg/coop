import { AuthenticationError } from 'apollo-server-express';

import { ErrorType, CoopError } from '../../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

/** Context shape required by rotateWebhookSigningKey (avoids importing resolvers). */
type RotateWebhookSigningKeyContext = {
  getUser: () => { orgId: string } | null | undefined;
  dataSources: {
    orgAPI: { rotateWebhookSigningKey: (orgId: string) => Promise<string> };
  };
};

const typeDefs = /* GraphQL */ `
  type ApiKey {
    id: ID!
    name: String!
    description: String
    isActive: Boolean!
    createdAt: String!
    lastUsedAt: String
    createdBy: String
  }

  type RotateApiKeySuccessResponse {
    apiKey: String!
    record: ApiKey!
  }

  type RotateApiKeyError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union RotateApiKeyResponse = RotateApiKeySuccessResponse | RotateApiKeyError

  input RotateApiKeyInput {
    name: String!
    description: String
  }

  type RotateWebhookSigningKeySuccessResponse {
    publicSigningKey: String!
  }

  type RotateWebhookSigningKeyError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union RotateWebhookSigningKeyResponse =
      RotateWebhookSigningKeySuccessResponse
    | RotateWebhookSigningKeyError

  type Query {
    apiKey: String!
  }

  type Mutation {
    rotateApiKey(input: RotateApiKeyInput!): RotateApiKeyResponse!
    rotateWebhookSigningKey: RotateWebhookSigningKeyResponse!
  }
`;

const Query: any = {
  async apiKey(_: any, __: any, context: any) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw new AuthenticationError('User must be authenticated');
    }

    const apiKeyRecord = await context.services.ApiKeyService.getActiveApiKeyForOrg(user.orgId);
    if (!apiKeyRecord) {
      return process.env.NODE_ENV !== 'production' ? '' : '';
    }
    // Return a message indicating the key exists but is hidden for security
    return 'API key exists (hidden for security)';
  },
};

const Mutation: any = {
  async rotateApiKey(_: any, { input }: any, context: any) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw new AuthenticationError('User must be authenticated');
    }

    try {
      const { apiKey, record } = await context.services.ApiKeyService.rotateApiKey(
        user.orgId,
        input.name,
        input.description || null,
        user.id
      );

      return gqlSuccessResult(
        {
          apiKey,
          record: {
            id: record.id,
            name: record.name,
            description: record.description,
            isActive: record.isActive,
            createdAt: record.createdAt.toISOString(),
            lastUsedAt: record.lastUsedAt?.toISOString() || null,
            createdBy: record.createdBy,
          },
        },
        'RotateApiKeySuccessResponse'
      );
    } catch (error) {
      console.error('Failed to rotate API key', error);
      return gqlErrorResult(
        new CoopError({
          status: 500,
          type: [ErrorType.InternalServerError],
          title: 'Failed to rotate API key',
          detail: 'An error occurred while rotating the API key',
          name: 'InternalServerError',
          shouldErrorSpan: true,
        }),
      );
    }
  },
  async rotateWebhookSigningKey(
    _: unknown,
    __: Record<string, never>,
    context: RotateWebhookSigningKeyContext,
  ) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw new AuthenticationError('User must be authenticated');
    }

    try {
      const publicSigningKey =
        await context.dataSources.orgAPI.rotateWebhookSigningKey(user.orgId);
      return gqlSuccessResult(
        { publicSigningKey },
        'RotateWebhookSigningKeySuccessResponse',
      );
    } catch (error) {
      console.error('Failed to rotate webhook signing key', error);
      return gqlErrorResult(
        new CoopError({
          status: 500,
          type: [ErrorType.InternalServerError],
          title: 'Failed to rotate webhook signing key',
          detail: 'An error occurred while rotating the webhook signing key',
          name: 'InternalServerError',
          shouldErrorSpan: true,
        }),
      );
    }
  },
};

export const resolvers = { Query, Mutation };
export { typeDefs, Query, Mutation };
