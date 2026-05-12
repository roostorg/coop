import { type Kysely } from 'kysely';

import { makeKyselyTransactionWithRetry } from './kyselyTransactionWithRetry.js';

/**
 * Per-attempt behavior: throw to simulate a transaction failure on that
 * attempt, or return to let the wrapper's callback run normally.
 */
type AttemptBehavior = () => Promise<void>;

/**
 * Minimal `Kysely` stand-in. `kysely.transaction()[.setIsolationLevel].execute(cb)`
 * is the only API the wrapper touches, so we only model that surface.
 */
function makeFakeKysely(behaviors: readonly AttemptBehavior[]): {
  fakeKysely: Kysely<unknown>;
  getAttemptCount: () => number;
  getLastIsolationLevel: () => string | undefined;
} {
  let attemptCount = 0;
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

      await behavior();
      return cb({});
    },
  });

  const fakeKysely = {
    transaction: () => makeBuilder(undefined),
  } as unknown as Kysely<unknown>;

  return {
    fakeKysely,
    getAttemptCount: () => attemptCount,
    getLastIsolationLevel: () => lastIsolationLevel,
  };
}

const noop: AttemptBehavior = async () => {};

function throwing(error: unknown): AttemptBehavior {
  return async () => {
    throw error;
  };
}

function makeSerializationFailure(): Error & { code: string } {
  return Object.assign(new Error('serialization failure'), { code: '40001' });
}

describe('makeKyselyTransactionWithRetry', () => {
  test('returns the callback result on first-attempt success', async () => {
    const { fakeKysely, getAttemptCount } = makeFakeKysely([noop]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    const result = await transactionWithRetry(async () => 'ok');

    expect(result).toBe('ok');
    expect(getAttemptCount()).toBe(1);
  });

  test('retries on serialization failure (SQLSTATE 40001) and eventually succeeds', async () => {
    const { fakeKysely, getAttemptCount } = makeFakeKysely([
      throwing(makeSerializationFailure()),
      noop,
    ]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    const result = await transactionWithRetry(async () => 'ok-after-retry');

    expect(result).toBe('ok-after-retry');
    expect(getAttemptCount()).toBe(2);
  });

  test('gives up after 3 attempts and rethrows the last serialization failure', async () => {
    const finalFailure = makeSerializationFailure();
    const { fakeKysely, getAttemptCount } = makeFakeKysely([
      throwing(makeSerializationFailure()),
      throwing(makeSerializationFailure()),
      throwing(finalFailure),
    ]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await expect(transactionWithRetry(async () => 'unreachable')).rejects.toBe(
      finalFailure,
    );

    expect(getAttemptCount()).toBe(3);
  });

  test('does not retry on non-serialization pg errors', async () => {
    const uniqueViolation = Object.assign(new Error('unique violation'), {
      code: '23505',
    });
    const { fakeKysely, getAttemptCount } = makeFakeKysely([
      throwing(uniqueViolation),
    ]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await expect(transactionWithRetry(async () => 'unreachable')).rejects.toBe(
      uniqueViolation,
    );

    expect(getAttemptCount()).toBe(1);
  });

  test('does not retry on plain (non-pg) errors thrown by the callback', async () => {
    const appError = new Error('business logic error');
    const { fakeKysely, getAttemptCount } = makeFakeKysely([
      throwing(appError),
    ]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await expect(transactionWithRetry(async () => 'unreachable')).rejects.toBe(
      appError,
    );

    expect(getAttemptCount()).toBe(1);
  });

  test('applies isolationLevel when supplied via options overload', async () => {
    const { fakeKysely, getLastIsolationLevel } = makeFakeKysely([noop]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await transactionWithRetry(
      { isolationLevel: 'repeatable read' },
      async () => 'ok',
    );

    expect(getLastIsolationLevel()).toBe('repeatable read');
  });

  test('omits setIsolationLevel when options.isolationLevel is not provided', async () => {
    const { fakeKysely, getLastIsolationLevel } = makeFakeKysely([noop]);

    const transactionWithRetry = makeKyselyTransactionWithRetry(fakeKysely);
    await transactionWithRetry(async () => 'ok');

    expect(getLastIsolationLevel()).toBeUndefined();
  });
});
