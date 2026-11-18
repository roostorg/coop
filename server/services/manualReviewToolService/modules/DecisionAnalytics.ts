/* eslint-disable max-lines */
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { type ReadonlyDeep } from 'type-fest';

import { schema, type CoopDb } from '../../../storage/postgres/drizzle.js';
import { MONTH_MS } from '../../../utils/time.js';
import { UserPermission } from '../../userManagementService/index.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';
import {
  type ManualReviewJob,
  type ManualReviewJobEnqueueSource,
} from '../manualReviewToolService.js';
import {
  type ManualReviewDecisionComponent,
  type ManualReviewDecisionRelatedAction,
  type ManualReviewDecisionType,
} from './JobDecisioning.js';

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

export const RECENT_DECISIONS_PAGE_SIZE = 100;

export type ActivityFeedDecisionCursor = { ts: Date; id: string | null };

const MAX_DECISIONS_LIMIT = 200;

const dimDecisions = schema.dimMrtDecisionsMaterialized;
const mrtDecisions = schema.manualReviewDecisions;
const flattenedJobCreations = schema.flattenedJobCreations;
// The time-to-action and handle-time queries group by `decisions.<column>`
// names that come from the caller, so they need the `decisions` alias.
const decisionsAlias = alias(schema.manualReviewDecisions, 'decisions');
const creationsAlias = alias(schema.jobCreations, 'creations');

/** Kysely's `eb.or([])` rendered `false`; Drizzle's `or()` renders nothing. */
function orOrFalse(conditions: (SQL | undefined)[]): SQL {
  return conditions.length === 0 ? sql`false` : or(...conditions)!;
}

/**
 * `date_trunc(...)` selected as `time`. Grouping by the alias (rather than
 * repeating the expression) is required: the repeated expression would carry
 * fresh bind parameters, which Postgres doesn't treat as the same expression.
 * `mapWith` decodes it to a Date, as pg's default parser did under Kysely.
 */
function truncatedTime(
  timeDivision: string,
  column: SQLWrapper,
  timeZone: string,
) {
  return sql<string>`date_trunc(${timeDivision}, ${column}, ${timeZone})`
    .mapWith(dimDecisions.decidedAt)
    .as('time');
}

/** Unqualified column (or output alias) reference, like Kysely's `ref()`. */
const ident = (name: string): SQL => sql`${sql.identifier(name)}`;

type DecisionCountRow = {
  time: string;
  count: number;
  action_id?: string | null;
  queue_id?: string;
  type?: ManualReviewDecisionType;
  reviewer_id?: string;
  policy_id?: string | null;
};

type DecisionCountTableRow = {
  count: number;
  action_id: string | null;
  type: ManualReviewDecisionType;
  queue_id?: string;
  reviewer_id?: string;
};

type JobCreationCountRow = {
  time: string;
  count: number;
  item_type_id?: string;
  queue_id?: string;
  policy_id?: string;
  source?: ManualReviewJobEnqueueSource;
  rule_id?: string;
};

type ResolvedJobCountRow = {
  time: string;
  count: number;
  queue_id?: string;
  reviewer_id?: string | null;
};

const recentDecisionSelection = {
  id: mrtDecisions.id,
  queue_id: mrtDecisions.queueId,
  reviewer_id: mrtDecisions.reviewerId,
  decision_components: mrtDecisions.decisionComponents,
  related_actions: mrtDecisions.relatedActions,
  created_at: mrtDecisions.createdAt,
  item_id: sql<string>`((${mrtDecisions.jobPayload}->'payload'::text)->'item'::text) -> 'itemId'::text`,
  item_type_id: sql<string>`(((${mrtDecisions.jobPayload}->'payload'::text)->'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text`,
  decision_reason: mrtDecisions.decisionReason,
  assigned_at: mrtDecisions.assignedAt,
  job_created_at: sql<string | null>`${mrtDecisions.jobPayload}->>'createdAt'`,
  job_id: sql<string>`(${mrtDecisions.jobPayload}->>'id')::text`,
};

type RecentDecisionRow = {
  id: string;
  queue_id: string;
  reviewer_id: string | null;
  decision_components: ManualReviewDecisionComponent[];
  related_actions: ManualReviewDecisionRelatedAction[];
  created_at: Date;
  item_id: string;
  item_type_id: string;
  decision_reason: string | null;
  assigned_at: Date | null;
  job_created_at: string | null;
  job_id: string;
};

