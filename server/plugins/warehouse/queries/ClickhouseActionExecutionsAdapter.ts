import type { JsonObject } from 'type-fest';

import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import { jsonParse, type JsonOf } from '../../../utils/encoding.js';
import type SafeTracer from '../../../utils/SafeTracer.js';
import {
  getUtcDateOnlyString,
  parseClickhouseTimestamp,
  SIX_MONTHS_MS,
} from '../../../utils/time.js';
import { formatClickhouseQuery } from '../utils/clickhouseSql.js';
import {
  type ClickhouseActionExecutionRow,
  type ClickhouseManualActionItemRow,
  type ClickhouseModeratorActionGroupRow,
} from './clickhouseActionExecutionRows.js';
import { extractIds, parseJsonIdArray } from './clickhouseJsonIdArray.js';
import {
  type ContentCreatorIdentityInput,
  type ContentCreatorIdentityRecord,
  type IActionExecutionsAdapter,
  type InferredUserIdentityInput,
  type InferredUserIdentityRecord,
  type ItemActionHistoryInput,
  type ItemActionHistoryRecord,
  type ManualActionItemsInput,
  type ManualActionItemsResult,
  type ModeratorActionGroupRecord,
  type RecentModeratorActionsInput,
  type UserStrikeActionRecord,
  type UserStrikeActionsInput,
} from './IActionExecutionsAdapter.js';

const MODERATOR_ACTION_SOURCES = ['manual-action-run'];

export class ClickhouseActionExecutionsAdapter implements IActionExecutionsAdapter {
  constructor(
    private readonly warehouse: IDataWarehouse,
    private readonly tracer: SafeTracer,
  ) {}

  /**
   * Every action recorded against an item or its creator, newest first, with
   * the policies, rules and moderator-supplied parameters each ran with.
   * Background rule executions are excluded — they're machine bookkeeping
   * rather than enforcement a reviewer needs to see.
   */
  async getItemActionHistory(
    input: ItemActionHistoryInput,
  ): Promise<ReadonlyArray<ItemActionHistoryRecord>> {
    const { orgId, itemId, itemTypeId } = input;

    const sql = `
      SELECT
        ts,
        item_id,
        item_type_id,
        item_creator_id,
        item_creator_type_id,
        actor_id,
        job_id,
        policies,
        rules,
        parameters,
        action_id
      FROM analytics.ACTION_EXECUTIONS
      WHERE org_id = ?
        AND (
          (lower(item_creator_id) = lower(?)
            AND lower(item_creator_type_id) = lower(?))
          OR
          (lower(item_id) = lower(?)
            AND lower(item_type_id) = lower(?))
        )
        AND (rule_environment IS NULL OR rule_environment != 'BACKGROUND')
      ORDER BY ts DESC
    `;

    const rows = (await this.query(sql, [
      orgId,
      itemId,
      itemTypeId,
      itemId,
      itemTypeId,
    ])) as ClickhouseActionExecutionRow[];

    return rows
      .filter((row) => row.item_id && row.item_type_id)
      .map<ItemActionHistoryRecord>((row) => ({
        actionId: row.action_id,
        itemId: row.item_id!,
        itemTypeId: row.item_type_id!,
        actorId: row.actor_id ?? null,
        jobId: row.job_id ?? null,
        userId: row.item_creator_id ?? null,
        userTypeId: row.item_creator_type_id ?? null,
        policies: extractIds(parseJsonIdArray(row.policies)),
        ruleIds: extractIds(parseJsonIdArray(row.rules)),
        parameters: this.parseJsonObject(row.parameters),
        occurredAt: new Date(row.ts),
      }));
  }

