import _ from 'lodash';

const { omit } = _;

/**
 * In GraphQL, input types don't support unions in the same way output types do.
 * Instead, for input types, the convention for representing what is logically
 * still a tagged union is to use an object type where there's one field for
 * each possible constituent of the union, and then only the applicable field is
 * given a value on input data. This way of representing a union is inconsistent
 * with how we tend to represent unions on the backend/in TS, which involves
 * putting the discriminator as a `type` key's value within the union type's
 * object value.
 *
 * Given these conventions, this function converts between the input type and
 * our backend representations.
 *
 * E.g., if the schema is:
 *
 * ```gql
 * input XInput { a: AInput, B: BInput }
 * input AInput { hello: String! }
 * input BInput { _: true }
 * ```
 *
 * Then calling:
 *
 * ```
 * oneOfInputToTaggedUnion(
 *   { a: { hello: 'World' } }, // value of union XInput
 *   { a: 'A', b: 'B' } // map of input keys to the final `type` values.
 * )
 * ```
 *
 * returns `{ type: 'A', hello: 'World' }`
 *
 * The use of an optional `_` property in the `BInput` type is a graphql
 * convention for when one constituent of the union doesn't need any extra fields.
 * (See https://github.com/graphql/graphql-spec/pull/825#issuecomment-1182979316).
 * Accordingly, this function also strips off any input value field called `_`.
 *
 * This function uses `type` as the key for holding the tag, which we might
 * support customizing later (though that gets tricky to express in TS).
 *
 * @param gqlInputValue
 * @param inputKeyToTypeValueMap
 * @returns
 */
export function oneOfInputToTaggedUnion<
  InputValue extends Record<string, object | undefined | null>,
  TypeValue extends string,
  Mapping extends { [K in keyof InputValue]: TypeValue },
>(gqlInputValue: InputValue, inputKeyToTypeValueMap: Mapping) {
  const inputFilledEntries = Object.entries(gqlInputValue).filter(
    ([_k, v]) => v != null,
  ) as [keyof InputValue, InputValue][];

  if (inputFilledEntries.length !== 1) {
    throw new Error(
      'Input object must have exactly one key with a (non-null) value.',
    );
  }

  const [inputKey, inputValue] = inputFilledEntries[0];

  return {
    type: inputKeyToTypeValueMap[inputKey],
    ...omit(inputValue, '_'),
  } as unknown as Exclude<
    {
      [K in keyof InputValue]: { type: Mapping[K] } & Omit<
        Exclude<InputValue[K], null | undefined>,
        '_'
      >;
    }[keyof InputValue],
    undefined
  >;
}
