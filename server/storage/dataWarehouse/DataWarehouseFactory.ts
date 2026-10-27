/**
 * Factory for creating data warehouse instances based on configuration
 */

/* eslint-disable max-classes-per-file */
import { type Kysely } from 'kysely';

import {
  isEnvTrue,
  safeGetEnvInt,
  safeGetEnvNonNegativeInt,
  safeGetEnvVar,
} from '../../iocContainer/utils.js';
import {
  ClickhouseAnalyticsAdapter as ClickhouseAnalyticsPlugin,
  NoOpAnalyticsAdapter,
  type IAnalyticsAdapter,
} from '../../plugins/analytics/index.js';
import {
  ClickhouseWarehouseAdapter,
  NoOpWarehouseAdapter,
  PostgresWarehouseAdapter,
  type IWarehouseAdapter,
} from '../../plugins/warehouse/index.js';
import { assertUnreachable } from '../../utils/misc.js';
import type SafeTracer from '../../utils/SafeTracer.js';
import {
  ClickhouseKyselyAdapter,
  type ClickhouseConnectionSettings,
} from './ClickhouseAdapter.js';
import {
  type DataWarehousePoolSettings,
  type IDataWarehouse,
  type IDataWarehouseDialect,
  type DataWarehouseProvider as IDataWarehouseProvider,
  type TransactionFunction,
} from './IDataWarehouse.js';
import type {
  AnalyticsSchema,
  BulkWriteConfig,
  CDCChange,
  CDCConfig,
  IDataWarehouseAnalytics,
} from './IDataWarehouseAnalytics.js';
import {
  PostgresKyselyAdapter,
  type PostgresConnectionSettings,
} from './PostgresAdapter.js';
import { PostgresAnalyticsAdapter } from './PostgresAnalyticsAdapter.js';

/**
 * Concrete data warehouse providers
 * Extend this type to add new warehouse implementations
 */
export type DataWarehouseProvider = 'clickhouse' | 'postgresql' | 'noop';

export type AnalyticsProvider = 'clickhouse' | 'postgresql' | 'noop';

// Re-export the interface provider type for external use
export type { IDataWarehouseProvider };

export type DataWarehouseConfig =
  | {
      provider: 'clickhouse';
      connection: ClickhouseConnectionSettings;
      pool?: DataWarehousePoolSettings;
      analyticsProvider?: AnalyticsProvider;
    }
  | {
      provider: 'postgresql';
      connection: PostgresConnectionSettings;
      pool?: DataWarehousePoolSettings;
      analyticsProvider?: AnalyticsProvider;
    }
  | {
      provider: 'noop';
      analyticsProvider?: AnalyticsProvider;
    };

class NoOpKyselyDialect implements IDataWarehouseDialect {
  getKyselyInstance(): Kysely<any> {
    // Return a proxy so services can hold a Kysely reference without
    // crashing at startup; any attempt to build or execute a query throws.
    return new Proxy({} as Kysely<any>, {
      get(_target, prop) {
        if (prop === 'destroy') return async () => {};
        if (prop === 'then') return undefined; // not thenable
        if (typeof prop === 'symbol') return undefined;
        return () => {
          throw new Error('NoOp dialect: Kysely queries are not supported');
        };
      },
    });
  }
  async destroy(): Promise<void> {}
}

class WarehouseAdapterBridge implements IDataWarehouse {
  constructor(
    private readonly provider: DataWarehouseProvider,
    private readonly adapter: IWarehouseAdapter,
  ) {}

  async query(
    query: string,
    tracer: SafeTracer,
    binds: readonly unknown[] = [],
  ): Promise<unknown[]> {
    const runQuery = async () => {
      const rows = await this.adapter.query(query, binds);
      return Array.from(rows) as unknown[];
    };

    return tracer.addActiveSpan(
      {
        resource: `${this.provider}.client`,
        operation: `${this.provider}.query`,
      },
      runQuery,
    );
  }

  async transaction<T>(fn: TransactionFunction<T>): Promise<T> {
    return this.adapter.transaction(async (warehouseQuery) => {
      return fn(async (statement, parameters = []) => {
        const rows = await warehouseQuery(statement, parameters);
        return Array.from(rows);
      });
    });
  }

  start(): void {
    const maybeStart = (this.adapter as { start?: () => void }).start;
    if (typeof maybeStart === 'function') {
      maybeStart.call(this.adapter);
    }
  }

  async close(): Promise<void> {
    await this.adapter.flush();
    await this.adapter.close();
  }

  getProvider(): DataWarehouseProvider {
    return this.provider;
  }
}

