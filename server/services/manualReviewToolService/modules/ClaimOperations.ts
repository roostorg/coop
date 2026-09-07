import { type Kysely } from 'kysely';

import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';
import { type JobId } from '../manualReviewToolService.js';

export default class ClaimOperations {
  constructor(private readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

  async logClaim(opts: {
    orgId: string;
    jobId: JobId;
    queueId: string;
    userId: string;
  }) {
    const { orgId, jobId, queueId, userId } = opts;
    try {
      await this.pgQuery
        .insertInto('manual_review_tool.job_claims')
        .values({
          org_id: orgId,
          job_id: jobId,
          queue_id: queueId,
          user_id: userId,
        })
        .executeTakeFirst();
    } catch (e) {
      if (isForeignKeyViolationError(e)) {
        throw makeNotFoundError('Queue not found', { shouldErrorSpan: true });
      }

      throw e;
    }
  }

  async getLatestClaimedAt(opts: {
    orgId: string;
    jobId: JobId;
    userId?: string;
  }): Promise<Date | null> {
    const { orgId, jobId, userId } = opts;
    let query = this.pgQuery
      .selectFrom('manual_review_tool.job_claims')
      .select('claimed_at')
      .where('org_id', '=', orgId)
      .where('job_id', '=', jobId);

    if (userId != null) {
      query = query.where('user_id', '=', userId);
    }

    const row = await query
      .orderBy('claimed_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    return row?.claimed_at ?? null;
  }
}