  async getRecentModeratorActions(
    input: RecentModeratorActionsInput,
  ): Promise<ReadonlyArray<ModeratorActionGroupRecord>> {
    const { orgId, cursor, after, before, limit, actorIds, policyIds, itemId } =
      input;

    const upperBound = cursor
      ? before && before.valueOf() < cursor.ts.valueOf()
        ? before
        : cursor.ts
      : before;

    const conditions = [
      'org_id = ?',
      `action_source IN (${MODERATOR_ACTION_SOURCES.map(() => '?').join(', ')})`,
    ];
    const params: unknown[] = [orgId, ...MODERATOR_ACTION_SOURCES];

    if (after) {
      conditions.push('ds >= toDate(?) - 1');
      params.push(getUtcDateOnlyString(after));
    }
    if (upperBound) {
      conditions.push('ds <= toDate(?) + 1');
      params.push(getUtcDateOnlyString(upperBound));
    }

    if (actorIds && actorIds.length > 0) {
      conditions.push(`actor_id IN (${actorIds.map(() => '?').join(', ')})`);
      params.push(...actorIds);
    }
    if (policyIds && policyIds.length > 0) {
      // `policies` is a JSON array of objects; `policy_ids` exists on the table
      // but ActionExecutionLogger never populates it, so extract from the JSON.
      conditions.push(
        `hasAny(arrayMap(p -> JSONExtractString(p, 'id'), JSONExtractArrayRaw(policies)), ?)`,
      );
      params.push([...policyIds]);
    }

    const having: string[] = [];
    if (cursor) {
      having.push(
        '(max(ts), correlation_id) < (parseDateTime64BestEffort(?), ?)',
      );
      params.push(cursor.ts.toISOString(), cursor.correlationId);
    }
    if (after) {
      having.push('max(ts) >= parseDateTime64BestEffort(?)');
      params.push(after.toISOString());
    }
    if (before) {
      having.push('max(ts) <= parseDateTime64BestEffort(?)');
      params.push(before.toISOString());
    }
    if (itemId) {
      having.push('has(groupUniqArray(item_id), ?)');
      params.push(itemId);
    }

    const sql = `
      SELECT
        correlation_id,
        max(ts) AS last_ts,
        any(actor_id) AS actor_id,
        any(item_type_id) AS item_type_id,
        any(actor_note) AS actor_note,
        any(policies) AS policies,
        groupUniqArray(action_id) AS action_ids,
        uniqExact(item_id) AS item_count,
        uniqExactIf(item_id, failed = 1) AS failed_count
      FROM analytics.ACTION_EXECUTIONS
      WHERE ${conditions.join('\n        AND ')}
      GROUP BY correlation_id
      ${having.length > 0 ? `HAVING ${having.join('\n        AND ')}` : ''}
      ORDER BY last_ts DESC, correlation_id DESC
      LIMIT ${Number(limit)}
    `;

    const rows = await this.query<ClickhouseModeratorActionGroupRow>(
      sql,
      params,
    );

    return rows.map<ModeratorActionGroupRecord>((row) => ({
      correlationId: row.correlation_id,
      actorId: row.actor_id ?? null,
      itemTypeId: row.item_type_id ?? null,
      actionIds: row.action_ids ?? [],
      policyIds: extractIds(parseJsonIdArray(row.policies)),
      actorNote: row.actor_note ?? null,
      itemCount: Number(row.item_count) || 0,
      failedCount: Number(row.failed_count) || 0,
      occurredAt: parseClickhouseTimestamp(row.last_ts),
    }));
  }

