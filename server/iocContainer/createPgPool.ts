import pg from 'pg';

import { logErrorJson } from '../utils/logging.js';

/**
 * Wraps `new pg.Pool` with an idle-client `'error'` listener.
 *
 * Without a listener, `pg` escalates idle-client errors (Postgres restart,
 * dropped LB connection, etc.) to `uncaughtException`, which kills the
 * process. Logging the error lets the pool replace the dead client on the
 * next checkout, which is the recovery path `pg` already supports.
 */
export function createPgPool(config: pg.PoolConfig): pg.Pool {
  const pool = new pg.Pool(config);

  // Log-only; do NOT re-throw.
  pool.on('error', (err) => {
    // eslint-disable-next-line no-restricted-syntax -- boot-time logger; runs before tracer init
    logErrorJson({
      message: 'Postgres pool idle-client error (pool will reconnect lazily)',
      error: err,
    });
  });

  return pool;
}
