/**
 * Factory for creating data warehouse instances based on configuration
 */

/* eslint-disable max-classes-per-file */
import {
  ClickhouseAnalyticsAdapter as ClickhouseAnalyticsPlugin,
  NoOpAnalyticsAdapter,
  type AnalyticsEventInput,
  type IAnalyticsAdapter,
} from '../../plugins/analytics/index.js';
import {
  ClickhouseWarehouseAdapter,
  NoOpWarehouseAdapter,
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
      connection: {
        host: string;
        port?: number;
        username: string;
        password: string;
        database: string;
      };
      pool?: DataWarehousePoolSettings;
      analyticsProvider?: AnalyticsProvider;
    }
  | {
      provider: 'noop';
      analyticsProvider?: AnalyticsProvider;
    };

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
        return Array.from(rows) as unknown[];
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
      rows as readonly AnalyticsEventInput[],
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
  static createDataWarehouse(config: DataWarehouseConfig): IDataWarehouse {
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
      case 'postgresql':
        return new WarehouseAdapterBridge(
          'postgresql',
          new NoOpWarehouseAdapter(),
        );
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
        throw new Error('PostgreSQL Kysely dialect not yet implemented');
      case 'noop':
        throw new Error('NoOp provider does not support Kysely dialect');
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
    const analyticsProvider =
      config.analyticsProvider ?? (config.provider as AnalyticsProvider);

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
    const provider = (process.env.WAREHOUSE_ADAPTER ??
      process.env.DATA_WAREHOUSE_PROVIDER ??
      'clickhouse') as DataWarehouseProvider;
    const analyticsProvider = (process.env.ANALYTICS_ADAPTER ??
      provider) as AnalyticsProvider;

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
              | 'http'
              | 'https',
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
          connection: {
            host: process.env.POSTGRES_HOST ?? 'localhost',
            port: process.env.POSTGRES_PORT
              ? parseInt(process.env.POSTGRES_PORT)
              : undefined,
            username: process.env.POSTGRES_USERNAME ?? 'postgres',
            password: process.env.POSTGRES_PASSWORD ?? '',
            database: process.env.POSTGRES_DATABASE ?? 'postgres',
          },
        };
      default:
        return assertUnreachable(
          provider,
          `Unknown data warehouse provider: ${provider as string}`,
        );
    }
  }
}
