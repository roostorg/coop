import pg from 'pg';

/**
 * Test-only Postgres harness that wraps an entire test in a single transaction
 * and rolls it back at the end, giving perfect isolation without any per-test
 * cleanup.
 *
 * It hands out a `pg.Pool`-shaped facade (`.pool`) to be injected wherever the
 * app expects a Postgres pool (e.g. Kysely's `PostgresDialect`). The facade:
 *
 *   - pins a SINGLE real connection and returns it for every `connect()`, so
 *     the app's reads see the app's own uncommitted writes (and so a read
 *     replica routed through the same facade stays consistent);
 *   - never truly releases that connection (`release()` is a no-op);
 *   - rewrites the application's own transaction-control statements to
 *     SAVEPOINTs: `BEGIN`/`START TRANSACTION` -> `SAVEPOINT`, `COMMIT` ->
 *     `RELEASE SAVEPOINT`, `ROLLBACK` -> `ROLLBACK TO SAVEPOINT`. This is what
 *     lets nested application transactions (e.g. via
 *     `makeKyselyTransactionWithRetry`) commit/roll back correctly relative to
 *     their own scope while the outer test transaction still discards
 *     everything on `rollback()`.
 *
 * The outer transaction itself is driven by `begin()`/`rollback()`, which issue
 * the real `BEGIN`/`ROLLBACK` on the pinned connection (bypassing the savepoint
 * rewrite).
 *
 * NOTE: a single pinned connection cannot run queries concurrently, and the
 * savepoint stack assumes properly nested (LIFO) transactions.
 */
export type TransactionalTestDb = {
  /** A `pg.Pool`-compatible facade to inject into the app under test. */
  pool: pg.Pool;
  /** Connect and open the outer transaction. Call once before the test runs. */
  begin: () => Promise<void>;
  /** Roll back the outer transaction, discarding all writes made during it. */
  rollback: () => Promise<void>;
  /** Close the underlying connection. Call once after the test. */
  end: () => Promise<void>;
};

export function createTransactionalTestDb(
  config: pg.ClientConfig,
): TransactionalTestDb {
  const client = new pg.Client(config);
  let connected = false;
  // Application transactions are strictly nested (LIFO), so the active
  // savepoint is fully determined by the current depth — no stack needed.
  let savepointDepth = 0;
  const savepointName = (depth: number) => `coop_test_sp_${depth}`;

  // The single place transaction-control statements are rewritten to
  // savepoints; everything else passes straight through to the pinned client.
  // Shared by both the per-connection facade (`connect().query`) and the
  // pool-level `query` (used by consumers like the express-session store).
  const runQuery = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textOrConfig: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values?: any,
  ): Promise<unknown> => {
    const text =
      typeof textOrConfig === 'string' ? textOrConfig : textOrConfig?.text;
    const normalized =
      typeof text === 'string' ? text.trim().toLowerCase() : '';

    if (normalized === 'begin' || normalized.startsWith('start transaction')) {
      savepointDepth += 1;
      return client.query(`SAVEPOINT ${savepointName(savepointDepth)}`);
    }
    if (normalized === 'commit') {
      const name = savepointName(savepointDepth);
      savepointDepth -= 1;
      return client.query(`RELEASE SAVEPOINT ${name}`);
    }
    if (normalized === 'rollback') {
      const name = savepointName(savepointDepth);
      savepointDepth -= 1;
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      return client.query(`RELEASE SAVEPOINT ${name}`);
    }

    return values === undefined
      ? client.query(textOrConfig)
      : client.query(textOrConfig, values);
  };

  const facadeClient = {
    query: runQuery,
    // Keep the pinned connection alive across the whole test.
    release() {},
  };

  const pool = {
    async connect() {
      return facadeClient;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async query(textOrConfig: any, values?: any) {
      return runQuery(textOrConfig, values);
    },
    async end() {},
    on() {},
  };

  return {
    pool: pool as unknown as pg.Pool,
    async begin() {
      await client.connect();
      connected = true;
      await client.query('BEGIN');
      savepointDepth = 0;
    },
    async rollback() {
      await client.query('ROLLBACK');
      savepointDepth = 0;
    },
    async end() {
      if (connected) {
        await client.end();
        connected = false;
      }
    },
  };
}
