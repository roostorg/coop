/**
 * `transactionWithRetry` and the transactional test harness's handling of
 * TypeORM transactions (callback-style `connect`, `SAVEPOINT typeorm_<n>`
 * nesting and the separate `SET TRANSACTION ISOLATION LEVEL` statement).
 */
import pg from 'pg';
import { type DataSource } from 'typeorm';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import {
  createTransactionalTestDb,
  type TransactionalTestDb,
} from '../../test/harness/transactionalPgPool.js';
import { makeTypeormDataSource } from './dataSource.js';
import { transactionWithRetry } from './db.js';

const pgConfig = getPgConnectionParams();

describe('TypeORM transactions', () => {
  let tdb: TransactionalTestDb;
  let ds: DataSource;

  beforeEach(async () => {
    tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    ds = await makeTypeormDataSource(tdb.pool).initialize();
    await ds.query(`CREATE TABLE typeorm_txn_probe (id int)`);
  });

  afterEach(async () => {
    await ds.destroy();
    await tdb.rollback();
    await tdb.end();
  });

  const ids = async () =>
    (
      await ds.query<{ id: number }[]>(
        `SELECT id FROM typeorm_txn_probe ORDER BY id`,
      )
    ).map((r) => r.id);

  const serializationFailure = Object.assign(new Error('could not serialize'), {
    code: '40001',
  });

  it('retries serialization failures up to three attempts', async () => {
    let attempts = 0;
    const result = await transactionWithRetry(ds.manager, {}, async (m) => {
      attempts++;
      await m.query(`INSERT INTO typeorm_txn_probe VALUES ($1)`, [attempts]);
      if (attempts < 3) throw serializationFailure;
      return 'done';
    });
    expect(result).toBe('done');
    expect(attempts).toBe(3);
    // The failed attempts were rolled back.
    expect(await ids()).toEqual([3]);
  });

  it('gives up after three serialization failures', async () => {
    let attempts = 0;
    await expect(
      transactionWithRetry(ds.manager, {}, async () => {
        attempts++;
        throw serializationFailure;
      }),
    ).rejects.toBe(serializationFailure);
    expect(attempts).toBe(3);
  });

  it('does not retry other errors', async () => {
    let attempts = 0;
    const other = Object.assign(new Error('unique'), { code: '23505' });
    await expect(
      transactionWithRetry(ds.manager, {}, async () => {
        attempts++;
        throw other;
      }),
    ).rejects.toBe(other);
    expect(attempts).toBe(1);
  });

  it("joins a caller's transaction instead of opening a new one", async () => {
    await ds.manager.transaction(async (outer) => {
      await transactionWithRetry(outer, {}, async (inner) => {
        expect(inner).toBe(outer);
        await inner.query(`INSERT INTO typeorm_txn_probe VALUES (1)`);
      });
    });
    expect(await ids()).toEqual([1]);
  });

  it('rolls back a nested TypeORM transaction to its savepoint, with an isolation level', async () => {
    await ds.manager.transaction('SERIALIZABLE', async (outer) => {
      await outer.query(`INSERT INTO typeorm_txn_probe VALUES (1)`);
      await expect(
        outer.transaction(async (inner) => {
          await inner.query(`INSERT INTO typeorm_txn_probe VALUES (2)`);
          throw new Error('roll back the inner transaction');
        }),
      ).rejects.toThrow('roll back the inner transaction');
    });
    expect(await ids()).toEqual([1]);

    await tdb.rollback();
    const probe = new pg.Client(pgConfig);
    await probe.connect();
    try {
      const { rows } = await probe.query(
        `SELECT to_regclass('public.typeorm_txn_probe') AS oid`,
      );
      expect(rows[0].oid).toBeNull();
    } finally {
      await probe.end();
    }
  });
});
