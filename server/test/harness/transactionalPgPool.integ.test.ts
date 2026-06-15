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
});
