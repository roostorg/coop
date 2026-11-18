import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type PgTransactionConfig } from 'drizzle-orm/pg-core';
import type pg from 'pg';

import { safeGet } from '../../utils/misc.js';
import { relations } from './schema/relations.js';
import * as schema from './schema/schema.js';

export { schema };

export type CoopDb = NodePgDatabase<typeof relations>;
export type CoopTx = Parameters<Parameters<CoopDb['transaction']>[0]>[0];
/** A db handle or an open transaction; both run queries the same way. */
export type CoopDbOrTx = CoopDb | CoopTx;

export function makeDrizzle(
  pool: pg.Pool,
  opts: { logQueries?: boolean } = {},
) {
  return drizzle({
    client: pool,
    relations,
    logger: opts.logQueries ?? false,
  });
}

function isSerializationFailure(error: unknown): boolean {
  return (
    safeGet(error, ['code']) === '40001' ||
    safeGet(error, ['cause', 'code']) === '40001'
  );
}

/**
 * Runs `callback` in a transaction and retries (up to 3 attempts) on Postgres
 * serialization failures (SQLSTATE 40001). Other errors propagate.
 *
 * Callbacks must be retry-safe: on a 40001 the whole callback is re-run,
 * including any non-database side effects.
 */
export async function transactionWithRetry<R>(
  db: CoopDb,
  callback: (tx: CoopTx) => Promise<R>,
  config?: PgTransactionConfig,
): Promise<R> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(callback, config);
    } catch (e: unknown) {
      if (!isSerializationFailure(e)) {
        throw e;
      }
      lastError = e;
    }
  }
  throw lastError;
}
