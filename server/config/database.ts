import appConfig from '#config/app';
import env from '#start/env';
import { LOG_LEVELS, type LogLevel } from 'kysely';
import type { ClientConfig, PoolConfig } from 'pg';

/**
 * Postgres connection and pool settings.
 *
 * Defaults live here rather than at the call site, so the value a variable
 * takes when unset is visible next to the variable itself.
 *
 * `statementTimeoutMs` and `keepAliveInitialDelayMs` are deliberately left as
 * `number | undefined`: the pg options they map to must be *absent* rather than
 * zero when unconfigured, so Postgres and pg apply their own defaults.
 */
const config = {
  host: env.get('DATABASE_HOST'),
  readOnlyHost: env.get('DATABASE_READ_ONLY_HOST'),
  port: env.get('DATABASE_PORT', 5432),
  name: env.get('DATABASE_NAME', 'development'),
  user: env.get('DATABASE_USER', 'postgres'),
  password: env.get('DATABASE_PASSWORD'),
  ssl: env.get('DATABASE_SSL', false),

  /** Logs every executed query, with SQL, bound params and duration. */
  printLogs: env.get('DATABASE_PRINT_LOGS', false),

  pool: {
    max: env.get('DATABASE_POOL_MAX', 30),
    readMax: env.get('DATABASE_READ_POOL_MAX', 150),

    /** pg's own default is 10s, which churns connections during quiet periods. */
    idleTimeoutMs: env.get('DATABASE_POOL_IDLE_TIMEOUT_MS', 300_000),

    /** pg's own default is 0 (wait forever). Fail fast if the db is unreachable. */
    connectionTimeoutMs: env.get('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 15_000),

    /** Client-side bound on long-running queries. */
    queryTimeoutMs: env.get('DATABASE_QUERY_TIMEOUT_MS', 1_000_000),

    /**
     * Server-side bound, defence in depth alongside `queryTimeoutMs`. Unset
     * leaves Postgres' own default, which is no limit.
     */
    statementTimeoutMs: env.get('DATABASE_STATEMENT_TIMEOUT_MS'),

    /** Kills sessions sitting idle inside an open transaction, holding locks. */
    idleInTransactionTimeoutMs: env.get(
      'DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS',
      300_000,
    ),

    /** Recycles each client after N seconds to dodge stale connections. */
    maxLifetimeSeconds: env.get('DATABASE_POOL_MAX_LIFETIME_SECONDS', 0),

    /**
     * TCP keepalive surfaces NAT and load-balancer connection drops as pool
     * errors rather than hung queries. On unless explicitly disabled.
     */
    keepAlive: env.get('DATABASE_KEEPALIVE', true),

    /** Unset leaves pg's own initial delay. */
    keepAliveInitialDelayMs: env.get('DATABASE_KEEPALIVE_INITIAL_DELAY_MS'),
  },
};

/**
 * Where to connect and as whom, with no pool tuning: what a single `pg.Client`
 * should be built from.
 *
 * `connections.primary` is not a substitute. `PoolConfig extends ClientConfig`,
 * so it type-checks, but pg forwards `statement_timeout`, `query_timeout` and
 * `idle_in_transaction_session_timeout` to a plain client as well — and the
 * last of those would terminate a connection that is deliberately held open
 * inside a transaction, which is exactly what the test harness does.
 */
const connectionParams: ClientConfig = {
  user: config.user,
  database: config.name,
  password: config.password.release(),
  port: config.port,
  host: config.host,
  ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
};

/**
 * Pool tuning shared by both pools, in pg's own option names.
 *
 * `statement_timeout` and `keepAliveInitialDelayMillis` are omitted rather than
 * zeroed when unconfigured, so Postgres and pg apply their own defaults.
 */
const poolTuning: PoolConfig = {
  idleTimeoutMillis: config.pool.idleTimeoutMs,
  connectionTimeoutMillis: config.pool.connectionTimeoutMs,
  query_timeout: config.pool.queryTimeoutMs,
  ...(config.pool.statementTimeoutMs !== undefined && {
    statement_timeout: config.pool.statementTimeoutMs,
  }),
  idle_in_transaction_session_timeout: config.pool.idleInTransactionTimeoutMs,
  maxLifetimeSeconds: config.pool.maxLifetimeSeconds,
  // Connection drops surface as pool errors, handled by `createPgPool`.
  keepAlive: config.pool.keepAlive,
  ...(config.pool.keepAliveInitialDelayMs !== undefined && {
    keepAliveInitialDelayMillis: config.pool.keepAliveInitialDelayMs,
  }),
};

/** Everything needed to build the primary pool. */
const primary: PoolConfig = {
  ...connectionParams,
  max: config.pool.max,
  application_name: appConfig.serviceName,
  ...poolTuning,
};

/**
 * The primary pool's settings, redirected at the read replica.
 *
 * Falls back to the primary host when no replica is configured, so a
 * single-database deployment works without repeating the host. It keeps its
 * own pool size either way, since read and write traffic are sized
 * differently.
 */
const readReplica: PoolConfig = {
  ...primary,
  max: config.pool.readMax,
  host: config.readOnlyHost ?? config.host,
};

/**
 * Kysely's own default is `['error']`; `DATABASE_PRINT_LOGS` opts in to
 * `LOG_LEVELS`, every level Kysely defines, which also logs each executed
 * query with its SQL, bound params and duration.
 *
 * Tests log nothing by default. Kysely logs a query error even when the caller
 * catches and handles it, so a suite that deliberately exercises a failure
 * path - a unique violation surfacing as a friendly "name already exists", for
 * instance - fills the output with errors that are not failures, and are easily
 * mistaken for them. `DATABASE_PRINT_LOGS` still overrides this when debugging.
 */
function resolveLogLevels(): ReadonlyArray<LogLevel> {
  if (config.printLogs) {
    return LOG_LEVELS;
  }

  return appConfig.inTest ? [] : ['error'];
}

export default {
  ...config,
  connectionParams,
  connections: { primary, readReplica },
  logLevels: resolveLogLevels(),
};
