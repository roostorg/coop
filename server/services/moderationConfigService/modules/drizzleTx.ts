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
 * it. A savepoint can't change the outer transaction's isolation level or
 * retry it, so asking for an isolation level there is an error rather than
 * being silently dropped.
 */
export async function runInTransaction<R>(
  db: CoopDbOrTx,
  callback: (tx: CoopTx) => Promise<R>,
  config?: PgTransactionConfig,
): Promise<R> {
  if (!isTransaction(db)) {
    return transactionWithRetry(db, callback, config);
  }
  if (config?.isolationLevel != null) {
    throw new Error(
      `runInTransaction: can't run at isolation level "${config.isolationLevel}" inside an existing transaction`,
    );
  }
  return db.transaction(callback);
}
