// eslint-disable-next-line import/no-extraneous-dependencies
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type QueryCompiler,
  type QueryResult,
  type TransactionSettings,
} from 'kysely';

import { formatClickhouseQuery } from '../../plugins/warehouse/utils/clickhouseSql.js';
import type {
  IDataWarehouseDialect,
  DataWarehousePoolSettings,
} from './IDataWarehouse.js';

export interface ClickhouseConnectionSettings {
  host: string;
  username: string;
  password: string;
  database: string;
  port?: number;
  protocol?: 'http' | 'https';
}

function createConnection(client: ClickHouseClient): DatabaseConnection {
  const execute = async <R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> => {
    const statement = formatClickhouseQuery(compiledQuery.sql, compiledQuery.parameters);
    const result = await client.query({
      query: statement,
      format: 'JSONEachRow',
    });

    const rows = await result.json<R>();
    return { rows };
  };

  return {
    executeQuery: execute,
    streamQuery<R>(compiledQuery: CompiledQuery) {
      return (async function* iterator(): AsyncIterableIterator<QueryResult<R>> {
        yield await execute<R>(compiledQuery);
      })();
    },
  };
}

function createDriver(client: ClickHouseClient): Driver {
  return {
    async init() {
      // No initialization steps required for the HTTP client.
    },
    async acquireConnection() {
      return createConnection(client);
    },
    async beginTransaction(
      _connection: DatabaseConnection,
      _settings: TransactionSettings,
    ) {
      throw new Error('ClickHouse does not support multi-statement transactions');
    },
    async commitTransaction() {
      throw new Error('ClickHouse does not support multi-statement transactions');
    },
    async rollbackTransaction() {
      throw new Error('ClickHouse does not support multi-statement transactions');
    },
    async releaseConnection(_connection: DatabaseConnection) {
      // Nothing to release; HTTP client pools internally.
    },
    async destroy() {
      await client.close();
    },
  };
}

function createDialect(client: ClickHouseClient): Dialect {
  return {
    createDriver() {
      return createDriver(client);
    },
    createQueryCompiler(): QueryCompiler {
      return new PostgresQueryCompiler();
    },
    createAdapter(): DialectAdapter {
      return new PostgresAdapter();
    },
    createIntrospector(db: Kysely<any>) {
      return new PostgresIntrospector(db);
    },
  };
}

export class ClickhouseKyselyAdapter implements IDataWarehouseDialect {
  private readonly client: ClickHouseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly kysely: Kysely<any>;

  constructor(
    connectionSettings: ClickhouseConnectionSettings,
    _poolSettings?: DataWarehousePoolSettings,
  ) {
    const protocol = connectionSettings.protocol ?? 'http';
    const port = connectionSettings.port ?? 8123;

    const url = `${protocol}://${connectionSettings.host}:${port}`;
    const rawPassword = connectionSettings.password;
    const password = rawPassword && rawPassword.length > 0 ? rawPassword : undefined;
    this.client = createClient({
      url,
      username: connectionSettings.username,
      ...(password ? { password } : {}),
      database: connectionSettings.database,
      clickhouse_settings: {
        allow_experimental_object_type: 1,
      },
    });

    this.kysely = new Kysely({
      dialect: createDialect(this.client),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKyselyInstance(): Kysely<any> {
    return this.kysely;
  }

  async destroy(): Promise<void> {
    await this.kysely.destroy();
  }
}

