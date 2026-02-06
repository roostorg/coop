import { gql } from '@apollo/client';

export const API_AUTH_QUERY = gql`
  query ApiAuth {
    apiKey
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
          isActive
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
