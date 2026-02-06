import { sql, type Kysely } from 'kysely';

import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';
import type { ReadonlyDeep } from '../../../utils/typescript-types.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';
import type { RecentDecisionsFilterInput } from './DecisionAnalytics.js';

export default class SkipOperations {
  constructor(private readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

  async logSkip(opts: {
    orgId: string;
    jobId: string;
    queueId: string;
    userId: string;
  }) {
    const { orgId, jobId, queueId, userId } = opts;
    try {
      await this.pgQuery
        .insertInto('manual_review_tool.moderator_skips')
        .values([
          {
            org_id: orgId,
            job_id: jobId,
            queue_id: queueId,
            user_id: userId,
          },
        ])
        .executeTakeFirst();
    } catch (e) {
      if (isForeignKeyViolationError(e)) {
        throw makeNotFoundError('Job not found', { shouldErrorSpan: true });
      }

      throw e;
    }
  }

  async getSkippedJobCount(input: SkippedJobCountInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const { queueIds, userIds, startDate, endDate } = filterBy;
    const { ref } = this.pgQuery.dynamic;
    return this.pgQuery
      .selectFrom('manual_review_tool.moderator_skips')
      .select([
        sql<string>`date_trunc(${timeDivision}, ts, ${timeZone})`.as('time'),
        sql<number>`COUNT(*)`.as('count'),
      ])
      .$if(groupBy.includes('queue_id'), (qb) => qb.select('queue_id'))
      .$if(groupBy.includes('reviewer_id'), (qb) => qb.select('user_id'))
      .where('org_id', '=', orgId)
      .where((eb) => {
        return eb.and([
          eb(sql`ts AT TIME ZONE ${timeZone}`, '>=', startDate),
          eb(sql`ts AT TIME ZONE ${timeZone}`, '<=', endDate),
        ]);
      })
      .where(({ eb }) => {
        return eb.and([
          ...(queueIds.length > 0 ? [eb('queue_id', 'in', queueIds)] : []),
          ...(userIds.length > 0 ? [eb('user_id', 'in', userIds)] : []),
        ]);
      })
      .groupBy([
        'time',
        ...groupBy
          .map((it) =>
            it === 'reviewer_id' ? ref('user_id') : ref(it as string),
          )
          .flat(),
      ])
      .execute();
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
      (policyIds && policyIds.length > 0) ??
      (decisions && decisions.length > 0)
    ) {
      return [];
    }

    // Return all of the skips since they're not interleaved in the
    // decisions table and aren't too many of them, and filter on the
    // front end.
    return this.pgQuery
      .selectFrom('manual_review_tool.moderator_skips')
      .select([
        'job_id as jobId',
        'queue_id as queueId',
        'user_id as userId',
        'ts',
      ])
      .where('org_id', '=', orgId)
      .where((eb) => {
        return eb.and([
          ...(queueIds && queueIds.length > 0
            ? [eb('queue_id', 'in', queueIds)]
            : []),
          ...(reviewerIds && reviewerIds.length > 0
            ? [eb('user_id', 'in', reviewerIds)]
            : []),
        ]);
      })
      .$if(userSearchString !== undefined, (qb) =>
        // See https://stackoverflow.com/a/55607847
        qb.where(({ and, eb, val }) =>
          and([
            eb(
              'user_id',
              '=',
              // Above, the 'itemId' field is of type jsonb, so we cast it to a string using ::text, but that
              // cast will leave quotes around the resulting string because it's just stringifying what it thinks
              // is a jsonb object. The easiest way to handle this is to just add quotes around the userSearchString
              // to match the quotes in the value above.
              val(`${userSearchString}`),
            ),
          ]),
        ),
      )
      .execute();
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
