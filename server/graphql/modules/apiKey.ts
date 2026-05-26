import { ErrorType, CoopError } from '../../utils/errors.js';
import { logErrorJson } from '../../utils/logging.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';
import { forbiddenError } from '../utils/errors.js';
import { type GQLMutationResolvers, type GQLQueryResolvers } from '../generated.js';

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

const Query: GQLQueryResolvers = {
  async apiKey(_, __, context) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw forbiddenError('User does not have permission to check if key exists');
    }

    const apiKeyRecord = await context.services.ApiKeyService.getActiveApiKeyForOrg(user.orgId);
    if (!apiKeyRecord) {
      return process.env.NODE_ENV !== 'production' ? '' : '';
    }
    // Return a message indicating the key exists but is hidden for security
    return 'API key exists (hidden for security)';
  },
};

const Mutation: GQLMutationResolvers = {
  async rotateApiKey(_, { input }, context) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw forbiddenError('User does not have permission to rotate the API key');
    }
    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw forbiddenError('User does not have permission to rotate the API key');
    }

    try {
      const { apiKey, record } = await context.services.ApiKeyService.rotateApiKey(
        user.orgId,
        input.name,
        input.description ?? null,
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
            lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
            createdBy: record.createdBy,
          },
        },
        'RotateApiKeySuccessResponse'
      );
    } catch (error) {
      // Resolvers do not receive a request-scoped logger; use logErrorJson for structured server-side logging.
      // eslint-disable-next-line no-restricted-syntax -- see comment above
      logErrorJson({ message: 'Failed to rotate API key', error });
      return gqlErrorResult(
        new CoopError({
          status: 500,
          type: [ErrorType.InternalServerError],
          title: 'Failed to rotate API key',
          detail: 'An error occurred while rotating the API key',
          name: 'RotateApiKeyError',
          shouldErrorSpan: true,
        }),
      );
    }
  },
  async rotateWebhookSigningKey(_, __, context) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw forbiddenError('User does not have permission to rotate the webhook signing key');
    }
    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw forbiddenError('User does not have permission to rotate the webhook signing key');
    }

    try {
      const publicSigningKey =
        await context.dataSources.orgAPI.rotateWebhookSigningKey(user.orgId);
      return gqlSuccessResult(
        { publicSigningKey },
        'RotateWebhookSigningKeySuccessResponse',
      );
    } catch (error) {
      // Resolvers do not receive a request-scoped logger; use logErrorJson for structured server-side logging.
      // eslint-disable-next-line no-restricted-syntax -- see comment above
      logErrorJson({
        message: 'Failed to rotate webhook signing key',
        error,
      });
      return gqlErrorResult(
        new CoopError({
          status: 500,
          type: [ErrorType.InternalServerError],
          title: 'Failed to rotate webhook signing key',
          detail: 'An error occurred while rotating the webhook signing key',
          name: 'RotateWebhookSigningKeyError',
          shouldErrorSpan: true,
        }),
      );
    }
  },
};

export const resolvers = { Query, Mutation };
export { typeDefs, Query, Mutation };