class AnalyticsAdapterBridge implements IDataWarehouseAnalytics {
  constructor(
    private readonly provider: DataWarehouseProvider,
    private readonly adapter: IAnalyticsAdapter,
  ) {}

  async bulkWrite<TableName extends keyof AnalyticsSchema>(
    tableName: TableName,
    rows: readonly AnalyticsSchema[TableName][],
    config?: BulkWriteConfig,
  ): Promise<void> {
    await this.adapter.writeEvents(
      tableName,
      rows,
      config?.batchTimeout !== undefined
        ? { batchTimeout: config.batchTimeout }
        : undefined,
    );
  }

  async createCDCStream<TableName extends string>(
    config: CDCConfig<TableName>,
  ): Promise<void> {
    if (!this.adapter.createCDCStream) {
      throw new Error(
        `Analytics adapter "${this.provider}" does not support CDC streams.`,
      );
    }
    await this.adapter.createCDCStream(config);
  }

  async consumeCDCChanges<T = unknown>(
    streamName: string,
    callback: (changes: CDCChange<T>[]) => Promise<void>,
    tracer: SafeTracer,
  ): Promise<void> {
    if (!this.adapter.consumeCDCChanges) {
      throw new Error(
        `Analytics adapter "${this.provider}" does not support CDC consumption.`,
      );
    }
    await this.adapter.consumeCDCChanges(streamName, callback, tracer);
  }

  supportsCDC(): boolean {
    return this.adapter.supportsCDC?.() ?? false;
  }

  async flushPendingWrites(): Promise<void> {
    await this.adapter.flush();
  }

  async close(): Promise<void> {
    await this.adapter.close();
  }
}

/**
 * Factory class for creating data warehouse instances
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DataWarehouseFactory {
  /**
   * Create a data warehouse instance based on the provided configuration
   */
  static createDataWarehouse(
    config: DataWarehouseConfig,
    dialect?: IDataWarehouseDialect,
  ): IDataWarehouse {
    switch (config.provider) {
      case 'noop':
        return new WarehouseAdapterBridge('noop', new NoOpWarehouseAdapter());
      case 'clickhouse':
        return new WarehouseAdapterBridge(
          'clickhouse',
          new ClickhouseWarehouseAdapter({
            connection: config.connection,
          }),
        );
      case 'postgresql': {
        const pgKysely = dialect?.getKyselyInstance();
        if (!pgKysely) {
          throw new Error('PostgreSQL warehouse requires Kysely instance');
        }
        return new WarehouseAdapterBridge(
          'postgresql',
          new PostgresWarehouseAdapter(pgKysely),
        );
      }
      default:
        return assertUnreachable(
          config,
          `Unknown data warehouse provider: ${
            (config as DataWarehouseConfig).provider
          }`,
        );
    }
  }

  /**
   * Create a Kysely dialect instance based on the provided configuration
   */
  static createKyselyDialect(
    config: DataWarehouseConfig,
  ): IDataWarehouseDialect {
    switch (config.provider) {
      case 'clickhouse':
        return new ClickhouseKyselyAdapter(config.connection, config.pool);
      case 'postgresql':
        return new PostgresKyselyAdapter(config.connection, config.pool);
      case 'noop':
        return new NoOpKyselyDialect();
      default:
        return assertUnreachable(
          config,
          `Unknown data warehouse provider: ${
            (config as DataWarehouseConfig).provider
          }`,
        );
    }
  }

  /**
   * Create an analytics adapter for warehouse-specific analytics features
   * (bulk writes, CDC, logging)
   */
  static createAnalyticsAdapter(
    config: DataWarehouseConfig,
    dialect?: IDataWarehouseDialect,
  ): IDataWarehouseAnalytics {
    const analyticsProvider = config.analyticsProvider ?? config.provider;

    switch (analyticsProvider) {
      case 'noop':
        return new AnalyticsAdapterBridge('noop', new NoOpAnalyticsAdapter());
      case 'clickhouse':
        if (config.provider !== 'clickhouse') {
          throw new Error(
            'Clickhouse analytics provider requires the clickhouse warehouse configuration.',
          );
        }
        return new AnalyticsAdapterBridge(
          'clickhouse',
          new ClickhouseAnalyticsPlugin({
            connection: config.connection,
          }),
        );
      case 'postgresql': {
        const pgKysely = dialect?.getKyselyInstance();
        if (!pgKysely) {
          throw new Error('PostgreSQL analytics requires Kysely instance');
        }
        return new PostgresAnalyticsAdapter(pgKysely);
      }
      default:
        return assertUnreachable(
          analyticsProvider,
          `Unknown analytics provider: ${analyticsProvider as string}`,
        );
    }
  }

  /**
   * Create configuration from environment variables
   */

  static createConfigFromEnv(): DataWarehouseConfig {
    const provider =
      parseProviderEnvVar('ANALYTICS_DIALECT') ??
      parseProviderEnvVar('WAREHOUSE_ADAPTER') ??
      parseProviderEnvVar('DATA_WAREHOUSE_PROVIDER') ??
      'clickhouse';
    const analyticsProvider =
      parseProviderEnvVar('ANALYTICS_ADAPTER') ?? provider;

    if (analyticsProvider !== provider && analyticsProvider !== 'noop') {
      throw new Error(
        `ANALYTICS_ADAPTER=${analyticsProvider} does not match the ${provider} warehouse; it may only be set to the same engine or to noop.`,
      );
    }

    switch (provider) {
      case 'noop':
        return {
          provider: 'noop',
          analyticsProvider,
        };
      case 'clickhouse':
        return {
          provider: 'clickhouse',
          analyticsProvider,
          connection: {
            host: process.env.CLICKHOUSE_HOST ?? 'localhost',
            port: process.env.CLICKHOUSE_PORT
              ? parseInt(process.env.CLICKHOUSE_PORT)
              : 8123,
            username: process.env.CLICKHOUSE_USERNAME ?? 'default',
            password: process.env.CLICKHOUSE_PASSWORD ?? '',
            database: process.env.CLICKHOUSE_DATABASE ?? 'default',
            protocol: (process.env.CLICKHOUSE_PROTOCOL ?? 'http') as
              'http' | 'https',
          },
          pool: {
            max: process.env.CLICKHOUSE_POOL_SIZE
              ? parseInt(process.env.CLICKHOUSE_POOL_SIZE)
              : 10,
          },
        };
      case 'postgresql':
        return {
          provider: 'postgresql',
          analyticsProvider,
          connection: getPostgresAnalyticsConnection(),
          pool: { max: safeGetEnvInt('ANALYTICS_DB_POOL_MAX', 5) },
        };
      default:
        return assertUnreachable(
          provider,
          `Unknown data warehouse provider: ${provider as string}`,
        );
    }
  }
}

