import { getPgConnectionParams } from '../../iocContainer/index.js';
import { DataWarehouseFactory } from './DataWarehouseFactory.js';

const SELECTOR_VARS = [
  'ANALYTICS_DIALECT',
  'WAREHOUSE_ADAPTER',
  'DATA_WAREHOUSE_PROVIDER',
  'ANALYTICS_ADAPTER',
] as const;

const ANALYTICS_DB_VARS = [
  'ANALYTICS_DB_HOST',
  'ANALYTICS_DB_PORT',
  'ANALYTICS_DB_NAME',
  'ANALYTICS_DB_USER',
  'ANALYTICS_DB_PASSWORD',
  'ANALYTICS_DB_SSL',
  'ANALYTICS_DB_POOL_MAX',
  'ANALYTICS_DB_STATEMENT_TIMEOUT_MS',
] as const;

function stubEnv(vars: Record<string, string | undefined>) {
  for (const name of [...SELECTOR_VARS, ...ANALYTICS_DB_VARS]) {
    vi.stubEnv(name, undefined);
  }
  for (const [name, value] of Object.entries(vars)) {
    vi.stubEnv(name, value);
  }
}

const APP_DB_ENV = {
  DATABASE_HOST: 'app-db.internal',
  DATABASE_PORT: '5433',
  DATABASE_NAME: 'coop',
  DATABASE_USER: 'coop_app',
  DATABASE_PASSWORD: 'app-test-password',
  DATABASE_SSL: 'true',
};

describe('DataWarehouseFactory.createConfigFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('engine selection', () => {
    test('ANALYTICS_DIALECT selects postgres for reads and writes', () => {
      // `postgresql` is the value existing deployments already use.
      for (const value of ['postgres', 'postgresql']) {
        stubEnv({ ...APP_DB_ENV, ANALYTICS_DIALECT: value });
        const config = DataWarehouseFactory.createConfigFromEnv();
        expect(config.provider).toBe('postgresql');
        expect(config.analyticsProvider).toBe('postgresql');
      }
    });

    test('ANALYTICS_DIALECT takes precedence over the legacy selectors', () => {
      stubEnv({
        ...APP_DB_ENV,
        ANALYTICS_DIALECT: 'postgres',
        WAREHOUSE_ADAPTER: 'clickhouse',
        DATA_WAREHOUSE_PROVIDER: 'clickhouse',
      });
      expect(DataWarehouseFactory.createConfigFromEnv().provider).toBe(
        'postgresql',
      );
    });

    test('falls back to WAREHOUSE_ADAPTER, then DATA_WAREHOUSE_PROVIDER, then clickhouse', () => {
      stubEnv({
        WAREHOUSE_ADAPTER: 'noop',
        DATA_WAREHOUSE_PROVIDER: 'clickhouse',
      });
      expect(DataWarehouseFactory.createConfigFromEnv().provider).toBe('noop');

      stubEnv({ DATA_WAREHOUSE_PROVIDER: 'noop' });
      expect(DataWarehouseFactory.createConfigFromEnv().provider).toBe('noop');

      stubEnv({});
      expect(DataWarehouseFactory.createConfigFromEnv()).toMatchObject({
        provider: 'clickhouse',
        analyticsProvider: 'clickhouse',
      });
    });

    test('ANALYTICS_ADAPTER=noop disables writes while keeping reads', () => {
      stubEnv({
        ...APP_DB_ENV,
        ANALYTICS_DIALECT: 'postgres',
        ANALYTICS_ADAPTER: 'noop',
      });
      const config = DataWarehouseFactory.createConfigFromEnv();
      expect(config.provider).toBe('postgresql');
      expect(config.analyticsProvider).toBe('noop');
    });

    test('rejects an ANALYTICS_ADAPTER engine that differs from the warehouse', () => {
      stubEnv({
        ...APP_DB_ENV,
        ANALYTICS_DIALECT: 'postgres',
        ANALYTICS_ADAPTER: 'clickhouse',
      });
      expect(() => DataWarehouseFactory.createConfigFromEnv()).toThrow(
        /does not match the postgresql warehouse/,
      );
    });

    test('rejects unknown values', () => {
      stubEnv({ ANALYTICS_DIALECT: 'snowflake' });
      expect(() => DataWarehouseFactory.createConfigFromEnv()).toThrow(
        /Invalid ANALYTICS_DIALECT="snowflake"/,
      );
    });
  });

  describe('postgres connection', () => {
    // Compared against `getPgConnectionParams` rather than hard-coded values,
    // so the two can't drift apart (including their defaults).
    test.each([
      ['explicit app settings', APP_DB_ENV],
      [
        'app defaults',
        {
          DATABASE_HOST: 'app-db.internal',
          DATABASE_PASSWORD: 'app-test-password',
          DATABASE_PORT: undefined,
          DATABASE_NAME: undefined,
          DATABASE_USER: undefined,
          DATABASE_SSL: undefined,
        },
      ],
    ])(
      'connects to the app database when ANALYTICS_DB_HOST is unset (%s)',
      (_label, appEnv) => {
        stubEnv({ ...appEnv, ANALYTICS_DIALECT: 'postgres' });
        const app = getPgConnectionParams();
        expect(DataWarehouseFactory.createConfigFromEnv()).toMatchObject({
          connection: {
            host: app.host,
            port: app.port,
            database: app.database,
            username: app.user,
            password: app.password,
            ssl: app.ssl !== undefined,
          },
        });
      },
    );

    test('uses only ANALYTICS_DB_* when ANALYTICS_DB_HOST is set', () => {
      stubEnv({
        ...APP_DB_ENV,
        ANALYTICS_DIALECT: 'postgres',
        ANALYTICS_DB_HOST: 'analytics-db.internal',
        ANALYTICS_DB_NAME: 'coop_analytics',
        ANALYTICS_DB_USER: 'coop_analytics',
        ANALYTICS_DB_PASSWORD: 'analytics-test-password',
        ANALYTICS_DB_POOL_MAX: '12',
        ANALYTICS_DB_STATEMENT_TIMEOUT_MS: '60000',
      });
      const config = DataWarehouseFactory.createConfigFromEnv();
      expect(config).toMatchObject({
        connection: {
          host: 'analytics-db.internal',
          port: 5432,
          database: 'coop_analytics',
          username: 'coop_analytics',
          password: 'analytics-test-password',
          ssl: false,
          statementTimeoutMs: 60000,
        },
        pool: { max: 12 },
      });
    });

    test('does not fill missing ANALYTICS_DB_* fields from the app database', () => {
      stubEnv({
        ...APP_DB_ENV,
        ANALYTICS_DIALECT: 'postgres',
        ANALYTICS_DB_HOST: 'analytics-db.internal',
        ANALYTICS_DB_NAME: 'coop_analytics',
        ANALYTICS_DB_USER: 'coop_analytics',
      });
      expect(() => DataWarehouseFactory.createConfigFromEnv()).toThrow(
        /Missing env var ANALYTICS_DB_PASSWORD/,
      );
    });
  });
});
