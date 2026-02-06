/* eslint-disable max-lines */
import {
  type Opaque,
  type Primitive,
  type Simplify,
  type SnakeCase,
  type UnwrapOpaque,
} from 'type-fest';

import { __throw } from './misc.js';

export type WithUndefined<T extends object> = { [K in keyof T]?: undefined };

export type {
  SnakeCase as CamelToSnakeCase,
  CamelCase as SnakeToCamelCase,
  ReadonlyDeep,
} from 'type-fest';

/**
 * Equivalent to SnakeCasePropertiesDeep from type-fest, except that it also
 * recursively transforms the keys of objects in array/tuple types.
 */
export type SnakeCasedPropertiesDeepWithArrays<T> = T extends
  | readonly []
  | readonly [...never[]]
  ? readonly []
  : T extends readonly [infer U, ...infer V]
  ? readonly [
      SnakeCasedPropertiesDeepWithArrays<U>,
      ...SnakeCasedPropertiesDeepWithArrays<V>,
    ]
  : T extends readonly [...infer U, infer V]
  ? readonly [
      ...SnakeCasedPropertiesDeepWithArrays<U>,
      SnakeCasedPropertiesDeepWithArrays<V>,
    ]
  : T extends ReadonlyArray<infer ItemType>
  ? ReadonlyArray<SnakeCasedPropertiesDeepWithArrays<ItemType>>
  : T extends object
  ? { [K in keyof T as SnakeCase<K>]: SnakeCasedPropertiesDeepWithArrays<T[K]> }
  : T;

export type StringKeys<T extends object> = keyof T & string;

export type RequiredWithoutNull<T> = {
  [P in keyof T]-?: Exclude<T[P], null>;
};

export type Mutable<T> = T extends readonly (infer U)[]
  ? U[]
  : { -readonly [K in keyof T]: T[K] };

/**
 * Synchronous iterables can be used as async iterables (i.e., code can await
 * the values they yield and it's a no-op), so functions that sometimes need to
 * accept async iterables should also be able to be called with a sync iterable;
 * this makes that easier to type.
 */
export type IterableOrAsyncIterable<T> = Iterable<T> | AsyncIterable<T>;

/**
 * Extracts the public method names from a type T, returning a union of string
 * literal types. Also works on plain objects, for which it returns the name of
 * any function-holding properties.
 */
export type PublicMethodNames<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Returns a value cast to be typed as a compatible opaque type.
 *
 * @template OpaqueType The opaque type to cast the given value `value` to.
 * @param value The value that is to be cast to the given opaque type.
 */
export function instantiateOpaqueType<OpaqueType extends Opaque<unknown>>(
  value: UnwrapOpaque<OpaqueType>,
): OpaqueType {
  return value as OpaqueType;
}

/**
 * Takes a value typed as an opaque type and returns it cast to its runtime
 * representation.
 *
 * @param value The opaque value that is to be casted to its runtime type.
 */
export function unwrapOpaqueValue<OpaqueType extends Opaque<unknown>>(
  value: OpaqueType,
): UnwrapOpaque<OpaqueType> {
  return value as UnwrapOpaque<OpaqueType>;
}

// A convenient helper for building types that have different values based on
// some boolean generic.
export type If<Cond extends boolean, IfTrue, IfFalse> = Cond extends true
  ? IfTrue
  : Cond extends false
  ? IfFalse
  : IfTrue | IfFalse;

export type NullableKeysOf<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

export type Bind1<
  F extends (arg0: A0, ...args: never[]) => unknown,
  A0 = never,
> = F extends (arg0: A0, ...args: infer Args) => infer R
  ? (...args: Args) => R
  : never;

export type Bind2<
  F extends (arg0: A0, arg1: A1, ...args: never[]) => unknown,
  A0 = never,
  A1 = never,
> = F extends (arg0: A0, arg1: A1, ...args: infer Args) => infer R
  ? (...args: Args) => R
  : never;

