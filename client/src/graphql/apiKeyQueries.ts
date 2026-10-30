import { gql } from '@apollo/client';

export const API_KEYS_QUERY = gql`
  query ApiKeys {
    apiKeyPermissions {
      value
      description
    }
    apiKeys {
      id
      name
      description
      permissions
      createdAt
      lastUsedAt
    }
  }
`;

export const CREATE_API_KEY_MUTATION = gql`
  mutation CreateApiKey($input: CreateApiKeyInput!) {
    createApiKey(input: $input) {
      apiKey
      record {
        id
      }
    }
  }
`;

export const UPDATE_API_KEY_MUTATION = gql`
  mutation UpdateApiKey($input: UpdateApiKeyInput!) {
    updateApiKey(input: $input) {
      id
      name
      description
    }
  }
`;

export const DELETE_API_KEY_MUTATION = gql`
  mutation DeleteApiKey($id: ID!) {
    deleteApiKey(id: $id)
  }
`;

export const API_AUTH_QUERY = gql`
  query ApiAuth {
    myOrg {
      id
      publicSigningKey
    }
    me {
      id
      permissions
    }
  }
`;

export const ROTATE_API_KEY_MUTATION = gql`
  mutation RotateApiKey($input: RotateApiKeyInput!) {
    rotateApiKey(input: $input) {
      ... on RotateApiKeySuccessResponse {
        apiKey
        record {
          id
          name
          description
          permissions
          createdAt
          lastUsedAt
          createdBy
        }
      }
      ... on RotateApiKeyError {
        title
        status
        type
        detail
        pointer
        requestId
      }
    }
  }
`;

export const ROTATE_WEBHOOK_SIGNING_KEY_MUTATION = gql`
  mutation RotateWebhookSigningKey {
    rotateWebhookSigningKey {
      ... on RotateWebhookSigningKeySuccessResponse {
        publicSigningKey
      }
      ... on RotateWebhookSigningKeyError {
        title
        status
        type
        detail
        pointer
        requestId
      }
    }
  }
`;
