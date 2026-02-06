import { type ItemIdentifier } from '@roostorg/types';
import { sql, type Kysely } from 'kysely';
import _ from 'lodash';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { getUtcDateOnlyString, WEEK_MS } from '../../utils/time.js';
import {
  sfDateToDate,
  sfDateToDateOnlyString,
  type SnowflakePublicSchema,
} from '../../snowflake/types.js';

/** ClickHouse uses lowercase column names; Snowflake uses uppercase. */
const CLICKHOUSE_RULE_EXECUTIONS_COLUMNS = [
  'ds',
  'ts',
  'item_type_name',
  'item_type_id',
  'item_id',
  'item_data',
  'result',
  'environment',
  'passed',
  'rule_id',
  'rule',
  'policy_names',
  'tags',
] as const;

/** Snowflake uses uppercase column names. */
const SNOWFLAKE_RULE_EXECUTIONS_COLUMNS = [
  'DS',
  'TS',
  'ITEM_TYPE_NAME',
  'ITEM_TYPE_ID',
  'ITEM_ID',
  'ITEM_DATA',
  'RESULT',
  'ENVIRONMENT',
  'PASSED',
  'RULE_ID',
  'RULE',
  'POLICY_NAMES',
  'TAGS',
] as const;

class UserHistoryQueries {
  constructor(
    private readonly dialect: Dependencies['DataWarehouseDialect'],
    private readonly warehouse: Dependencies['DataWarehouse'],
  ) {}

  private get kysely(): Kysely<SnowflakePublicSchema> {
    return this.dialect.getKyselyInstance();
  }

  private isClickhouseProvider(): boolean {
    return this.warehouse.getProvider().toLowerCase() === 'clickhouse';
  }

  async getUserRuleExecutionsHistory(
    orgId: string,
    userItemIdentifier: ItemIdentifier,
  ) {
    const lowercaseUserId = userItemIdentifier.id.toLowerCase();

    if (this.isClickhouseProvider()) {
      return this.getUserRuleExecutionsHistoryClickhouse(
        orgId,
        userItemIdentifier,
        lowercaseUserId,
      );
    }

    return this.getUserRuleExecutionsHistorySnowflake(
      orgId,
      userItemIdentifier,
      lowercaseUserId,
    );
  }

  private async getUserRuleExecutionsHistoryClickhouse(
    orgId: string,
    userItemIdentifier: ItemIdentifier,
    lowercaseUserId: string,
  ) {
    // ClickHouse uses lowercase column names; cast to escape Snowflake schema typing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kyselyAny = this.kysely as unknown as Kysely<Record<string, any>>;
    const makeQuery = (startDate: Date, endDate: Date) => {
      const startDateString = getUtcDateOnlyString(startDate);
      const endDateString = getUtcDateOnlyString(endDate);
      return kyselyAny
        .selectFrom('RULE_EXECUTIONS')
        .select([...CLICKHOUSE_RULE_EXECUTIONS_COLUMNS])
        .where('org_id', '=', orgId)
        .where('passed', '=', true)
        .where(({ ref, fn, eb, and }) =>
          and([
            eb('item_creator_type_id', '=', userItemIdentifier.typeId),
            eb(fn('LOWER', ['item_creator_id']), '=', lowercaseUserId),
            sql`${ref('ds')} BETWEEN ${startDateString} AND ${endDateString}`,
          ]),
        )
        .orderBy('environment', 'desc')
        .orderBy('passed', 'desc')
        .orderBy('ts', 'desc');
    };
    const now = Date.now();
    const dateRanges = Array.from(Array(6), (_, i) => [
      new Date(now - (i + 1) * WEEK_MS * 2),
      new Date(now - i * WEEK_MS * 2),
    ]);
    const results = await Promise.all(
      dateRanges.map(async ([startDate, endDate]) =>
        makeQuery(startDate, endDate).execute(),
      ),
    );
    const rows = results.flat() as Array<Record<string, unknown>>;
    return rows.map((result) => ({
      date: sfDateToDateOnlyString(
        result.ds as Parameters<typeof sfDateToDateOnlyString>[0],
      ),
      ts: sfDateToDate(
        result.ts as Parameters<typeof sfDateToDate>[0],
      ),
      itemTypeName: result.item_type_name as string,
      itemTypeId: result.item_type_id as string,
      contentId: result.item_id as string,
      content: result.item_data,
      result: result.result ?? null,
      environment: result.environment as string,
      passed: result.passed as boolean,
      ruleId: result.rule_id as string,
      ruleName: result.rule as string,
      policies: (result.policy_names ?? []) as string[],
      tags: (result.tags ?? []) as string[],
    }));
  }

  private async getUserRuleExecutionsHistorySnowflake(
    orgId: string,
    userItemIdentifier: ItemIdentifier,
    lowercaseUserId: string,
  ) {
    const makeQuery = (startDate: Date, endDate: Date) => {
      const startDateString = getUtcDateOnlyString(startDate);
      const endDateString = getUtcDateOnlyString(endDate);
      return this.kysely
        .selectFrom('RULE_EXECUTIONS')
        .select([...SNOWFLAKE_RULE_EXECUTIONS_COLUMNS])
        .where('ORG_ID', '=', orgId)
        .where('PASSED', '=', true)
        .where(({ ref, fn, eb, and }) =>
          and([
            eb('ITEM_CREATOR_TYPE_ID', '=', userItemIdentifier.typeId),
            eb(fn('LOWER', ['ITEM_CREATOR_ID']), '=', lowercaseUserId),
            sql`${ref('DS')} BETWEEN ${startDateString} AND ${endDateString}`,
          ]),
        )
        .orderBy('ENVIRONMENT', 'desc')
        .orderBy('PASSED', 'desc')
        .orderBy('TS', 'desc');
    };
    const now = Date.now();
    const dateRanges = Array.from(Array(6), (_, i) => [
      new Date(now - (i + 1) * WEEK_MS * 2),
      new Date(now - i * WEEK_MS * 2),
    ]);
    const results = await Promise.all(
      dateRanges.map(async ([startDate, endDate]) =>
        makeQuery(startDate, endDate).execute(),
      ),
    );
    const rows = results.flat();
    return rows.map((result: Record<string, unknown>) => ({
      date: sfDateToDateOnlyString(
        result.DS as Parameters<typeof sfDateToDateOnlyString>[0],
      ),
      ts: sfDateToDate(
        result.TS as Parameters<typeof sfDateToDate>[0],
      ),
      itemTypeName: result.ITEM_TYPE_NAME as string,
      itemTypeId: result.ITEM_TYPE_ID as string,
      contentId: result.ITEM_ID as string,
      content: result.ITEM_DATA ?? null,
      result: result.RESULT ?? null,
      environment: result.ENVIRONMENT as string,
      passed: result.PASSED as boolean,
      ruleId: result.RULE_ID as string,
      ruleName: result.RULE as string,
      policies: (result.POLICY_NAMES ?? []) as string[],
      tags: (result.TAGS ?? []) as string[],
    }));
  }
}

export default inject(
  ['DataWarehouseDialect', 'DataWarehouse'],
  UserHistoryQueries,
);
export { type UserHistoryQueries };
