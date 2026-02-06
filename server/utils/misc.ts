import crypto from 'node:crypto';
import { setTimeout } from 'node:timers';
import { promisify } from 'node:util';
import _ from 'lodash';
import { type Simplify, type SnakeCasedProperties } from 'type-fest';

import {
  type CamelToSnakeCase,
  type PickEach,
  type RenameEach,
  type SnakeCasedPropertiesDeepWithArrays,
  type SnakeToCamelCase,
} from './typescript-types.js';

const { pick } = _;

export function pad(padWithChar: string, targetLength: number, str: string) {
  const strFinal = String(str);
  const padding = padWithChar.repeat(
    Math.max(0, targetLength - strFinal.length),
  );
  return padding + strFinal;
}

/**
 * Takes a function, calls it, and returns whether the function threw
 * (synchronously).
 */
export function doesThrow(fn: () => unknown) {
  try {
    fn();
    return false;
  } catch (e) {
    return true;
  }
}

export const __throw = (x: unknown): never => {
  throw x;
};

export const thrownValueToString = (e: unknown) =>
  e && typeof e === 'object' && 'message' in e ? String(e.message) : undefined;

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
  props: readonly U[],
): Simplify<PickEach<T, U>> {
  return pick(obj, props) satisfies object as PickEach<T, U>;
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

// TODO: replace w/ Object.hasOwn when it's in lib.d.ts and we're all on latest Node.
// https://github.com/microsoft/TypeScript/issues/44253
export function hasOwn(obj: object, key: string | symbol) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 *
 * @param {number} ms Number of miliseconds before resolution.
 */
export async function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    return setTimeout(resolve, ms).unref();
  });
}

/**
 * Returns a promise that resolves when the (optionally async) predicate becomes
 * true. Waits `pollingIntervalMs` between tests of the predicate's truthiness;
 * rejects if `timeoutMs` is reached.
 */
export async function waitFor(
  predicate: () => Promise<boolean>,
  opts: { pollingIntervalMs: number; timeoutMs?: number },
): Promise<void> {
  const { pollingIntervalMs, timeoutMs = Infinity } = opts;

  let timeoutElapsed = false;
  if (timeoutMs !== Infinity && timeoutMs > 0) {
    setTimeout(() => {
      timeoutElapsed = true;
    }, timeoutMs).unref();
  }

  while (!timeoutElapsed) {
    if (await predicate()) {
      return;
    }

    await sleep(pollingIntervalMs);
  }

  throw new Error('Timeout reached.');
}

export function snakeToCamelCase<S extends string>(s: S) {
  return s.replace(/_(.)/g, (_m, p1) =>
    p1.toUpperCase(),
  ) as SnakeToCamelCase<S>;
}

export function camelToSnakeCase<S extends string>(s: S) {
  return s
    .split(/(?=[A-Z])/)
    .join('_')
    .toLowerCase() as CamelToSnakeCase<S>;
}

/**
 * NB: If you pass in an array, any objects within that array won't have their
 * keys snake cased.
 */
export function camelCaseObjectKeysToSnakeCase<O extends object>(o: O) {
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [camelToSnakeCase(k), v]),
  ) as SnakeCasedProperties<O>;
}

/**
 * Takes an object or an array and recursively snake cases the key names of any
 * plain objects within the value.
 *
 * @param it
 * @returns
 */
export function camelCaseObjectKeysToSnakeCaseDeep<O extends object>(it: O) {
  return _camelCaseObjectKeysToSnakeCaseDeepHelper(it);
}

function _camelCaseObjectKeysToSnakeCaseDeepHelper<O>(
  o: O,
): SnakeCasedPropertiesDeepWithArrays<O> {
  return Array.isArray(o)
    ? (o.map((it) =>
        _camelCaseObjectKeysToSnakeCaseDeepHelper(it),
      ) as SnakeCasedPropertiesDeepWithArrays<O>)
    : _.isPlainObject(o)
    ? (Object.fromEntries(
        Object.entries(o as { [k: string]: unknown }).map(([k, v]) => [
          camelToSnakeCase(k),
          _camelCaseObjectKeysToSnakeCaseDeepHelper(v),
        ]),
      ) as SnakeCasedPropertiesDeepWithArrays<O>)
    : (o as SnakeCasedPropertiesDeepWithArrays<O>);
}

/**
 * This function merges the data from patch into object. It's very similar to
 * `Object.assign` _except_ that if the `patch` has an enumerable, own property
 * whose value is undefined, then the property from the `patch` is ignored and
 * the original value from `object` (if any) is left in place. Object.assign, by
 * contrast, would copy the value `undefined`. It's also similar to lodash's
 * merge, except it's not recursive.
 *
 * This is useful for working with GraphQL argument objects, where we
 * might pick some subset of known argument names into a new object, but give
 * them an undefined value in the process. E.g., imagine `someQuery(id: true)`,
 * where `id` is not mutable, and there are also optional arguments `y` and `z`.
 * So, the original args argument looked like `{ id: true }` and simply had no
 * key for `y` or `z`. But, if we do `{ id, y, z } = args`, and then
 * `patchInPlace(await getObjectById(id), { y, z })`, suddenly there are keys
 * for `y` and `z`, just with undefined values that we want to ignore.
 *
 * @param object The object to mutate by assigning the patch's fields to it.
 * @param patch An object of fields to set on the object.
 * @returns
 */
