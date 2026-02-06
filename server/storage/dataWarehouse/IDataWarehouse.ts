/**
 * Interface for Data Warehouse operations.
 * Provides abstraction over different data warehouse implementations
 * (Snowflake, Clickhouse, PostgreSQL, BigQuery, Redshift, etc.)
 */

import { type Kysely } from 'kysely';
import type SafeTracer from '../../utils/SafeTracer.js';

/**
 * Supported data warehouse providers
 * Integrators can add their own warehouse types here
 */
export type DataWarehouseProvider = 'snowflake' | 'clickhouse' | 'postgresql' | string;

/**
 * Connection settings that are common across data warehouse implementations
 */
export interface DataWarehouseConnectionSettings {
  host?: string;
  account?: string;
  username: string;
  password: string;
  database: string;
  warehouse?: string;
  schema?: string;
  role?: string;
  port?: number;
}

/**
 * Pool settings for connection pooling
 */
export interface DataWarehousePoolSettings {
  max?: number;
  min?: number;
  autostart?: boolean;
}

/**
 * Transaction function type
 */
export type TransactionFunction<T> = (
  query: (query: string, binds?: unknown[]) => Promise<unknown[]>,
) => Promise<T>;

/**
 * Main interface for data warehouse operations
 */
export interface IDataWarehouse {
  /**
   * Execute a query with optional bindings
   */
  query(
    query: string,
    tracer: SafeTracer,
    binds?: readonly unknown[],
  ): Promise<unknown[]>;

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(trx: TransactionFunction<T>): Promise<T>;

  /**
   * Start the connection pool
   */
  start(): void;

  /**
   * Close all connections
   */
  close(): Promise<void>;

  /**
   * Get the provider type
   */
  getProvider(): DataWarehouseProvider;
}

/**
 * Interface for Kysely-based data warehouse dialect
 */
export interface IDataWarehouseDialect {
  /**
   * Get a Kysely instance configured for this data warehouse
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKyselyInstance(): Kysely<any>;

  /**
   * Close the Kysely instance
   */
  destroy(): Promise<void>;
}

