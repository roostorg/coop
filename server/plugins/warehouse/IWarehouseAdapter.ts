import type { WarehouseQueryResult, WarehouseTransactionFn } from './types.js';

/**
 * Contract implemented by every primary warehouse adapter.
 *
 * Adapters power operational workloads (transactions, point queries, etc.).
 * The interface intentionally mirrors a typical SQL client without enforcing
 * a specific library (Kysely, Knex, pg, etc.).
 */
export interface IWarehouseAdapter {
  /** Human friendly provider name for logging / diagnostics. */
  readonly name: string;

  /** Execute a raw SQL statement and return its rows. */
  query<T = WarehouseQueryResult>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<readonly T[]>;

  /** Execute a callback inside a transaction. */
  transaction<T>(fn: WarehouseTransactionFn<T>): Promise<T>;

  /** Flush buffers or pending work (optional for most adapters). */
  flush(): Promise<void>;

  /** Release external resources. */
  close(): Promise<void>;
}
