import { type Kysely } from 'kysely';

import { makeKyselyTransactionWithRetry } from './kyselyTransactionWithRetry.js';

/**
 * Per-attempt behavior. `throw-after-callback` is the realistic 40001 shape
 * (failure at commit, callback already ran) and the case where retries
 * re-execute any side effects the callback performed.
 */
type AttemptBehavior =
  | { phase: 'success' }
  | { phase: 'throw-before-callback'; error: unknown }
  | { phase: 'throw-after-callback'; error: unknown };

const success = (): AttemptBehavior => ({ phase: 'success' });
const throwBeforeCallback = (error: unknown): AttemptBehavior => ({
  phase: 'throw-before-callback',
  error,
});
const throwAfterCallback = (error: unknown): AttemptBehavior => ({
  phase: 'throw-after-callback',
  error,
});

type FakeKyselyResult = {
  fakeKysely: Kysely<unknown>;
  getAttemptCount: () => number;
  getCallbackInvocationCount: () => number;
  getLastIsolationLevel: () => string | undefined;
};

/**
 * Minimal `Kysely` stand-in. `kysely.transaction()[.setIsolationLevel].execute(cb)`
 * is the only API the wrapper touches, so we only model that surface.
 */
function makeFakeKysely(
  behaviors: readonly AttemptBehavior[],
  callback?: () => Promise<void>,
): FakeKyselyResult {
  let attemptCount = 0;
  let callbackInvocationCount = 0;
  let lastIsolationLevel: string | undefined;

  const makeBuilder = (isolationLevel: string | undefined) => ({
    setIsolationLevel: (level: string) => makeBuilder(level),
    execute: async (cb: (trx: unknown) => Promise<unknown>) => {
      const i = attemptCount;
      attemptCount = attemptCount + 1;
      lastIsolationLevel = isolationLevel;

      const behavior = behaviors[i];
      if (behavior === undefined) {
        throw new Error(
          `Test setup error: callback invoked more times than configured (got attempt ${i + 1})`,
        );
      }

      if (behavior.phase === 'throw-before-callback') {
        throw behavior.error;
      }

      callbackInvocationCount = callbackInvocationCount + 1;
      const result = await cb({});
      if (callback !== undefined) {
        await callback();
      }
      if (behavior.phase === 'throw-after-callback') {
        throw behavior.error;
      }
      return result;
    },
  });

  const fakeKysely = {
    transaction: () => makeBuilder(undefined),
  } as unknown as Kysely<unknown>;

  return {
    fakeKysely,
    getAttemptCount: () => attemptCount,
    getCallbackInvocationCount: () => callbackInvocationCount,
    getLastIsolationLevel: () => lastIsolationLevel,
  };
}

function makeSerializationFailure(): Error & { code: string } {
  return Object.assign(new Error('serialization failure'), { code: '40001' });
}

describe('makeKyselyTransactionWithRetry', () => {
  test('returns the callback result on first-attempt success', async () => {
    const { fakeKysely, getAttemptCount, getCallbackInvocationCount } =
      makeFakeKysely([success()]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    const result = await transactionWithRetry(async () => 'ok');

    expect(result).toBe('ok');
    expect(getAttemptCount()).toBe(1);
    expect(getCallbackInvocationCount()).toBe(1);
  });

  test('retries on serialization failure thrown before the callback runs', async () => {
    const { fakeKysely, getAttemptCount, getCallbackInvocationCount } =
      makeFakeKysely([
        throwBeforeCallback(makeSerializationFailure()),
        success(),
      ]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    const result = await transactionWithRetry(async () => 'ok-after-retry');

    expect(result).toBe('ok-after-retry');
    expect(getAttemptCount()).toBe(2);
    expect(getCallbackInvocationCount()).toBe(1);
  });

  test('retries on serialization failure surfaced after the callback runs (e.g. at commit)', async () => {
    // Realistic 40001 scenario: the callback has already issued its queries
    // when COMMIT fails. The wrapper retries the entire callback, so the
    // callback runs twice. This test documents that observable behavior — any
    // non-database side effect inside the callback would have run twice here.
    const { fakeKysely, getAttemptCount, getCallbackInvocationCount } =
      makeFakeKysely([
        throwAfterCallback(makeSerializationFailure()),
        success(),
      ]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    let callbackRuns = 0;
    const result = await transactionWithRetry(async () => {
      callbackRuns = callbackRuns + 1;
      return 'committed-on-second-try';
    });

    expect(result).toBe('committed-on-second-try');
    expect(getAttemptCount()).toBe(2);
    expect(getCallbackInvocationCount()).toBe(2);
    expect(callbackRuns).toBe(2);
  });

  test('gives up after 3 attempts of post-callback 40001 and rethrows the last failure', async () => {
    const finalFailure = makeSerializationFailure();
    const { fakeKysely, getAttemptCount, getCallbackInvocationCount } =
      makeFakeKysely([
        throwAfterCallback(makeSerializationFailure()),
        throwAfterCallback(makeSerializationFailure()),
        throwAfterCallback(finalFailure),
      ]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await expect(transactionWithRetry(async () => 'unreachable')).rejects.toBe(
      finalFailure,
    );

    expect(getAttemptCount()).toBe(3);
    expect(getCallbackInvocationCount()).toBe(3);
  });

  test('does not retry on non-serialization pg errors raised before the callback', async () => {
    const uniqueViolation = Object.assign(new Error('unique violation'), {
      code: '23505',
    });
    const { fakeKysely, getAttemptCount, getCallbackInvocationCount } =
      makeFakeKysely([throwBeforeCallback(uniqueViolation)]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await expect(transactionWithRetry(async () => 'unreachable')).rejects.toBe(
      uniqueViolation,
    );

    expect(getAttemptCount()).toBe(1);
    expect(getCallbackInvocationCount()).toBe(0);
  });

  test('does not retry on plain (non-pg) errors thrown by the callback', async () => {
    // The callback itself throws — the fake records the invocation and the
    // wrapper sees the error without ever reaching the post-callback hook.
    const appError = new Error('business logic error');
    const { fakeKysely, getAttemptCount, getCallbackInvocationCount } =
      makeFakeKysely([success()]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await expect(
      transactionWithRetry(async () => {
        throw appError;
      }),
    ).rejects.toBe(appError);

    expect(getAttemptCount()).toBe(1);
    expect(getCallbackInvocationCount()).toBe(1);
  });

  test('applies isolationLevel when supplied via options overload', async () => {
    const { fakeKysely, getLastIsolationLevel } = makeFakeKysely([success()]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await transactionWithRetry(
      { isolationLevel: 'repeatable read' },
      async () => 'ok',
    );

    expect(getLastIsolationLevel()).toBe('repeatable read');
  });

  test('omits setIsolationLevel when options.isolationLevel is not provided', async () => {
    const { fakeKysely, getLastIsolationLevel } = makeFakeKysely([success()]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await transactionWithRetry(async () => 'ok');

    expect(getLastIsolationLevel()).toBeUndefined();
  });
});
