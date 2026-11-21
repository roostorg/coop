import { and, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';

import { type Dependencies } from '../../../iocContainer/index.js';
import { schema, type CoopDb } from '../../../storage/postgres/drizzle.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';
import type { ReadonlyDeep } from '../../../utils/typescript-types.js';
import type { RecentDecisionsFilterInput } from './DecisionAnalytics.js';
import type QueueOperations from './QueueOperations.js';

const { moderatorSkips } = schema;

export default class SkipOperations {
  constructor(
    private readonly db: CoopDb,
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
      await this.db
        .insert(moderatorSkips)
        .values([{ orgId, jobId, queueId, userId }]);

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

  async getSkippedJobCount(input: SkippedJobCountInput): Promise<
    Array<{
      // A Date at runtime: GraphQL serializes it to epoch-ms, which the
      // dashboard parses. Typed as string to match the GraphQL schema.
      time: string;
      count: number;
      queue_id?: string;
      user_id?: string;
    }>
  > {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const { queueIds, userIds, startDate, endDate } = filterBy;
    const groupByQueue = groupBy.includes('queue_id');
    const groupByReviewer = groupBy.includes('reviewer_id');
    const tsInZone = sql`${moderatorSkips.ts} AT TIME ZONE ${timeZone}`;

    const groupByColumns: SQL[] = [sql`${sql.identifier('time')}`];
    for (const it of groupBy) {
      groupByColumns.push(
        it === 'reviewer_id'
          ? sql`${moderatorSkips.userId}`
          : sql`${moderatorSkips.queueId}`,
      );
    }

    return this.db
      .select({
        // Drizzle returns raw-SQL timestamptz values as strings; decode to
        // a Date like the typed timestamp columns.
        time: sql`date_trunc(${timeDivision}, ${moderatorSkips.ts}, ${timeZone})`
          .mapWith((v: unknown) => new Date(v as string) as unknown as string)
          .as('time'),
        // COUNT(*) is a bigint, which pg returns as a string at runtime.
        count: sql<number>`COUNT(*)`.as('count'),
        ...(groupByQueue ? { queue_id: moderatorSkips.queueId } : {}),
        ...(groupByReviewer ? { user_id: moderatorSkips.userId } : {}),
      })
      .from(moderatorSkips)
      .where(
        and(
          eq(moderatorSkips.orgId, orgId),
          gte(tsInZone, startDate),
          lte(tsInZone, endDate),
          queueIds.length > 0
            ? inArray(moderatorSkips.queueId, queueIds)
            : undefined,
          userIds.length > 0
            ? inArray(moderatorSkips.userId, userIds)
            : undefined,
        ),
      )
      .groupBy(...groupByColumns);
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
    return this.db
      .select({
        jobId: moderatorSkips.jobId,
        queueId: moderatorSkips.queueId,
        userId: moderatorSkips.userId,
        ts: moderatorSkips.ts,
      })
      .from(moderatorSkips)
      .where(
        and(
          eq(moderatorSkips.orgId, orgId),
          queueIds && queueIds.length > 0
            ? inArray(moderatorSkips.queueId, [...queueIds])
            : undefined,
          reviewerIds && reviewerIds.length > 0
            ? inArray(moderatorSkips.userId, [...reviewerIds])
            : undefined,
          userSearchString !== undefined
            ? eq(moderatorSkips.userId, `${userSearchString}`)
            : undefined,
        ),
      )
      .limit(1000);
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
