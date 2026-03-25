import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type ExchangeInfo {
    api: String!
    enabled: Boolean!
    has_auth: Boolean!
    error: String
    last_fetch_succeeded: Boolean
    last_fetch_time: String
    up_to_date: Boolean
    fetched_items: Int
    is_fetching: Boolean
  }

  type HashBank {
    id: ID!
    name: String!
    description: String
    hma_name: String!
    enabled_ratio: Float!
    org_id: String!
    exchange: ExchangeInfo
  }

  type ExchangeFieldDescriptor {
    name: String!
    type: String!
    required: Boolean!
    default: JSON
    help: String
    choices: [String!]
  }

  type ExchangeSchemaSection {
    fields: [ExchangeFieldDescriptor!]!
  }

  type ExchangeApiSchema {
    config_schema: ExchangeSchemaSection!
    credentials_schema: ExchangeSchemaSection
  }

  type ExchangeApiInfo {
    name: String!
    supports_auth: Boolean!
    has_auth: Boolean!
  }

  input ExchangeConfigInput {
    api_name: String!
    config_json: String!
    credentials_json: String
  }

  input CreateHashBankInput {
    name: String!
    description: String
    enabled_ratio: Float!
    exchange: ExchangeConfigInput
  }

  input UpdateHashBankInput {
    id: ID!
    name: String
    description: String
    enabled_ratio: Float
  }

  type MutateHashBankSuccessResponse {
    data: HashBank!
    warning: String
  }

  type MatchingBankNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union MutateHashBankResponse =
      MutateHashBankSuccessResponse
    | MatchingBankNameExistsError

  type Query {
    hashBanks: [HashBank!]!
    hashBank(name: String!): HashBank
    hashBankById(id: ID!): HashBank
    exchangeApis: [ExchangeApiInfo!]!
    exchangeApiSchema(apiName: String!): ExchangeApiSchema
  }

  type Mutation {
    createHashBank(input: CreateHashBankInput!): MutateHashBankResponse!
    updateHashBank(input: UpdateHashBankInput!): MutateHashBankResponse!
    deleteHashBank(id: ID!): Boolean!
    updateExchangeCredentials(apiName: String!, credentialsJson: String!): Boolean!
  }
`; 
