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

// This harness doesn't yet support every single Postgres transaction control
// statement. The following are unsupported, and should raise an exception loudly
// rather than silently break the test harness.
const UNSUPPORTED_TXN_CONTROL_VERBS = [
  'end', // alias for COMMIT
  'abort', // alias for ROLLBACK
  'commit', // COMMIT PREPARED
  'rollback', // ROLLBACK TO SAVEPOINT / ROLLBACK PREPARED
  'savepoint',
  'release', // RELEASE [SAVEPOINT]
  'prepare transaction',
];

function rejectUnsupportedTransactionControl(
  normalized: string,
  raw: string,
): void {
  const isUnsupported = UNSUPPORTED_TXN_CONTROL_VERBS.some(
    (verb) => normalized === verb || normalized.startsWith(`${verb} `),
  );
  if (!isUnsupported) return;

  throw new Error(
    [
      `transactionalPgPool refused to run "${raw}".`,
      '',
      'This test harness isolates each test by wrapping it in one Postgres',
      'transaction and rewriting BEGIN/COMMIT/ROLLBACK into savepoints. The',
      'statement above is a different transaction-control command that would',
      'act on the outer per-test transaction instead — committing or aborting',
      "the whole test's writes and breaking isolation for every later test.",
    ].join('\n'),
  );
}

export function createTransactionalTestDb(
  config: pg.ClientConfig,
): TransactionalTestDb {
  const client = new pg.Client(config);
  let connected = false;
  // Application transactions are strictly nested (LIFO), so the active
  // savepoint is fully determined by the current depth — no stack needed.
  let savepointDepth = 0;
  const savepointName = (depth: number) => `coop_test_sp_${depth}`;

  const openSavepoint = async () => {
    savepointDepth += 1;
    return client.query(`SAVEPOINT ${savepointName(savepointDepth)}`);
  };

  const closeSavepoint = async (verb: 'commit' | 'rollback') => {
    if (savepointDepth <= 0) {
      throw new Error(
        `${verb.toUpperCase()} without a matching application transaction`,
      );
    }
    const name = savepointName(savepointDepth);
    if (verb === 'rollback') {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    }
    const result = await client.query(`RELEASE SAVEPOINT ${name}`);
    // Drop the depth only after the SQL succeeds, so a failed call can't leave
    // the savepoint stack out of sync.
    savepointDepth -= 1;
    return result;
  };

  let queue: Promise<unknown> = Promise.resolve();
  const runAfterPending = async <T>(thunk: () => Promise<T>): Promise<T> => {
    const next = queue.then(thunk);
    queue = next.catch(() => {});
    return next;
  };

  // Held for the lifetime of one application transaction (BEGIN →
  // COMMIT/ROLLBACK). `null` outside any application transaction.
  let txMutex: Promise<void> | null = null;
  let endTx: (() => void) | null = null;

  const runQuery = async (
    textOrConfig: string | pg.QueryConfig,
    values?: unknown[],
  ): Promise<unknown> => {
    const text =
      typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    const normalized =
      typeof text === 'string'
        ? text.trim().toLowerCase().replace(/;/g, '')
        : '';
    if (normalized === 'begin' || normalized.startsWith('start transaction')) {
      // A BEGIN that arrives while a transaction already holds the connection
      // is a *nested* transaction (Kysely issues a plain `begin` for nesting,
      // not a savepoint).
      if (txMutex !== null) {
        return openSavepoint(); // → SAVEPOINT coop_test_sp_<new depth>
      }
      // Top-level BEGIN: queue behind any in-flight work, wait for a prior
      // transaction to finish, then acquire the connection for ours.
      return runAfterPending(async () => {
        while (txMutex !== null) {
          await txMutex;
        }
        txMutex = new Promise<void>((resolve) => {
          endTx = resolve;
        });
        try {
          return await openSavepoint(); // → SAVEPOINT coop_test_sp_<new depth>
        } catch (e) {
          // BEGIN failed: release the mutex so we don't deadlock the queue.
          endTx?.();
          txMutex = null;
          endTx = null;
          throw e;
        }
      });
    }
    if (normalized === 'commit' || normalized === 'rollback') {
      const verb = normalized === 'commit' ? 'commit' : 'rollback';
      // Only release the mutex when the outermost
      // savepoint closes (i.e. depth is 0).
      if (txMutex === null) {
        throw new Error(
          `${verb.toUpperCase()} without a matching application transaction`,
        );
      }
      const result = await closeSavepoint(verb);
      if (savepointDepth === 0) {
        endTx?.();
        txMutex = null;
        endTx = null;
      }
      return result;
    }

    rejectUnsupportedTransactionControl(normalized, text);

    // Outside a transaction, queue to
    // preserve wire order against other ad-hoc queries.
    if (txMutex !== null) {
      return values === undefined
        ? client.query(textOrConfig)
        : client.query(textOrConfig, values);
    }
    return runAfterPending(async () =>
      values === undefined
        ? client.query(textOrConfig)
        : client.query(textOrConfig, values),
    );
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
    async query(textOrConfig: string | pg.QueryConfig, values?: unknown[]) {
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