export type Bind3<
  F extends (arg0: A0, arg1: A1, arg2: A2, ...args: never[]) => unknown,
  A0 = never,
  A1 = never,
  A2 = never,
> = F extends (arg0: A0, arg1: A1, arg2: A2, ...args: infer Args) => infer R
  ? (...args: Args) => R
  : never;

export type Bind4<
  F extends (
    arg0: A0,
    arg1: A1,
    arg2: A2,
    arg3: A3,
    ...args: never[]
  ) => unknown,
  A0 = never,
  A1 = never,
  A2 = never,
  A3 = never,
> = F extends (
  arg0: A0,
  arg1: A1,
  arg2: A2,
  arg3: A3,
  ...args: infer Args
) => infer R
  ? (...args: Args) => R
  : never;

/**
 * Takes a tuple type, and returns a new tuple type with the first N elements
 * removed.
 */
export type DropN<T extends readonly unknown[], N extends number> = N extends 0
  ? T
  : T extends readonly [unknown, ...infer U] // @ts-ignore
  ? DropN<U, Nat2Number<Dec<Number2Nat<N>>>>
  : never;

// Types for doing math in TS, by representing each natural number as a tuple
// type with n elements, and exploiting its ability to track a tuple's length
// as a number literal type.
type Zero = readonly [];
type SomeNat = readonly [...unknown[]];
type Succ<N extends SomeNat> = readonly [...N, unknown];
type Dec<N extends SomeNat> = N extends readonly [unknown, ...infer T]
  ? T
  : never;
type Nat2Number<N extends SomeNat> = N['length'];
type Number2Nat<
  I extends number,
  N extends SomeNat = Zero,
> = I extends Nat2Number<N> ? N : Number2Nat<I, Succ<N>>;
// type NumericToNat<I extends string> = I extends `${infer T extends number}`
//   ? Number2Nat<T>
//   : never;

// type Min2<N extends SomeNat, M extends SomeNat> = ((
//   ...args: N
// ) => any) extends (...args: M) => any
//   ? N
//   : M;

// type Min<T extends SomeNat[]> = T extends [
//   infer M,
//   infer N,
//   ...infer R extends SomeNat[],
// ]
//   ? //@ts-ignore
//     Min2<M, Min<[N, ...R]>>
//   : T extends [infer M, infer N]
//   ? Min2<M, N>
//   : T extends [infer M]
//   ? M
//   : Zero;

// type Max2<N extends SomeNat, M extends SomeNat> = ((
//   ...args: N
// ) => any) extends (...args: M) => any
//   ? M
//   : N;

// type MaxOfUnion<It extends number> = Nat2Number<
//   Parameters<
//     UnionToIntersection<{ [K in It]: (...it: Number2Nat<K>) => any }[It]>
//   >
// >;

// type MinOfUnion<It extends number> = Exclude<It, MaxOfUnion<It>> extends never
//   ? It
//   : MinOfUnion<Exclude<It, MaxOfUnion<It>>>;

// type Add<N extends SomeNat, M extends SomeNat> = readonly [...N, ...M];
// type Multiply<N extends SomeNat, M extends SomeNat> = M extends Zero
//   ? Zero
//   : Add<N, Multiply<N, Dec<M>>>;
// type Subtract<N extends SomeNat, M extends SomeNat> = M extends Zero
//   ? N
//   : Subtract<Dec<N>, Dec<M>>;

