import type SafeTracer from '../../../utils/SafeTracer.js';
import makeSnowflakeConnectionPool from '../../../snowflake/makeConnectionPool.js';
import type { IWarehouseAdapter } from '../IWarehouseAdapter.js';
import {
  type WarehouseTransactionFn,
  type WarehouseQueryFn,
  type WarehouseQueryResult,
} from '../types.js';

export interface SnowflakeWarehouseConnection {
  account: string;
  username: string;
  password: string;
  database: string;
  warehouse: string;
  schema?: string;
  role?: string;
  arrayBindingThreshold?: number;
}

export interface SnowflakeWarehousePoolConfig {
  max?: number;
  min?: number;
  autostart?: boolean;
}

export interface SnowflakeWarehouseAdapterOptions {
  connection: SnowflakeWarehouseConnection;
  pool?: SnowflakeWarehousePoolConfig;
  tracer?: SafeTracer;
}

export class SnowflakeWarehouseAdapter implements IWarehouseAdapter {
  readonly name = 'snowflake-warehouse';

  private readonly tracer?: SafeTracer;
  private readonly pool: ReturnType<typeof makeSnowflakeConnectionPool>;

  constructor(private readonly options: SnowflakeWarehouseAdapterOptions) {
    this.tracer = options.tracer;
    this.pool = makeSnowflakeConnectionPool(
      {
        account: options.connection.account,
        username: options.connection.username,
        password: options.connection.password,
        database: options.connection.database,
        role: options.connection.role ?? 'ACCOUNTADMIN',
        schema: options.connection.schema ?? 'PUBLIC',
        warehouse: options.connection.warehouse,
        arrayBindingThreshold:
          options.connection.arrayBindingThreshold ?? Number.MAX_VALUE,
      },
      options.pool,
    );
  }

  start(): void {
    this.pool.start();
  }

  async query<T = WarehouseQueryResult>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const runQuery = async () => {
      const connection = await this.pool.acquire();
      try {
        const rows = (await connection.execute(
          sql,
          params as unknown[],
        )) as T[];
        return rows as readonly T[];
      } finally {
        this.pool.release(connection).catch(() => {});
      }
    };

    if (this.tracer) {
      return this.tracer.addActiveSpan(
        { resource: 'snowflake.client', operation: 'snowflake.query' },
        runQuery,
      );
    }

    return runQuery();
  }

  async transaction<T>(fn: WarehouseTransactionFn<T>): Promise<T> {
    const connection = await this.pool.acquire();
    await connection.execute('begin');

    const query: WarehouseQueryFn = async function <
      R = WarehouseQueryResult,
    >(
      statement: string,
      parameters: readonly unknown[] = [],
    ): Promise<readonly R[]> {
      const rows = (await connection.execute(
        statement,
        parameters as unknown[],
      )) as R[];
      return rows as readonly R[];
    };

    try {
      const result = await fn(query);
      await connection.execute('commit');
      return result;
    } catch (error) {
      await connection.execute('rollback');
      throw error;
    } finally {
      this.pool.release(connection).catch(() => {});
    }
  }

  async flush(): Promise<void> {
    // Snowflake connections do not buffer operations. This is a no-op.
  }

  async close(): Promise<void> {
    await this.pool.drain();
    await this.pool.clear();
  }
}
