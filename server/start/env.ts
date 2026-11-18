import { Env } from '@adonisjs/core/env';

/**
 * Every environment variable the server, workers and CLI read, validated once
 * at process start.
 *
 * Validation is deliberately loose: the existing readers (`safeGetEnvVar`,
 * `safeGetEnvInt`, `isEnvTrue`, ...) fall back to defaults and log on bad
 * values, and only fail when a service that needs the variable is built. A
 * worker isn't given the web server's variables. Making these stricter here
 * would turn today's warnings into boot failures, so only the variables every
 * process needs are required. The schema still gives one typed list of
 * supported variables.
 */
const optionalString = Env.schema.string.optional;

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: optionalString(),
  PORT: Env.schema.number.optional(),
  BUILD_ID: optionalString(),
  LOG_LEVEL: optionalString(),
  OTEL_SERVICE_NAME: optionalString(),
  LOG_REQUEST_BODY: optionalString(),
  EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS: optionalString(),
  ALLOW_USER_INPUT_LOCALHOST_URIS: optionalString(),
  INTEGRATIONS_CONFIG_PATH: optionalString(),
  GRAPHQL_MAX_DEPTH: optionalString(),
  ITEM_QUEUE_TRAFFIC_PERCENTAGE: optionalString(),

  // Read eagerly by the service container in every process.
  UI_URL: Env.schema.string({ format: 'url', tld: false, protocol: false }),
  // Required by the web server only; checked in providers/coop_provider.ts.
  SESSION_SECRET: optionalString(),

  DATABASE_HOST: optionalString(),
  DATABASE_READ_ONLY_HOST: optionalString(),
  DATABASE_PORT: optionalString(),
  DATABASE_NAME: optionalString(),
  DATABASE_USER: optionalString(),
  DATABASE_PASSWORD: optionalString(),
  DATABASE_SSL: optionalString(),
  DATABASE_POOL_MAX: optionalString(),
  DATABASE_READ_POOL_MAX: optionalString(),
  DATABASE_POOL_IDLE_TIMEOUT_MS: optionalString(),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: optionalString(),
  DATABASE_POOL_MAX_LIFETIME_SECONDS: optionalString(),
  DATABASE_QUERY_TIMEOUT_MS: optionalString(),
  DATABASE_STATEMENT_TIMEOUT_MS: optionalString(),
  DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: optionalString(),
  DATABASE_KEEPALIVE: optionalString(),
  DATABASE_KEEPALIVE_INITIAL_DELAY_MS: optionalString(),
  DATABASE_PRINT_LOGS: optionalString(),

  WAREHOUSE_ADAPTER: optionalString(),
  ANALYTICS_ADAPTER: optionalString(),
  DATA_WAREHOUSE_PROVIDER: optionalString(),
  CLICKHOUSE_HOST: optionalString(),
  CLICKHOUSE_PORT: optionalString(),
  CLICKHOUSE_USERNAME: optionalString(),
  CLICKHOUSE_PASSWORD: optionalString(),
  CLICKHOUSE_DATABASE: optionalString(),
  CLICKHOUSE_PROTOCOL: optionalString(),
  CLICKHOUSE_POOL_SIZE: optionalString(),
  CLICKHOUSE_MAX_THREADS: optionalString(),
  CLICKHOUSE_MAX_BLOCK_SIZE: optionalString(),
  CLICKHOUSE_INSERT_MAX_RETRIES: optionalString(),
  // Postgres as the data warehouse (DataWarehouseFactory).
  POSTGRES_HOST: optionalString(),
  POSTGRES_PORT: optionalString(),
  POSTGRES_DATABASE: optionalString(),
  POSTGRES_USERNAME: optionalString(),
  POSTGRES_PASSWORD: optionalString(),

  SCYLLA_ENABLED: optionalString(),
  SCYLLA_HOSTS: optionalString(),
  SCYLLA_PORT: optionalString(),
  SCYLLA_USERNAME: optionalString(),
  SCYLLA_PASSWORD: optionalString(),
  SCYLLA_LOCAL_DATACENTER: optionalString(),
  SCYLLA_SSL: optionalString(),
  SCYLLA_SSL_SERVERNAME: optionalString(),

  REDIS_HOST: optionalString(),
  REDIS_PORT: optionalString(),
  REDIS_USER: optionalString(),
  REDIS_PASSWORD: optionalString(),
  REDIS_TLS: optionalString(),
  REDIS_USE_CLUSTER: optionalString(),

  HMA_SERVICE_URL: optionalString(),
  GOOGLE_PLACES_API_KEY: optionalString(),
  SENDGRID_API_KEY: optionalString(),
  EMAIL_TRANSPORT: optionalString(),
  NOREPLY_EMAIL: optionalString(),
  SUPPORT_EMAIL: optionalString(),
  TEAM_EMAIL: optionalString(),
  NCMEC_ENV: optionalString(),
  NCMEC_DEBUG: optionalString(),
});
