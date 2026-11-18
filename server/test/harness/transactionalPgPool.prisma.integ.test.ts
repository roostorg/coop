/**
 * Proves the transaction-rollback harness also isolates Prisma: model queries,
 * interactive transactions (with an isolation level) and nested transactions
 * all run as savepoints inside the per-test transaction.
 */
import pg from 'pg';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import { makePrismaClient } from '../../storage/prisma/index.js';
import { makePrismaTransactionWithRetry } from '../../utils/prismaTransactionWithRetry.js';
import { createTransactionalTestDb } from './transactionalPgPool.js';

const pgConfig = getPgConnectionParams();
const jobName = 'transactional-harness-prisma-probe';

async function countProbeRowsFromAnotherConnection() {
  const probe = new pg.Client(pgConfig);
  await probe.connect();
  try {
    const result = await probe.query(
      'select count(*)::int as count from jobs.scheduled_jobs_info where job_name = $1',
      [jobName],
    );
    return result.rows[0].count as number;
  } finally {
    await probe.end();
  }
}

describe('createTransactionalTestDb with Prisma', () => {
  it('rolls back model writes, including committed and nested interactive transactions', async () => {
    const tdb = createTransactionalTestDb(pgConfig);
    await tdb.begin();
    try {
      const prisma = makePrismaClient(tdb.pool);
      const transactionWithRetry = makePrismaTransactionWithRetry(prisma);

      await transactionWithRetry(
        { isolationLevel: 'Serializable' },
        async (tx) => {
          await tx.scheduled_jobs_info.create({
            data: { job_name: jobName, last_run: new Date(0) },
          });
          await transactionWithRetry(async (inner) => {
            await inner.scheduled_jobs_info.update({
              where: { job_name: jobName },
              data: { last_run: new Date(1000) },
            });
          });
        },
      );

      await expect(
        transactionWithRetry(async (tx) => {
          await tx.scheduled_jobs_info.update({
            where: { job_name: jobName },
            data: { last_run: new Date(2000) },
          });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      const row = await prisma.scheduled_jobs_info.findUniqueOrThrow({
        where: { job_name: jobName },
      });
      expect(row.last_run).toEqual(new Date(1000));
      expect(await countProbeRowsFromAnotherConnection()).toBe(0);

      await tdb.rollback();
      expect(
        await prisma.scheduled_jobs_info.count({
          where: { job_name: jobName },
        }),
      ).toBe(0);
    } finally {
      await tdb.end();
    }
  });
});
