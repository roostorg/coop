import { UserInputError } from 'apollo-server-express';
import { GraphQLScalarType, Kind } from 'graphql';

import {
  b64Decode,
  b64Encode,
  jsonParse,
  jsonStringify,
  type B64Of,
  type JsonOf,
} from '../../utils/encoding.js';
import { type JSON } from '../../utils/json-schema-types.js';

/**
 * A cursor is a pointer into a particular place in an ordered collection.
 * This custom type helps us serialize cursors as Base64-encoded strings, and
 * parse them back to their underlying representation. That underlying
 * representation (which provides the instructions for "where to point") can use
 * any JSON-serializable value.
 */
export default new GraphQLScalarType<JSON, B64Of<JsonOf<JSON>>>({
  name: 'Cursor',
  description:
    'An opaque string used as a cursor to point within a paginated collection.',
  serialize(value) {
    // NB: with the cast below, we're just assuming that the `value` is a plain
    // JSON value (i.e., one where `JSON.parse(JSON.stringify(it)) === it`),
    // which isn't necessarily a safe assumption, but it's hard/not worth it to
    // make the types more strict.
    const jsonString = jsonStringify(value as JSON);
    return b64Encode(jsonString);
  },
  parseValue: parseCursorValue,
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new UserInputError('Cursor values must be strings.');
    }
    return parseCursorValue(ast.value);
  },
});

function parseCursorValue(value: unknown) {
  if (typeof value !== 'string') {
    throw new UserInputError('Cursor values must be strings.');
  }

  try {
    // Cast isn't necessarily true, but it's ok cuz we're in a try-catch.
    const jsonString = b64Decode(value as B64Of<JsonOf<JSON>>);
    return jsonParse(jsonString);
  } catch {
    throw new UserInputError('Invalid cursor value');
  }
}
