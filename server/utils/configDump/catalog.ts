/**
 * The process configuration the config dump reports: every environment
 * variable the server, workers and the OpenTelemetry instrumentation read,
 * grouped by subsystem, with the default the code falls back to when it is
 * unset. `catalog.test.ts` scans the source for env reads and fails if one is
 * missing here.
 *
 * Defaults are written as the string an operator would set to get the same
 * behavior. Keys with no default are either required (the process throws at
 * startup when it needs them) or optional features that stay off when unset.
 */

type Env = Readonly<Record<string, string | undefined>>;

export type ConfigKeySpec = {
  key: string;
  default?: string;
  /**
   * Computes the effective value when the key is unset but the code derives it
   * from other settings. Returning undefined falls back to `default`.
   */
  derive?: (env: Env) => string | undefined;
};

const effectiveWarehouseAdapter = (env: Env) =>
  env.WAREHOUSE_ADAPTER ?? env.DATA_WAREHOUSE_PROVIDER;

export const CONFIG_CATALOG: Readonly<
  Record<string, readonly ConfigKeySpec[]>
> = {
  server: [
    { key: 'NODE_ENV', default: 'development' },
    { key: 'PORT', default: '8080' },
    { key: 'UI_URL' },
    { key: 'SESSION_SECRET' },
    { key: 'GRAPHQL_MAX_DEPTH', default: '10' },
    { key: 'ITEM_QUEUE_TRAFFIC_PERCENTAGE' },
    {
      key: 'EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS',
      default: 'false',
    },
    { key: 'ALLOW_USER_INPUT_LOCALHOST_URIS', default: 'false' },
    { key: 'INTEGRATIONS_CONFIG_PATH' },
  ],
  postgres: [
    { key: 'DATABASE_HOST' },
    { key: 'DATABASE_READ_ONLY_HOST' },
    { key: 'DATABASE_PORT', default: '5432' },
    { key: 'DATABASE_NAME', default: 'development' },
    { key: 'DATABASE_USER', default: 'postgres' },
    { key: 'DATABASE_PASSWORD' },
    { key: 'DATABASE_SSL', default: 'false' },
    { key: 'DATABASE_POOL_MAX', default: '30' },
    { key: 'DATABASE_READ_POOL_MAX', default: '150' },
    { key: 'DATABASE_POOL_IDLE_TIMEOUT_MS', default: '300000' },
    { key: 'DATABASE_POOL_CONNECTION_TIMEOUT_MS', default: '15000' },
    { key: 'DATABASE_QUERY_TIMEOUT_MS', default: '1000000' },
    { key: 'DATABASE_STATEMENT_TIMEOUT_MS' },
    { key: 'DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS', default: '300000' },
    { key: 'DATABASE_POOL_MAX_LIFETIME_SECONDS', default: '0' },
    { key: 'DATABASE_KEEPALIVE', default: 'true' },
    { key: 'DATABASE_KEEPALIVE_INITIAL_DELAY_MS' },
    { key: 'DATABASE_PRINT_LOGS', default: 'false' },
  ],
  warehouse: [
    {
      key: 'WAREHOUSE_ADAPTER',
      default: 'clickhouse',
      derive: (env) => env.DATA_WAREHOUSE_PROVIDER,
    },
    { key: 'DATA_WAREHOUSE_PROVIDER' },
    {
      key: 'ANALYTICS_ADAPTER',
      default: 'clickhouse',
      derive: effectiveWarehouseAdapter,
    },
  ],
  clickhouse: [
    { key: 'CLICKHOUSE_HOST', default: 'localhost' },
    { key: 'CLICKHOUSE_PORT', default: '8123' },
    { key: 'CLICKHOUSE_PROTOCOL', default: 'http' },
    { key: 'CLICKHOUSE_USERNAME', default: 'default' },
    { key: 'CLICKHOUSE_PASSWORD', default: '' },
    { key: 'CLICKHOUSE_DATABASE', default: 'default' },
    { key: 'CLICKHOUSE_POOL_SIZE', default: '10' },
    { key: 'CLICKHOUSE_INSERT_MAX_RETRIES', default: '2' },
    { key: 'CLICKHOUSE_INSERT_RETRY_INITIAL_MS', default: '100' },
    { key: 'CLICKHOUSE_INSERT_RETRY_MAX_MS', default: '1000' },
    {
      key: 'CLICKHOUSE_MAX_BYTES_BEFORE_EXTERNAL_GROUP_BY',
      default: '1500000000',
    },
    { key: 'CLICKHOUSE_MAX_BYTES_BEFORE_EXTERNAL_SORT', default: '1500000000' },
    { key: 'CLICKHOUSE_MAX_THREADS', default: '2' },
    { key: 'CLICKHOUSE_MAX_BLOCK_SIZE', default: '32768' },
    { key: 'CLICKHOUSE_RULE_INSIGHTS_LOOKBACK_DAYS', default: '90' },
  ],
  postgres_warehouse: [
    { key: 'POSTGRES_HOST', default: 'localhost' },
    { key: 'POSTGRES_PORT' },
    { key: 'POSTGRES_USERNAME', default: 'postgres' },
    { key: 'POSTGRES_PASSWORD', default: '' },
    { key: 'POSTGRES_DATABASE', default: 'postgres' },
  ],
  redis: [
    { key: 'REDIS_USE_CLUSTER' },
    { key: 'REDIS_HOST' },
    { key: 'REDIS_PORT', default: '6379' },
    { key: 'REDIS_USER' },
    { key: 'REDIS_PASSWORD' },
    { key: 'REDIS_TLS', default: 'false' },
  ],
  scylla: [
    { key: 'SCYLLA_ENABLED', default: 'true' },
    { key: 'SCYLLA_HOSTS' },
    { key: 'SCYLLA_PORT', default: '9042' },
    { key: 'SCYLLA_LOCAL_DATACENTER' },
    { key: 'SCYLLA_USERNAME' },
    { key: 'SCYLLA_PASSWORD' },
    { key: 'SCYLLA_SSL', default: 'false' },
    {
      key: 'SCYLLA_SSL_SERVERNAME',
      derive: (env) => env.SCYLLA_HOSTS?.split(',')[0]?.trim(),
    },
  ],
  hma: [{ key: 'HMA_SERVICE_URL', default: 'http://localhost:9876/' }],
  email: [
    { key: 'EMAIL_TRANSPORT' },
    { key: 'SENDGRID_API_KEY' },
    { key: 'NOREPLY_EMAIL', default: 'noreply@example.com' },
    { key: 'SUPPORT_EMAIL', default: 'support@example.com' },
    { key: 'TEAM_EMAIL', default: 'team@example.com' },
  ],
  ncmec: [{ key: 'NCMEC_ENV', default: 'test' }, { key: 'NCMEC_DEBUG' }],
  google_places: [{ key: 'GOOGLE_PLACES_API_KEY' }],
  telemetry: [
    { key: 'OTEL_SERVICE_NAME' },
    { key: 'OTEL_EXPORTER_OTLP_ENDPOINT' },
    { key: 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT' },
    { key: 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT' },
    { key: 'OTEL_EXPORTER_OTLP_HEADERS' },
    { key: 'OTEL_RESOURCE_ATTRIBUTES' },
    { key: 'GIT_REPOSITORY_URL' },
    { key: 'LOG_REQUEST_BODY', default: 'false' },
  ],
};
