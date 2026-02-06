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