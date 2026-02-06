/* eslint-disable max-lines */
import { sql, type Kysely } from 'kysely';
import { type ReadonlyDeep } from 'type-fest';

import { UserPermission } from '../../../models/types/permissioning.js';
import { MONTH_MS } from '../../../utils/time.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';
import {
  type ManualReviewJob,
  type ManualReviewJobEnqueueSource,
} from '../manualReviewToolService.js';
import { type ManualReviewDecisionType } from './JobDecisioning.js';

export type RecentDecisionsFilterInput = {
  userSearchString?: string;
  decisions?: readonly (
    | {
        type: Exclude<
          ManualReviewDecisionType,
          'CUSTOM_ACTION' | 'RELATED_ACTION'
        >;
        actionIds: undefined;
      }
    | {
        type: 'CUSTOM_ACTION' | 'RELATED_ACTION';
        actionIds: readonly string[];
      }
  )[];
  policyIds?: readonly string[];
  reviewerIds?: readonly string[];
  queueIds?: readonly string[];
  startTime?: Date;
  endTime?: Date;
  page: number;
};

export default class DecisionAnalytics {
  constructor(private readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

  async getDecisionCounts(input: DecisionCountsInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const { ref } = this.pgQuery.dynamic;
    return this.pgQuery
      .selectFrom('manual_review_tool.dim_mrt_decisions_materialized')
      .select([
        sql<string>`DATE_TRUNC(${timeDivision}, decided_at, ${timeZone})`.as(
          'time',
        ),
        sql<number>`COUNT(DISTINCT (item_id, item_type_id))`.as('count'),
      ])
      .$if(groupBy.includes('action_id'), (qb) => qb.select('action_id'))
      .$if(groupBy.includes('queue_id'), (qb) => qb.select('queue_id'))
      .$if(groupBy.includes('type'), (qb) => qb.select(['action_id', 'type']))
      .$if(groupBy.includes('reviewer_id'), (qb) => qb.select('reviewer_id'))
      .$if(groupBy.includes('policy_id'), (qb) => qb.select('policy_id'))
      .where((eb) => {
        return eb.and([
          eb('org_id', '=', orgId),
          eb(
            sql`decided_at AT TIME ZONE ${timeZone}`,
            '>=',
            filterBy.startDate,
          ),
          eb(sql`decided_at AT TIME ZONE ${timeZone}`, '<=', filterBy.endDate),
          ...(filterBy.actionIds.length > 0 || filterBy.type.length > 0
            ? [
                eb.or([
                  ...(filterBy.actionIds.length > 0
                    ? [eb('action_id', 'in', filterBy.actionIds)]
                    : []),
                  ...(filterBy.type.length > 0
                    ? [eb('type', 'in', filterBy.type)]
                    : []),
                ]),
              ]
            : []),
          ...(filterBy.itemTypeIds.length > 0
            ? [eb('item_type_id', 'in', filterBy.itemTypeIds)]
            : []),
          ...(filterBy.policyIds.length > 0
            ? [eb('policy_id', 'in', filterBy.policyIds)]
            : []),
          ...(filterBy.reviewerIds.length > 0
            ? [eb('reviewer_id', 'in', filterBy.reviewerIds)]
            : []),
          ...(filterBy.queueIds.length > 0
            ? [eb('queue_id', 'in', filterBy.queueIds)]
            : []),
          // Ignores, NCMEC reports and re-enqueueing don't make any sense when
          // grouping by policy ID
          ...(groupBy.includes('policy_id')
            ? [eb('type', 'in', ['CUSTOM_ACTION', 'RELATED_ACTION'])]
            : []),
          ...(filterBy.filteredDecisionActionType &&
          filterBy.filteredDecisionActionType.includes('RELATED_ACTION')
            ? [eb('type', 'not in', filterBy.filteredDecisionActionType)]
            : []),
          ...(filterBy.filteredDecisionActionType?.includes('CUSTOM_ACTION')
            ? [eb('type', 'not in', filterBy.filteredDecisionActionType)]
            : []),
        ]);
      })
      .groupBy([
        ...groupBy.map((it) => ref(it as string)).flat(),
        'time',
        ...(groupBy.includes('type') ? [ref('action_id')] : []),
      ])
      .execute();
  }

  async getDecisionCountsTable(input: DecisionCountsTableInput) {
    const { orgId, groupBy, filterBy, timeZone } = input;
    return this.pgQuery
      .selectFrom('manual_review_tool.dim_mrt_decisions_materialized')
      .select([
        sql<number>`COUNT(DISTINCT (item_id, item_type_id))`.as('count'),
        'action_id',
        'type',
      ])
      .$if(groupBy.includes('queue_id'), (qb) => qb.select('queue_id'))
      .$if(groupBy.includes('reviewer_id'), (qb) => qb.select('reviewer_id'))
      .where((eb) => {
        return eb.and([
          eb('org_id', '=', orgId),
          eb(
            sql`decided_at AT TIME ZONE ${timeZone}`,
            '>=',
            filterBy.startDate,
          ),
          eb(sql`decided_at AT TIME ZONE ${timeZone}`, '<=', filterBy.endDate),
          ...(filterBy.reviewerIds.length > 0
            ? [eb('reviewer_id', 'in', filterBy.reviewerIds)]
            : []),
          ...(filterBy.queueIds.length > 0
            ? [eb('queue_id', 'in', filterBy.queueIds)]
            : []),
        ]);
      })
      .groupBy([groupBy, 'action_id', 'type'])
      .execute();
  }

  async getTimeToAction(input: TimeToActionInput) {
    const { orgId, groupBy, filterBy } = input;
    const { ref } = this.pgQuery.dynamic;
    return this.pgQuery
      .selectFrom('manual_review_tool.job_creations as creations')
      .innerJoin(
        'manual_review_tool.manual_review_decisions as decisions',
        (join) =>
          join.on((eb) =>
            eb(
              'creations.id',
              '=',
              eb.ref('decisions.job_payload', '->>').key('id'),
            ),
          ),
      )
      .select(({ fn, val }) =>
        fn<number | null>('date_part', [
          val('EPOCH'),
          fn.avg<number | null>(({ eb, ref }) =>
            eb('decisions.created_at', '-', ref('creations.created_at')),
          ),
        ]).as('time_to_action'),
      )
      .$if(groupBy.includes('queue_id'), (qb) =>
        qb.select('decisions.queue_id as queue_id'),
      )
      .where((eb) => {
        return eb.and([
          eb('creations.org_id', '=', orgId),
          eb('creations.created_at', '>=', filterBy.startDate),
          eb('creations.created_at', '<=', filterBy.endDate),
          ...(filterBy.queueIds.length > 0
            ? [eb('decisions.queue_id', 'in', filterBy.queueIds)]
            : []),
        ]);
      })
      .$if(groupBy.length > 0, (qb) =>
        qb.groupBy([
          ...groupBy.map((it) => ref(`decisions.${it as string}`)).flat(),
        ]),
      )
      .execute();
  }

  async getJobCreations(input: JobCreationsInput) {
    const { groupBy, filterBy, orgId, timeDivision, timeZone } = input;

    const { ref } = this.pgQuery.dynamic;
    return this.pgQuery
      .selectFrom('manual_review_tool.flattened_job_creations as creations')
      .select([
        sql<string>`date_trunc(${timeDivision}, created_at, ${timeZone})`.as(
          'time',
        ),
        sql<number>`COUNT(DISTINCT(item_id, item_type_id))`.as('count'),
      ])
      .$if(groupBy.includes('item_type_id'), (qb) => qb.select('item_type_id'))
      .$if(groupBy.includes('queue_id'), (qb) => qb.select('queue_id'))
      .$if(groupBy.includes('policy_id'), (qb) => qb.select('policy_id'))
      .$if(groupBy.includes('source'), (qb) =>
        qb.select(['source_kind as source', 'rule_id']),
      )
      .where((eb) => {
        return eb.and([
          eb('org_id', '=', orgId),
          eb('creations.created_at', '>=', filterBy.startDate),
          eb('creations.created_at', '<=', filterBy.endDate),
          ...(filterBy.itemTypeIds.length > 0
            ? [eb('item_type_id', 'in', filterBy.itemTypeIds)]
            : []),
          ...(filterBy.queueIds.length > 0
            ? [eb('queue_id', 'in', filterBy.queueIds)]
            : []),
          ...(filterBy.policyIds.length > 0
            ? [eb('policy_id', 'in', filterBy.policyIds)]
            : []),
          ...(filterBy.sources.length > 0
            ? [eb('source_kind', 'in', filterBy.sources)]
            : []),
          ...(filterBy.ruleIds.length > 0
            ? [eb('rule_id', 'in', filterBy.ruleIds)]
            : []),
        ]);
      })
      .groupBy([
        ...groupBy.map((it) => ref(it as string)).flat(),
        'time',
        ...(groupBy.includes('source') ? [ref('rule_id')] : []),
      ])
      .execute();
  }

  async getRecentDecisions(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: RecentDecisionsFilterInput;
  }) {
    const { userPermissions, orgId, input } = opts;
    const {
      userSearchString,
      decisions: decisionsFilter,
      policyIds,
      reviewerIds,
      queueIds,
      startTime,
      endTime,
      page,
    } = input;
    const limit = 100;
    const decisions = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_decisions')
      .select([
        'id',
        'queue_id',
        'reviewer_id',
        'decision_components',
        'related_actions',
        'created_at',
        sql<string>`((job_payload->'payload'::text)->'item'::text) -> 'itemId'::text`.as(
          'item_id',
        ),
        sql<string>`(((job_payload->'payload'::text)->'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text`.as(
          'item_type_id',
        ),
        'decision_reason',
        sql<string>`(job_payload->>'id')::text`.as('job_id'),
      ])
      .where('org_id', '=', orgId)
      .where(({ eb, selectFrom }) => {
        return eb.and([
          ...(startTime ? [eb('created_at', '>=', new Date(startTime))] : []),
          ...(endTime ? [eb('created_at', '<=', new Date(endTime))] : []),
          ...(queueIds && queueIds.length > 0
            ? [eb('queue_id', 'in', queueIds)]
            : []),
          ...(reviewerIds && reviewerIds.length > 0
            ? [eb('reviewer_id', 'in', reviewerIds)]
            : []),
          ...(policyIds
            ? [
                eb.exists(
                  selectFrom(
                    sql`unnest(manual_review_tool.manual_review_decisions.decision_components)`.as(
                      'decision_component',
                    ),
                  )
                    .selectAll()
                    .where(
                      eb.or(
                        policyIds.map((policyId) =>
                          eb(
                            sql<string>`decision_component->>'policies'`,
                            'like',
                            `%"${policyId}"%`,
                          ),
                        ),
                      ),
                    ),
                ),
              ]
            : []),
          ...(decisionsFilter
            ? [
                eb.or(
                  decisionsFilter.flatMap((it) => [
                    eb.exists(
                      selectFrom(
                        sql`unnest(manual_review_tool.manual_review_decisions.decision_components)`.as(
                          'decision_component',
                        ),
                      )
                        .selectAll()
                        .where(
                          sql<string>`decision_component->>'type'`,
                          '=',
                          it.type,
                        )
                        .$if(it.actionIds !== undefined, (qb) =>
                          qb.where(
                            eb.or(
                              it.actionIds!.map((actionId) =>
                                eb(
                                  sql<string>`decision_component->>'actions'`,
                                  'like',
                                  `%"${actionId}"%`,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ),
                  ]),
                ),
              ]
            : []),
        ]);
      })
      .$if(userSearchString !== undefined, (qb) =>
        // See https://stackoverflow.com/a/55607847
        qb.where(({ and, eb, val }) =>
          and([
            eb('created_at', '>', val(new Date(Date.now() - 3 * MONTH_MS))),
            eb(
              sql<string>`(manual_review_tool.manual_review_decisions.job_payload->'payload'->'item'->>'itemId')`,
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
      // If the user doesn't have the VIEW_CHILD_SAFETY_DATA permission, filter out decisions on
      // all NCMEC jobs
      .$if(
        !userPermissions.includes(UserPermission.VIEW_CHILD_SAFETY_DATA),
        (qb) =>
          qb.where(({ eb, val }) =>
            eb(
              sql<string>`(job_payload->'payload'->'kind')::text`,
              '!=',
              val('"NCMEC"'),
            ),
          ),
      )
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(page * limit)
      .execute();
    return decisions.map((decision) => ({
      id: decision.id,
      itemId: decision.item_id,
      itemTypeId: decision.item_type_id,
      queueId: decision.queue_id,
      reviewerId: decision.reviewer_id,
      decisions: decision.decision_components.map((it) => {
        if (it.type !== 'CUSTOM_ACTION') {
          return it;
        }
        return {
          ...it,
          actionIds: it.actions.map((it) => it.id),
          policyIds: it.policies.map((it) => it.id),
          itemTypeId: it.itemTypeId,
        };
      }),
      relatedActions: decision.related_actions.map((action) => ({
        ...action,
        type: 'RELATED_ACTION' as const,
      })),
      createdAt: decision.created_at,
      decisionReason: decision.decision_reason,
      jobId: decision.job_id,
    }));
  }

  async getResolvedJobCounts(input: JobCountsInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const { queueIds, reviewerIds, startDate, endDate } = filterBy;
    const { ref } = this.pgQuery.dynamic;
    return this.pgQuery
      .selectFrom('manual_review_tool.manual_review_decisions')
      .select([
        sql<string>`date_trunc(${timeDivision}, created_at, ${timeZone})`.as(
          'time',
        ),
        sql<number>`COUNT(DISTINCT id)`.as('count'),
      ])
      .$if(groupBy.includes('queue_id'), (qb) => qb.select('queue_id'))
      .$if(groupBy.includes('reviewer_id'), (qb) => qb.select('reviewer_id'))
      .where('org_id', '=', orgId)
      .where((eb) => {
        return eb.and([
          eb(sql`created_at AT TIME ZONE ${timeZone}`, '>=', startDate),
          eb(sql`created_at AT TIME ZONE ${timeZone}`, '<=', endDate),
        ]);
      })
      .where(({ eb }) => {
        return eb.and([
          ...(queueIds.length > 0 ? [eb('queue_id', 'in', queueIds)] : []),
          ...(reviewerIds.length > 0
            ? [eb('reviewer_id', 'in', reviewerIds)]
            : []),
        ]);
      })
      .groupBy(['time', ...groupBy.map((it) => ref(it as string)).flat()])
      .execute();
  }

  async getDecidedJob(opts: { orgId: string; id: string }) {
    const { orgId, id } = opts;
    const payload = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_decisions')
      .select(['job_payload'])
      .where('created_at', '>=', new Date('2023-10-01'))
      .where('org_id', '=', orgId)
      .where('id', '=', id)
      .executeTakeFirst();
    // This is safe because only jobs created before Sept 2023 have
    // the old legacy schema defined in StoredManualReviewJob (see
    // the comment associated with the StoredManualReviewJob type).
    // This query has a hardcoded filter to not include those old jobs.
    return (payload?.job_payload ?? null) as ManualReviewJob | null;
  }

  async getDecidedJobFromJobId(opts: {
    orgId: string;
    jobId: string;
    userPermissions: UserPermission[];
  }) {
    const { orgId, jobId, userPermissions } = opts;
    const decisionWithPayload = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_decisions')
      .select([
        'job_payload',
        'id',
        'queue_id',
        'reviewer_id',
        'decision_components',
        'related_actions',
        'created_at',
        sql<string>`((job_payload->'payload'::text)->'item'::text) -> 'itemId'::text`.as(
          'item_id',
        ),
        sql<string>`(((job_payload->'payload'::text)->'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text`.as(
          'item_type_id',
        ),
        sql<string>`(job_payload->>'id')::text`.as('job_id'),
      ])
      .where('created_at', '>=', new Date('2023-10-01'))
      .where('org_id', '=', orgId)
      .where(sql<string>`(job_payload->>'id')::text`, '=', jobId)
      .$if(
        !userPermissions.includes(UserPermission.VIEW_CHILD_SAFETY_DATA),
        (qb) =>
          qb.where(({ eb, val }) =>
            eb(
              sql<string>`(job_payload->'payload'->'kind')::text`,
              '!=',
              val('"NCMEC"'),
            ),
          ),
      )
      .executeTakeFirst();
    // This is safe because only jobs created before Sept 2023 have
    // the old legacy schema defined in StoredManualReviewJob (see
    // the comment associated with the StoredManualReviewJob type).
    // This query has a hardcoded filter to not include those old jobs.
    if (!decisionWithPayload) {
      return null;
    }
    return {
      job: decisionWithPayload.job_payload as ManualReviewJob,
      decision: {
        id: decisionWithPayload.id,
        itemId: decisionWithPayload.item_id,
        itemTypeId: decisionWithPayload.item_type_id,
        queueId: decisionWithPayload.queue_id,
        reviewerId: decisionWithPayload.reviewer_id,
        decisions: decisionWithPayload.decision_components.map((it) => {
          if (it.type !== 'CUSTOM_ACTION') {
            return it;
          }
          return {
            ...it,
            actionIds: it.actions.map((it) => it.id),
            policyIds: it.policies.map((it) => it.id),
            itemTypeId: it.itemTypeId,
          };
        }),
        relatedActions: decisionWithPayload.related_actions.map((action) => ({
          ...action,
          type: 'RELATED_ACTION' as const,
        })),
        createdAt: decisionWithPayload.created_at,
        jobId: decisionWithPayload.job_id,
      },
    };
  }
}

/**
 * These options are meant to be passed to the psql `DATE_TRUNC()`
 * function, so the strings must conform to valid `field`
 * value from the postgres docs:
 * https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-TRUNC
 * microseconds, milliseconds, second, minute, hour, day, week, month, quarter, year, decade,
 * century, millennium
 */
type DecisionAnalyticsTimeDivisionOptions = 'DAY' | 'HOUR';

export type TimeToActionInput = ReadonlyDeep<{
  orgId: string;
  groupBy: Array<'queue_id' | 'reviewer_id' | 'item_type_id'>;
  filterBy: {
    itemTypeIds: string[];
    queueIds: string[];
    startDate: Date;
    endDate: Date;
  };
}>;

export type JobCreationsInput = ReadonlyDeep<{
  orgId: string;
  groupBy: Array<'queue_id' | 'item_type_id' | 'policy_id' | 'source'>;
  timeDivision: DecisionAnalyticsTimeDivisionOptions;
  timeZone: string;
  filterBy: {
    itemTypeIds: string[];
    queueIds: string[];
    policyIds: string[];
    ruleIds: string[];
    sources: ManualReviewJobEnqueueSource[];
    startDate: Date;
    endDate: Date;
  };
}>;

export type DecisionCountsInput = ReadonlyDeep<{
  orgId: string;
  groupBy: Omit<
    keyof ManualReviewToolServicePg['manual_review_tool.dim_mrt_decisions_materialized'],
    'action_id' | 'ds'
  >[];
  timeDivision: DecisionAnalyticsTimeDivisionOptions;
  timeZone: string;
  filterBy: {
    actionIds: string[];
    itemTypeIds: string[];
    policyIds: string[];
    queueIds: string[];
    type: ManualReviewDecisionType[];
    reviewerIds: string[];
    startDate: Date;
    endDate: Date;
    filteredDecisionActionType?: ('CUSTOM_ACTION' | 'RELATED_ACTION')[];
  };
}>;

export type DecisionCountsTableInput = ReadonlyDeep<{
  orgId: string;
  groupBy: 'reviewer_id' | 'queue_id';
  timeZone: string;
  filterBy: {
    queueIds: string[];
    reviewerIds: string[];
    startDate: Date;
    endDate: Date;
  };
}>;

export type JobCountsInput = ReadonlyDeep<{
  orgId: string;
  groupBy: Array<'queue_id' | 'reviewer_id'>;
  timeDivision: DecisionAnalyticsTimeDivisionOptions;
  timeZone: string;
  filterBy: {
    startDate: Date;
    endDate: Date;
    queueIds: string[];
    reviewerIds: string[];
  };
}>;