const PROVIDERS_BY_ENV_VALUE: Partial<Record<string, DataWarehouseProvider>> = {
  clickhouse: 'clickhouse',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  noop: 'noop',
};

function parseProviderEnvVar(
  varName: string,
): DataWarehouseProvider | undefined {
  const raw = process.env[varName]?.trim();
  if (!raw) {
    return undefined;
  }
  const provider = PROVIDERS_BY_ENV_VALUE[raw.toLowerCase()];
  if (!provider) {
    throw new Error(
      `Invalid ${varName}="${raw}". Expected clickhouse, postgres, or noop.`,
    );
  }
  return provider;
}

function getPostgresAnalyticsConnection(): PostgresConnectionSettings {
  const statementTimeoutMs = process.env.ANALYTICS_DB_STATEMENT_TIMEOUT_MS
    ? safeGetEnvNonNegativeInt('ANALYTICS_DB_STATEMENT_TIMEOUT_MS', 0)
    : undefined;

  // Never mix fields from the two blocks: a separate host must come with its
  // own credentials, so every field is read from the same prefix.
  if (process.env.ANALYTICS_DB_HOST?.trim()) {
    return {
      host: safeGetEnvVar('ANALYTICS_DB_HOST'),
      port: parseInt(process.env.ANALYTICS_DB_PORT ?? '5432'),
      username: safeGetEnvVar('ANALYTICS_DB_USER'),
      password: safeGetEnvVar('ANALYTICS_DB_PASSWORD'),
      database: safeGetEnvVar('ANALYTICS_DB_NAME'),
      ssl: isEnvTrue('ANALYTICS_DB_SSL'),
      ...(statementTimeoutMs !== undefined && { statementTimeoutMs }),
    };
  }

  // Same variables and defaults as the app database (`getPgConnectionParams`).
  return {
    host: safeGetEnvVar('DATABASE_HOST'),
    port: parseInt(process.env.DATABASE_PORT ?? '5432'),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: safeGetEnvVar('DATABASE_PASSWORD'),
    database: process.env.DATABASE_NAME ?? 'development',
    ssl: isEnvTrue('DATABASE_SSL'),
    ...(statementTimeoutMs !== undefined && { statementTimeoutMs }),
  };
}
