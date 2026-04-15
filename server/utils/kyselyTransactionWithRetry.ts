import { type Kysely } from 'kysely';

import { safeGet } from './misc.js';

function isSerializationFailure(error: unknown): boolean {
  return safeGet(error, ['code']) === '40001';
}

/**
 * Like {@link server/models/sequelizeSetup.ts maketransactionWithRetry} but for Kysely.
 */
export function makeKyselyTransactionWithRetry<T>(kysely: Kysely<T>) {
  return async function transactionWithRetry<R>(
    callback: (trx: Kysely<T>) => Promise<R>,
  ): Promise<R> {
    let remainingTries = 3;
    while (remainingTries > 0) {
      remainingTries -= 1;
      try {
        return await kysely.transaction().execute(callback);
      } catch (e: unknown) {
        if (!isSerializationFailure(e)) {
          throw e;
        }
      }
    }

    throw new Error('Retry limit exceeded.');
  };
}

export type KyselyTransactionWithRetry<T> = ReturnType<
  typeof makeKyselyTransactionWithRetry<T>
>;
