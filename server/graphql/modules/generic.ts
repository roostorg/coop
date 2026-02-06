import * as scalars from 'graphql-scalars';

import Cursor from '../customScalars/Cursor.js';
import NonEmptyString from '../customScalars/NonEmptyString.js';

/**
 * Types and resolvers for building blocks that aren't really coop-specific,
 * like custom scalar Date types and pagination related types.
 */
const typeDefs = /* GraphQL */ `
  # Custom scalar types

  scalar Cursor

  """
  DateTime represents an instant, with a UTC offset, serialized in ISO 8601
  (specifically, the profile of ISO 8601 supported by Date.toISOString()).
  as implemented by https://www.graphql-scalars.dev/docs/scalars/date-time
  NB: This is different from Apollo's default serialization of JS Date's, which
  uses a string with a unix timestamp in it, so be careful when updating existing
  fields.
  """
  scalar DateTime

  """
  Date represents just a date, with no time, no timezone, no offset.
  """
  scalar Date

  """
  Represents an arbitrary json object.
  """
  scalar JSONObject

  "Information about the current page in a connection."
  type PageInfo {
    "When paginating forwards, are there more items?"
    hasNextPage: Boolean!
    "When paginating backwards, are there more items?"
    hasPreviousPage: Boolean!
    "When paginating backwards, the cursor to continue."
    startCursor: Cursor!
    "When paginating forwards, the cursor to continue."
    endCursor: Cursor!
  }

  enum SortOrder {
    ASC
    DESC
  }

  """
  Represents the possible types for the name of a ConditionInput
  """
  scalar CoopInputOrString

  """
  Represents a string | float union, which is the type of a Condition's threshold
  """
  scalar StringOrFloat

  """
  Represents a string that must be non-empty.
  """
  scalar NonEmptyString

  "Base type for all errors."
  interface Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  """
  A not found error that we reuse in many different places,
  where it's obvious what the error is referring to.
  """
  type NotFoundError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }
`;

const resolvers = {
  DateTime: scalars.GraphQLDateTime,
  Date: scalars.GraphQLDate,
  Cursor,
  JSONObject: scalars.GraphQLJSONObject,
  NonEmptyString,
};

export { typeDefs, resolvers };
