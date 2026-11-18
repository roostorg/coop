import { type Dependencies } from '../../../iocContainer/index.js';
import { Prisma, type PrismaPgClient } from '../../../storage/prisma/index.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';
import type { ReadonlyDeep } from '../../../utils/typescript-types.js';
import type { RecentDecisionsFilterInput } from './DecisionAnalytics.js';
import type QueueOperations from './QueueOperations.js';

export default class SkipOperations {
  constructor(
    private readonly prisma: PrismaPgClient,
    private readonly queueOps: QueueOperations,
    private readonly meter?: Dependencies['Meter'],
  ) {}

  async logSkip(opts: {
    orgId: string;
    jobId: string;
    queueId: string;
    userId: string;
  }) {
    const { orgId, jobId, queueId, userId } = opts;
    try {
      // prisma-raw: moderator_skips has no PK (@@ignore)
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO manual_review_tool.moderator_skips (org_id, job_id, queue_id, user_id)
        VALUES (${orgId}, ${jobId}, ${queueId}, ${userId})
      `);

      this.meter?.recordManualReviewEvent('skip_recorded', {
        queue_id: queueId,
      });
    } catch (e) {
      if (isForeignKeyViolationError(e)) {
        throw makeNotFoundError('Job not found', { shouldErrorSpan: true });
      }

      throw e;
    }

    await this.queueOps.recordReviewerSkip({
      orgId,
      queueId,
      reviewerId: userId,
      jobId,
    });
  }

  async getSkippedJobCount(input: SkippedJobCountInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const { queueIds, userIds, startDate, endDate } = filterBy;
    const groupColumns = [
      ...(groupBy.includes('queue_id') ? ['queue_id'] : []),
      ...(groupBy.includes('reviewer_id') ? ['user_id'] : []),
    ];
    const extraSelect = groupColumns.map((c) => Prisma.sql`, ${Prisma.raw(c)}`);
    // prisma-raw: moderator_skips has no PK (@@ignore); date_trunc with time
    // zone, dynamic GROUP BY
    return this.prisma.$queryRaw<
      { time: string; count: number; queue_id?: string; user_id?: string }[]
    >(Prisma.sql`
      SELECT date_trunc(${timeDivision}, ts, ${timeZone}) AS "time",
        COUNT(*)::int AS count
        ${extraSelect.length > 0 ? Prisma.join(extraSelect, '') : Prisma.empty}
      FROM manual_review_tool.moderator_skips
      WHERE org_id = ${orgId}
        AND ts AT TIME ZONE ${timeZone} >= ${startDate}
        AND ts AT TIME ZONE ${timeZone} <= ${endDate}
        ${queueIds.length > 0 ? Prisma.sql`AND queue_id IN (${Prisma.join(queueIds)})` : Prisma.empty}
        ${userIds.length > 0 ? Prisma.sql`AND user_id IN (${Prisma.join(userIds)})` : Prisma.empty}
      GROUP BY ${Prisma.join([Prisma.raw('"time"'), ...groupColumns.map((c) => Prisma.raw(c))])}
    `);
  }

  async getSkippedJobsForRecentDecisions(opts: {
    orgId: string;
    input: Omit<RecentDecisionsFilterInput, 'page' | 'startTime' | 'endTime'>;
  }) {
    const { orgId, input } = opts;
    const { queueIds, reviewerIds, policyIds, userSearchString, decisions } =
      input;

    // Skips aren't a decision or are associated with policies, so just skip
    // the query
    if (
      (policyIds && policyIds.length > 0) ||
      (decisions && decisions.length > 0)
    ) {
      return [];
    }

    // Return all of the skips since they're not interleaved in the
    // decisions table and aren't too many of them, and filter on the
    // front end.
    // prisma-raw: moderator_skips has no PK (@@ignore)
    return this.prisma.$queryRaw<
      { jobId: string; queueId: string; userId: string; ts: Date }[]
    >(Prisma.sql`
      SELECT job_id AS "jobId", queue_id AS "queueId", user_id AS "userId", ts
      FROM manual_review_tool.moderator_skips
      WHERE org_id = ${orgId}
        ${queueIds && queueIds.length > 0 ? Prisma.sql`AND queue_id IN (${Prisma.join(queueIds)})` : Prisma.empty}
        ${reviewerIds && reviewerIds.length > 0 ? Prisma.sql`AND user_id IN (${Prisma.join(reviewerIds)})` : Prisma.empty}
        ${userSearchString !== undefined ? Prisma.sql`AND user_id = ${userSearchString}` : Prisma.empty}
      LIMIT 1000
    `);
  }
}

export type SkippedJobCountInput = ReadonlyDeep<{
  orgId: string;
  groupBy: Array<'queue_id' | 'reviewer_id'>;
  timeDivision: 'HOUR' | 'DAY';
  timeZone: string;
  filterBy: {
    startDate: Date;
    endDate: Date;
    queueIds: string[];
    userIds: string[];
  };
}>;
