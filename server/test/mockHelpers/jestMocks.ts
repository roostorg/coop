import { vi, type Mock } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

type FunctionKeys<T extends object> = {
  [K in keyof T]: T[K] extends AnyFn ? K : never;
}[keyof T];

export type MockedFn<T extends AnyFn> = T & Mock<T>;

/**
 * This takes an object and returns a version of it where the requested methods
 * have been replaced by Vitest mocked functions (i.e., vi.fn()).
 *
 * Functionality like this doesn't appear to be built-in to Vitest, which is a bit
 * annoying because other libraries like sinon have it. But, rather than switch
 * to one of those other libraries, we want to stick with vi.fn because it has
 * deep integration with the Vitest test runner (which can, e.g., clear the
 * history of all mocks between tests), which is too convenient to give up.
 * So, instead, we implement this functionality ourselves.
 */
export function mocked<T extends object, Keys extends FunctionKeys<T>>(
  obj: T,
  keys: Keys[],
) {
  // put the original object in the prototype chain of the returned object,
  // rather than, e.g., spreading its keys, so that prototype look ups and
  // instanceof checks still work.
  const mock = Object.create(obj);
  for (const k of keys) {
    // eslint-disable-next-line functional/immutable-data
    mock[k] = vi.fn((obj[k] as AnyFn).bind(obj));
  }

  return mock as Mocked<T, Keys>;
}

export type Mocked<T extends object, Keys extends FunctionKeys<T>> = T & {
  [K in Keys]: T[K] extends AnyFn ? MockedFn<T[K]> : never;
};
