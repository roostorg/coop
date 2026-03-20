import { type ItemIdentifier } from '@roostorg/types';
import { sql, type Kysely } from 'kysely';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { getUtcDateOnlyString, WEEK_MS } from '../../utils/time.js';
import {
  sfDateToDate,
  sfDateToDateOnlyString,
  type DataWarehousePublicSchema,
} from '../../storage/dataWarehouse/warehouseSchema.js';

const RULE_EXECUTIONS_COLUMNS = [
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

class UserHistoryQueries {
  constructor(
    private readonly dialect: Dependencies['DataWarehouseDialect'],
    private readonly warehouse: Dependencies['DataWarehouse'],
  ) {}

  private get kysely(): Kysely<DataWarehousePublicSchema> {
    return this.dialect.getKyselyInstance();
  }

  async getUserRuleExecutionsHistory(
    orgId: string,
    userItemIdentifier: ItemIdentifier,
  ) {
    const lowercaseUserId = userItemIdentifier.id.toLowerCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kyselyAny = this.kysely as unknown as Kysely<Record<string, any>>;
    const makeQuery = (startDate: Date, endDate: Date) => {
      const startDateString = getUtcDateOnlyString(startDate);
      const endDateString = getUtcDateOnlyString(endDate);
      return kyselyAny
        .selectFrom('RULE_EXECUTIONS')
        .select([...RULE_EXECUTIONS_COLUMNS])
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
}

export default inject(
  ['DataWarehouseDialect', 'DataWarehouse'],
  UserHistoryQueries,
);
export { type UserHistoryQueries };
