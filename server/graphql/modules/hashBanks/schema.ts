import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type HashBank {
    id: ID!
    name: String!
    description: String
    hma_name: String!
    enabled_ratio: Float!
    org_id: String!
  }

  input CreateHashBankInput {
    name: String!
    description: String
    enabled_ratio: Float!
  }

  input UpdateHashBankInput {
    id: ID!
    name: String
    description: String
    enabled_ratio: Float
  }

  type MutateHashBankSuccessResponse {
    data: HashBank!
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
  }

  type Mutation {
    createHashBank(input: CreateHashBankInput!): MutateHashBankResponse!
    updateHashBank(input: UpdateHashBankInput!): MutateHashBankResponse!
    deleteHashBank(id: ID!): Boolean!
  }
`; 