/** Excludes NCMEC jobs for users without VIEW_CHILD_SAFETY_DATA. */
function ncmecVisibilityCondition(userPermissions: UserPermission[]) {
  return userPermissions.includes(UserPermission.VIEW_CHILD_SAFETY_DATA)
    ? undefined
    : sql`(${mrtDecisions.jobPayload}->'payload'->'kind')::text != ${'"NCMEC"'}`;
}

export default class DecisionAnalytics {
  constructor(private readonly db: CoopDb) {}

  async getDecisionCounts(
    input: DecisionCountsInput,
  ): Promise<DecisionCountRow[]> {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const t = dimDecisions;
    const decidedAtInZone = sql`${t.decidedAt} AT TIME ZONE ${timeZone}`;
    const rows = await this.db
      .select({
        time: truncatedTime(timeDivision, t.decidedAt, timeZone),
        count: sql<number>`COUNT(DISTINCT (${t.itemId}, ${t.itemTypeId}))`,
        ...(groupBy.includes('action_id') || groupBy.includes('type')
          ? { action_id: t.actionId }
          : {}),
        ...(groupBy.includes('queue_id') ? { queue_id: t.queueId } : {}),
        ...(groupBy.includes('type') ? { type: t.type } : {}),
        ...(groupBy.includes('reviewer_id')
          ? { reviewer_id: t.reviewerId }
          : {}),
        ...(groupBy.includes('policy_id') ? { policy_id: t.policyId } : {}),
      })
      .from(t)
      .where(
        and(
          eq(t.orgId, orgId),
          sql`${decidedAtInZone} >= ${filterBy.startDate}`,
          sql`${decidedAtInZone} <= ${filterBy.endDate}`,
          filterBy.actionIds.length > 0 || filterBy.type.length > 0
            ? or(
                filterBy.actionIds.length > 0
                  ? inArray(t.actionId, [...filterBy.actionIds])
                  : undefined,
                filterBy.type.length > 0
                  ? inArray(t.type, [...filterBy.type])
                  : undefined,
              )
            : undefined,
          filterBy.itemTypeIds.length > 0
            ? inArray(t.itemTypeId, [...filterBy.itemTypeIds])
            : undefined,
          filterBy.policyIds.length > 0
            ? inArray(t.policyId, [...filterBy.policyIds])
            : undefined,
          filterBy.reviewerIds.length > 0
            ? inArray(t.reviewerId, [...filterBy.reviewerIds])
            : undefined,
          filterBy.queueIds.length > 0
            ? inArray(t.queueId, [...filterBy.queueIds])
            : undefined,
          // Ignores, NCMEC reports and re-enqueueing don't make any sense when
          // grouping by policy ID
          groupBy.includes('policy_id')
            ? inArray(t.type, ['CUSTOM_ACTION', 'RELATED_ACTION'])
            : undefined,
          filterBy.filteredDecisionActionType &&
            filterBy.filteredDecisionActionType.includes('RELATED_ACTION')
            ? notInArray(t.type, [...filterBy.filteredDecisionActionType])
            : undefined,
          filterBy.filteredDecisionActionType?.includes('CUSTOM_ACTION')
            ? notInArray(t.type, [...filterBy.filteredDecisionActionType])
            : undefined,
        ),
      )
      .groupBy(
        ...[
          ...groupBy.map((it) => ident(it as string)),
          ident('time'),
          ...(groupBy.includes('type') ? [ident('action_id')] : []),
        ],
      );
    return rows as unknown as DecisionCountRow[];
  }

  async getDecisionCountsTable(
    input: DecisionCountsTableInput,
  ): Promise<DecisionCountTableRow[]> {
    const { orgId, groupBy, filterBy, timeZone } = input;
    const t = dimDecisions;
    const decidedAtInZone = sql`${t.decidedAt} AT TIME ZONE ${timeZone}`;
    const rows = await this.db
      .select({
        count: sql<number>`COUNT(DISTINCT (${t.itemId}, ${t.itemTypeId}))`,
        action_id: t.actionId,
        type: t.type,
        ...(groupBy.includes('queue_id') ? { queue_id: t.queueId } : {}),
        ...(groupBy.includes('reviewer_id')
          ? { reviewer_id: t.reviewerId }
          : {}),
      })
      .from(t)
      .where(
        and(
          eq(t.orgId, orgId),
          sql`${decidedAtInZone} >= ${filterBy.startDate}`,
          sql`${decidedAtInZone} <= ${filterBy.endDate}`,
          filterBy.reviewerIds.length > 0
            ? inArray(t.reviewerId, [...filterBy.reviewerIds])
            : undefined,
          filterBy.queueIds.length > 0
            ? inArray(t.queueId, [...filterBy.queueIds])
            : undefined,
        ),
      )
      .groupBy(ident(groupBy), t.actionId, t.type);
    return rows as unknown as DecisionCountTableRow[];
  }

