import _ from 'lodash';
import { sql, type Kysely } from 'kysely';

import {
  type ActionCountsInput,
  type IActionStatisticsAdapter,
} from './IActionStatisticsAdapter.js';
import {
  sfDateToDateOnlyString,
  type FilterableSfDate,
} from '../../../snowflake/types.js';
import {
  getUtcDateOnlyString,
  YEAR_MS,
} from '../../../utils/time.js';

const { omit } = _;

type ActionStatisticsServiceSchema = {
  'ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS': {
    DS: unknown;
    ORG_ID: string;
    NUM_SUBMISSIONS: number;
  };
  'ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_POLICY': {
    DS: unknown;
    ORG_ID: string;
    NUM_SUBMISSIONS: number;
    POLICY_ID: string;
    POLICY_NAME: string;
  };
  'ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_TAG': {
    DS: unknown;
    ORG_ID: string;
    NUM_SUBMISSIONS: number;
    TAG: string;
  };
  'ACTION_STATISTICS_SERVICE.BY_RULE': {
    ORG_ID: string;
    ITEM_ID: string;
    ITEM_TYPE_ID: string;
    RULE_ID: string;
    ACTION_TIME: Date;
  };
  'ACTION_STATISTICS_SERVICE.BY_POLICY': {
    ORG_ID: string;
    ITEM_ID: string;
    ITEM_TYPE_ID: string;
    POLICY_ID: string;
    ACTION_TIME: Date;
  };
  'ACTION_STATISTICS_SERVICE.BY_ACTION': {
    ORG_ID: string;
    ITEM_ID: string;
    ITEM_TYPE_ID: string;
    ACTION_ID: string;
    ACTION_TIME: Date;
  };
  'ACTION_STATISTICS_SERVICE.BY_ITEM_TYPE': {
    ORG_ID: string;
    ITEM_ID: string;
    ITEM_TYPE_ID: string;
    ACTION_TIME: Date;
  };
  'ACTION_STATISTICS_SERVICE.BY_SOURCE': {
    ORG_ID: string;
    ITEM_ID: string;
    ITEM_TYPE_ID: string;
    SOURCE: string;
    ACTION_TIME: Date;
  };
};

type SnowflakePublicSchema = {
  ACTION_EXECUTIONS: {
    ORG_ID: string;
    ACTION_ID: string;
    ACTION_NAME: string;
    ACTION_SOURCE: string;
    ITEM_TYPE_ID: string;
    TS: Date;
    DS: string;
  };
};

