import { UserInputError } from 'apollo-server-express';
import { GraphQLScalarType, Kind } from 'graphql';

import {
  tryParseNonEmptyString,
  type NonEmptyString,
} from '../../utils/typescript-types.js';

/**
 * This scalar is needed for values that must be non-empty strings. This
 * implementation borrows from the graphql-scalars library's implementation, but
 * is adapted to use our NonEmptyString TS type.
 */
export default new GraphQLScalarType<NonEmptyString, NonEmptyString>({
  name: 'NonEmptyString',
  description: 'A string that must be non-empty.',
  serialize(value) {
    if (typeof value !== 'string') {
      throw new UserInputError('Expected a string.');
    }
    return tryParseNonEmptyString(value);
  },
  parseValue: tryParseNonEmptyString,
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new UserInputError('NonEmptyString must be a string.');
    }
    return tryParseNonEmptyString(ast.value);
  },

  extensions: {
    // This is allowed to be used by graphlql-codegen in the event that we omit
    // this type from the scalar mapping in our codegen.yml file.
    // TODO(maxdumas): Verify this by removing this type from the codegen.yml
    codegenScalarType: 'string',
    // This field isn't used by anything in our codebase right now, but including a
    // jsonSchema for a custom scalar is standard practice in the
    // `graphql-scalars` codebase, so we include it here as well for
    // consistency. It's possible that this could aid with automatic client
    // generation or documentation in the future.
    jsonSchema: {
      title: 'NonEmptyString',
      type: 'string',
      minLength: 1,
    },
  },
});
