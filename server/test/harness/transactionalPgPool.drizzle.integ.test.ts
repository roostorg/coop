/**
 * The transaction-rollback harness under Drizzle, whose transaction control
 * differs from Kysely's: BEGIN carries the isolation level, and nested
 * transactions are Drizzle's own named savepoints.
 */
import { sql } from 'drizzle-orm';
import pg from 'pg';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import {
  makeDrizzle,
  transactionWithRetry,
} from '../../storage/postgres/drizzle.js';
import { createTransactionalTestDb } from './transactionalPgPool.js';

const pgConfig = getPgConnectionParams();

describe('createTransactionalTestDb with Drizzle', () => {
  it('maps Drizzle transactions and nested savepoints onto the outer test transaction', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const db = makeDrizzle(tdb.pool);
      await db.execute(sql`create table drizzle_probe (id int, tag text)`);

      await transactionWithRetry(
        db,
        async (tx) => {
          await tx.execute(
            sql`insert into drizzle_probe values (1, 'outer committed')`,
          );
          await expect(
            tx.transaction(async (nested) => {
              await nested.execute(
                sql`insert into drizzle_probe values (2, 'nested rolled back')`,
              );
              throw new Error('roll back nested');
            }),
          ).rejects.toThrow('roll back nested');
          await tx.transaction(async (nested) => {
            await nested.execute(
              sql`insert into drizzle_probe values (3, 'nested committed')`,
            );
          });
        },
        { isolationLevel: 'serializable' },
      );

      await expect(
        db.transaction(async (tx) => {
          await tx.execute(
            sql`insert into drizzle_probe values (4, 'outer rolled back')`,
          );
          throw new Error('roll back outer');
        }),
      ).rejects.toThrow('roll back outer');

      const rows = await db.execute<{ id: number }>(
        sql`select id from drizzle_probe order by id`,
      );
      expect(rows.rows.map((it) => it.id)).toEqual([1, 3]);

      await tdb.rollback();

      const probe = new pg.Client(pgConfig);
      await probe.connect();
      try {
        const exists = await probe.query(
          `select to_regclass('public.drizzle_probe') as table_oid`,
        );
        expect(exists.rows[0].table_oid).toBeNull();
      } finally {
        await probe.end();
      }
    } finally {
      await tdb.end();
    }
  });

  it('still rejects savepoint commands outside an application transaction', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const db = makeDrizzle(tdb.pool);
      // Drizzle wraps driver errors; the harness's error is the `cause`.
      await expect(db.execute(sql.raw('savepoint sp1'))).rejects.toMatchObject({
        cause: { message: expect.stringMatching(/refused to run/) },
      });
    } finally {
      await tdb.end();
    }
  });
});
