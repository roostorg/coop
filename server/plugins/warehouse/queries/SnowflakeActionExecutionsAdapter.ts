import { type Kysely } from 'kysely';

import {
  type IActionExecutionsAdapter,
  type ItemActionHistoryInput,
  type ItemActionHistoryRecord,
  type UserStrikeActionRecord,
  type UserStrikeActionsInput,
} from './IActionExecutionsAdapter.js';
import { type SnowflakePublicSchema } from '../../../snowflake/types.js';
import { sfDateToDate } from '../../../snowflake/types.js';
import { getUtcDateOnlyString } from '../../../utils/time.js';
import { RuleEnvironment } from '../../../rule_engine/RuleEngine.js';

interface ActionExecutionsRow {
  TS: Date;
  ITEM_ID: string | null;
  ITEM_TYPE_ID: string | null;
  ITEM_CREATOR_ID: string | null;
  ITEM_CREATOR_TYPE_ID: string | null;
  ACTOR_ID: string | null;
  JOB_ID: string | null;
  POLICIES: Array<{ id: string }> | null;
  RULES: Array<{ id: string }> | null;
  ACTION_ID: string;
  ACTION_SOURCE?: string;
}

export class SnowflakeActionExecutionsAdapter
  implements IActionExecutionsAdapter
{
  constructor(
    private readonly kysely: Kysely<
      Pick<SnowflakePublicSchema, 'ACTION_EXECUTIONS'>
    >,
  ) {}

  async getItemActionHistory(
    input: ItemActionHistoryInput,
  ): Promise<ReadonlyArray<ItemActionHistoryRecord>> {
    const { orgId, itemId, itemTypeId } = input;

    const query = this.kysely
      .selectFrom('ACTION_EXECUTIONS')
      .select([
        'TS',
        'ITEM_ID',
        'ITEM_TYPE_ID',
        'ITEM_CREATOR_ID',
        'ITEM_CREATOR_TYPE_ID',
        'ACTOR_ID',
        'JOB_ID',
        'POLICIES',
        'RULES',
        'ACTION_ID',
      ])
      .where('ORG_ID', '=', orgId)
      .where(({ or, and, eb, fn, val }) =>
        or([
          and([
            eb(fn('LOWER', ['ITEM_CREATOR_ID']), '=', fn('LOWER', [val(itemId)])),
            eb(
              fn('LOWER', ['ITEM_CREATOR_TYPE_ID']),
              '=',
              fn('LOWER', [val(itemTypeId)]),
            ),
          ]),
          and([
            eb(fn('LOWER', ['ITEM_ID']), '=', fn('LOWER', [val(itemId)])),
            eb(
              fn('LOWER', ['ITEM_TYPE_ID']),
              '=',
              fn('LOWER', [val(itemTypeId)]),
            ),
          ]),
        ]),
      )
      .where(({ or, eb }) =>
        or([
          eb('RULE_ENVIRONMENT', 'is', null),
          eb('RULE_ENVIRONMENT', '!=', RuleEnvironment.BACKGROUND),
        ]),
      )
      .orderBy('TS', 'desc');

    const rows = (await query.execute()) as unknown as ActionExecutionsRow[];

    return rows
      .filter((row) => row.ITEM_ID != null && row.ITEM_TYPE_ID != null)
      .map<ItemActionHistoryRecord>((row) => ({
        actionId: row.ACTION_ID,
        itemId: row.ITEM_ID!,
        itemTypeId: row.ITEM_TYPE_ID!,
        actorId: row.ACTOR_ID ?? null,
        jobId: row.JOB_ID ?? null,
        userId: row.ITEM_CREATOR_ID ?? null,
        userTypeId: row.ITEM_CREATOR_TYPE_ID ?? null,
        policies: (row.POLICIES ?? []).map((policy) => policy.id),
        ruleIds: (row.RULES ?? []).map((rule) => rule.id),
        occurredAt: sfDateToDate(row.TS),
      }));
  }

  async getRecentUserStrikeActions(
    input: UserStrikeActionsInput,
  ): Promise<ReadonlyArray<UserStrikeActionRecord>> {
    const { orgId, filterBy, limit } = input;

    const query = this.kysely
      .selectFrom('ACTION_EXECUTIONS')
      .select([
        'TS',
        'ITEM_ID',
        'ITEM_TYPE_ID',
        'ACTION_ID',
        'ACTION_SOURCE',
      ])
      .where('ORG_ID', '=', orgId)
      .where('ACTION_SOURCE', '=', 'user-strike-action-execution')
      .$if(filterBy?.startDate != null, (qb) =>
        qb.where('DS', '>=', getUtcDateOnlyString(filterBy!.startDate)),
      )
      .$if(filterBy?.endDate != null, (qb) =>
        qb.where('DS', '<=', getUtcDateOnlyString(filterBy!.endDate)),
      )
      .orderBy('TS', 'desc')
      .$if(limit != null, (qb) => qb.limit(limit!));

    const rows = (await query.execute()) as unknown as ActionExecutionsRow[];

    return rows
      .filter((row) => row.ITEM_ID != null && row.ITEM_TYPE_ID != null)
      .map<UserStrikeActionRecord>((row) => ({
        actionId: row.ACTION_ID,
        itemId: row.ITEM_ID!,
        itemTypeId: row.ITEM_TYPE_ID!,
        source: row.ACTION_SOURCE ?? 'user-strike-action-execution',
        occurredAt: sfDateToDate(row.TS),
      }));
  }
}