  async getManualActionItems(
    input: ManualActionItemsInput,
  ): Promise<ManualActionItemsResult> {
    const { orgId, correlationId, occurredAt, limit, offset } = input;

    const sql = `
      SELECT
        item_id,
        any(item_type_id) AS item_type_id,
        max(failed) AS failed,
        count() OVER () AS total_count
      FROM (
        SELECT item_id, item_type_id, failed
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND ds <= toDate(?) + 1
          AND correlation_id = ?
          AND item_id IS NOT NULL
          AND action_source IN (${MODERATOR_ACTION_SOURCES.map(() => '?').join(', ')})
      )
      GROUP BY item_id
      ORDER BY item_id ASC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const rows = await this.query<ClickhouseManualActionItemRow>(sql, [
      orgId,
      getUtcDateOnlyString(occurredAt),
      correlationId,
      ...MODERATOR_ACTION_SOURCES,
    ]);

    return {
      items: rows.map((row) => ({
        itemId: row.item_id,
        itemTypeId: row.item_type_id ?? null,
        failed: Number(row.failed) === 1,
      })),
      totalCount: Number(rows[0]?.total_count ?? 0) || 0,
    };
  }

  async getRecentUserStrikeActions(
    input: UserStrikeActionsInput,
  ): Promise<ReadonlyArray<UserStrikeActionRecord>> {
    const { orgId, filterBy, limit } = input;

    const conditions: string[] = [
      'org_id = ?',
      "action_source = 'user-strike-action-execution'",
    ];
    const params: unknown[] = [orgId];

    if (filterBy?.startDate) {
      conditions.push('ds >= toDate(?)');
      params.push(filterBy.startDate);
    }
    if (filterBy?.endDate) {
      conditions.push('ds <= toDate(?)');
      params.push(filterBy.endDate);
    }

    const sql = `
      SELECT
        ts,
        item_id,
        item_type_id,
        item_creator_id,
        item_creator_type_id,
        action_id,
        action_source
      FROM analytics.ACTION_EXECUTIONS
      WHERE ${conditions.join(' AND ')}
      ORDER BY ts DESC
      ${limit != null ? `LIMIT ${Number(limit)}` : ''}
    `;

    const rows = (await this.query(
      sql,
      params,
    )) as ClickhouseActionExecutionRow[];

    return rows
      .filter((row) => row.item_id && row.item_type_id)
      .map<UserStrikeActionRecord>((row) => ({
        actionId: row.action_id,
        itemId: row.item_id!,
        itemTypeId: row.item_type_id!,
        creatorId: row.item_creator_id || null,
        creatorTypeId: row.item_creator_type_id || null,
        source: row.action_source ?? 'user-strike-action-execution',
        occurredAt: new Date(row.ts),
      }));
  }

  async findInferredUserIdentity(
    input: InferredUserIdentityInput,
  ): Promise<InferredUserIdentityRecord | null> {
    const { orgId, itemId, lookbackWindowMs = SIX_MONTHS_MS } = input;

    const lookbackStart = new Date(Date.now() - Math.max(1, lookbackWindowMs));
    const lookbackStartDate = lookbackStart.toISOString().slice(0, 10);

    // Filter projected-type-id NULL/empty rows in SQL so a single LIMIT 1
    // suffices — pulling a page and skipping in JS would miss valid older
    // rows whenever the most-recent N candidates all happen to be NULL.
    const sql = `
      SELECT
        ts,
        item_id,
        item_type_id,
        item_type_kind,
        item_creator_id,
        item_creator_type_id
      FROM analytics.ACTION_EXECUTIONS
      WHERE org_id = ?
        AND ds >= toDate(?)
        AND (
          (
            lower(item_id) = lower(?)
            AND item_type_kind = 'USER'
            AND item_type_id IS NOT NULL
            AND item_type_id != ''
          )
          OR (
            lower(item_creator_id) = lower(?)
            AND item_creator_type_id IS NOT NULL
            AND item_creator_type_id != ''
          )
        )
      ORDER BY ts DESC
      LIMIT 1
    `;

    const rows = await this.query<ClickhouseActionExecutionRow>(sql, [
      orgId,
      lookbackStartDate,
      itemId,
      itemId,
    ]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const matchesAsUserAction =
      row.item_type_kind === 'USER' &&
      row.item_id != null &&
      row.item_id.toLowerCase() === itemId.toLowerCase();

    const userTypeId = matchesAsUserAction
      ? row.item_type_id
      : row.item_creator_type_id;

    if (!userTypeId) {
      return null;
    }

    return {
      itemTypeId: userTypeId,
      lastSeenAt: new Date(row.ts),
    };
  }

  async findContentCreatorIdentity(
    input: ContentCreatorIdentityInput,
  ): Promise<ContentCreatorIdentityRecord | null> {
    const {
      orgId,
      itemId,
      itemTypeId,
      lookbackWindowMs = SIX_MONTHS_MS,
    } = input;

    const lookbackStart = new Date(Date.now() - Math.max(1, lookbackWindowMs));
    const lookbackStartDate = lookbackStart.toISOString().slice(0, 10);

    // Filter empty creator rows in SQL so LIMIT 1 always returns a usable row
    // when one exists; otherwise the most recent action on this content could
    // legitimately have no creator and hide older rows that do.
    const sql = `
      SELECT
        ts,
        item_creator_id,
        item_creator_type_id
      FROM analytics.ACTION_EXECUTIONS
      WHERE org_id = ?
        AND ds >= toDate(?)
        AND lower(item_id) = lower(?)
        AND item_type_id = ?
        AND item_type_kind = 'CONTENT'
        AND item_creator_id IS NOT NULL
        AND item_creator_id != ''
        AND item_creator_type_id IS NOT NULL
        AND item_creator_type_id != ''
      ORDER BY ts DESC
      LIMIT 1
    `;

    const rows = await this.query<ClickhouseActionExecutionRow>(sql, [
      orgId,
      lookbackStartDate,
      itemId,
      itemTypeId,
    ]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    if (!row.item_creator_id || !row.item_creator_type_id) {
      return null;
    }

    return {
      creatorId: row.item_creator_id,
      creatorTypeId: row.item_creator_type_id,
      lastSeenAt: new Date(row.ts),
    };
  }

  /**
   * `ACTION_EXECUTIONS.parameters` holds a canonical JSON object (`'{}'` by
   * default). Anything that isn't a readable JSON object — a legacy row, an
   * empty string, or a value that got written as an array or scalar — reads
   * back as `{}` rather than failing the whole history query for one bad row.
   */
  private parseJsonObject(jsonString: string | null | undefined): JsonObject {
    if (!jsonString) {
      return {};
    }
    try {
      const parsed = jsonParse(jsonString as JsonOf<unknown>);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as JsonObject;
      }
      return {};
    } catch {
      return {};
    }
  }

  private async query<T>(
    statement: string,
    params: readonly unknown[],
  ): Promise<readonly T[]> {
    const formatted = formatClickhouseQuery(statement, params);
    const response = await this.warehouse.query(formatted, this.tracer);
    return response as readonly T[];
  }
}
