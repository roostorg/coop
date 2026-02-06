import isPlainObject from 'lodash/isPlainObject';
import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';

/**
 * In GraphQL, it's often not possible to make output types and input types
 * totally symmetric, because output types support unions of object types (where
 * the __typename key is a discriminator) but input types don't. Instead, for
 * input types, the convention is to use an object type where there's one field
 * for each possible constituent of the logical input type union, and then only
 * the applicable field is set on input. Given these conventions, this function
 * converts between the output type result and the input type.
 *
 * E.g., if the schema is:
 *
 * ```
 * union X = A | B
 * type A { hello: String! }
 * type B { goodbye: Boolean! }
 *
 * input XInput { a: AInput, B: BInput }
 * input AInput { hello: String! }
 * input BInput { goodbye: BOolean! }
 * ```
 *
 * Then calling:
 *
 * ```
 * taggedUnionToOneOfInput(
 *   { __typename: 'A', hello: 'World' }, // value of union X, tagged by __typename.
 *   { A: 'a', B: 'b' } // map of the tag values ('A', and 'B') to the input keys.
 * )
 * ```
 *
 * returns `{ a: { hello: 'World' } }`
 *
 * This function looks for the tag key in either `__typename` (which will be the
 * case w/ GraphQL output unions) or `type` (which some of our old output types
 * used because they were mirroring typescript).
 *
 * @param taggedUnionValue
 * @param tagValueToInputKeyMap
 * @returns
 */
export function taggedUnionToOneOfInput<U extends string>(
  taggedUnionValue: ({ type: U } | { __typename: U }) & { [k: string]: any },
  tagValueToInputKeyMap: { [K in U]: string },
) {
  // We could accept this as an argument, but it's convenient to try to infer it
  // automatically here, given how narrow our use cases are for calling this fn.
  const tagKey = Object.hasOwn(taggedUnionValue, '__typename')
    ? ('__typename' as keyof typeof taggedUnionValue)
    : ('type' as keyof typeof taggedUnionValue);

  const tagValue = taggedUnionValue[tagKey] as U;

  const inputObjectKey = tagValueToInputKeyMap[tagValue];

  return { [inputObjectKey]: omit(taggedUnionValue, tagKey) };
}

/**
 * Apollo always adds __typename to the selection set of all queries that it
 * issues. Sometimes, though, we want to use a query's output, let the end user
 * modify it, and then pass data back with the same shape as a mutation's input.
 * But because the corresponding input type for the mutation doesn't have
 * __typename, the mutation fails. So, this helper function removes __typename
 * recursively from a query result.
 */
export function stripTypename<T extends object>(it: T): WithoutTypename<T> {
  return (
    Array.isArray(it)
      ? it.map(stripTypename)
      : isPlainObject(it)
      ? mapValues(omit(it, '__typename'), stripTypename)
      : it
  ) as WithoutTypename<T>;
}

export type WithoutTypename<T> = T extends (infer U)[]
  ? WithoutTypename<U>[]
  : T extends (...args: any[]) => any
  ? T
  : T extends object
  ? Omit<{ [K in keyof T]: WithoutTypename<T[K]> }, '__typename'>
  : T;
