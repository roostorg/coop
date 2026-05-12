import { type IsolationLevel, type Kysely, type Transaction } from 'kysely';

import { safeGet } from './misc.js';

function isSerializationFailure(error: unknown): boolean {
  return safeGet(error, ['code']) === '40001';
}

type TransactionWithRetryOptions = {
  isolationLevel?: IsolationLevel;
};

/**
 * Returns a `transactionWithRetry` helper bound to the given Kysely instance.
 * The returned function wraps `kysely.transaction().execute(callback)` and
 * automatically retries (up to 3 attempts) on Postgres serialization failures
 * (SQLSTATE `40001`), which are always safe to retry by definition. All other
 * errors are propagated immediately.
 *
 * Callers may optionally pass `{ isolationLevel }` as a first argument to
 * configure the transaction (e.g. `'repeatable read'`).
 *
 * Prefer this over calling `kysely.transaction().execute(...)` directly — it's
 * enforced by the `no-restricted-syntax` rule in `.eslintrc.cjs`.
 */
export function makeKyselyTransactionWithRetry<T>(kysely: Kysely<T>) {
  async function transactionWithRetry<R>(
    callback: (trx: Transaction<T>) => Promise<R>,
  ): Promise<R>;
  async function transactionWithRetry<R>(
    options: TransactionWithRetryOptions,
    callback: (trx: Transaction<T>) => Promise<R>,
  ): Promise<R>;
  async function transactionWithRetry<R>(
    optionsOrCallback:
      | TransactionWithRetryOptions
      | ((trx: Transaction<T>) => Promise<R>),
    maybeCallback?: (trx: Transaction<T>) => Promise<R>,
  ): Promise<R> {
    const [options, callback] =
      typeof optionsOrCallback === 'function'
        ? [{}, optionsOrCallback]
        : [optionsOrCallback, maybeCallback!];

    let remainingTries = 3;
    let lastError: unknown;
    while (remainingTries > 0) {
      remainingTries -= 1;
      try {
        const builder = kysely.transaction();
        const configured =
          options.isolationLevel == null
            ? builder
            : builder.setIsolationLevel(options.isolationLevel);
        return await configured.execute(callback);
      } catch (e: unknown) {
        if (!isSerializationFailure(e)) {
          throw e;
        }
        lastError = e;
      }
    }

    throw lastError;
  }

  return transactionWithRetry;
}

export type KyselyTransactionWithRetry<T> = ReturnType<
  typeof makeKyselyTransactionWithRetry<T>
>;
