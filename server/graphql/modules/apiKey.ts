import {
  API_KEY_PERMISSIONS,
  type ApiKeyRecord,
} from '../../services/apiKeyService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { CoopError, ErrorType } from '../../utils/errors.js';
import { logErrorJson } from '../../utils/logging.js';
import {
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from '../generated.js';
import {
  forbiddenError,
  unauthenticatedError,
  userInputError,
} from '../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type ApiKeyPermissionDefinition {
    value: String!
    description: String!
  }

  type ApiKey {
    id: ID!
    name: String!
    description: String
    permissions: [String!]!
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
    id: ID!
  }

  input CreateApiKeyInput {
    name: String!
    description: String
    permissions: [String!]!
  }

  input UpdateApiKeyInput {
    id: ID!
    name: String!
    description: String
    permissions: [String!]
  }

  type CreateApiKeySuccessResponse {
    apiKey: String!
    record: ApiKey!
  }

  type UpdateApiKeySuccessResponse {
    record: ApiKey!
  }

  type DeleteApiKeySuccessResponse {
    id: ID!
  }

  type ApiKeyMutationError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union CreateApiKeyResponse = CreateApiKeySuccessResponse | ApiKeyMutationError
  union UpdateApiKeyResponse = UpdateApiKeySuccessResponse | ApiKeyMutationError
  union DeleteApiKeyResponse = DeleteApiKeySuccessResponse | ApiKeyMutationError

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
    apiKey: String! @deprecated(reason: "Use \`apiKeys\` instead.")
    apiKeys: [ApiKey!]!
    apiKeyPermissions: [ApiKeyPermissionDefinition!]!
  }

  type Mutation {
    createApiKey(input: CreateApiKeyInput!): CreateApiKeyResponse!
    updateApiKey(input: UpdateApiKeyInput!): UpdateApiKeyResponse!
    deleteApiKey(id: ID!): DeleteApiKeyResponse!
    rotateApiKey(input: RotateApiKeyInput!): RotateApiKeyResponse!
    rotateWebhookSigningKey: RotateWebhookSigningKeyResponse!
  }
`;

function validateApiKeyMetadata(input: {
  name: string;
  description?: string | null;
}) {
  const name = input.name.trim();
  const description = input.description?.trim() ?? '';
  if (!name) {
    throw userInputError('API key name must not be empty');
  }
  if (name.length > 255) {
    throw userInputError('API key name must be at most 255 characters');
  }
  if (description.length > 2000) {
    throw userInputError('API key description must be at most 2000 characters');
  }
  return { name, description: description.length === 0 ? null : description };
}

function apiKeyNotFoundResult<
  T extends 'ApiKeyMutationError' | 'RotateApiKeyError',
>(name: T) {
  return gqlErrorResult(
    new CoopError({
      name,
      status: 404,
      type: [ErrorType.NotFound],
      title: 'API key not found',
      detail: 'API key not found',
      shouldErrorSpan: false,
    }),
  );
}

async function runApiKeyMutation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof CoopError &&
      error.status === 400 &&
      error.type.includes(ErrorType.InvalidUserInput)
    ) {
      return gqlErrorResult(
        new CoopError({
          ...error,
          name: 'ApiKeyMutationError',
          shouldErrorSpan: false,
        }),
      );
    }
    // Resolvers do not receive a request-scoped logger.
    // eslint-disable-next-line no-restricted-syntax -- log unexpected errors without exposing them to clients
    logErrorJson({ message: 'API key operation failed', error });
    return gqlErrorResult(
      new CoopError({
        name: 'ApiKeyMutationError',
        status: 500,
        type: [ErrorType.InternalServerError],
        title: 'API key operation failed',
        detail: 'An error occurred while managing the API key',
        shouldErrorSpan: true,
      }),
    );
  }
}

function serializeApiKey(record: ApiKeyRecord) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    permissions: record.permissions,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    createdBy: record.createdBy,
  };
}

const Query: GQLQueryResolvers = {
  apiKeyPermissions: () => API_KEY_PERMISSIONS,
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
    const { name, description } = validateApiKeyMetadata(input);
    return runApiKeyMutation(async () => {
      const { apiKey, record } =
        await context.services.ApiKeyService.createApiKey(
          user.orgId,
          name,
          description,
          user.id,
          input.permissions,
        );
      return gqlSuccessResult(
        {
          apiKey,
          record: serializeApiKey(record),
        },
        'CreateApiKeySuccessResponse',
      );
    });
  },
  async updateApiKey(_, { input }, context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError('User does not have permission to manage API keys');
    }
    const { name, description } = validateApiKeyMetadata(input);
    return runApiKeyMutation(async () => {
      const record = await context.services.ApiKeyService.updateApiKey(
        input.id,
        user.orgId,
        name,
        description,
        input.permissions ?? undefined,
      );
      return record
        ? gqlSuccessResult(
            { record: serializeApiKey(record) },
            'UpdateApiKeySuccessResponse',
          )
        : apiKeyNotFoundResult('ApiKeyMutationError');
    });
  },
  async deleteApiKey(_, { id }, context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError('User does not have permission to manage API keys');
    }
    return runApiKeyMutation(async () => {
      const deleted = await context.services.ApiKeyService.deleteApiKey(
        id,
        user.orgId,
      );
      return deleted
        ? gqlSuccessResult({ id }, 'DeleteApiKeySuccessResponse')
        : apiKeyNotFoundResult('ApiKeyMutationError');
    });
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
      const result = await context.services.ApiKeyService.rotateApiKey(
        user.orgId,
        input.id,
      );
      if (!result) {
        return apiKeyNotFoundResult('RotateApiKeyError');
      }
      const { apiKey, record } = result;

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
