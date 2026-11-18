/* eslint-disable max-lines */
import { type ReadonlyDeep } from 'type-fest';

import { Prisma, type PrismaPgClient } from '../../../storage/prisma/index.js';
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

type DimMrtDecisionsColumn =
  keyof ManualReviewToolServicePg['manual_review_tool.dim_mrt_decisions_materialized'];

const DIM_MRT_DECISIONS_COLUMNS: ReadonlySet<string> =
  new Set<DimMrtDecisionsColumn>([
    'org_id',
    'job_id',
    'item_id',
    'action_id',
    'policy_id',
    'queue_id',
    'type',
    'item_type_id',
    'reviewer_id',
    'ds',
    'decided_at',
  ]);

/**
 * Identifiers go through `Prisma.raw`, so they must never be user input. The
 * group-by lists come from GraphQL enums; check them against the known
 * columns anyway.
 */
function column(name: string, allowed: ReadonlySet<string>) {
  if (!allowed.has(name)) {
    throw new Error(`Unexpected column name: ${name}`);
  }
  return Prisma.raw(name);
}

// Same semantics as Kysely's `eb.and([])` (TRUE) and `eb.or([])` (FALSE).
function and(conditions: Prisma.Sql[]) {
  return conditions.length === 0
    ? Prisma.sql`TRUE`
    : Prisma.sql`(${Prisma.join(conditions, ' AND ')})`;
}
function or(conditions: Prisma.Sql[]) {
  return conditions.length === 0
    ? Prisma.sql`FALSE`
    : Prisma.sql`(${Prisma.join(conditions, ' OR ')})`;
}

function inList(col: string, values: readonly string[]) {
  return Prisma.sql`${Prisma.raw(col)} IN (${Prisma.join(values)})`;
}
function notInList(col: string, values: readonly string[]) {
  return Prisma.sql`${Prisma.raw(col)} NOT IN (${Prisma.join(values)})`;
}

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

const recentDecisionColumns = Prisma.sql`
  id,
  queue_id,
  reviewer_id,
  decision_components,
  related_actions,
  created_at,
  ((job_payload->'payload'::text)->'item'::text) -> 'itemId'::text AS item_id,
  (((job_payload->'payload'::text)->'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text AS item_type_id,
  decision_reason,
  assigned_at,
  job_payload->>'createdAt' AS job_created_at,
  (job_payload->>'id')::text AS job_id`;

const notNcmecJob = Prisma.sql`(job_payload->'payload'->'kind')::text != ${'"NCMEC"'}`;

export default class DecisionAnalytics {
  constructor(private readonly prisma: PrismaPgClient) {}

