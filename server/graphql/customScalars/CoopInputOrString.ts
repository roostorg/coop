import { UserInputError } from 'apollo-server-express';
import { GraphQLScalarType, Kind } from 'graphql';

import { CoopInput } from '../../services/moderationConfigService/index.js';

export const CoopInputEnumInverted = Object.fromEntries(
  Object.entries(CoopInput).map(([key, value]) => [value, key]),
) as { [key: string]: string | undefined };

/**
 * Some of our old GraphQL types -- particularly ConditionInputField and
 * ConditionInputFieldInput -- have a field that sometimes holds a string and
 * sometimes holds a CoopInput enum value. Eventually, we probably want to
 * get rid of these overloaded fields, as it's not quite type safe. But, for
 * now, this'll let us keep the API working.
 */
export default new GraphQLScalarType<CoopInput | string, string>({
  name: 'CoopInputOrString',
  description:
    'Either an arbitrary string or a CoopInput enum key name (not the TS runtime value).',
  serialize(value) {
    if (typeof value !== 'string') {
      throw new UserInputError('Expected a string.');
    }

    return CoopInputEnumInverted[value] ?? value;
  },
  parseValue: parseCoopInputOrStringValue,
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new UserInputError('CoopInputOrString must be a string.');
    }
    return parseCoopInputOrStringValue(ast.value);
  },
});

function parseCoopInputOrStringValue(value: unknown) {
  if (typeof value !== 'string') {
    throw new UserInputError('CoopInputOrString must be a CoopInput.');
  }

  // @ts-ignore
  return CoopInput[value] !== undefined ? CoopInput[value] : value;
}
