import {
  type ActionCountsInput,
  type IActionStatisticsAdapter,
  type ActionStatisticsTimeDivisionOptions,
} from './IActionStatisticsAdapter.js';
import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import type SafeTracer from '../../../utils/SafeTracer.js';
import { YEAR_MS } from '../../../utils/time.js';

type ActionedSubmissionCountRow = {
  ds: string;
  num_submissions: number;
};

type ActionedSubmissionTagRow = {
  ds: string;
  tag: string;
  count: number;
};

type ActionedSubmissionPolicyRow = {
  ds: string;
  policy_id: string;
  policy_name: string;
  num_submissions: number;
};

type GroupByResultRow = {
  count: number;
  time: string;
  action_id?: string;
  source?: string;
  item_type_id?: string;
  policy_id?: string;
  rule_id?: string;
};

type CountRow = { count: number; date: string };

type PolicyViolationRow = {
  count: number;
  policy_id: string;
};

type ActionCountRow = {
  count: number;
  action_name: string;
  date: string;
};

export class ClickhouseActionStatisticsAdapter
  implements IActionStatisticsAdapter
{
  constructor(
    private readonly dataWarehouse: IDataWarehouse,
    private readonly tracer: SafeTracer,
  ) {}

  private async query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const result = await this.dataWarehouse.query(sql, this.tracer, params);
    return result as readonly T[];
  }

  private formatDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toTimeDivisionValue(
    division: ActionStatisticsTimeDivisionOptions,
  ): string {
    return division.toLowerCase();
  }

  async getActionedSubmissionCountsByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const rows = await this.query<ActionedSubmissionCountRow>(
      `
        SELECT 
          ds,
          uniqExact(item_submission_id) AS num_submissions
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND ds > ?
          AND item_submission_id IS NOT NULL
        GROUP BY ds
        ORDER BY ds
      `,
      [orgId, this.formatDate(startAt)],
    );

    return rows.map((row) => ({
      date: row.ds,
      count: Number(row.num_submissions),
    }));
  }

  async getActionedSubmissionCountsByTagByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const rows = await this.query<ActionedSubmissionTagRow>(
      `
        SELECT 
          ds,
          arrayJoin(JSONExtractArrayRaw(rule_tags)) AS tag,
          uniqExact(item_submission_id) AS count
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND ds > ?
          AND item_submission_id IS NOT NULL
          AND length(rule_tags) > 2
        GROUP BY ds, tag
        ORDER BY ds
      `,
      [orgId, this.formatDate(startAt)],
    );

    return rows.map((row) => ({
      date: row.ds,
      tag: row.tag.replace(/"/g, ''), // Remove JSON quotes
      count: Number(row.count),
    }));
  }

  async getActionedSubmissionCountsByPolicyByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const rows = await this.query<ActionedSubmissionPolicyRow>(
      `
        SELECT 
          ds,
          JSONExtractString(policy_json, 'id') AS policy_id,
          JSONExtractString(policy_json, 'name') AS policy_name,
          uniqExact(item_submission_id) AS num_submissions
        FROM analytics.ACTION_EXECUTIONS
        ARRAY JOIN JSONExtractArrayRaw(policies) AS policy_json
        WHERE org_id = ?
          AND ds > ?
          AND item_submission_id IS NOT NULL
          AND length(policies) > 2
        GROUP BY ds, policy_id, policy_name
        ORDER BY ds
      `,
      [orgId, this.formatDate(startAt)],
    );

    return rows.map((row) => ({
      date: row.ds,
      count: Number(row.num_submissions),
      policy: { id: row.policy_id, name: row.policy_name },
    }));
  }

  async getActionedSubmissionCountsByActionByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const rows = await this.query<ActionCountRow>(
      `
        SELECT 
          count() AS count,
          action_name,
          ds AS date
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND ds > ?
        GROUP BY action_name, date
        ORDER BY date DESC
      `,
      [orgId, this.formatDate(startAt)],
    );

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
      action: { name: row.action_name },
    }));
  }

  async getActionCountsPerDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const rows = await this.query<CountRow>(
      `
        SELECT 
          count() AS count,
          ds AS date
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND ds > ?
        GROUP BY date
        ORDER BY date DESC
      `,
      [orgId, this.formatDate(startAt)],
    );

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  async getPoliciesSortedByViolationCount(input: {
    filterBy: { startDate: Date; endDate: Date };
    timeZone: string;
    orgId: string;
  }) {
    const { orgId, filterBy, timeZone } = input;

    const rows = await this.query<PolicyViolationRow>(
      `
        SELECT 
          count() AS count,
          JSONExtractString(arrayJoin(JSONExtractArrayRaw(policies)), 'id') AS policy_id
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND toTimeZone(ts, ?) >= ?
          AND toTimeZone(ts, ?) <= ?
          AND length(policies) > 2
        GROUP BY policy_id
        ORDER BY count DESC
      `,
      [
        orgId,
        timeZone,
        this.formatDateTime(filterBy.startDate),
        timeZone,
        this.formatDateTime(filterBy.endDate),
      ],
    );

    return rows.map((row) => ({
      count: Number(row.count),
      policy_id: row.policy_id,
    }));
  }

  async getAllActionCountsGroupByPolicy(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const rows = await this.query<GroupByResultRow>(
      `
        SELECT 
          count() AS count,
          JSONExtractString(arrayJoin(JSONExtractArrayRaw(policies)), 'id') AS policy_id,
          toString(toUnixTimestamp(date_trunc(?, toTimeZone(ts, ?))) * 1000) AS time
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND toTimeZone(ts, ?) >= ?
          AND toTimeZone(ts, ?) <= ?
          AND length(policies) > 2
        GROUP BY policy_id, time
        ORDER BY time
      `,
      [
        this.toTimeDivisionValue(timeDivision),
        timeZone,
        orgId,
        timeZone,
        this.formatDateTime(filterBy.startDate),
        timeZone,
        this.formatDateTime(filterBy.endDate),
      ],
    );

    return rows.map((row) => ({
      count: Number(row.count),
      policy_id: row.policy_id ?? '',
      time: row.time,
    }));
  }

  async getAllActionCountsGroupByActionId(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const rows = await this.query<GroupByResultRow>(
      `
        SELECT 
          count() AS count,
          action_id,
          toString(toUnixTimestamp(date_trunc(?, toTimeZone(ts, ?))) * 1000) AS time
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND toTimeZone(ts, ?) >= ?
          AND toTimeZone(ts, ?) <= ?
        GROUP BY action_id, time
        ORDER BY time
      `,
      [
        this.toTimeDivisionValue(timeDivision),
        timeZone,
        orgId,
        timeZone,
        this.formatDateTime(filterBy.startDate),
        timeZone,
        this.formatDateTime(filterBy.endDate),
      ],
    );

    return rows.map((row) => ({
      count: Number(row.count),
      action_id: row.action_id ?? '',
      time: row.time,
    }));
  }

  async getAllActionCountsGroupBySource(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const rows = await this.query<GroupByResultRow>(
      `
        SELECT 
          count() AS count,
          multiIf(
            action_source IN ('post-items', 'post-content'),
            'automated-rule',
            action_source
          ) AS source,
          toString(toUnixTimestamp(date_trunc(?, toTimeZone(ts, ?))) * 1000) AS time
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND toTimeZone(ts, ?) >= ?
          AND toTimeZone(ts, ?) <= ?
        GROUP BY source, time
        ORDER BY time
      `,
      [
        this.toTimeDivisionValue(timeDivision),
        timeZone,
        orgId,
        timeZone,
        this.formatDateTime(filterBy.startDate),
        timeZone,
        this.formatDateTime(filterBy.endDate),
      ],
    );

    return rows.map((row) => ({
      count: Number(row.count),
      source: row.source ?? '',
      time: row.time,
    }));
  }

  async getAllActionCountsGroupByItemTypeId(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const rows = await this.query<GroupByResultRow>(
      `
        SELECT 
          count() AS count,
          item_type_id,
          toString(toUnixTimestamp(date_trunc(?, toTimeZone(ts, ?))) * 1000) AS time
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND toTimeZone(ts, ?) >= ?
          AND toTimeZone(ts, ?) <= ?
          AND item_type_id IS NOT NULL
        GROUP BY item_type_id, time
        ORDER BY time
      `,
      [
        this.toTimeDivisionValue(timeDivision),
        timeZone,
        orgId,
        timeZone,
        this.formatDateTime(filterBy.startDate),
        timeZone,
        this.formatDateTime(filterBy.endDate),
      ],
    );

    return rows.map((row) => ({
      count: Number(row.count),
      item_type_id: row.item_type_id ?? '',
      time: row.time,
    }));
  }

  async getAllActionCountsGroupByRule(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const rows = await this.query<GroupByResultRow>(
      `
        SELECT 
          count() AS count,
          JSONExtractString(arrayJoin(JSONExtractArrayRaw(rules)), 'id') AS rule_id,
          toString(toUnixTimestamp(date_trunc(?, toTimeZone(ts, ?))) * 1000) AS time
        FROM analytics.ACTION_EXECUTIONS
        WHERE org_id = ?
          AND toTimeZone(ts, ?) >= ?
          AND toTimeZone(ts, ?) <= ?
          AND length(rules) > 2
        GROUP BY rule_id, time
        ORDER BY time
      `,
      [
        this.toTimeDivisionValue(timeDivision),
        timeZone,
        orgId,
        timeZone,
        this.formatDateTime(filterBy.startDate),
        timeZone,
        this.formatDateTime(filterBy.endDate),
      ],
    );

    return rows.map((row) => ({
      count: Number(row.count),
      rule_id: row.rule_id ?? '',
      time: row.time,
    }));
  }

  async getAllActionCountsGroupBy(input: ActionCountsInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;

    if (groupBy === 'POLICY_ID' || groupBy === 'RULE_ID') {
      throw new Error('Cannot group by policy id on this table');
    }

    const filters: string[] = [
      'org_id = ?',
      'toTimeZone(ts, ?) >= ?',
      'toTimeZone(ts, ?) <= ?',
    ];
    const params: unknown[] = [
      orgId,
      timeZone,
      this.formatDateTime(filterBy.startDate),
      timeZone,
      this.formatDateTime(filterBy.endDate),
    ];

    if (filterBy.actionIds.length > 0) {
      filters.push(`action_id IN (${filterBy.actionIds.map(() => '?').join(', ')})`);
      params.push(...filterBy.actionIds);
    }

    if (filterBy.itemTypeIds.length > 0) {
      filters.push(`item_type_id IN (${filterBy.itemTypeIds.map(() => '?').join(', ')})`);
      params.push(...filterBy.itemTypeIds);
    }

    if (filterBy.sources.length > 0) {
      const sources = filterBy.sources.flatMap((it) =>
        it === 'automated-rule' ? ['post-items', 'post-content'] : it,
      );
      filters.push(`action_source IN (${sources.map(() => '?').join(', ')})`);
      params.push(...sources);
    }

    const selectColumn =
      groupBy === 'ACTION_SOURCE'
        ? `multiIf(action_source IN ('post-items','post-content'), 'automated-rule', action_source) AS action_source`
        : `${groupBy} AS ${groupBy.toLowerCase()}`;

    const groupByColumn = groupBy === 'ACTION_SOURCE' ? 'action_source' : groupBy;

    const rows = await this.query<GroupByResultRow>(
      `
        SELECT 
          count() AS count,
          ${selectColumn},
          date_trunc(?, toTimeZone(ts, ?)) AS time
        FROM analytics.ACTION_EXECUTIONS
        WHERE ${filters.join(' AND ')}
        GROUP BY ${groupByColumn}, time
        ORDER BY time
      `,
      [
        this.toTimeDivisionValue(timeDivision),
        timeZone,
        ...params,
      ],
    );

    return rows.map((row) => ({
      count: Number(row.count),
      action_id: row.action_id,
      source: row.source,
      item_type_id: row.item_type_id,
      time: row.time,
    }));
  }
}