export class SnowflakeActionStatisticsAdapter
  implements IActionStatisticsAdapter
{
  constructor(
    private readonly kysely: Kysely<
      ActionStatisticsServiceSchema &
        Pick<SnowflakePublicSchema, 'ACTION_EXECUTIONS'>
    >,
  ) {}

  async getActionedSubmissionCountsByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const results = await this.kysely
      .selectFrom('ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS')
      .select(['DS', 'NUM_SUBMISSIONS'])
      .where('DS', '>', getUtcDateOnlyString(startAt))
      .where('ORG_ID', '=', orgId)
      .execute();

    return results.map((result) => ({
      date: sfDateToDateOnlyString(result.DS as FilterableSfDate),
      count: result.NUM_SUBMISSIONS,
    }));
  }

  async getActionedSubmissionCountsByTagByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const results = await this.kysely
      .selectFrom('ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_TAG')
      .select(['DS', 'TAG as tag', 'NUM_SUBMISSIONS as count'])
      .where('DS', '>', getUtcDateOnlyString(startAt))
      .where('ORG_ID', '=', orgId)
      .execute();

    return results.map((result) => ({
      ...omit(result, 'DS'),
      date: sfDateToDateOnlyString(result.DS as FilterableSfDate),
    }));
  }

  async getActionedSubmissionCountsByPolicyByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const results = await this.kysely
      .selectFrom(
        'ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_POLICY',
      )
      .select(['DS', 'POLICY_ID', 'POLICY_NAME', 'NUM_SUBMISSIONS'])
      .where('DS', '>', getUtcDateOnlyString(startAt))
      .where('ORG_ID', '=', orgId)
      .execute();

    return results.map((result) => ({
      date: sfDateToDateOnlyString(result.DS as FilterableSfDate),
      count: result.NUM_SUBMISSIONS,
      policy: { id: result.POLICY_ID, name: result.POLICY_NAME },
    }));
  }

  async getActionedSubmissionCountsByActionByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const results = await this.kysely
      .selectFrom('ACTION_EXECUTIONS')
      .select([sql`COUNT(*)`.as('count'), 'ACTION_NAME', 'DS'])
      .where('DS', '>', getUtcDateOnlyString(startAt))
      .where('ORG_ID', '=', orgId)
      .groupBy(['ACTION_NAME', 'DS'])
      .orderBy('DS', 'desc')
      .execute();

    return results.map((result) => ({
      date: sfDateToDateOnlyString(result.DS as FilterableSfDate),
      count: result.count as number,
      action: { name: result.ACTION_NAME },
    }));
  }

  async getActionCountsPerDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    const results = await this.kysely
      .selectFrom('ACTION_EXECUTIONS')
      .select([sql`COUNT(*)`.as('count'), 'DS'])
      .where('DS', '>', getUtcDateOnlyString(startAt))
      .where('ORG_ID', '=', orgId)
      .groupBy(['DS'])
      .orderBy('DS', 'desc')
      .execute();

    return results.map((result) => ({
      date: sfDateToDateOnlyString(result.DS as FilterableSfDate),
      count: result.count as number,
    }));
  }

  async getPoliciesSortedByViolationCount(input: {
    filterBy: { startDate: Date; endDate: Date };
    timeZone: string;
    orgId: string;
  }) {
    const { orgId, filterBy, timeZone } = input;

    const results = await this.kysely
      .selectFrom(`ACTION_STATISTICS_SERVICE.BY_POLICY`)
      .select([sql<number>`COUNT(*)`.as('count')])
      .select(['POLICY_ID'])
      .where('ORG_ID', '=', orgId)
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '>=',
        filterBy.startDate,
      )
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '<=',
        filterBy.endDate,
      )
      .groupBy(['POLICY_ID'])
      .orderBy('count', 'desc')
      .execute();

    return results.map((result) => ({
      count: result.count,
      policy_id: result.POLICY_ID,
    }));
  }

  async getAllActionCountsGroupByPolicy(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const results = await this.kysely
      .selectFrom(`ACTION_STATISTICS_SERVICE.BY_POLICY`)
      .select([sql<number>`COUNT(*)`.as('count')])
      .select([
        sql<string>`DATE_TRUNC(${timeDivision}, CONVERT_TIMEZONE(${timeZone}, action_time))`.as(
          'time',
        ),
        'POLICY_ID',
      ])
      .where('ORG_ID', '=', orgId)
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '>=',
        filterBy.startDate,
      )
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '<=',
        filterBy.endDate,
      )
      .groupBy(['POLICY_ID', 'time'])
      .execute();

    return results.map((result) => ({
      count: result.count,
      policy_id: result.POLICY_ID,
      time: result.time,
    }));
  }

  async getAllActionCountsGroupByActionId(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const results = await this.kysely
      .selectFrom(`ACTION_STATISTICS_SERVICE.BY_ACTION`)
      .select([sql<number>`COUNT(*)`.as('count')])
      .select([
        sql<string>`DATE_TRUNC(${timeDivision}, CONVERT_TIMEZONE(${timeZone}, action_time))`.as(
          'time',
        ),
        'ACTION_ID',
      ])
      .where('ORG_ID', '=', orgId)
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '>=',
        filterBy.startDate,
      )
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '<=',
        filterBy.endDate,
      )
      .groupBy(['ACTION_ID', 'time'])
      .execute();

    return results.map((result) => ({
      count: result.count,
      action_id: result.ACTION_ID,
      time: result.time,
    }));
  }

  async getAllActionCountsGroupBySource(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const results = await this.kysely
      .selectFrom(`ACTION_STATISTICS_SERVICE.BY_SOURCE`)
      .select([sql<number>`COUNT(*)`.as('count')])
      .select([
        sql<string>`DATE_TRUNC(${timeDivision}, CONVERT_TIMEZONE(${timeZone}, action_time))`.as(
          'time',
        ),
      ])
      .select((qb) =>
        qb
          .case()
          .when('SOURCE', 'in', ['post-items', 'post-content'])
          .then('automated-rule')
          .else(qb.ref('SOURCE'))
          .end()
          .as('SOURCE'),
      )
      .where('ORG_ID', '=', orgId)
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '>=',
        filterBy.startDate,
      )
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '<=',
        filterBy.endDate,
      )
      .groupBy(['SOURCE', 'time'])
      .execute();

    return results.map((result) => ({
      count: result.count,
      source: result.SOURCE,
      time: result.time,
    }));
  }

  async getAllActionCountsGroupByItemTypeId(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const results = await this.kysely
      .selectFrom(`ACTION_STATISTICS_SERVICE.BY_ITEM_TYPE`)
      .select([sql<number>`COUNT(*)`.as('count')])
      .select([
        sql<string>`DATE_TRUNC(${timeDivision}, CONVERT_TIMEZONE(${timeZone}, action_time))`.as(
          'time',
        ),
        'ITEM_TYPE_ID',
      ])
      .where('ORG_ID', '=', orgId)
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '>=',
        filterBy.startDate,
      )
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '<=',
        filterBy.endDate,
      )
      .groupBy(['ITEM_TYPE_ID', 'time'])
      .execute();

    return results.map((result) => ({
      count: result.count,
      item_type_id: result.ITEM_TYPE_ID,
      time: result.time,
    }));
  }

  async getAllActionCountsGroupByRule(input: ActionCountsInput) {
    const { orgId, filterBy, timeZone, timeDivision } = input;

    const results = await this.kysely
      .selectFrom(`ACTION_STATISTICS_SERVICE.BY_RULE`)
      .select([sql<number>`COUNT(*)`.as('count')])
      .select([
        sql<string>`DATE_TRUNC(${timeDivision}, CONVERT_TIMEZONE(${timeZone}, action_time))`.as(
          'time',
        ),
        'RULE_ID',
      ])
      .where('ORG_ID', '=', orgId)
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '>=',
        filterBy.startDate,
      )
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, ACTION_TIME)`,
        '<=',
        filterBy.endDate,
      )
      .groupBy(['RULE_ID', 'time'])
      .execute();

    return results.map((result) => ({
      count: result.count,
      rule_id: result.RULE_ID,
      time: result.time,
    }));
  }

  async getAllActionCountsGroupBy(input: ActionCountsInput) {
    const { orgId, groupBy, filterBy, timeDivision, timeZone } = input;

    if (groupBy === 'POLICY_ID') {
      throw new Error('Cannot group by policy id on this table');
    }
    if (groupBy === 'RULE_ID') {
      throw new Error('Cannot group by policy id on this table');
    }

    const results = await this.kysely
      .selectFrom(`ACTION_EXECUTIONS`)
      .select([sql<number>`COUNT(*)`.as('count'), groupBy])
      .select([
        sql<string>`DATE_TRUNC(${timeDivision}, CONVERT_TIMEZONE(${timeZone}, TS))`.as(
          'time',
        ),
      ])
      .$if(groupBy.includes('ACTION_SOURCE'), (qb) =>
        qb.select((qb) =>
          qb
            .case()
            .when('ACTION_SOURCE', 'in', ['post-items', 'post-content'])
            .then('automated-rule')
            .else(qb.ref('ACTION_SOURCE'))
            .end()
            .as('source'),
        ),
      )
      .where('ORG_ID', '=', orgId)
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, TS)`,
        '>=',
        filterBy.startDate,
      )
      .where(
        sql<Date>`CONVERT_TIMEZONE(${timeZone}, TS)`,
        '<=',
        filterBy.endDate,
      )
      .$if(filterBy.actionIds.length > 0, (qb) =>
        qb.where('ACTION_ID', 'in', filterBy.actionIds),
      )
      .$if(filterBy.itemTypeIds.length > 0, (qb) =>
        qb.where('ITEM_TYPE_ID', 'in', filterBy.itemTypeIds),
      )
      .$if(filterBy.sources.length > 0, (qb) =>
        qb.where(
          'ACTION_SOURCE',
          'in',
          filterBy.sources.flatMap((it) =>
            it === 'automated-rule' ? ['post-items', 'post-content'] : it,
          ),
        ),
      )
      .groupBy([groupBy, 'time'])
      .execute();

    return results.map((result) => ({
      count: result.count,
      action_id: result.ACTION_ID,
      source: result.source,
      item_type_id: result.ITEM_TYPE_ID,
      time: result.time,
    }));
  }
}

