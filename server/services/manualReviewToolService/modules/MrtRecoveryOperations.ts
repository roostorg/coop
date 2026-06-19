import { sql, type Kysely } from 'kysely';

import { type ManualReviewToolServicePg } from '../dbTypes.js';

export type MrtRecoveryStateStatus = 'PENDING' | 'FAILED';

export type MrtRecoveryState = {
  jobId: string;
  orgId: string;
  queueId: string;
  itemId: string;
  itemTypeId: string;
  status: MrtRecoveryStateStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const selection = [
  'job_id as jobId',
  'org_id as orgId',
  'queue_id as queueId',
  'item_id as itemId',
  'item_type_id as itemTypeId',
  'status',
  'retry_count as retryCount',
  'last_error as lastError',
  'created_at as createdAt',
  'updated_at as updatedAt',
] as const;

const table = 'manual_review_tool.mrt_queue_recovery_state' as const;

export default class MrtRecoveryOperations {
  constructor(private readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

  async getRecoveryStatesForJobIds(jobIds: readonly string[]) {
    if (jobIds.length === 0) return [];

    return this.pgQuery
      .selectFrom(table)
      .select(selection)
      .where('job_id', 'in', [...jobIds])
      .execute();
  }

  async deleteRecoveryStatesForJobIds(jobIds: readonly string[]) {
    if (jobIds.length === 0) return;

    await this.pgQuery
      .deleteFrom(table)
      .where('job_id', 'in', [...jobIds])
      .execute();
  }

  async resetFailedRecoveryStates(opts: {
    orgId: string;
    jobIds: readonly string[];
  }) {
    const { orgId, jobIds } = opts;
    if (jobIds.length === 0) return 0;

    const result = await this.pgQuery
      .updateTable(table)
      .set({
        status: 'PENDING',
        retry_count: 0,
        last_error: null,
        updated_at: sql`now()`,
      })
      .where('org_id', '=', orgId)
      .where('job_id', 'in', [...jobIds])
      .where('status', '=', 'FAILED')
      .executeTakeFirst();

    return Number(result.numUpdatedRows);
  }

  async recordRecoveryFailure(opts: {
    jobId: string;
    orgId: string;
    queueId: string;
    itemId: string;
    itemTypeId: string;
    error: string;
    maxRetries: number;
  }): Promise<MrtRecoveryState> {
    const now = new Date();
    return this.pgQuery
      .insertInto(table)
      .values({
        job_id: opts.jobId,
        org_id: opts.orgId,
        queue_id: opts.queueId,
        item_id: opts.itemId,
        item_type_id: opts.itemTypeId,
        status: opts.maxRetries <= 1 ? 'FAILED' : 'PENDING',
        retry_count: 1,
        last_error: opts.error,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column('job_id').doUpdateSet({
          retry_count: sql<number>`manual_review_tool.mrt_queue_recovery_state.retry_count + 1`,
          status: sql<MrtRecoveryStateStatus>`CASE WHEN manual_review_tool.mrt_queue_recovery_state.retry_count + 1 >= ${opts.maxRetries} THEN 'FAILED' ELSE 'PENDING' END`,
          last_error: opts.error,
          updated_at: now,
        }),
      )
      .returning(selection)
      .executeTakeFirstOrThrow();
  }
}