/**
 * If you have an object type w/ a call signature but also some extra properties
 * (e.g., `{ (): Promise<void>, restoreOriginal: () => void }`), this returns
 * just the call signature (`() => Promise<void>` in the example above).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CallSignature<T extends (...args: any) => any> = (
  ...args: Parameters<T>
) => ReturnType<T>;

export type NonEmptyString = Opaque<string, 'NonEmptyString'>;

export function isNonEmptyString(it: unknown): it is NonEmptyString {
  return typeof it === 'string' && it !== '';
}

export function tryParseNonEmptyString(it: unknown) {
  return isNonEmptyString(it)
    ? it
    : __throw(new Error('Was not an NonEmptyString'));
}

export function areAllValuesNonEmptyStrings<T extends { [K: string]: string }>(
  it: T,
): it is { [K in keyof T]: T[K] & NonEmptyString } {
  return Object.values(it).every(isNonEmptyString);
}

export function areAllArrayValuesNonEmptyString<T>(
  it: readonly T[],
): it is readonly (T & NonEmptyString)[] {
  return it.every(isNonEmptyString);
}

export type NonEmptyArray<T> = [T, ...T[]];

// This overload is needed to help TS reduce the resulting type properly. I.e.,
// if `isNonEmptyArray` is called with a mutable `T[]`, the result will be:
// `T[] & readonly NonEmptyArray<T>`, which TS can't simplify neatly to
// NonEmptyArray<T>.
export function isNonEmptyArray<T>(arr: Array<T>): arr is NonEmptyArray<T>;
export function isNonEmptyArray<T>(
  arr: ReadonlyArray<T>,
): arr is Readonly<NonEmptyArray<T>>;
export function isNonEmptyArray<T>(
  arr: Readonly<Array<T>>,
): arr is Readonly<NonEmptyArray<T>> {
  return arr.length > 0;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type UnionToIntersection<T> = (
  T extends any ? (x: T) => any : never
) extends (x: infer R) => any
  ? R
  : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type RenameEach<
  Union,
  Renames extends { [K in string]: keyof Union },
> = Union extends object ? { [K in keyof Renames]: Union[Renames[K]] } : never;

/**
 * This type is exactly like Pick, except that it takes a union type as its
 * first argument, and returns a union of the picked types. Concretely:
 *
 * ```
 * Pick<
 *   { id: string, x: string, y: any } | { id: number, x: number, y: any },
 *   'id' | 'x'
 * >
 * ```
 *
 * returns
 *
 * ```
 * { id: string | number, x: string | number }
 * ```
 *
 * Whereas `PickEach` preserves the original structure, giving
 *
 * { id: string, x: string } | { id: number, x: number }
 *
 * The difference is that the second type, correctly, rejects an object like
 * `{ id: 'string', x: 4 }`.
 *
 * This works by exploiting that fact that conditional types distribute over
 * unions in TS.
 */
export type PickEach<Union, Keys extends keyof Union> = Union extends unknown
  ? Pick<Union, Keys>
  : never;

/**
 * This type is exactly like Omit, except that it takes a union type as its
 * first argument, and returns a union of the omitted types. See {@link PickEach}
 * docblock for a concrete example of this behavior.
 */
export type OmitEach<Union, Keys extends keyof Union> = Union extends unknown
  ? Omit<Union, Keys>
  : never;
/**
 * CollapseCases takes a type T that's a union of object types, and returns a
 * single object type where the type of each key is the union of the types for
 * that key across all the cases of T.
 *
 * For example, if you have:
 *
 * type A = { id: 'A' }
 * type B = { id: 'B' }
 * type C = { id: 'C' }
 *
 * type Item =
 *  | { id: string; type: A; }
 *  | { id: string; type: B; }
 *  | { id: string; type: C; }
 *
 * Then, `CollapseCases<Item>` will be: `{ id: string, type: A | B | C }`.
 *
 * This can be useful because Typescript checks assignability case by case,
 * so a type like `{ id: string, type: A | B | C }` would not be assignable
 * to Item, because TS can only see that it's not known to be assignable to
 * any of Item's individual cases.
 *
 * The fix, assuming `x` has type `{ id: string, type: A | B | C }`,
 * would be something like `x satisfies CollapseCases<Item> as Item`.
 *
 * Note: in cases where a key only appears in some of the cases, the
 * result type will have that key as optional, and typed as `unknown`.
 *  E.g., `CollapseCases<{ a: string } | { b: string }>` will be
 * `{ a?: unknown, b?: unknown }`. This is the correct type because the first
 * type in the union can be satisfied with any value in its key for `b`, and
 * vice-versa. I.e., `{ a: 'hello', b: true }` and `{ a: 42, b: 'hello' }` are
 * both legal assignments to `{ a: string } | { b: string }` (ignoring
 * excess property checking heuristics that only sometimes apply), as they
 * satisfy the first and second case respectively.
 */
