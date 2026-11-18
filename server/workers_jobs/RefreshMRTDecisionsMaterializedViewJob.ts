import { inject } from '../iocContainer/utils.js';
import { transactionWithRetry, type TypeormDb } from '../storage/typeorm/db.js';
import { ViewMaintenanceMetadata } from '../storage/typeorm/entities/index.js';
import { MINUTE_MS } from '../utils/time.js';

const MATERIALIZED_TABLE = 'manual_review_tool.dim_mrt_decisions_materialized';

export default inject(
  ['closeSharedResourcesForShutdown', 'TypeormPg'],
  (sharedResourceShutdown, db: TypeormDb) => {
    return {
      type: 'Job' as const,
      async run() {
        await transactionWithRetry(db, {}, async (manager) => {
          const lastTimestamp = await manager.findOneBy(
            ViewMaintenanceMetadata,
            { table_name: MATERIALIZED_TABLE },
          );

          if (!lastTimestamp) {
            throw new Error('No last_insert timestamp found for the table');
          }

          // On a fresh deploy the row is seeded with Postgres `-infinity`,
          // which `pg-types` parses to the JS number `-Infinity`. In that case
          // `new Date(-Infinity - MINUTE_MS)` would be an Invalid Date, so fall
          // back to epoch and do a full backfill.
          const lastInsertMs = lastTimestamp.last_insert.valueOf();
          const oneMinutePrevious = Number.isFinite(lastInsertMs)
            ? new Date(lastInsertMs - MINUTE_MS)
            : new Date(0);

          // Raw SQL: TypeORM's insert builder has no INSERT ... SELECT.
          //
          // Since we go back in time by 1 minute, we will likely re-insert
          // some rows, which would violate that unique index. In this case we
          // just want to ignore those rows to avoid duplicate data.
          const insertedRows: { decided_at: Date }[] = await manager.query(
            `INSERT INTO manual_review_tool.dim_mrt_decisions_materialized
             SELECT * FROM manual_review_tool.dim_mrt_decisions
             WHERE decided_at > $1
             ON CONFLICT DO NOTHING
             RETURNING decided_at`,
            [oneMinutePrevious],
          );

          if (insertedRows.length === 0) {
            return;
          }

          const latestDecidedAt = insertedRows.reduce(
            (max, row) => (row.decided_at > max ? row.decided_at : max),
            insertedRows[0].decided_at,
          );

          await manager.update(
            ViewMaintenanceMetadata,
            { table_name: MATERIALIZED_TABLE },
            { last_insert: latestDecidedAt },
          );
        });
      },
      async shutdown() {
        await sharedResourceShutdown();
      },
    };
  },
);