  async getDecisionCounts(input: DecisionCountsInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const groupByColumns = groupBy as readonly string[];
    const selected = new Set([
      ...(groupByColumns.includes('action_id') ? ['action_id'] : []),
      ...(groupByColumns.includes('queue_id') ? ['queue_id'] : []),
      ...(groupByColumns.includes('type') ? ['action_id', 'type'] : []),
      ...(groupByColumns.includes('reviewer_id') ? ['reviewer_id'] : []),
      ...(groupByColumns.includes('policy_id') ? ['policy_id'] : []),
    ]);
    const extraSelect = [...selected].map(
      (c) => Prisma.sql`, ${column(c, DIM_MRT_DECISIONS_COLUMNS)}`,
    );
    const groupByList = [
      ...groupByColumns.map((c) => column(c, DIM_MRT_DECISIONS_COLUMNS)),
      Prisma.raw('"time"'),
      ...(groupByColumns.includes('type') ? [Prisma.raw('action_id')] : []),
    ];
    const where = and([
      Prisma.sql`org_id = ${orgId}`,
      Prisma.sql`decided_at AT TIME ZONE ${timeZone} >= ${filterBy.startDate}`,
      Prisma.sql`decided_at AT TIME ZONE ${timeZone} <= ${filterBy.endDate}`,
      ...(filterBy.actionIds.length > 0 || filterBy.type.length > 0
        ? [
            or([
              ...(filterBy.actionIds.length > 0
                ? [inList('action_id', filterBy.actionIds)]
                : []),
              ...(filterBy.type.length > 0
                ? [inList('type', filterBy.type)]
                : []),
            ]),
          ]
        : []),
      ...(filterBy.itemTypeIds.length > 0
        ? [inList('item_type_id', filterBy.itemTypeIds)]
        : []),
      ...(filterBy.policyIds.length > 0
        ? [inList('policy_id', filterBy.policyIds)]
        : []),
      ...(filterBy.reviewerIds.length > 0
        ? [inList('reviewer_id', filterBy.reviewerIds)]
        : []),
      ...(filterBy.queueIds.length > 0
        ? [inList('queue_id', filterBy.queueIds)]
        : []),
      // Ignores, NCMEC reports and re-enqueueing don't make any sense when
      // grouping by policy ID
      ...(groupByColumns.includes('policy_id')
        ? [inList('type', ['CUSTOM_ACTION', 'RELATED_ACTION'])]
        : []),
      ...(filterBy.filteredDecisionActionType &&
      filterBy.filteredDecisionActionType.includes('RELATED_ACTION')
        ? [notInList('type', filterBy.filteredDecisionActionType)]
        : []),
      ...(filterBy.filteredDecisionActionType?.includes('CUSTOM_ACTION')
        ? [notInList('type', filterBy.filteredDecisionActionType)]
        : []),
    ]);
    // prisma-raw: @@ignore'd table (no PK); date_trunc with time zone, COUNT(DISTINCT (tuple)), dynamic GROUP BY
    return this.prisma.$queryRaw<
      {
        time: string;
        count: number;
        action_id?: string | null;
        queue_id?: string;
        type?: ManualReviewDecisionType;
        reviewer_id?: string;
        policy_id?: string | null;
      }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC(${timeDivision}, decided_at, ${timeZone}) AS "time",
        COUNT(DISTINCT (item_id, item_type_id))::int AS count
        ${extraSelect.length > 0 ? Prisma.join(extraSelect, '') : Prisma.empty}
      FROM manual_review_tool.dim_mrt_decisions_materialized
      WHERE ${where}
      GROUP BY ${Prisma.join(groupByList)}
    `);
  }

  async getDecisionCountsTable(input: DecisionCountsTableInput) {
    const { orgId, groupBy, filterBy, timeZone } = input;
    const groupByColumn = column(groupBy, DIM_MRT_DECISIONS_COLUMNS);
    const where = and([
      Prisma.sql`org_id = ${orgId}`,
      Prisma.sql`decided_at AT TIME ZONE ${timeZone} >= ${filterBy.startDate}`,
      Prisma.sql`decided_at AT TIME ZONE ${timeZone} <= ${filterBy.endDate}`,
      ...(filterBy.reviewerIds.length > 0
        ? [inList('reviewer_id', filterBy.reviewerIds)]
        : []),
      ...(filterBy.queueIds.length > 0
        ? [inList('queue_id', filterBy.queueIds)]
        : []),
    ]);
    // prisma-raw: @@ignore'd table (no PK); COUNT(DISTINCT (tuple))
    return this.prisma.$queryRaw<
      {
        count: number;
        action_id: string | null;
        type: ManualReviewDecisionType;
        queue_id?: string;
        reviewer_id?: string;
      }[]
    >(Prisma.sql`
      SELECT COUNT(DISTINCT (item_id, item_type_id))::int AS count,
        action_id,
        type,
        ${groupByColumn}
      FROM manual_review_tool.dim_mrt_decisions_materialized
      WHERE ${where}
      GROUP BY ${groupByColumn}, action_id, type
    `);
  }

  async getTimeToAction(input: TimeToActionInput) {
    const { orgId, groupBy, filterBy } = input;
    const where = and([
      Prisma.sql`creations.org_id = ${orgId}`,
      Prisma.sql`creations.created_at >= ${filterBy.startDate}`,
      Prisma.sql`creations.created_at <= ${filterBy.endDate}`,
      ...(filterBy.queueIds.length > 0
        ? [inList('decisions.queue_id', filterBy.queueIds)]
        : []),
    ]);
    // manual_review_decisions has no item_type_id column, so grouping by it
    // fails in Postgres, as it did before the port.
    const allowed = new Set(['queue_id', 'reviewer_id', 'item_type_id']);
    const groupByList = groupBy.map(
      (c) => Prisma.sql`decisions.${column(c, allowed)}`,
    );
    // prisma-raw: join on a jsonb expression, AVG over an interval, date_part
    return this.prisma.$queryRaw<
      { time_to_action: number | null; queue_id?: string }[]
    >(Prisma.sql`
      SELECT date_part(${'EPOCH'}, avg(decisions.created_at - creations.created_at)) AS time_to_action
        ${groupBy.includes('queue_id') ? Prisma.sql`, decisions.queue_id AS queue_id` : Prisma.empty}
      FROM manual_review_tool.job_creations AS creations
      INNER JOIN manual_review_tool.manual_review_decisions AS decisions
        ON creations.id = decisions.job_payload->>'id'
      WHERE ${where}
      ${groupByList.length > 0 ? Prisma.sql`GROUP BY ${Prisma.join(groupByList)}` : Prisma.empty}
    `);
  }

  async getHandleTime(input: HandleTimeInput) {
    const { orgId, groupBy, filterBy } = input;
    const where = and([
      Prisma.sql`decisions.org_id = ${orgId}`,
      Prisma.sql`decisions.assigned_at IS NOT NULL`,
      Prisma.sql`decisions.created_at >= ${filterBy.startDate}`,
      Prisma.sql`decisions.created_at <= ${filterBy.endDate}`,
      ...(filterBy.queueIds.length > 0
        ? [inList('decisions.queue_id', filterBy.queueIds)]
        : []),
      ...(filterBy.reviewerIds.length > 0
        ? [inList('decisions.reviewer_id', filterBy.reviewerIds)]
        : []),
    ]);
    const allowed = new Set(['queue_id', 'reviewer_id']);
    const groupByList = groupBy.map(
      (c) => Prisma.sql`decisions.${column(c, allowed)}`,
    );
    // prisma-raw: AVG over an interval, date_part
    return this.prisma.$queryRaw<
      { handle_time: number | null; queue_id?: string; reviewer_id?: string }[]
    >(Prisma.sql`
      SELECT date_part(${'EPOCH'}, avg(decisions.created_at - decisions.assigned_at)) AS handle_time
        ${groupBy.includes('queue_id') ? Prisma.sql`, decisions.queue_id AS queue_id` : Prisma.empty}
        ${groupBy.includes('reviewer_id') ? Prisma.sql`, decisions.reviewer_id AS reviewer_id` : Prisma.empty}
      FROM manual_review_tool.manual_review_decisions AS decisions
      WHERE ${where}
      ${groupByList.length > 0 ? Prisma.sql`GROUP BY ${Prisma.join(groupByList)}` : Prisma.empty}
    `);
  }

  async getJobCreations(input: JobCreationsInput) {
    const { groupBy, filterBy, orgId, timeDivision, timeZone } = input;
    const allowed = new Set(['item_type_id', 'queue_id', 'policy_id', 'source']);
    const where = and([
      Prisma.sql`org_id = ${orgId}`,
      Prisma.sql`creations.created_at >= ${filterBy.startDate}`,
      Prisma.sql`creations.created_at <= ${filterBy.endDate}`,
      ...(filterBy.itemTypeIds.length > 0
        ? [inList('item_type_id', filterBy.itemTypeIds)]
        : []),
      ...(filterBy.queueIds.length > 0
        ? [inList('queue_id', filterBy.queueIds)]
        : []),
      ...(filterBy.policyIds.length > 0
        ? [inList('policy_id', filterBy.policyIds)]
        : []),
      ...(filterBy.sources.length > 0
        ? [inList('source_kind', filterBy.sources)]
        : []),
      ...(filterBy.ruleIds.length > 0
        ? [inList('rule_id', filterBy.ruleIds)]
        : []),
    ]);
    const groupByList = [
      ...groupBy.map((c) => column(c, allowed)),
      Prisma.raw('"time"'),
      ...(groupBy.includes('source') ? [Prisma.raw('rule_id')] : []),
    ];
    // prisma-raw: date_trunc with time zone, COUNT(DISTINCT (tuple)), aliased columns, dynamic GROUP BY
    return this.prisma.$queryRaw<
      {
        time: string;
        count: number;
        item_type_id?: string;
        queue_id?: string;
        policy_id?: string;
        source?: ManualReviewJobEnqueueSource;
        rule_id?: string;
      }[]
    >(Prisma.sql`
      SELECT date_trunc(${timeDivision}, created_at, ${timeZone}) AS "time",
        COUNT(DISTINCT(item_id, item_type_id))::int AS count
        ${groupBy.includes('item_type_id') ? Prisma.sql`, item_type_id` : Prisma.empty}
        ${groupBy.includes('queue_id') ? Prisma.sql`, queue_id` : Prisma.empty}
        ${groupBy.includes('policy_id') ? Prisma.sql`, policy_id` : Prisma.empty}
        ${groupBy.includes('source') ? Prisma.sql`, source_kind AS source, rule_id` : Prisma.empty}
      FROM manual_review_tool.flattened_job_creations AS creations
      WHERE ${where}
      GROUP BY ${Prisma.join(groupByList)}
    `);
  }

  /**
   * Shared WHERE clause for recent decisions: every filter predicate, the
   * `userSearchString` branch, and the NCMEC permission gate. Each caller
   * adds its own ordering and paging.
   */
  private buildRecentDecisionsWhere(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: Omit<RecentDecisionsFilterInput, 'page'>;
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
    } = input;
    const someComponent = (condition: Prisma.Sql) =>
      Prisma.sql`EXISTS (SELECT * FROM unnest(manual_review_tool.manual_review_decisions.decision_components) AS decision_component WHERE ${condition})`;
    return and([
      Prisma.sql`org_id = ${orgId}`,
      ...(startTime ? [Prisma.sql`created_at >= ${new Date(startTime)}`] : []),
      ...(endTime ? [Prisma.sql`created_at <= ${new Date(endTime)}`] : []),
      ...(queueIds && queueIds.length > 0
        ? [inList('queue_id', queueIds)]
        : []),
      ...(reviewerIds && reviewerIds.length > 0
        ? [inList('reviewer_id', reviewerIds)]
        : []),
      ...(policyIds
        ? [
            someComponent(
              or(
                policyIds.map(
                  (policyId) =>
                    Prisma.sql`decision_component->>'policies' LIKE ${`%"${policyId}"%`}`,
                ),
              ),
            ),
          ]
        : []),
      ...(decisionsFilter
        ? [
            or(
              decisionsFilter.map((it) =>
                someComponent(
                  and([
                    Prisma.sql`decision_component->>'type' = ${it.type}`,
                    ...(it.actionIds !== undefined
                      ? [
                          or(
                            it.actionIds.map(
                              (actionId) =>
                                Prisma.sql`decision_component->>'actions' LIKE ${`%"${actionId}"%`}`,
                            ),
                          ),
                        ]
                      : []),
                  ]),
                ),
              ),
            ),
          ]
        : []),
      // See https://stackoverflow.com/a/55607847
      ...(userSearchString !== undefined
        ? [
            Prisma.sql`created_at > ${new Date(Date.now() - 3 * MONTH_MS)}`,
            Prisma.sql`(manual_review_tool.manual_review_decisions.job_payload->'payload'->'item'->>'itemId') = ${userSearchString}`,
          ]
        : []),
      // If the user doesn't have the VIEW_CHILD_SAFETY_DATA permission, filter
      // out decisions on all NCMEC jobs
      ...(!userPermissions.includes(UserPermission.VIEW_CHILD_SAFETY_DATA)
        ? [notNcmecJob]
        : []),
    ]);
  }

  async getRecentDecisions(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: RecentDecisionsFilterInput;
  }) {
    const { userPermissions, orgId, input } = opts;
    const { page } = input;
    const limit = RECENT_DECISIONS_PAGE_SIZE;
    const where = this.buildRecentDecisionsWhere({
      userPermissions,
      orgId,
      input,
    });
    // prisma-raw: computed jsonb select expressions, EXISTS over unnest()
    const decisions = await this.prisma.$queryRaw<RecentDecisionRow[]>(
      Prisma.sql`
        SELECT ${recentDecisionColumns}
        FROM manual_review_tool.manual_review_decisions
        WHERE ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT ${Math.min(limit, MAX_DECISIONS_LIMIT)}
        OFFSET ${page * limit}
      `,
    );
    return decisions.map(mapDecisionRow);
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
    const where = this.buildRecentDecisionsWhere({
      userPermissions,
      orgId,
      input,
    });
    const cursorCondition =
      cursor === undefined
        ? Prisma.empty
        : cursor.id === null
          ? Prisma.sql`AND created_at < ${cursor.ts}`
          : // `id` is uuid. Without the cast Postgres infers the bind type
            // from the column, and a non-uuid string raises a Postgres error.
            Prisma.sql`AND (created_at, id) < (${cursor.ts}::timestamptz, ${cursor.id}::uuid)`;
    // prisma-raw: computed jsonb select expressions, EXISTS over unnest(), row-value comparison
    const decisions = await this.prisma.$queryRaw<RecentDecisionRow[]>(
      Prisma.sql`
        SELECT ${recentDecisionColumns}
        FROM manual_review_tool.manual_review_decisions
        WHERE ${where} ${cursorCondition}
        ORDER BY created_at DESC, id DESC
        LIMIT ${Math.min(limit, MAX_DECISIONS_LIMIT)}
      `,
    );
    return decisions.map(mapDecisionRow);
  }

  async getResolvedJobCounts(input: JobCountsInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;
    const { queueIds, reviewerIds, startDate, endDate } = filterBy;
    const allowed = new Set(['queue_id', 'reviewer_id']);
    const groupByList = [
      Prisma.raw('"time"'),
      ...groupBy.map((c) => column(c, allowed)),
    ];
    // prisma-raw: date_trunc with time zone, COUNT(DISTINCT), dynamic GROUP BY
    return this.prisma.$queryRaw<
      { time: string; count: number; queue_id?: string; reviewer_id?: string }[]
    >(Prisma.sql`
      SELECT date_trunc(${timeDivision}, created_at, ${timeZone}) AS "time",
        COUNT(DISTINCT id)::int AS count
        ${groupBy.includes('queue_id') ? Prisma.sql`, queue_id` : Prisma.empty}
        ${groupBy.includes('reviewer_id') ? Prisma.sql`, reviewer_id` : Prisma.empty}
      FROM manual_review_tool.manual_review_decisions
      WHERE org_id = ${orgId}
        AND created_at AT TIME ZONE ${timeZone} >= ${startDate}
        AND created_at AT TIME ZONE ${timeZone} <= ${endDate}
        ${queueIds.length > 0 ? Prisma.sql`AND ${inList('queue_id', queueIds)}` : Prisma.empty}
        ${reviewerIds.length > 0 ? Prisma.sql`AND ${inList('reviewer_id', reviewerIds)}` : Prisma.empty}
      GROUP BY ${Prisma.join(groupByList)}
    `);
  }

  async getDecidedJob(opts: { orgId: string; id: string }) {
    const { orgId, id } = opts;
    const payload = await this.prisma.manual_review_decisions.findFirst({
      select: { job_payload: true },
      where: {
        created_at: { gte: new Date('2023-10-01') },
        org_id: orgId,
        id,
      },
    });
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
    // prisma-raw: computed jsonb select and filter expressions
    const [decisionWithPayload] = await this.prisma.$queryRaw<
      (RecentDecisionRow & { job_payload: ManualReviewJob })[]
    >(Prisma.sql`
      SELECT job_payload, ${recentDecisionColumns}
      FROM manual_review_tool.manual_review_decisions
      WHERE created_at >= ${new Date('2023-10-01')}
        AND org_id = ${orgId}
        AND (job_payload->>'id')::text = ${jobId}
        ${
          !userPermissions.includes(UserPermission.VIEW_CHILD_SAFETY_DATA)
            ? Prisma.sql`AND ${notNcmecJob}`
            : Prisma.empty
        }
      LIMIT 1
    `);
    // This is safe because only jobs created before Sept 2023 have
    // the old legacy schema defined in StoredManualReviewJob (see
    // the comment associated with the StoredManualReviewJob type).
    // This query has a hardcoded filter to not include those old jobs.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!decisionWithPayload) {
      return null;
    }
    return {
      job: decisionWithPayload.job_payload,
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
