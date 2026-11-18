// Types and helpers for NestJS schema-first resolver classes. Each method takes
// its parameter and return types from the graphql-codegen resolver types, so a
// class resolver is checked against the SDL just like a resolver map is.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

export type Fn<M, K extends keyof M> = Extract<NonNullable<M[K]>, AnyFn>;

export type P<M, K extends keyof M> = Parameters<Fn<M, K>>;

/**
 * Turns a resolver class instance into a plain `{ field: fn }` map, with each
 * method bound to the instance. Unit tests use it to call class resolvers the
 * same way they call resolver-map functions.
 */
export function resolverMapOf(instance: object): Record<string, AnyFn> {
  const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
  return Object.fromEntries(
    Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor')
      .map((name) => [name, (proto[name] as AnyFn).bind(instance)]),
  );
}
