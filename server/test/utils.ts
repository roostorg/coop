/**
 * Jest doesn't always do a good job surfacing thrown errors (or promise
 * rejections), so we use this helper a lot to log them w/ the test results.
 */
export function logErrorAndThrow(e: Error): never {
  console.error(e);
  throw e;
}

type Fixture<T extends Record<string, unknown>> = T & {
  cleanup?(): void | Promise<void>;
};

/**
 * This function simplifies the process of defining one or more tests that: a)
 * need some data or objects ("fixtures") to be setup before the test runs; and
 * b) need to cleanup that data when the test is complete. To see how this
 * function is useful, consider how you might setup/cleanup some fixtures
 * without this function:
 *
 * First, imagine that you only want the fixtures for a single test. In that
 * case, you might simply do:
 *
 * ```ts
 * it("some test...", () => {
 *   // setup data/fixtures here ("arrange")
 *
 *   // run test logic ("act" + "assert")
 *
 *  // do cleanup.
 * })
 * ```
 *
 * But there are two problems:
 *
 *  1) if any of the test logic throws (i.e., if the test fails), then the
 *     cleanup code will never run, leaving the system in an undesirable state.
 *     How problematic this is depends on exactly what state is left
 *     un-cleaned-up, and how our tests are written -- i.e., if most of our
 *     tests are written to not be effected by state created for other tests,
 *     which is a prerequisite for running tests in parallel, then the dangling
 *     state wouldn't matter for those tests. However, our tests aren't
 *     currently written like that, and there are likely to always be at least
 *     some cases where we'll want serial execution between a set of tests. For
 *     those, reliably executing the cleanup logic is important.
 *
 * 2) there's no way to share the setup and cleanup logic across a set of tests,
 *    which is often convenient (e.g., every test in some suite may want to
 *    create an X at the beginning and delete it at the end).
 *
 * To solve these problems, jest et al introduce the `beforeEach()` and
 * `afterEach()` methods for defining setup logic that'll run before/after all
 * the tests in a give suite. The advantage is that `afterEach()` runs even if
 * the test fails, saving the test code from being wrapped in a `try-finally`,
 * and the same `beforeEach`/`afterEach` logic can apply to multiple tests by
 * wrapping all those tests in the same `describe()` block (although the need
 * for that extra wrapping can sometimes feel a bit artifical and hurt
 * organization).
 *
 * However, with this `beforeEach`/`afterEach` pattern, a mutable, shared
 * variable is needed for a test (or the cleanup code) to get access to a value
 * created by `beforeEach`, like so:
 *
 * ```ts
 * let fixtureValue: SomeType;
 * beforeEach(async () => {
 *  fixtureValue = ....
 * })
 *
 * afterEach(async () => {
 *  await deleteFromDb(fixtureValue.id)
 * })
 *
 * test('...', () => {
 *  callSomething(fixtureValue);
 * })
 *
 * test('...', () => {
 *  callSomethingElse(fixtureValue);
 * })
 * ````
 *
 * The problem with this, fundamentally, is that it makes it impossible to ever
 * run the tests in parallel, because each test is referring to (and could
 * mutate) the shared `fixtureValue` variable. For that same reason, it also
 * makes the tests harder to read/refactor, as it's less clear whether the order
 * of the test matters (or whether a subsequent test will fail if a prior one is
 * skipped).
 *
 * `makeTestWithFixture` offers the same value as `beforeEach`/`afterEach` --
 * i.e. reusable setup/teardown logic, that'll run even if tests fail -- but
 * without the downsides of the tests referring to shared mutable variables.
 *
 * You use it like this:
 *
 * ```ts
 * // NB: name this constant something more appropriate based on the fixtures
 * // you're defining.
 * const testWithTwoSpecificFixtures = makeTestWithFixture(async () => {
 *   // create new object that is a fixture.
 *   const [fixtureOne, fixtureTwo] = await Promise.all([
 *     addSomethingToDb(), // for example.
 *     addSomethingToDb()
 *   ];
 *
 *   return {
 *     // the keys can be called whatever you want; one key per fixture value.
 *     fixtureOne,
 *     fixtureTwo,
 *     // this cleanup function has to be called cleanup.
 *     async cleanup() {
 *       await Promise.all([deleteFromDb(fixtureOne), deleteFromDb(fixtureTwo)])
 *     }
 *   }
 * })
 * ```
 *
 * This returns a new function, which is saved into `testWithObject` that, when
 * called, defines a jest test that has access to the fixture values (i.e.,
 * `fixtureOne` and `fixtureTwo`) as an argument to the function containing the
 * test code. The fixture values are destructurable by name. Then, the cleanup
 * code automatically runs after the test, regardless of whether the test fails.
 *
 * For example, to define two tests, each of which will get a fresh copy of
 * `fixtureOne` and `fixtureTwo` (i.e., the fixture-creating-and-cleanup
 * function passed to `makeTestWithFixture` will run for each test):
 *
 * ```ts
 * // Define the test by calling testWithObject, and destructure the fixture
 * // values by name.
 *
 * testWithTwoSpecificFixtures('...', ({ fixtureOne, fixtureTwo }) => {
 *  callSomething(fixtureOne);
 * })
 *
 * testWithTwoSpecificFixtures('...', ({ fixtureOne, fixtureTwo }) => {
 *  callSomethingElse(fixtureTwo);
 * })
 * ```
 *
 * @returns A function that registers/defines a test. This takes a name and a
 * function containing the code for the test case. That function can receives
 * the fixtures as an object and can destructure them by name.
 */
