import env from '#start/env';

import { type ClickhouseInsertRetrySettings } from '../plugins/analytics/adapters/clickhouseRetry.js';
import { type ClickhouseMemorySettings } from '../plugins/warehouse/utils/clickhouseSettings.js';
import { type DataWarehouseConfig } from '../storage/dataWarehouse/DataWarehouseFactory.js';

/**
 * `max_bytes_before_external_*` above this spills to disk instead of failing
 * the query. Zero disables the threshold entirely.
 */
const DEFAULT_MAX_BYTES_BEFORE_EXTERNAL = 1_500_000_000;

const memory: ClickhouseMemorySettings = {
  max_bytes_before_external_group_by: String(
    env.get(
      'CLICKHOUSE_MAX_BYTES_BEFORE_EXTERNAL_GROUP_BY',
      DEFAULT_MAX_BYTES_BEFORE_EXTERNAL,
    ),
  ),
  max_bytes_before_external_sort: String(
    env.get(
      'CLICKHOUSE_MAX_BYTES_BEFORE_EXTERNAL_SORT',
      DEFAULT_MAX_BYTES_BEFORE_EXTERNAL,
    ),
  ),
  max_threads: env.get('CLICKHOUSE_MAX_THREADS', 2),
  max_block_size: String(env.get('CLICKHOUSE_MAX_BLOCK_SIZE', 32768)),
};

/**
 * ClickHouse over HTTP can reset in-flight connections (remote restart, an
 * idle-socket reaper in between), which is transient and worth a retry.
 */
const insertRetry: ClickhouseInsertRetrySettings = {
  maxRetries: env.get('CLICKHOUSE_INSERT_MAX_RETRIES', 2),
  initialTimeMsBetweenRetries: env.get(
    'CLICKHOUSE_INSERT_RETRY_INITIAL_MS',
    100,
  ),
  maxTimeMsBetweenRetries: env.get('CLICKHOUSE_INSERT_RETRY_MAX_MS', 1000),
};

/**
 * Which warehouse backs analytics and reporting.
 *
 * `DATA_WAREHOUSE_PROVIDER` is the superseded spelling of `WAREHOUSE_ADAPTER`
 * and is still honoured. `ANALYTICS_ADAPTER` defaults to whatever the warehouse
 * is, so a deployment only sets it to split the two.
 */
const provider = env.get(
  'WAREHOUSE_ADAPTER',
  env.get('DATA_WAREHOUSE_PROVIDER', 'clickhouse'),
);

const analyticsProvider = env.get('ANALYTICS_ADAPTER', provider);

/**
 * Every warehouse Coop can talk to, keyed by the value `WAREHOUSE_ADAPTER`
 * takes, with `connection` naming the one in use — the shape `@adonisjs/lucid`
 * and `@adonisjs/redis` both use for "several possible backends, one selected".
 *
 * `satisfies Record<typeof provider, …>` is what makes this exhaustive: the map
 * must cover exactly the values the schema permits, so widening the enum is a
 * type error here until the connection exists. A `switch` could only have caught
 * that at runtime.
 *
 * `postgresql` is absent deliberately. The factory still carries its branches,
 * but they are unimplemented — a no-op warehouse and a dialect that throws — so
 * it is not offered as an adapter value until that work lands.
 */
const connections = {
  noop: { provider: 'noop' },

  clickhouse: {
    provider: 'clickhouse',
    connection: {
      host: env.get('CLICKHOUSE_HOST', 'localhost'),
      port: env.get('CLICKHOUSE_PORT', 8123),
      username: env.get('CLICKHOUSE_USERNAME', 'default'),
      password: env.get('CLICKHOUSE_PASSWORD')?.release() ?? '',
      database: env.get('CLICKHOUSE_DATABASE', 'default'),
      protocol: env.get('CLICKHOUSE_PROTOCOL', 'http'),
    },
    pool: { max: env.get('CLICKHOUSE_POOL_SIZE', 10) },
    memory,
    insertRetry,
  },
} satisfies Record<typeof provider, DataWarehouseConfig>;

export default {
  connections,

  /** Queries and transactions: the `DataWarehouse` and `DataWarehouseDialect` services. */
  warehouse: {
    connection: provider,

    /**
     * Bounds the window Rule Insights scans, so a memory-constrained instance
     * reads far less than a full year. The client filters further and defaults
     * to a one-week view.
     */
    ruleInsightsLookbackDays: env.get(
      'CLICKHOUSE_RULE_INSIGHTS_LOOKBACK_DAYS',
      90,
    ),
  },

  /** Bulk writes, CDC and logging: the `DataWarehouseAnalytics` service. */
  analytics: {
    connection: analyticsProvider,
  },
};
