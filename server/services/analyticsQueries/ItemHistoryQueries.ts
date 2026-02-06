import { type Kysely, sql } from 'kysely';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import { jsonParse } from '../../utils/encoding.js';
import { getUtcDateOnlyString, WEEK_MS } from '../../utils/time.js';
import {
  sfDateToDate,
  sfDateToDateOnlyString,
} from '../../snowflake/types.js';

type ItemHistoryQueryFilter = {
  passed?: boolean;
  environment?: RuleEnvironment;
  startDate?: Date;
  endDate?: Date;
};

class ItemHistoryQueries {
  constructor(private readonly dialect: Dependencies['DataWarehouseDialect']) {}

  private get kysely(): Kysely<any> {
    return this.dialect.getKyselyInstance();
  }

  async getItemRuleExecutionsHistory(opts: {
    itemId: string;
    itemTypeId: string | undefined;
    orgId: string;
    filters?: ItemHistoryQueryFilter;
  }) {
    const { itemId, itemTypeId, orgId, filters } = opts;
    const {
      passed,
      environment,
      startDate = new Date(Date.now() - WEEK_MS),
      endDate = new Date(Date.now()),
    } = filters ?? {};

    const query = this.kysely
      .selectFrom(sql`analytics.RULE_EXECUTIONS`.as('rule_exec'))
      .select([
        'ds',
        'ts',
        'item_type_name as itemTypeName',
        'item_type_id as itemTypeId',
        'item_creator_id as userId',
        'item_creator_type_id as userTypeId',
        'item_data as content',
        'result as result',
        'environment as environment',
        'passed as passed',
        'rule_id as ruleId',
        'rule as ruleName',
        'policy_names as policies',
        'tags as tags',
      ])
      .where('org_id', '=', orgId)
      .where('ds', '>=', getUtcDateOnlyString(startDate))
      .where('result', 'is not', null)
      .where('item_data', 'is not', null)
      .where(({ and, eb, fn, val }) => {
        return and([
          eb(fn('LOWER', ['item_id']), '=', fn('LOWER', [val(itemId)])),
          eb(
            fn('LOWER', ['item_type_id']),
            '=',
            fn('LOWER', [val(itemTypeId)]),
          ),
          eb('ds', '<=', getUtcDateOnlyString(endDate)),
          ...(environment ? [eb('environment', '=', environment)] : []),
          ...(passed != null ? [eb('passed', '=', passed)] : []),
        ]);
      });


    try {
      const results = await query.execute();
      return results.map((it: any) => ({
        itemTypeName: it.itemTypeName,
        itemTypeId: it.itemTypeId,
        userId: it.userId,
        userTypeId: it.userTypeId,
        content: it.content,
        result: jsonParse(it.result),
        environment: it.environment,
        passed: it.passed,
        ruleId: it.ruleId,
        ruleName: it.ruleName,
        policies: it.policies,
        tags: it.tags,
        date: sfDateToDateOnlyString(it.ds),
        ts: sfDateToDate(it.ts),
        contentId: itemId,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('ItemHistoryQueries: getItemRuleExecutionsHistory failed:', (error as Error).message);
      throw error;
    }
  }
}

export default inject(['DataWarehouseDialect'], ItemHistoryQueries);
export { type ItemHistoryQueries };