export type CollapseCases<T extends object> = Simplify<
  Pick<T, keyof T> & Partial<Pick<T, AllKeys<T>>>
>;

/**
 * Returns all the keys from a union of object types.
 *
 * I.e., with a `type T = { a: number, b: string } | { a: boolean }`,
 *
 * I.e., `keyof T` will normally only return `'a'`, because `keyof` with an
 * object type union returns the keys that exist in _every_ constituent of the
 * union. However, AllKeys<T> will return `'a' | 'b'`.
 */
export type AllKeys<T extends object> = T extends object ? keyof T : never;

/**
 * Returns the first type parameter, while giving a type error if the first
 * parameter's type isn't assignable to the second parameter's type.
 *
 * This is like a type-level equivalent of the `satisfies` operator: in the same
 * way that you'd write `exprOfTypeT satisfies U` to get the `exprOfTypeT` typed
 * as `T` while ensuring that the type is a `U`, you can write `Satisfies<T, U>`
 * to get a type `T` while ensuring that it's assignable to `U`.
 */
export type Satisfies<T extends U, U> = T;

/**
 * Returns the first type parameter, while enforcing that it's a supertype of
 * the second parameter.
 */
export type SatisfiedBy<T, _U extends T> = T;

/**
 * This type allows you to make sure that every case in one tagged union has a
 * corresponding case in another tagged union. For example, imagine you have:
 *
 * type Job =
 *   | { type: 'USER_INITIATED', startedAt: Date };
 *   | { type: 'CRON', startedAt: Date, schedule: string };
 *
 * Now, imagine somewhere else you want to define (say) the shape of db rows
 * that'll store a job. In this type, the keys are cased differently, and you
 * might attach some extra metadata, like so:
 *
 * type JobRow =
 *   | { type: 'USER_INITIATED', started_at: Date, initiated_by: UserId }
 *   | { type: 'CRON', started_at: Date, schedule: string };
 *
 * Still, you want every `type` of Job to have a corresponding `type` in JobRow;
 * otherwise, some jobs may not be able to be stored correctly. But, the
 * question is: how can you make TS enforce that?
 *
 * The answer is to use this type, like so:
 *
 * type JobRow2 = TaggedUnionFromCases<
 *   { type: Job['type'] },
 *   {
 *     USER_INITIATED: { started_at: Date, initiated_by: UserId },
 *     CRON: { started_at: Date, schedule: string }
 *   }
 * >
 *
 * The JobRow2 type will be exactly equal to the original JobRow type, but TS
 * will give an error if the object type passed as the second type parameter
 * doesn't have a key for every `type` value in Job.
 *
 * To unpack the above, the first type parameter holds an object type whose
 * single key will be used as the discriminator key in the final type, and whose
 * value is the union of all the required values of the discriminator key.
 *
 * Then, the second type parameter is an object type whose keys are the possible
 * values of the discriminator key, and whose values are the corresponding
 * fields that should be present in that case.
 *
 * This, honestly, is not the most intuitive API, but it's the best I could come
 * up with.
 */
export type TaggedUnionFromCases<
  TagWithValues extends object,
  Map extends { [K in TagValues]: unknown },
  TagKey extends keyof TagWithValues = keyof TagWithValues,
  TagValues extends TagWithValues[TagKey] &
    (string | number | symbol) = TagWithValues[TagKey] &
    (string | number | symbol),
> = { [K in TagValues]: Simplify<{ [K2 in TagKey]: K } & Map[K]> }[TagValues];

