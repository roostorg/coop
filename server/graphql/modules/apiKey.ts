import { AuthenticationError } from 'apollo-server-express';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';
import { ErrorType, CoopError } from '../../utils/errors.js';

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

  type Query {
    apiKey: String!
  }

  type Mutation {
    rotateApiKey(input: RotateApiKeyInput!): RotateApiKeyResponse!
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
      return gqlErrorResult(
        new CoopError({
          status: 500,
          type: [ErrorType.InternalServerError],
          title: 'Failed to rotate API key',
          detail: error instanceof Error ? error.message : 'An error occurred while rotating the API key',
          name: 'InternalServerError',
          shouldErrorSpan: true,
        })
      );
    }
  },
};

export const resolvers = { Query, Mutation };
export { typeDefs, Query, Mutation };
