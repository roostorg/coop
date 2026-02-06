/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type Bottle from '@ethanresnick/bottlejs';

import { __throw } from '../utils/misc.js';
import { type Dependencies as Deps } from './index.js';

const DEPENDENCIES = Symbol();
type DepName = keyof Deps;

export type Factory<D extends any[], R extends any> =
  | ((...args: D) => R)
  | (new (...args: D) => R);

export type AnnotatedFactory<ServiceType> = Factory<any[], ServiceType> & {
  [DEPENDENCIES]: DepName[];
};

/**
 * Inject is used to define the dependencies that a service (or other injectable
 * value) will need in order to create the service. It has a ton of overloads
 * to support static typing for the injected dependencies based on their name.
 *
 * @param deps A list of dependency names. These dictate the dependencies to
 *   inject when the container calls factory.
 *
 * @param factory A function that will return the value (to be stored in the
 *   container) for a service/injectable. This factory function will be called
 *   with instances of the dependencies specified in `deps`. A class can also be
 *   passed here, as (ofc) classes in js are runtime values represented by their
 *   constructor function, which works as the factory.
 *
 * @returns A version of the factory function that can be passed to
 *   {@link register}, and that will be set up with bottle to have the right
 *   dependencies injected.
 */
export function inject<F extends Factory<[], any>>(
  deps: [],
  factory: F,
): F & { [DEPENDENCIES]: [] };
export function inject<T extends DepName, F extends Factory<[Deps[T]], any>>(
  deps: [T],
  factory: F,
): F & { [DEPENDENCIES]: [T] };
export function inject<
  T extends DepName,
  U extends DepName,
  F extends Factory<[Deps[T], Deps[U]], any>,
>(deps: [T, U], factory: F): F & { [DEPENDENCIES]: [T, U] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  F extends Factory<[Deps[T], Deps[U], Deps[V]], any>,
>(deps: [T, U, V], factory: F): F & { [DEPENDENCIES]: [T, U, V] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  F extends Factory<[Deps[T], Deps[U], Deps[V], Deps[W]], any>,
>(deps: [T, U, V, W], factory: F): F & { [DEPENDENCIES]: [T, U, V, W] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  F extends Factory<[Deps[T], Deps[U], Deps[V], Deps[W], Deps[X]], any>,
>(deps: [T, U, V, W, X], factory: F): F & { [DEPENDENCIES]: [T, U, V, W, X] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  F extends Factory<
    [Deps[T], Deps[U], Deps[V], Deps[W], Deps[X], Deps[Y]],
    any
  >,
>(
  deps: [T, U, V, W, X, Y],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  F extends Factory<
    [Deps[T], Deps[U], Deps[V], Deps[W], Deps[X], Deps[Y], Deps[Z]],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  F extends Factory<
    [Deps[T], Deps[U], Deps[V], Deps[W], Deps[X], Deps[Y], Deps[Z], Deps[S]],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  M extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
      Deps[M],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  M extends DepName,
  L extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
      Deps[M],
      Deps[L],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  M extends DepName,
  L extends DepName,
  K extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
      Deps[M],
      Deps[L],
      Deps[K],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K] };
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  M extends DepName,
  L extends DepName,
  K extends DepName,
  J extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
      Deps[M],
      Deps[L],
      Deps[K],
      Deps[J],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K, J],
  factory: F,
): F & { [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K, J] };

export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  M extends DepName,
  L extends DepName,
  K extends DepName,
  J extends DepName,
  I extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
      Deps[M],
      Deps[L],
      Deps[K],
      Deps[J],
      Deps[I],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K, J, I],
  factory: F,
): F & {
  [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K, J, I];
};
export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  M extends DepName,
  L extends DepName,
  K extends DepName,
  J extends DepName,
  I extends DepName,
  H extends DepName,
  G extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
      Deps[M],
      Deps[L],
      Deps[K],
      Deps[J],
      Deps[I],
      Deps[H],
      Deps[G],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K, J, I, H, G],
  factory: F,
): F & {
  [DEPENDENCIES]: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K, J, I, H, G];
};

export function inject<
  T extends DepName,
  U extends DepName,
  V extends DepName,
  W extends DepName,
  X extends DepName,
  Y extends DepName,
  Z extends DepName,
  S extends DepName,
  R extends DepName,
  Q extends DepName,
  P extends DepName,
  O extends DepName,
  N extends DepName,
  M extends DepName,
  L extends DepName,
  K extends DepName,
  J extends DepName,
  I extends DepName,
  H extends DepName,
  G extends DepName,
  // no F
  E extends DepName,
  F extends Factory<
    [
      Deps[T],
      Deps[U],
      Deps[V],
      Deps[W],
      Deps[X],
      Deps[Y],
      Deps[Z],
      Deps[S],
      Deps[R],
      Deps[Q],
      Deps[P],
      Deps[O],
      Deps[N],
      Deps[M],
      Deps[L],
      Deps[K],
      Deps[J],
      Deps[I],
      Deps[H],
      Deps[G],
      Deps[E],
    ],
    any
  >,
>(
  deps: [T, U, V, W, X, Y, Z, S, R, Q, P, O, N, M, L, K, J, I, H, G, E],
  factory: F,
): F & {
  [DEPENDENCIES]: [
    T,
    U,
    V,
    W,
    X,
    Y,
    Z,
    S,
    R,
    Q,
    P,
    O,
    N,
    M,
    L,
    K,
    J,
    I,
    H,
    G,
    E,
  ];
};
export function inject<F extends (...it: any[]) => any>(
  deps: DepName[],
  factory: F,
): F & { [DEPENDENCIES]: DepName[] } {
  (factory as any)[DEPENDENCIES] = deps;
  return factory as any;
}

export function register<T extends keyof Deps & string>(
  bottle: Bottle<Deps>,
  name: T,
  factory: AnnotatedFactory<Deps[T]>,
) {
  const deps = factory[DEPENDENCIES];
  if (isConstructable(factory)) {
    bottle.service<T>(name, factory, ...deps);
  } else {
    bottle.serviceFactory(name, factory, ...deps);
  }
}

// See https://stackoverflow.com/a/49510834/1261879
function isConstructable(fn: any): fn is new (...args: any[]) => any {
  try {
    // eslint-disable-next-line no-new
    new new Proxy(fn, { construct: () => ({}) })();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Gets an env var, or throws if the variable is undefined. This is critical to
 * make the app hard crash early (so we'll get alerts) if some expected config
 * var is missing.
 */
export function safeGetEnvVar(varName: string): string {
  return (
    process.env[varName] ?? __throw(new Error(`Missing env var ${varName}`))
  );
}
