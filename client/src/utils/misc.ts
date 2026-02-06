import { FormInstance } from 'antd';
import lodashIsPlainObject from 'lodash/isPlainObject';
import pick from 'lodash/pick';
import unzip from 'lodash/unzip';

/**
 * Identical to lodash.pick, except with more type safety.
 *
 * Lodash's pick has an overload in the type definition which allows one of its
 * generic parameters to fall back to being assigned without any constraint,
 * which defeats type safefty and loses autocomplete. This function just calls
 * pick, but has a safer signature for type inference.
 */
export function safePick<T extends object, U extends keyof T>(
  obj: T,
  props: U[],
) {
  return pick(obj, props);
}

export function isPlainObject(
  obj: unknown,
): obj is { [k: string | number | symbol]: unknown } {
  return lodashIsPlainObject(obj);
}

/**
 * This is a function that's used to help TS warn us if a union type that we
 * should've handled all cases for in fact has some cases unhandled.
 *
 * After handling all cases, you call `assertUnreachable(unionTypeVar)` and, if
 * you don't get a compiler error, it means that all the cases have truly been
 * handled, because TS has narrowed the type of unionTypeVar down to `never`.
 *
 * At runtime, this just throws an error, which is appropriate because it should
 * never be reached.
 */
export function assertUnreachable(
  _x: never,
  message: string = "Didn't expect to get here",
): never {
  throw new Error(message);
}

/**
 * A helper for debugging antd forms.
 *
 * @returns A pretty-printed JSON string of the form's state, which you can
 * console.log or render on the screen during dev.
 */
export function antdFormState(form: FormInstance, _fieldNames: string[]) {
  const fieldNamesAndValues = form.getFieldsValue();
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(fieldNamesAndValues).map(([name, value]) => [
        name,
        {
          value,
          touched: form.isFieldTouched(name),
          errors: form.getFieldError(name),
        },
      ]),
    ),
    undefined,
    4,
  );
}

/**
 * A type-safe wrapper around lodash unzip, that only works for arrays of
 * 2-tuples, but also handles inverting a `zip([], []) => []`, which callers
 * rely on and which unzip can't do, because it doesn't know how many source
 * arrays there would've been.
 */
export function unzip2<T, U>(it: readonly (readonly [T, U])[]) {
  return (it.length ? (unzip(it) as unknown) : [[], []]) as [T[], U[]];
}

/**
 * Util type definitions to allow us to recursively omit a certain key in a type.
 */
type OmitDistributive<T, K extends PropertyKey> = T extends any
  ? T extends object
    ? Id<OmitRecursively<T, K>>
    : T
  : never;
type Id<T> = {} & { [P in keyof T]: T[P] }; // Cosmetic to make tooltips expand the type
export type OmitRecursively<T extends any, K extends PropertyKey> = Omit<
  { [P in keyof T]: OmitDistributive<T[P], K> },
  K
>;

export const __throw = (x: unknown): never => {
  throw x;
};
