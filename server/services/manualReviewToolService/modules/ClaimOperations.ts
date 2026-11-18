import { and, desc, eq } from 'drizzle-orm';

import { schema, type CoopDb } from '../../../storage/postgres/drizzle.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';
import { type JobId } from '../manualReviewToolService.js';

const { jobClaims } = schema;

export default class ClaimOperations {
  constructor(private readonly db: CoopDb) {}

  async logClaim(opts: {
    orgId: string;
    jobId: JobId;
    queueId: string;
    userId: string;
  }) {
    const { orgId, jobId, queueId, userId } = opts;
    try {
      await this.db.insert(jobClaims).values({ orgId, jobId, queueId, userId });
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
    const row = (
      await this.db
        .select({ claimedAt: jobClaims.claimedAt })
        .from(jobClaims)
        .where(
          and(
            eq(jobClaims.orgId, orgId),
            eq(jobClaims.jobId, jobId),
            userId != null ? eq(jobClaims.userId, userId) : undefined,
          ),
        )
        .orderBy(desc(jobClaims.claimedAt))
        .limit(1)
    ).at(0);

    return row?.claimedAt ?? null;
  }
}
