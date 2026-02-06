import {
  type IReportingAnalyticsAdapter,
  type ReportingRulePassRateInput,
  type ReportingRulePassRateRow,
  type ReportingRulePassingContentSample,
  type ReportingRulePassingContentSampleInput,
  type ReportsByDayRow,
} from './IReportingAnalyticsAdapter.js';
import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import type SafeTracer from '../../../utils/SafeTracer.js';

type ReportsByDayQueryRow = Record<string, unknown> & {
  date: string;
  count: number;
};

type ReportingRulePassRateQueryRow = Record<string, unknown> & {
  totalMatches: number;
  totalRequests: number;
  date: string;
};

type ReportingRuleSampleRow = Record<string, unknown> & {
  date: string;
  ts: string;
  item_id: string;
  item_type_name: string;
  item_type_id: string;
  item_creator_id: string | null;
  item_creator_type_id: string | null;
  item_data: unknown;
  result: unknown;
  rule_environment: string | null;
  rule_id: string;
  rule_name: string;
  passed: number;
  policy_ids: string[];
};

export class ClickhouseReportingAnalyticsAdapter
  implements IReportingAnalyticsAdapter
{
  constructor(
    private readonly warehouse: IDataWarehouse,
    private readonly tracer: SafeTracer,
  ) {}

  async getTotalIngestedReportsByDay(
    orgId: string,
  ): Promise<ReadonlyArray<ReportsByDayRow>> {
    const rows = await this.query<ReportsByDayQueryRow>(
      `
        SELECT 
          toDate(reported_at) AS date,
          count() AS count
        FROM REPORTING_SERVICE.REPORTS
        WHERE org_id = ?
        GROUP BY date
        ORDER BY date
      `,
      [orgId],
    );

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  async getReportingRulePassRateData(
    input: ReportingRulePassRateInput,
  ): Promise<ReadonlyArray<ReportingRulePassRateRow>> {
    const { orgId, ruleId, startDate } = input;

    const rows = await this.query<ReportingRulePassRateQueryRow>(
      `
        SELECT 
          sum(num_passes) AS totalMatches,
          sum(num_runs) AS totalRequests,
          toDate(ts_start_inclusive) AS date
        FROM REPORTING_SERVICE.REPORTING_RULE_EXECUTION_STATISTICS
        WHERE org_id = ?
          AND rule_id = ?
          AND ts_start_inclusive > ?
        GROUP BY date
        ORDER BY date
      `,
      [orgId, ruleId, startDate],
    );

    return rows.map((row) => ({
      totalMatches: Number(row.totalMatches),
      totalRequests: Number(row.totalRequests),
      date: new Date(row.date).toJSON(),
    }));
  }

  async getReportingRulePassingContentSamples(
    input: ReportingRulePassingContentSampleInput,
  ): Promise<ReadonlyArray<ReportingRulePassingContentSample>> {
    const { orgId, ruleId, itemIds, numSamples, filter } = input;

    const conditions: string[] = [
      'org_id = ?',
      'rule_id = ?',
      'passed = 1',
      'item_data IS NOT NULL',
    ];
    const params: unknown[] = [orgId, ruleId];

    if (itemIds && itemIds.length > 0) {
      conditions.push(
        `item_id IN (${itemIds.map(() => '?').join(', ')})`,
      );
      params.push(...itemIds);
    }

    if (filter.type === 'latestVersion') {
      conditions.push('rule_version >= ?');
      conditions.push('ds >= toDate(?)');
      params.push(new Date(filter.minVersion), filter.minDate);
    } else {
      conditions.push('rule_version >= ?');
      conditions.push('rule_version < ?');
      conditions.push('ds >= toDate(?)');
      conditions.push('ds <= toDate(?)');
      params.push(
        new Date(filter.fromVersion),
        new Date(filter.toVersion),
        filter.fromDate,
        filter.toDate,
      );
    }

    const rows = await this.query<ReportingRuleSampleRow>(
      `
        SELECT 
          ds AS date,
          ts,
          item_id,
          item_type_name,
          item_type_id,
          item_creator_id,
          item_creator_type_id,
          item_data,
          result,
          rule_environment,
          rule_id,
          rule_name,
          passed,
          policy_ids
        FROM REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS
        WHERE ${conditions.join(' AND ')}
        ORDER BY ts DESC
        LIMIT ${Number.isFinite(numSamples) ? numSamples : 50}
      `,
      params,
    );

    return rows.map((row) => ({
      date: new Date(`${row.date}T00:00:00.000Z`),
      ts: new Date(row.ts),
      itemId: row.item_id,
      itemTypeName: row.item_type_name,
      itemTypeId: row.item_type_id,
      creatorId: row.item_creator_id,
      creatorTypeId: row.item_creator_type_id,
      itemData: row.item_data,
      result: row.result,
      environment: row.rule_environment,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      passed: row.passed === 1,
      policyIds: row.policy_ids,
    }));
  }

  async getNumTimesReported(
    orgId: string,
    itemId: string,
  ): Promise<number | null> {
    const rows = await this.query<{ count: number }>(
      `
        SELECT 
          count() AS count
        FROM REPORTING_SERVICE.REPORTS
        WHERE org_id = ?
          AND reported_item_id = ?
      `,
      [orgId, itemId],
    );

    const value = rows.at(0)?.count ?? 0;
    return typeof value === 'number' ? value : Number(value);
  }

  private async query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const result = await this.warehouse.query(sql, this.tracer, params);
    return result as readonly T[];
  }
}