/**
 * Same as CollapseCases, but does it recursively on object types. Useful when
 * the type with the discriminated union is nested inside another object.
 *
 * For example with:
 *
 * type T =
 *   | { name: 'A', data: { value: 'C' | 'D' } }
 *   | { name: 'B', data: { value: 'E' | 'F' } }
 *
 * `CollapseCasesDeep<T>` will be:
 *
 * { name: 'A' | 'B', data: { value: 'C' | 'D' | 'E' | 'F' } }
 *
 * Whereas `CollapseCases<T>` would only be:
 *
 * { name: 'A' | 'B', data: { value: 'C' | 'D' } | { value: 'E' | 'F' } }
 */
export type CollapseCasesDeep<T extends object> = Simplify<
  {
    // For all the keys in T that are in _any_ case (if T is a union) but not
    // in _every_ case (which is what `keyof T` returns), make them optional.
    [K in Exclude<AllKeys<T>, keyof T>]?: T[K] extends object
      ? CollapseCasesDeep<T[K]>
      : T[K];
  } & {
    // Meanwhile, the keys from every case are required in the final object
    // type. `AllKeys<T> & keyof T` here might seem redundant, and it is, in the
    // sense that it's always equal to just `keyof T`. However, it's necessary
    // to prevent a TS rule from kicking in whereby, if T is a union, TS will
    // silently distribute in the { [K in keyof T]: ... } type, which we don't
    // want.
    [K in AllKeys<T> & keyof T]: T[K] extends object
      ? CollapseCasesDeep<T[K]>
      : T[K];
  }
>;

/**
 * This type allows you to replace a type within a complex type. It works
 * recursively, so it can handle nested types as well.
 *
 * @template Type The original type.
 * @template Search The type to be replaced. Any time it -- or a subtype of it
 *   -- is found (deeply) within @see {Type}, it will be replaced.
 * @template Replacement The type to replace with.
 *
 * @example
 *  ReplaceDeep<{ a: "x" | "y", b: { c: number } }, string, number> will return
 *  { a: number, b: { c: number } }. The type of `a` is replaced b/c "x" | "y"
 *  is a subtype of `string`, even though it's not exactly `string`.
 *
 * @example
 *   ReplaceDeep<{ a: string, b: { c: number } }, "x", number> will return
 *   the first type parameter without doing any replacements. The type of `a` is
 *   _not_ replaced, b/c string is not assignable to (i.e., isn't necesssarily)
 *   the "x" that's being searched for.
 */
export type ReplaceDeep<
  Type,
  Search,
  Replacement,
  IncludeFunctions extends boolean = false,
> = Type extends Search
  ? Replacement
  : Type extends Opaque<unknown, infer Tag>
  ? Opaque<ReplaceDeep<UnwrapOpaque<Type>, Search, Replacement>, Tag>
  : Type extends Primitive | Date | RegExp
  ? Type
  : // Treat Promises and AsyncIterables specially because, while it's possible
  // to do replacement totally structurally, that's likely undesirable and might
  // push up against TS limits deep in the replacement
  Type extends Promise<infer T>
  ? Promise<ReplaceDeep<T, Search, Replacement, IncludeFunctions>>
  : Type extends AsyncIterable<infer T>
  ? Simplify<
      AsyncIterable<ReplaceDeep<T, Search, Replacement, IncludeFunctions>> &
        Omit<Type, typeof Symbol.asyncIterator>
    >
  : IncludeFunctions extends true
  ? Type extends (...args: infer Args) => infer R
    ? (
        ...args: ReplaceDeep<Args, Search, Replacement, IncludeFunctions> &
          unknown[]
      ) => ReplaceDeep<R, Search, Replacement, IncludeFunctions>
    : ReplaceObjectDeep<Type, Search, Replacement, IncludeFunctions>
  : ReplaceObjectDeep<Type, Search, Replacement, IncludeFunctions>;

type ReplaceObjectDeep<
  Type,
  Search,
  Replacement,
  IncludeFunctions extends boolean = false,
> = Type extends object
  ? {
      [Key in keyof Type]: ReplaceDeep<
        Type[Key],
        Search,
        Replacement,
        IncludeFunctions
      >;
    }
  : never;