export function makeTestWithFixture<T extends Record<string, unknown>>(
  makeSetupTeardown: () => Promise<Fixture<T>> | Fixture<T>,
) {
  type JestItCall = (
    name: string,
    fn: (vars: T) => void | Promise<void>,
    timeout?: number | undefined,
  ) => void;

  const fn = _makeTestWithFixture(makeSetupTeardown) as JestItCall & {
    only: JestItCall;
    skip: JestItCall;
    todo: JestItCall;
  };
  // eslint-disable-next-line better-mutation/no-mutation
  fn.only = _makeTestWithFixture(makeSetupTeardown, it.only);
  // eslint-disable-next-line better-mutation/no-mutation
  fn.skip = _makeTestWithFixture(makeSetupTeardown, it.skip);
  // eslint-disable-next-line better-mutation/no-mutation
  fn.todo = _makeTestWithFixture(makeSetupTeardown, it.todo);
  return fn;
}

function _makeTestWithFixture<T extends Record<string, unknown>>(
  makeSetupTeardown: () => Promise<Fixture<T>> | Fixture<T>,
  jestFn = it,
) {
  return (
    name: string,
    testFn: (vars: T) => void | Promise<void>,
    timeout?: number,
  ) =>
    jestFn(
      name,
      // The function here returns a promise _if and only if_ the original
      // testFn returned a promise, to keep synchronous tests synchronous.
      /* eslint-disable @typescript-eslint/promise-function-async */
      (() => {
        return continueWith(
          () => makeSetupTeardown(),
          ({ cleanup, ...variables }) => {
            return continueWith(
              () => testFn(variables as T),
              (testRes) => {
                // if test succeeded, call cleanup, throw its error (if any),
                // else return test result.
                return continueWith(
                  () => cleanup?.(),
                  () => testRes,
                  (e) => {
                    throw e;
                  },
                );
              },
              (e) => {
                // If test threw, call cleanup and then throw test's error
                // (even if cleanup throws).
                return continueWith(
                  () => cleanup?.(),
                  () => {
                    throw e;
                  },
                  () => {
                    throw e;
                  },
                );
              },
            );
          },
          (e) => {
            // If makeSetupTeardown threw, nothing we can do but pass that error along.
            throw e;
          },
        );
      }) as jest.ProvidesCallback,
      /* eslint-enable @typescript-eslint/promise-function-async */
      timeout,
    );
}

function continueWith<T, U>(
  getValue: () => T | Promise<T>,
  then: (it: T) => U,
  catcher: (e: unknown) => void,
): Awaited<U> | Promise<Awaited<U>> | void | Promise<void> {
  try {
    const res = getValue();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (res && typeof res === 'object' && 'then' in res) {
      return res.then(then, catcher) as Promise<Awaited<U>> | Promise<void>;
    } else {
      return then(res) as Awaited<U>;
    }
  } catch (e) {
    catcher(e);
  }
}