export function patchInPlace<T extends object>(object: T, patch: Partial<T>) {
  for (const k of Object.keys(patch) as (keyof T)[]) {
    if (typeof patch[k] !== 'undefined') {
      object[k] = patch[k]!;
    }
  }
}

export function removeUndefinedKeys<T extends object>(object: T) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return _.pickBy(object, (v) => v !== undefined);
}

/**
 * Gets the value of a property at a path, but short-circuits if any key along
 * the way isn't found. It's like `?.`, except it returns a magic symbol to
 * represent the None/short circuit case, so you can differentiate that from the
 * property's value actually being null or undefined.
 *
 * This function is also much more convenient than `?.` when handling `unknown`
 * values with TS (as you'd get in a catch block, where nothing's guaranteed
 * about the thrown value), as TS won't let you do `unknownValue?.someProp` even
 * though this can't crash at runtime (even if the LHS is a primitive) and
 * should probably just produce `unknown`.
 *
 * For example, imagine you have some value `err` that's `unknown`, but you
 * expect it might well be `{ response: { status: number } }`, and you want to
 * check something like `e.response.status === 500`. Doing this in a way that TS
 * will accept is incredibly cumbersome, and requires:
 *
 * ```ts
 * if(typeof e === 'object' && e !== null &&
 *    typeof (e as { response?: unknown }).response === 'object' &&
 *    (e as { response: { status?: unknown } | null }).response !== null &&
 *    (e as { response: { status?: unknown } }).response.status === 500) {
 *     // ok
 * }
 * ```
 *
 * No sane person would write the above. Instead, one can do
 * `safeGet(e, ['response', 'status'])`.
 */
export function safeGet(value: unknown, path: readonly string[]): unknown {
  if (path.length === 0) {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const [firstKey, ...remainingKeys] = path;

    return !(firstKey in value)
      ? noPropertyValueFound
      : safeGet((value as { [k: string]: unknown })[firstKey], remainingKeys);
  } else {
    return noPropertyValueFound;
  }
}

export const noPropertyValueFound = Symbol();

export function pickFromKeys<
  T extends object,
  U extends { [K in string]: keyof T },
>(object: T, newNamesToKeys: U) {
  const newEntries = Object.entries(newNamesToKeys).map(([newName, key]) => [
    newName,
    object[key],
  ]);
  return Object.fromEntries(newEntries) as RenameEach<
    PickEach<T, U[keyof U]>,
    { [K in keyof U]: U[K] }
  >;
}

/**
 * This takes a retry policy and a function and returns a version of the
 * function that, when called, will be automatically retried according to the
 * policy.
 *
 * @param retryPolicy.maxRetries - The maximum number of times to retry the
 *   function.
 * @param retryPolicy.initialTimeMsBetweenRetries - How long to wait after the
 *   first failure before retrying, in milliseconds.
 * @param retryPolicy.maxTimeMsBetweenRetries - The maximum time to wait between
 *   retries, in milliseconds. This can be useful b/c the time between retries
 *   grows by defualt, to implement the standard exponential backoff pattern.
 * @param retryPolicy.jitter - Whether to randomly vary the time between retries
 *   slightly, to prevent many retrying clients that are all using the same
 *   (standard) exponential backoff strategy from inadvertently overloading the
 *   service/resource that the function requires. Jitter is implemented as full
 *   jitter as defined here by AWS:
 *   https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 * @param retryPolicy.nextRetryWaitTimeMultiple - How much to multiply the wait
 *   time from the last retry to determine the wait time for the next retry.
 *   This defaults to 2 -- i.e., the wait time doubles between retries -- which
 *   gives the standard exponential backoff behavior.
 * @param retryPolicy.isRetryableError - If the function being subject to
 *   retries returns a promise that rejects, the rejection could've been because
 *   of an error that is not retryable, in which case the retry process should
 *   bail early. This option accepts a predicate function that receives the
 *   rejection value and returns whether the error is retryable. By default, all
 *   errors are considered retryable.
 * @param fn The function that will be run and retried as needed.
 * @returns A version of the function with automatic retries.
 */
export function withRetries<Args extends unknown[], Return>(
  retryPolicy: {
    maxRetries: number;
    initialTimeMsBetweenRetries: number;
    maxTimeMsBetweenRetries: number;
    jitter?: boolean;
    nextRetryWaitTimeMultiple?: number;
    isRetryableError?: (rejectionValue: unknown) => boolean;
  },
  fn: (this: void, ...args: Args) => Promise<Return>,
): (...args: Args) => Promise<Return> {
  const {
    maxRetries,
    initialTimeMsBetweenRetries,
    maxTimeMsBetweenRetries,
    jitter = true,
    nextRetryWaitTimeMultiple = 2,
    isRetryableError = () => true,
  } = retryPolicy;
  return async (...args) => {
    for (let i = 0; i <= maxRetries; ++i) {
      try {
        return await fn(...args);
      } catch (ex) {
        if (i === maxRetries || !isRetryableError(ex)) {
          throw ex;
        }
        const waitTimeMs = Math.min(
          maxTimeMsBetweenRetries,
          (jitter ? Math.random() : 1) *
            (initialTimeMsBetweenRetries * nextRetryWaitTimeMultiple ** i),
        );
        await sleep(waitTimeMs);
      }
    }
    throw new Error('Invalid retry attempts');
  };
}

export const asyncRandomBytes = promisify(crypto.randomBytes);
