import { type ApiKeyRecord } from '../../services/apiKeyService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { CoopError, ErrorType } from '../../utils/errors.js';
import { logErrorJson } from '../../utils/logging.js';
import {
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from '../generated.js';
import { forbiddenError, unauthenticatedError } from '../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

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
    id: ID
    name: String!
    description: String
  }

  input CreateApiKeyInput {
    name: String!
    description: String
  }

  type CreateApiKeySuccessResponse {
    apiKey: String!
    record: ApiKey!
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
    | RotateWebhookSigningKeySuccessResponse
    | RotateWebhookSigningKeyError

  type Query {
    apiKey: String!
    apiKeys: [ApiKey!]!
  }

  type Mutation {
    createApiKey(input: CreateApiKeyInput!): CreateApiKeySuccessResponse!
    revokeApiKey(id: ID!): Boolean!
    rotateApiKey(input: RotateApiKeyInput!): RotateApiKeyResponse!
    rotateWebhookSigningKey: RotateWebhookSigningKeyResponse!
  }
`;

function serializeApiKey(record: ApiKeyRecord) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    createdBy: record.createdBy,
  };
}

const Query: GQLQueryResolvers = {
  async apiKeys(_, __, context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError('User does not have permission to manage API keys');
    }
    const records = await context.services.ApiKeyService.getApiKeysForOrg(
      user.orgId,
    );
    return records.map(serializeApiKey);
  },
  async apiKey(_, __, context) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError(
        'User does not have permission to view the org API key',
      );
    }

    const apiKeyRecord =
      await context.services.ApiKeyService.getActiveApiKeyForOrg(user.orgId);
    if (!apiKeyRecord) {
      return process.env.NODE_ENV !== 'production' ? '' : '';
    }
    // Return a message indicating the key exists but is hidden for security
    return 'API key exists (hidden for security)';
  },
};

const Mutation: GQLMutationResolvers = {
  async createApiKey(_, { input }, context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError('User does not have permission to manage API keys');
    }
    const { apiKey, record } =
      await context.services.ApiKeyService.createApiKey(
        user.orgId,
        input.name,
        input.description ?? null,
        user.id,
      );
    return {
      apiKey,
      record: serializeApiKey(record),
    };
  },
  async revokeApiKey(_, { id }, context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError('User does not have permission to manage API keys');
    }
    return context.services.ApiKeyService.deactivateApiKey(id, user.orgId);
  },
  async rotateApiKey(_, { input }, context) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError(
        'User does not have permission to rotate the API key',
      );
    }

    try {
      const { apiKey, record } =
        await context.services.ApiKeyService.rotateApiKey(
          user.orgId,
          input.name,
          input.description ?? null,
          user.id,
          input.id ?? undefined,
        );

      return gqlSuccessResult(
        {
          apiKey,
          record: serializeApiKey(record),
        },
        'RotateApiKeySuccessResponse',
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
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError(
        'User does not have permission to rotate the webhook signing key',
      );
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
