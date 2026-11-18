import { eq, gt } from 'drizzle-orm';

import { inject } from '../iocContainer/utils.js';
import {
  schema,
  transactionWithRetry,
  type CoopDb,
} from '../storage/postgres/drizzle.js';
import { MINUTE_MS } from '../utils/time.js';

const MATERIALIZED_TABLE_NAME =
  'manual_review_tool.dim_mrt_decisions_materialized';

export default inject(
  ['closeSharedResourcesForShutdown', 'DrizzlePg'],
  (sharedResourceShutdown, db: CoopDb) => {
    const metadata = schema.viewMaintenanceMetadata;
    const view = schema.dimMrtDecisions;
    const materialized = schema.dimMrtDecisionsMaterialized;
    return {
      type: 'Job' as const,
      async run() {
        await transactionWithRetry(db, async (tx) => {
          const [lastTimestamp] = await tx
            .select({ lastInsert: metadata.lastInsert })
            .from(metadata)
            .where(eq(metadata.tableName, MATERIALIZED_TABLE_NAME))
            .limit(1);

          if (!lastTimestamp) {
            throw new Error('No last_insert timestamp found for the table');
          }

          // On a fresh deploy the row is seeded with Postgres `-infinity`,
          // which decodes to an Invalid Date (NaN). In that case
          // `new Date(NaN - MINUTE_MS)` would be an Invalid Date too, so fall
          // back to epoch and do a full backfill.
          const lastInsertMs = lastTimestamp.lastInsert.valueOf();
          const oneMinutePrevious = Number.isFinite(lastInsertMs)
            ? new Date(lastInsertMs - MINUTE_MS)
            : new Date(0);

          // Drizzle builds the INSERT column list from these selection keys,
          // so each key must name a column of the materialized table.
          const insertedRows = await tx
            .insert(materialized)
            .select(
              tx
                .select({
                  orgId: view.orgId,
                  itemId: view.itemId,
                  actionId: view.actionId,
                  policyId: view.policyId,
                  type: view.type,
                  itemTypeId: view.itemTypeId,
                  queueId: view.queueId,
                  reviewerId: view.reviewerId,
                  ds: view.ds,
                  jobId: view.jobId,
                  decidedAt: view.decidedAt,
                })
                .from(view)
                .where(gt(view.decidedAt, oneMinutePrevious)),
            )
            // since we are going back in time by 1 minute, we will likely be
            // re-inserting some rows, which should lead to unique constraint
            // violations. In this case we just want to ignore those rows to avoid
            // duplicate data
            .onConflictDoNothing()
            .returning({ decidedAt: materialized.decidedAt });

          // decided_at is never null for rows coming from the view.
          const decidedAts = insertedRows.map((row) => row.decidedAt!);
          if (decidedAts.length === 0) {
            return;
          }

          const latestDecidedAt = decidedAts.reduce(
            (max, decidedAt) => (decidedAt > max ? decidedAt : max),
            decidedAts[0],
          );

          await tx
            .update(metadata)
            .set({ lastInsert: latestDecidedAt })
            .where(eq(metadata.tableName, MATERIALIZED_TABLE_NAME));
        });
      },
      async shutdown() {
        await sharedResourceShutdown();
      },
    };
  },
);
