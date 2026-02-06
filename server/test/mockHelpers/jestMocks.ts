// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

type FunctionKeys<T extends object> = {
  [K in keyof T]: T[K] extends AnyFn ? K : never;
}[keyof T];

// We used to get our jest types from a slightly different package
// (@jest/globals rather than @types/jest), which typed jest.fn() differently.
// So, below, we add back an overload matching the old type for back compat.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    function fn<T extends AnyFn>(
      implementation?: T,
    ): Mock<ReturnType<T>, Parameters<T>>;
  }
}

export type MockedFn<T extends AnyFn> = T &
  jest.Mock<ReturnType<T>, Parameters<T>>;

/**
 * This takes an object and returns a version of it where the requested methods
 * have been replaced by jest mocked functions (i.e., jest.fn()).
 *
 * Functionality like this doesn't appear to be built-in to jest, which is a bit
 * annoying because other libraries like sinon have it. But, rather than switch
 * to one of those other libraries, we want to stick with jest.fn because it has
 * deep integration with the jest test runner (which can, e.g., clear the
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
    // eslint-disable-next-line better-mutation/no-mutation
    mock[k] = jest.fn((obj[k] as AnyFn).bind(obj));
  }

  return mock as Mocked<T, Keys>;
}

export type Mocked<T extends object, Keys extends FunctionKeys<T>> = T & {
  [K in Keys]: T[K] extends AnyFn ? MockedFn<T[K]> : never;
};
