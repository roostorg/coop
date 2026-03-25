import { gql } from '@apollo/client';

export const HASH_BANKS_QUERY = gql`
  query HashBanks {
    hashBanks {
      id
      name
      description
      hma_name
      enabled_ratio
      org_id
    }
  }
`;

export const HASH_BANK_BY_ID_QUERY = gql`
  query HashBankById($id: ID!) {
    hashBankById(id: $id) {
      id
      name
      description
      hma_name
      enabled_ratio
      org_id
      exchange {
        api
        enabled
        has_auth
        error
        last_fetch_succeeded
        last_fetch_time
        up_to_date
        fetched_items
        is_fetching
      }
    }
  }
`;

export const EXCHANGE_APIS_QUERY = gql`
  query ExchangeApis {
    exchangeApis {
      name
      supports_auth
      has_auth
    }
  }
`;

export const EXCHANGE_API_SCHEMA_QUERY = gql`
  query ExchangeApiSchema($apiName: String!) {
    exchangeApiSchema(apiName: $apiName) {
      config_schema {
        fields {
          name
          type
          required
          default
          help
          choices
        }
      }
      credentials_schema {
        fields {
          name
          type
          required
          default
          help
          choices
        }
      }
    }
  }
`;

export const CREATE_HASH_BANK_MUTATION = gql`
  mutation CreateHashBank($input: CreateHashBankInput!) {
    createHashBank(input: $input) {
      ... on MutateHashBankSuccessResponse {
        data {
          id
          name
          description
          hma_name
          enabled_ratio
          org_id
        }
        warning
      }
      ... on MatchingBankNameExistsError {
        title
        status
        type
        pointer
        detail
        requestId
      }
    }
  }
`;

export const UPDATE_HASH_BANK_MUTATION = gql`
  mutation UpdateHashBank($input: UpdateHashBankInput!) {
    updateHashBank(input: $input) {
      ... on MutateHashBankSuccessResponse {
        data {
          id
          name
          description
          hma_name
          enabled_ratio
          org_id
        }
      }
      ... on MatchingBankNameExistsError {
        title
        status
        type
        pointer
        detail
        requestId
      }
    }
  }
`;

export const DELETE_HASH_BANK_MUTATION = gql`
  mutation DeleteHashBank($id: ID!) {
    deleteHashBank(id: $id)
  }
`;

export const UPDATE_EXCHANGE_CREDENTIALS_MUTATION = gql`
  mutation UpdateExchangeCredentials($apiName: String!, $credentialsJson: String!) {
    updateExchangeCredentials(apiName: $apiName, credentialsJson: $credentialsJson)
  }
`; 