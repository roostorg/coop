/**
 * Keystone test for the transaction-rollback test harness.
 *
 * Proves that `createTransactionalTestDb` lets us wrap a whole test in a single
 * Postgres transaction that is rolled back at the end.
 */
import 'dotenv/config';

import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import { makeKyselyTransactionWithRetry } from '../../utils/kyselyTransactionWithRetry.js';
import { createTransactionalTestDb } from './transactionalPgPool.js';

const pgConfig = getPgConnectionParams();

describe('createTransactionalTestDb', () => {
  it('rolls back every write made through the facade, isolating it from other connections', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const db = new Kysely<Record<string, never>>({
        dialect: new PostgresDialect({ pool: tdb.pool }),
      });

      await sql`create table rollback_probe (id int)`.execute(db);
      await sql`insert into rollback_probe (id) values (1)`.execute(db);
      const within = await sql<{
        count: number;
      }>`select count(*)::int as count from rollback_probe`.execute(db);
      expect(within.rows[0].count).toBe(1);

      await tdb.rollback();
      await db.destroy();

      // A separate, real connection must see no trace of the rolled-back work.
      const probe = new pg.Client(pgConfig);
      await probe.connect();
      try {
        const exists = await probe.query(
          `select to_regclass('public.rollback_probe') as table_oid`,
        );
        expect(exists.rows[0].table_oid).toBeNull();
      } finally {
        await probe.end();
      }
    } finally {
      // Always close the pinned connection so a mid-test throw can't leak it
      // (and closing aborts any still-open outer transaction).
      await tdb.end();
    }
  });

  it('rewrites application transactions to savepoints: committed nested work survives, rolled-back nested work does not, outer stays alive', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const db = new Kysely<Record<string, never>>({
        dialect: new PostgresDialect({ pool: tdb.pool }),
      });
      const transactionWithRetry = makeKyselyTransactionWithRetry(db);

      await sql`create table savepoint_probe (id int, tag text)`.execute(db);

      // A nested transaction that commits — its COMMIT must become RELEASE
      // SAVEPOINT, so the row persists within the still-open outer transaction.
      await transactionWithRetry(async (trx) => {
        await sql`insert into savepoint_probe (id, tag) values (1, 'committed')`.execute(
          trx,
        );
      });

      // A nested transaction that throws — its ROLLBACK must become ROLLBACK TO
      // SAVEPOINT, discarding only its own write while leaving the outer
      // transaction (and the committed row above) intact.
      await expect(
        transactionWithRetry(async (trx) => {
          await sql`insert into savepoint_probe (id, tag) values (2, 'rolled-back')`.execute(
            trx,
          );
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      const rows = await sql<{
        id: number;
      }>`select id from savepoint_probe order by id`.execute(db);
      expect(rows.rows.map((r) => r.id)).toEqual([1]);

      await tdb.rollback();
      await db.destroy();
    } finally {
      // Always close the pinned connection so a mid-test throw can't leak it
      // (and closing aborts any still-open outer transaction).
      await tdb.end();
    }
  });

  it('rejects unhandled transaction-control statements that would escape the outer transaction', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      // `END`/`ABORT` are aliases for COMMIT/ROLLBACK: forwarded unrewritten
      // they would act on the outer per-test transaction and defeat isolation,
      // so the facade must reject them rather than pass them through.
      await expect(tdb.pool.query('END')).rejects.toThrow(
        /transactionalPgPool refused to run "END"/,
      );
      await expect(tdb.pool.query('ABORT')).rejects.toThrow(
        /transactionalPgPool refused to run "ABORT"/,
      );

      // A `PREPARE <name>` statement is an ordinary query (not transaction
      // control) and must still pass straight through.
      await tdb.pool.query('prepare harness_probe as select 1');
      const prepared = await tdb.pool.query('execute harness_probe');
      expect(prepared.rows).toHaveLength(1);

      await tdb.rollback();
    } finally {
      // Always close the pinned connection so a mid-test throw can't leak it
      // (and closing aborts any still-open outer transaction).
      await tdb.end();
    }
  });

  it('supports direct pool.query (e.g. for the session store), routed through the same rolled-back transaction', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      await tdb.pool.query('create table direct_probe (id int)');
      await tdb.pool.query('insert into direct_probe (id) values ($1)', [7]);
      const within = await tdb.pool.query(
        'select count(*)::int as count from direct_probe',
      );
      expect(within.rows[0].count).toBe(1);

      await tdb.rollback();

      const probe = new pg.Client(pgConfig);
      await probe.connect();
      try {
        const exists = await probe.query(
          `select to_regclass('public.direct_probe') as table_oid`,
        );
        expect(exists.rows[0].table_oid).toBeNull();
      } finally {
        await probe.end();
      }
    } finally {
      // Always close the pinned connection so a mid-test throw can't leak it
      // (and closing aborts any still-open outer transaction).
      await tdb.end();
    }
  });

  it('serializes concurrent commits so they do not race the savepoint stack', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const db = new Kysely<Record<string, never>>({
        dialect: new PostgresDialect({ pool: tdb.pool }),
      });
      const transactionWithRetry = makeKyselyTransactionWithRetry(db);

      await sql`create table concurrency_probe (id int primary key, seq serial)`.execute(
        db,
      );

      const ids = Array.from({ length: 16 }, (_, i) => i);

      await Promise.all(
        ids.map(async (id) =>
          transactionWithRetry(async (trx) => {
            await sql`insert into concurrency_probe (id) values (${id})`.execute(
              trx,
            );
          }),
        ),
      );

      const rows = await sql<{
        id: number;
      }>`select id from concurrency_probe order by seq`.execute(db);
      expect(rows.rows.map((r) => r.id)).toEqual(ids);

      await tdb.rollback();
      await db.destroy();
    } finally {
      // Always close the pinned connection so a mid-test throw can't leak it
      // (and closing aborts any still-open outer transaction).
      await tdb.end();
    }
  });

  it('isolates a concurrent rollback from sibling committed transactions', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const db = new Kysely<Record<string, never>>({
        dialect: new PostgresDialect({ pool: tdb.pool }),
      });
      const transactionWithRetry = makeKyselyTransactionWithRetry(db);

      await sql`create table concurrency_probe (id int primary key)`.execute(
        db,
      );

      // Run several transactions concurrently; one throws after its insert.
      // Its row must be the only one missing — a concurrent rollback must
      // never discard a sibling transaction's committed work.
      const ids = [0, 1, 2, 3, 4];
      const throwingId = 2;

      await Promise.all(
        ids.map(async (id) => {
          if (id === throwingId) {
            await expect(
              transactionWithRetry(async (trx) => {
                await sql`insert into concurrency_probe (id) values (${id})`.execute(
                  trx,
                );
                throw new Error('boom');
              }),
            ).rejects.toThrow('boom');
          } else {
            await transactionWithRetry(async (trx) => {
              await sql`insert into concurrency_probe (id) values (${id})`.execute(
                trx,
              );
            });
          }
        }),
      );

      const rows = await sql<{
        id: number;
      }>`select id from concurrency_probe order by id`.execute(db);
      expect(rows.rows.map((r) => r.id)).toEqual(
        ids.filter((id) => id !== throwingId),
      );

      await tdb.rollback();
      await db.destroy();
    } finally {
      // Always close the pinned connection so a mid-test throw can't leak it
      // (and closing aborts any still-open outer transaction).
      await tdb.end();
    }
  });

  it('supports nested application transactions without deadlocking', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const db = new Kysely<Record<string, never>>({
        dialect: new PostgresDialect({ pool: tdb.pool }),
      });
      const transactionWithRetry = makeKyselyTransactionWithRetry(db);

      await sql`create table nested_probe (id int)`.execute(db);

      // An outer transaction that opens an inner transaction. Kysely issues a
      // plain `begin` for the inner one,
      // so the harness must treat a BEGIN that arrives while a transaction
      // already holds the connection as a nested savepoint, not a concurrent
      // transaction to wait on.
      const result = await transactionWithRetry(async (trx) => {
        await sql`insert into nested_probe (id) values (1)`.execute(trx);
        const inner = await transactionWithRetry(async (innerTrx) => {
          await sql`insert into nested_probe (id) values (2)`.execute(innerTrx);
          return 'inner-ok';
        });
        return `outer-${inner}`;
      });
      expect(result).toBe('outer-inner-ok');

      const rows = await sql<{
        id: number;
      }>`select id from nested_probe order by id`.execute(db);
      expect(rows.rows.map((r) => r.id)).toEqual([1, 2]);

      await tdb.rollback();
      await db.destroy();
    } finally {
      await tdb.end();
    }
  });
});
