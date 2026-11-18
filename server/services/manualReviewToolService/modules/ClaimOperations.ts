import { Prisma, type PrismaPgClient } from '../../../storage/prisma/index.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';
import { type JobId } from '../manualReviewToolService.js';

export default class ClaimOperations {
  constructor(private readonly prisma: PrismaPgClient) {}

  async logClaim(opts: {
    orgId: string;
    jobId: JobId;
    queueId: string;
    userId: string;
  }) {
    const { orgId, jobId, queueId, userId } = opts;
    try {
      // prisma-raw: job_claims has no PK (@@ignore)
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO manual_review_tool.job_claims (org_id, job_id, queue_id, user_id)
        VALUES (${orgId}, ${jobId}, ${queueId}, ${userId})
      `);
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
    // prisma-raw: job_claims has no PK (@@ignore)
    const rows = await this.prisma.$queryRaw<{ claimed_at: Date }[]>(
      Prisma.sql`
        SELECT claimed_at
        FROM manual_review_tool.job_claims
        WHERE org_id = ${orgId}
          AND job_id = ${jobId}
          ${userId != null ? Prisma.sql`AND user_id = ${userId}` : Prisma.empty}
        ORDER BY claimed_at DESC
        LIMIT 1
      `,
    );

    return rows[0]?.claimed_at ?? null;
  }
}
