import { UserInputError } from 'apollo-server-express';
import { GraphQLScalarType, Kind } from 'graphql';

/**
 * This scalar is needed for values that can be represented either
 * as strings or numbers.
 */
export default new GraphQLScalarType<string | number, string | number>({
  name: 'StringOrFloat',
  description: 'Either an arbitrary string or a float.',
  serialize(value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new UserInputError('Expected a string or float.');
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
      throw new UserInputError('StringOrFloat must be a string or number.');
    }
    return parseStringOrFloatValue(ast.value);
  },
});

function parseStringOrFloatValue(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new UserInputError(
      'StringOrFloat must be a string or number when passed to the server.',
    );
  }

  // NB: Number('') returns 0, so we have to check for the empty string
  // specially to make sure we don't cast it to a number.
  return value === '' || isNaN(Number(value)) ? value : Number(value);
}