  async getTimeToAction(input: TimeToActionInput) {
    const { orgId, groupBy, filterBy } = input;
    const creations = creationsAlias;
    const decisions = decisionsAlias;
    const query = this.db
      .select({
        time_to_action: sql<
          number | null
        >`date_part(${'EPOCH'}, avg(${decisions.createdAt} - ${creations.createdAt}))`,
        ...(groupBy.includes('queue_id')
          ? { queue_id: decisions.queueId }
          : {}),
      })
      .from(creations)
      .innerJoin(
        decisions,
        sql`${creations.id} = ${decisions.jobPayload}->>'id'`,
      )
      .where(
        and(
          eq(creations.orgId, orgId),
          gte(creations.createdAt, filterBy.startDate),
          lte(creations.createdAt, filterBy.endDate),
          filterBy.queueIds.length > 0
            ? inArray(decisions.queueId, [...filterBy.queueIds])
            : undefined,
        ),
      )
      .$dynamic();
    const rows =
      groupBy.length > 0
        ? await query.groupBy(
            ...groupBy.map((it) => sql`${ident('decisions')}.${ident(it)}`),
          )
        : await query;
    return rows as { time_to_action: number | null; queue_id?: string }[];
  }

  async getHandleTime(input: HandleTimeInput) {
    const { orgId, groupBy, filterBy } = input;
    const decisions = decisionsAlias;
    const query = this.db
      .select({
        handle_time: sql<
          number | null
        >`date_part(${'EPOCH'}, avg(${decisions.createdAt} - ${decisions.assignedAt}))`,
        ...(groupBy.includes('queue_id')
          ? { queue_id: decisions.queueId }
          : {}),
        ...(groupBy.includes('reviewer_id')
          ? { reviewer_id: decisions.reviewerId }
          : {}),
      })
      .from(decisions)
      .where(
        and(
          eq(decisions.orgId, orgId),
          isNotNull(decisions.assignedAt),
          gte(decisions.createdAt, filterBy.startDate),
          lte(decisions.createdAt, filterBy.endDate),
          filterBy.queueIds.length > 0
            ? inArray(decisions.queueId, [...filterBy.queueIds])
            : undefined,
          filterBy.reviewerIds.length > 0
            ? inArray(decisions.reviewerId, [...filterBy.reviewerIds])
            : undefined,
        ),
      )
      .$dynamic();
    const rows =
      groupBy.length > 0
        ? await query.groupBy(
            ...groupBy.map((it) => sql`${ident('decisions')}.${ident(it)}`),
          )
        : await query;
    return rows as {
      handle_time: number | null;
      queue_id?: string;
      reviewer_id?: string | null;
    }[];
  }

  async getJobCreations(
    input: JobCreationsInput,
  ): Promise<JobCreationCountRow[]> {
    const { groupBy, filterBy, orgId, timeDivision, timeZone } = input;
    const t = flattenedJobCreations;
    const rows = await this.db
      .select({
        time: truncatedTime(timeDivision, t.createdAt, timeZone),
        count: sql<number>`COUNT(DISTINCT(${t.itemId}, ${t.itemTypeId}))`,
        ...(groupBy.includes('item_type_id')
          ? { item_type_id: t.itemTypeId }
          : {}),
        ...(groupBy.includes('queue_id') ? { queue_id: t.queueId } : {}),
        ...(groupBy.includes('policy_id') ? { policy_id: t.policyId } : {}),
        ...(groupBy.includes('source')
          ? {
              // Aliased so the caller-supplied `source` group-by resolves.
              source: sql<ManualReviewJobEnqueueSource>`${t.sourceKind}`.as(
                'source',
              ),
              rule_id: t.ruleId,
            }
          : {}),
      })
      .from(t)
      .where(
        and(
          eq(t.orgId, orgId),
          gte(t.createdAt, filterBy.startDate),
          lte(t.createdAt, filterBy.endDate),
          filterBy.itemTypeIds.length > 0
            ? inArray(t.itemTypeId, [...filterBy.itemTypeIds])
            : undefined,
          filterBy.queueIds.length > 0
            ? inArray(t.queueId, [...filterBy.queueIds])
            : undefined,
          filterBy.policyIds.length > 0
            ? inArray(t.policyId, [...filterBy.policyIds])
            : undefined,
          filterBy.sources.length > 0
            ? inArray(t.sourceKind, [...filterBy.sources])
            : undefined,
          filterBy.ruleIds.length > 0
            ? inArray(t.ruleId, [...filterBy.ruleIds])
            : undefined,
        ),
      )
      .groupBy(
        ...[
          ...groupBy.map((it) => ident(it as string)),
          ident('time'),
          ...(groupBy.includes('source') ? [ident('rule_id')] : []),
        ],
      );
    return rows as unknown as JobCreationCountRow[];
  }

