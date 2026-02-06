import { type CoopError, type CoopErrorName } from '../../utils/errors.js';

/**
 * Takes a result from our data fetching/model layer and returns an object that
 * can be used to serialize the result to GraphQL, as a "success" constituent of
 * a result union type.
 *
 * This assumes that, for a given mutation, the GQL return type will be a union
 * type with some success cases (probably only one) and some error cases. To
 * serialize the success data from the model layer, though, we need to "tag" it
 * with the name of the success case's type, which the model layer shouldn't
 * know how to do. So this function handles that.
 *
 * @param result The success data.
 * @param name The name of the GraphQL type in the union that represents success.
 */
export function gqlSuccessResult<T extends object, U extends string>(
  result: T,
  name: U,
) {
  return {
    __typename: name,
    ...result,
  };
}

/**
 * Takes an error from our data fetching/model layer and returns an object that
 * can be used to serialize the result to GraphQL, as an error constituent of a
 * result union type.
 *
 * This assumes that, for a given mutation, the GQL return type will be a union
 * type with some success cases (probably only one) and some error cases. To
 * serialize the error from the model layer, though, we need to "tag" it with
 * the name of the error's GQL type, which the model layer shouldn't know how
 * to do, and augment it with other info that's only available at the graphql
 * layer (like the pointer to the input data that triggered the error
 * function handles that.
 */
export function gqlErrorResult<T extends CoopErrorName>(
  error: CoopError<T>,
  sourcePointer?: string,
  requestId?: string,
) {
  return {
    __typename: error.name,
    ...error,
    requestId,
    pointer: sourcePointer ?? error.pointer,
  };
}
