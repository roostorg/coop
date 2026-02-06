import { type Kysely } from 'kysely';
import _ from 'lodash';

import { inject } from '../iocContainer/utils.js';
import { type ManualReviewToolServicePg } from '../services/manualReviewToolService/index.js';
import { MINUTE_MS } from '../utils/time.js';

export default inject(
  ['closeSharedResourcesForShutdown', 'KyselyPg'],
  (sharedResourceShutdown, pgQuery: Kysely<ManualReviewToolServicePg>) => ({
    type: 'Job' as const,
    async run() {
      await pgQuery.transaction().execute(async (trx) => {
        const lastTimestamp = await trx
          .selectFrom('public.view_maintenance_metadata')
          .select('last_insert')
          .where(
            'table_name',
            '=',
            'manual_review_tool.dim_mrt_decisions_materialized',
          )
          .executeTakeFirst();

        if (!lastTimestamp) {
          throw new Error('No last_insert timestamp found for the table');
        }

        const oneMinutePrevious = new Date(
          lastTimestamp.last_insert.valueOf() - MINUTE_MS,
        );

        const insertedRows = await trx
          .insertInto('manual_review_tool.dim_mrt_decisions_materialized')
          .expression(
            trx
              .selectFrom('manual_review_tool.dim_mrt_decisions')
              .selectAll()
              .where('decided_at', '>', oneMinutePrevious),
          )
          // since we are going back in time by 1 minute, we will likely be
          // re-inserting some rows, which should lead to unique constraint
          // violations. In this case we just want to ignore those rows to avoid
          // duplicate data
          .onConflict((oc) => oc.doNothing())
          .returning('decided_at')
          .execute();

        if (insertedRows.length === 0) {
          return;
        }

        const latestDecidedAt = insertedRows.reduce(
          (max, row) => (row.decided_at > max ? row.decided_at : max),
          insertedRows[0].decided_at,
        );

        await trx
          .updateTable('public.view_maintenance_metadata')
          .set({
            last_insert: latestDecidedAt,
          })
          .where(
            'table_name',
            '=',
            'manual_review_tool.dim_mrt_decisions_materialized',
          )
          .execute();
      });
    },
    async shutdown() {
      await sharedResourceShutdown();
    },
  }),
);