  /**
   * Shared query body for recent decisions: the select list, every filter
   * predicate, the `userSearchString` branch, and the NCMEC permission gate.
   * Stops short of `orderBy`/`offset` so each caller applies its own paging.
   * Drizzle replaces (rather than ANDs) a second `.where()`, so callers pass
   * any extra predicate (the activity-feed cursor) in `extraCondition`.
   */
  private buildRecentDecisionsQuery(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: Omit<RecentDecisionsFilterInput, 'page'>;
    limit: number;
    extraCondition?: SQL;
  }) {
    const { userPermissions, orgId, input, extraCondition } = opts;
    const limit = Math.min(opts.limit, MAX_DECISIONS_LIMIT);
    const {
      userSearchString,
      decisions: decisionsFilter,
      policyIds,
      reviewerIds,
      queueIds,
      startTime,
      endTime,
    } = input;
    const d = mrtDecisions;
    const existsDecisionComponent = (condition: SQL) =>
      sql`exists (select * from unnest(${d.decisionComponents}) as decision_component where ${condition})`;

    return this.db
      .select(recentDecisionSelection)
      .from(d)
      .where(
        and(
          eq(d.orgId, orgId),
          startTime ? gte(d.createdAt, new Date(startTime)) : undefined,
          endTime ? lte(d.createdAt, new Date(endTime)) : undefined,
          queueIds && queueIds.length > 0
            ? inArray(d.queueId, [...queueIds])
            : undefined,
          reviewerIds && reviewerIds.length > 0
            ? inArray(d.reviewerId, [...reviewerIds])
            : undefined,
          policyIds
            ? existsDecisionComponent(
                orOrFalse(
                  policyIds.map(
                    (policyId) =>
                      sql`decision_component->>'policies' like ${`%"${policyId}"%`}`,
                  ),
                ),
              )
            : undefined,
          decisionsFilter
            ? orOrFalse(
                decisionsFilter.map((it) =>
                  existsDecisionComponent(
                    and(
                      sql`decision_component->>'type' = ${it.type}`,
                      it.actionIds !== undefined
                        ? orOrFalse(
                            it.actionIds.map(
                              (actionId) =>
                                sql`decision_component->>'actions' like ${`%"${actionId}"%`}`,
                            ),
                          )
                        : undefined,
                    )!,
                  ),
                ),
              )
            : undefined,
          // See https://stackoverflow.com/a/55607847
          userSearchString !== undefined
            ? and(
                gt(d.createdAt, new Date(Date.now() - 3 * MONTH_MS)),
                // Above, the 'itemId' field is of type jsonb, so we cast it to a string using ::text, but that
                // cast will leave quotes around the resulting string because it's just stringifying what it thinks
                // is a jsonb object. The easiest way to handle this is to just add quotes around the userSearchString
                // to match the quotes in the value above.
                sql`(${d.jobPayload}->'payload'->'item'->>'itemId') = ${`${userSearchString}`}`,
              )
            : undefined,
          // If the user doesn't have the VIEW_CHILD_SAFETY_DATA permission,
          // filter out decisions on all NCMEC jobs
          ncmecVisibilityCondition(userPermissions),
          extraCondition,
        ),
      )
      .limit(limit)
      .$dynamic();
  }

  async getRecentDecisions(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: RecentDecisionsFilterInput;
  }) {
    const { userPermissions, orgId, input } = opts;
    const { page } = input;
    const limit = RECENT_DECISIONS_PAGE_SIZE;
    const decisions = await this.buildRecentDecisionsQuery({
      userPermissions,
      orgId,
      input,
      limit,
    })
      .orderBy(desc(mrtDecisions.createdAt), desc(mrtDecisions.id))
      .offset(page * limit);
    return (decisions as RecentDecisionRow[]).map(mapDecisionRow);
  }

  /**
   * Cursor-paged recent decisions, for the merged activity feed.
   *
   * Ordering is `(created_at, id)` descending. The id leg makes each row's
   * position unique so the cursor is exact — a `created_at`-only bound would
   * drop or repeat decisions sharing an instant.
   */
  async getDecisionsForActivityFeed(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: Omit<RecentDecisionsFilterInput, 'page'>;
    cursor?: ActivityFeedDecisionCursor;
    limit: number;
  }) {
    const { userPermissions, orgId, input, cursor, limit } = opts;
    const cursorCondition =
      cursor === undefined
        ? undefined
        : cursor.id === null
          ? lt(mrtDecisions.createdAt, cursor.ts)
          : // `id` is uuid. Without the cast Postgres infers the bind type
            // from the column, and a non-uuid string raises a Postgres error.
            sql`(${mrtDecisions.createdAt}, ${mrtDecisions.id}) < (${cursor.ts}, ${cursor.id}::uuid)`;
    const decisions = await this.buildRecentDecisionsQuery({
      userPermissions,
      orgId,
      input,
      limit,
      extraCondition: cursorCondition,
    }).orderBy(desc(mrtDecisions.createdAt), desc(mrtDecisions.id));
    return (decisions as RecentDecisionRow[]).map(mapDecisionRow);
  }

  async getResolvedJobCounts(
    input: JobCountsInput,
  ): Promise<ResolvedJobCountRow[]> {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const { queueIds, reviewerIds, startDate, endDate } = filterBy;
    const d = mrtDecisions;
    const createdAtInZone = sql`${d.createdAt} AT TIME ZONE ${timeZone}`;
    const rows = await this.db
      .select({
        time: truncatedTime(timeDivision, d.createdAt, timeZone),
        count: sql<number>`COUNT(DISTINCT ${d.id})`,
        ...(groupBy.includes('queue_id') ? { queue_id: d.queueId } : {}),
        ...(groupBy.includes('reviewer_id')
          ? { reviewer_id: d.reviewerId }
          : {}),
      })
      .from(d)
      .where(
        and(
          eq(d.orgId, orgId),
          sql`${createdAtInZone} >= ${startDate}`,
          sql`${createdAtInZone} <= ${endDate}`,
          queueIds.length > 0 ? inArray(d.queueId, [...queueIds]) : undefined,
          reviewerIds.length > 0
            ? inArray(d.reviewerId, [...reviewerIds])
            : undefined,
        ),
      )
      .groupBy(...[ident('time'), ...groupBy.map((it) => ident(it as string))]);
    return rows as unknown as ResolvedJobCountRow[];
  }

  async getDecidedJob(opts: { orgId: string; id: string }) {
    const { orgId, id } = opts;
    const d = mrtDecisions;
    const [payload] = await this.db
      .select({ job_payload: d.jobPayload })
      .from(d)
      .where(
        and(
          gte(d.createdAt, new Date('2023-10-01')),
          eq(d.orgId, orgId),
          eq(d.id, id),
        ),
      )
      .limit(1);
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
    const d = mrtDecisions;
    const [decisionWithPayload] = (await this.db
      .select({ job_payload: d.jobPayload, ...recentDecisionSelection })
      .from(d)
      .where(
        and(
          gte(d.createdAt, new Date('2023-10-01')),
          eq(d.orgId, orgId),
          sql`(${d.jobPayload}->>'id')::text = ${jobId}`,
          ncmecVisibilityCondition(userPermissions),
        ),
      )
      .limit(1)) as (RecentDecisionRow & { job_payload: unknown })[];
    // This is safe because only jobs created before Sept 2023 have
    // the old legacy schema defined in StoredManualReviewJob (see
    // the comment associated with the StoredManualReviewJob type).
    // This query has a hardcoded filter to not include those old jobs.
    if (!decisionWithPayload) {
      return null;
    }
    return {
      job: decisionWithPayload.job_payload as ManualReviewJob,
      decision: mapDecisionRow(decisionWithPayload),
    };
  }
}

function mapDecisionRow(decision: RecentDecisionRow) {
  return {
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
    assignedAt: decision.assigned_at,
    jobCreatedAt: decision.job_created_at
      ? new Date(decision.job_created_at)
      : null,
    decisionReason: decision.decision_reason,
    jobId: decision.job_id,
  };
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

export type HandleTimeInput = ReadonlyDeep<{
  orgId: string;
  groupBy: Array<'queue_id' | 'reviewer_id'>;
  filterBy: {
    queueIds: string[];
    reviewerIds: string[];
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
