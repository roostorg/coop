import { CompiledQuery, type Kysely } from 'kysely';

import { makeKyselyTransactionWithRetry } from '../../../utils/kyselyTransactionWithRetry.js';
import type { IWarehouseAdapter } from '../IWarehouseAdapter.js';
import {
  type WarehouseQueryFn,
  type WarehouseQueryResult,
  type WarehouseTransactionFn,
} from '../types.js';

/**
 * Raw SQL access to a Postgres analytics warehouse. Statements use Postgres
 * `$1, $2, ...` placeholders and are always sent with bound parameters.
 *
 * The Kysely instance (and its pool) belongs to the warehouse dialect, which
 * is closed separately on shutdown, so `close()` here does not end the pool.
 *
 * Transactions retry on serialization failures, so callbacks must be safe to
 * re-run.
 */
export class PostgresWarehouseAdapter implements IWarehouseAdapter {
  readonly name = 'postgres-warehouse';

  private readonly kysely: Kysely<Record<string, unknown>>;
  private readonly transactionWithRetry: ReturnType<
    typeof makeKyselyTransactionWithRetry<Record<string, unknown>>
  >;

  constructor(kysely: Kysely<Record<string, unknown>>) {
    this.kysely = kysely;
    this.transactionWithRetry = makeKyselyTransactionWithRetry(kysely);
  }

  async query<T = WarehouseQueryResult>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const result = await this.kysely.executeQuery<T>(
      CompiledQuery.raw(sql, [...params]),
    );
    return result.rows;
  }

  async transaction<T>(fn: WarehouseTransactionFn<T>): Promise<T> {
    return this.transactionWithRetry(async (trx) => {
      const query: WarehouseQueryFn = async <R = WarehouseQueryResult>(
        statement: string,
        parameters: readonly unknown[] = [],
      ) => {
        const result = await trx.executeQuery<R>(
          CompiledQuery.raw(statement, [...parameters]),
        );
        return result.rows;
      };
      return fn(query);
    });
  }

  async flush(): Promise<void> {}

  async close(): Promise<void> {}
}
