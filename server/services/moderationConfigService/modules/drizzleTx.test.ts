import { sql } from 'drizzle-orm';

import { getPgConnectionParams } from '../../../iocContainer/index.js';
import { makeDrizzle } from '../../../storage/postgres/drizzle.js';
import { createTransactionalTestDb } from '../../../test/harness/transactionalPgPool.js';
import { runInTransaction } from './drizzleTx.js';

describe('runInTransaction', () => {
  it('runs in a savepoint of an existing transaction, and refuses an isolation level there', async () => {
    const tdb = createTransactionalTestDb(getPgConnectionParams());
    await tdb.begin();
    try {
      const db = makeDrizzle(tdb.pool);

      await expect(
        runInTransaction(db, async (outer) =>
          runInTransaction(outer, async () => 'unreachable', {
            isolationLevel: 'serializable',
          }),
        ),
      ).rejects.toThrow(/inside an existing transaction/);

      const nested = await runInTransaction(
        db,
        async (outer) =>
          runInTransaction(outer, async (inner) => {
            const result = await inner.execute<{ one: number }>(
              sql`select 1 as one`,
            );
            return result.rows[0].one;
          }),
        { isolationLevel: 'serializable' },
      );
      expect(nested).toBe(1);
    } finally {
      await tdb.rollback();
      await tdb.end();
    }
  });
});
