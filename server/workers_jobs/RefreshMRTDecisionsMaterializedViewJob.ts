import { inject } from '../iocContainer/utils.js';
import { Prisma } from '../storage/prisma/index.js';
import { makePrismaTransactionWithRetry } from '../utils/prismaTransactionWithRetry.js';
import { MINUTE_MS } from '../utils/time.js';

const MATERIALIZED_TABLE_NAME =
  'manual_review_tool.dim_mrt_decisions_materialized';

export default inject(
  ['closeSharedResourcesForShutdown', 'PrismaPg'],
  (sharedResourceShutdown, prisma) => {
    const transactionWithRetry = makePrismaTransactionWithRetry(prisma);
    return {
      type: 'Job' as const,
      async run() {
        // A full backfill (first run) can take far longer than the default
        // 30 s interactive-transaction timeout.
        await transactionWithRetry({ timeout: 30 * MINUTE_MS }, async (tx) => {
          const lastTimestamp = await tx.view_maintenance_metadata.findUnique({
            select: { last_insert: true },
            where: { table_name: MATERIALIZED_TABLE_NAME },
          });

          if (!lastTimestamp) {
            throw new Error('No last_insert timestamp found for the table');
          }

          // On a fresh deploy the row is seeded with Postgres `-infinity`,
          // which Prisma returns as an Invalid Date (`valueOf()` is NaN). In
          // that case `new Date(NaN - MINUTE_MS)` would also be invalid, so
          // fall back to epoch and do a full backfill.
          const lastInsertMs = lastTimestamp.last_insert.valueOf();
          const oneMinutePrevious = Number.isFinite(lastInsertMs)
            ? new Date(lastInsertMs - MINUTE_MS)
            : new Date(0);

          // since we are going back in time by 1 minute, we will likely be
          // re-inserting some rows, which should lead to unique constraint
          // violations. In this case we just want to ignore those rows to avoid
          // duplicate data
          // prisma-raw: INSERT ... SELECT into an @@ignore'd table (no PK), ON CONFLICT DO NOTHING RETURNING
          const insertedRows = await tx.$queryRaw<{ decided_at: Date }[]>(
            Prisma.sql`
              INSERT INTO manual_review_tool.dim_mrt_decisions_materialized
              SELECT * FROM manual_review_tool.dim_mrt_decisions
              WHERE decided_at > ${oneMinutePrevious}
              ON CONFLICT DO NOTHING
              RETURNING decided_at
            `,
          );

          if (insertedRows.length === 0) {
            return;
          }

          const latestDecidedAt = insertedRows.reduce(
            (max, row) => (row.decided_at > max ? row.decided_at : max),
            insertedRows[0].decided_at,
          );

          await tx.view_maintenance_metadata.updateMany({
            data: { last_insert: latestDecidedAt },
            where: { table_name: MATERIALIZED_TABLE_NAME },
          });
        });
      },
      async shutdown() {
        await sharedResourceShutdown();
      },
    };
  },
);
