import {
  PgAsyncTransaction,
  type PgTransactionConfig,
} from 'drizzle-orm/pg-core';

import {
  transactionWithRetry,
  type CoopDbOrTx,
  type CoopTx,
} from '../../../storage/postgres/drizzle.js';

export function isTransaction(db: CoopDbOrTx): db is CoopTx {
  return db instanceof PgAsyncTransaction;
}

/**
 * Runs `callback` in a retrying transaction, or, when `db` is already a
 * transaction (see ModerationConfigService.forTransaction), in a savepoint on
 * it; the isolation level then comes from the outer transaction.
 */
export async function runInTransaction<R>(
  db: CoopDbOrTx,
  callback: (tx: CoopTx) => Promise<R>,
  config?: PgTransactionConfig,
): Promise<R> {
  return isTransaction(db)
    ? db.transaction(callback)
    : transactionWithRetry(db, callback, config);
}
