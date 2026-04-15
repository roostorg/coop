import { GraphQLScalarType, Kind } from 'graphql';

import { userInputError } from '../utils/errors.js';

/**
 * This scalar is needed for values that can be represented either
 * as strings or numbers.
 */
export default new GraphQLScalarType<string | number, string | number>({
  name: 'StringOrFloat',
  description: 'Either an arbitrary string or a float.',
  serialize(value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw userInputError('Expected a string or float.');
    }
    return value;
  },
  parseValue: parseStringOrFloatValue,
  parseLiteral(ast) {
    if (
      ast.kind !== Kind.STRING &&
      ast.kind !== Kind.FLOAT &&
      ast.kind !== Kind.INT
    ) {
      throw userInputError('StringOrFloat must be a string or number.');
    }
    return parseStringOrFloatValue(ast.value);
  },
});

function parseStringOrFloatValue(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw userInputError('StringOrFloat must be a string or number when passed to the server.');
  }

  // NB: Number('') returns 0, so we have to check for the empty string
  // specially to make sure we don't cast it to a number.
  return value === '' || isNaN(Number(value)) ? value : Number(value);
}
