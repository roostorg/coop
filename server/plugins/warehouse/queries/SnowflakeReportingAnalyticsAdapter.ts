import { sql, type Kysely } from 'kysely';

import {
  type IReportingAnalyticsAdapter,
  type ReportingRulePassRateInput,
  type ReportingRulePassRateRow,
  type ReportingRulePassingContentSample,
  type ReportingRulePassingContentSampleInput,
  type ReportsByDayRow,
} from './IReportingAnalyticsAdapter.js';
import {
  sfDateToDate,
  sfDateToDateOnlyString,
  type SfDate,
} from '../../../snowflake/types.js';
import { getUtcDateOnlyString } from '../../../utils/time.js';
import { type ReportingServiceSnowflakeSchema } from '../../../services/reportingService/index.js';

export class SnowflakeReportingAnalyticsAdapter
  implements IReportingAnalyticsAdapter
{
  constructor(
    private readonly kysely: Kysely<ReportingServiceSnowflakeSchema>,
  ) {}

  async getTotalIngestedReportsByDay(
    orgId: string,
  ): Promise<ReadonlyArray<ReportsByDayRow>> {
    const results = await this.kysely
      .selectFrom('REPORTING_SERVICE.REPORTS')
      .select([
        sql<SfDate>`DATE(REPORTED_AT)`.as('date'),
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('ORG_ID', '=', orgId)
      .groupBy(sql<Date>`DATE(REPORTED_AT)`)
      .execute();

    return results.map((result) => ({
      ...result,
      date: sfDateToDateOnlyString(result.date),
    }));
  }

  async getReportingRulePassRateData(
    input: ReportingRulePassRateInput,
  ): Promise<ReadonlyArray<ReportingRulePassRateRow>> {
    const { orgId, ruleId, startDate } = input;

    const results = await this.kysely
      .selectFrom('REPORTING_SERVICE.REPORTING_RULE_EXECUTION_STATISTICS')
      .select((eb) => [
        eb.fn.sum<number>('NUM_PASSES').as('totalMatches'),
        eb.fn.sum<number>('NUM_RUNS').as('totalRequests'),
        eb.fn<SfDate>('date', ['TS_START_INCLUSIVE']).as('date'),
      ])
      .where('ORG_ID', '=', orgId)
      .where('RULE_ID', '=', ruleId)
      .where(({ fn, eb }) =>
        eb(
          fn('date', ['TS_START_INCLUSIVE']),
          '>',
          getUtcDateOnlyString(startDate),
        ),
      )
      .groupBy('date')
      .execute();

    return results.map((result) => ({
      totalMatches: result.totalMatches,
      totalRequests: result.totalRequests,
      date: (result.date as Date).toJSON(),
    }));
  }

  async getReportingRulePassingContentSamples(
    input: ReportingRulePassingContentSampleInput,
  ): Promise<ReadonlyArray<ReportingRulePassingContentSample>> {
    const { orgId, ruleId, itemIds, numSamples, filter } = input;

    const baseQuery = this.kysely
      .selectFrom('REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS')
      .select((eb) => [
        eb.ref('DS').as('date'),
        eb.ref('TS').as('ts'),
        eb.ref('ITEM_ID').as('itemId'),
        eb.ref('ITEM_TYPE_NAME').as('itemTypeName'),
        eb.ref('ITEM_TYPE_ID').as('itemTypeId'),
        eb.ref('ITEM_CREATOR_ID').as('creatorId'),
        eb.ref('ITEM_CREATOR_TYPE_ID').as('creatorTypeId'),
        eb.ref('ITEM_DATA').as('itemData'),
        eb.ref('RESULT').as('result'),
        eb.ref('RULE_ENVIRONMENT').as('environment'),
        eb.ref('RULE_ID').as('ruleId'),
        eb.ref('RULE_NAME').as('ruleName'),
        eb.ref('PASSED').as('passed'),
        eb.ref('POLICY_IDS').as('policyIds'),
      ])
      .where('RULE_ID', '=', ruleId)
      .where('ORG_ID', '=', orgId)
      .where('PASSED', '=', true)
      .where('ITEM_DATA', 'is not', null)
      .$if(itemIds != null && itemIds.length > 0, (qb) =>
        qb.where('ITEM_ID', 'in', itemIds!),
      )
      .limit(numSamples);

    const finalQuery =
      filter.type === 'latestVersion'
        ? baseQuery
            .where('RULE_VERSION', '>=', filter.minVersion.substring(0, 23))
            .where('DS', '>=', getUtcDateOnlyString(filter.minDate))
            .orderBy('TS', 'desc')
        : baseQuery
            .where('RULE_VERSION', '>=', filter.fromVersion)
            .where('RULE_VERSION', '<', filter.toVersion)
            .where('DS', '>=', getUtcDateOnlyString(filter.fromDate))
            .where('DS', '<=', getUtcDateOnlyString(filter.toDate));

    const rows = await finalQuery.execute();

    return rows.map((row) => ({
      date: sfDateToDate(row.date),
      ts: sfDateToDate(row.ts),
      itemId: row.itemId,
      itemTypeName: row.itemTypeName,
      itemTypeId: row.itemTypeId,
      creatorId: row.creatorId,
      creatorTypeId: row.creatorTypeId,
      itemData: row.itemData,
      result: row.result,
      environment: row.environment,
      ruleId: row.ruleId,
      ruleName: row.ruleName,
      passed: Boolean(row.passed),
      policyIds: row.policyIds,
    }));
  }

  async getNumTimesReported(
    orgId: string,
    itemId: string,
  ): Promise<number | null> {
    const result = await this.kysely
      .selectFrom('REPORTING_SERVICE.REPORTS')
      .select([sql<number>`COUNT(*)`.as('count')])
      .where('ORG_ID', '=', orgId)
      .where('REPORTED_ITEM_ID', '=', itemId)
      .executeTakeFirst();

    return result?.count ?? null;
  }
}

