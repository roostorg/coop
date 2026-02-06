import {
  type IActionExecutionsAdapter,
  type ItemActionHistoryInput,
  type ItemActionHistoryRecord,
  type UserStrikeActionRecord,
  type UserStrikeActionsInput,
} from './IActionExecutionsAdapter.js';
import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import type SafeTracer from '../../../utils/SafeTracer.js';
import { formatClickhouseQuery } from '../utils/clickhouseSql.js';
import { jsonParse, type JsonOf } from '../../../utils/encoding.js';

interface ClickhouseActionExecutionRow {
  ts: string;
  item_id: string | null;
  item_type_id: string | null;
  item_creator_id: string | null;
  item_creator_type_id: string | null;
  actor_id: string | null;
  job_id: string | null;
  policies?: string | null;
  rules?: string | null;
  action_id: string;
  action_source?: string;
}

export class ClickhouseActionExecutionsAdapter
  implements IActionExecutionsAdapter
{
  constructor(
    private readonly warehouse: IDataWarehouse,
    private readonly tracer: SafeTracer,
  ) {}

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
        policies: this.extractIds(this.parseJsonArray(row.policies)),
        ruleIds: this.extractIds(this.parseJsonArray(row.rules)),
        occurredAt: new Date(row.ts),
      }));
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
        action_id,
        action_source
      FROM analytics.ACTION_EXECUTIONS
      WHERE ${conditions.join(' AND ')}
      ORDER BY ts DESC
      ${limit != null ? `LIMIT ${Number(limit)}` : ''}
    `;

    const rows = (await this.query(sql, params)) as ClickhouseActionExecutionRow[];

    return rows
      .filter((row) => row.item_id && row.item_type_id)
      .map<UserStrikeActionRecord>((row) => ({
        actionId: row.action_id,
        itemId: row.item_id!,
        itemTypeId: row.item_type_id!,
        source: row.action_source ?? 'user-strike-action-execution',
        occurredAt: new Date(row.ts),
      }));
  }

  private parseJsonArray(
    jsonString: string | null | undefined,
  ): Array<{ id: string }> | null {
    if (!jsonString || jsonString === '[]') {
      return null;
    }
    try {
      const parsed = jsonParse(jsonString as JsonOf<unknown>);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is { id: string } =>
            typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            typeof item.id === 'string',
        );
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractIds(
    values: Array<{ id: string }> | null | undefined,
  ): readonly string[] {
    if (!values) {
      return [];
    }
    return values
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  private async query<T>(
    statement: string,
    params: readonly unknown[],
  ): Promise<readonly T[]> {
    const formatted = formatClickhouseQuery(statement, params);
    const response = await this.warehouse.query(
      formatted,
      this.tracer,
    );
    return response as readonly T[];
  }
}

