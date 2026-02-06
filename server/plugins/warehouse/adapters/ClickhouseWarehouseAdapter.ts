import { createClient, type ClickHouseClient } from '@clickhouse/client';

import type SafeTracer from '../../../utils/SafeTracer.js';
import type { IWarehouseAdapter } from '../IWarehouseAdapter.js';
import {
  type WarehouseQueryFn,
  type WarehouseQueryResult,
  type WarehouseTransactionFn,
} from '../types.js';
import { formatClickhouseQuery } from '../utils/clickhouseSql.js';

export interface ClickhouseWarehouseConnection {
  host: string;
  username: string;
  password: string;
  database: string;
  port?: number;
  protocol?: 'http' | 'https';
}

export interface ClickhouseWarehouseAdapterOptions {
  connection: ClickhouseWarehouseConnection;
  tracer?: SafeTracer;
}

export class ClickhouseWarehouseAdapter implements IWarehouseAdapter {
  readonly name = 'clickhouse-warehouse';

  private readonly tracer?: SafeTracer;
  private readonly client: ClickHouseClient;

  constructor(options: ClickhouseWarehouseAdapterOptions) {
    this.tracer = options.tracer;
    const { connection } = options;

    const protocol = connection.protocol ?? 'http';
    const port = connection.port ?? 8123;

    const url = `${protocol}://${connection.host}:${port}`;
    const password = connection.password.length ? connection.password : undefined;
    this.client = createClient({
      url,
      username: connection.username,
      ...(password ? { password } : {}),
      database: connection.database,
      clickhouse_settings: {
        allow_experimental_object_type: 1,
      },
    });
  }

  start(): void {
    // ClickHouse client lazily initializes connections on first query.
  }

  async query<T = WarehouseQueryResult>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const execute = async () => {
      const statement = formatClickhouseQuery(sql, params);
      
      // For INSERT statements, use command() instead of query() with format
      if (statement.trim().toUpperCase().startsWith('INSERT')) {
        await this.client.command({
          query: statement,
        });
        return [] as readonly T[];
      }
      
      const result = await this.client.query({
        query: statement,
        format: 'JSONEachRow',
      });

      const rows = await result.json();
      return rows as T[];
    };

    if (this.tracer) {
      return this.tracer.addActiveSpan(
        { resource: 'clickhouse.client', operation: 'clickhouse.query' },
        execute,
      );
    }

    return execute();
  }

  async transaction<T>(fn: WarehouseTransactionFn<T>): Promise<T> {
    // ClickHouse does not support multi-statement transactions in the same way
    // as OLTP databases. We provide a best-effort implementation that simply
    // executes the callback with the regular query function.
    const query: WarehouseQueryFn = async (statement, parameters = []) => {
      return this.query(statement, parameters);
    };

    return fn(query);
  }

  async flush(): Promise<void> {
    // No-op: ClickHouse client sends queries immediately.
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
