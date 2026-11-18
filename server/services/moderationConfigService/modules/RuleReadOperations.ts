import { Brackets, type SelectQueryBuilder } from 'typeorm';

import { managerOf, type TypeormDb } from '../../../storage/typeorm/db.js';
import {
  Rules,
  RulesAndItemTypes,
  RulesLatestVersionsView,
} from '../../../storage/typeorm/entities/index.js';
import { getUtcDateOnlyString } from '../../../utils/time.js';
import {
  RuleStatus,
  RuleType,
  type ConditionSet,
  type RuleAlarmStatus,
} from '../index.js';
import {
  computeRuleStatusFromRow,
  type PlainRuleWithLatestVersion,
} from '../types/rules.js';

// [column, alias] pairs; aliases are quoted, so camelCase survives.
const ruleSelect = [
  ['r.id', 'id'],
  ['r.name', 'name'],
  ['r.description', 'description'],
  ['r.status_if_unexpired', 'statusIfUnexpired'],
  ['r.tags', 'tags'],
  ['r.max_daily_actions', 'maxDailyActions'],
  ['r.daily_actions_run', 'dailyActionsRun'],
  ['r.last_action_date', 'lastActionDate'],
  ['r.created_at', 'createdAt'],
  ['r.updated_at', 'updatedAt'],
  ['r.org_id', 'orgId'],
  ['r.creator_id', 'creatorId'],
  ['r.expiration_time', 'expirationTime'],
  ['r.condition_set', 'conditionSet'],
  ['r.alarm_status', 'alarmStatus'],
  ['r.alarm_status_set_at', 'alarmStatusSetAt'],
  ['r.rule_type', 'ruleType'],
  ['r.parent_id', 'parentId'],
  ['rlv.version', 'latestVersionString'],
] as const;

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  statusIfUnexpired: Exclude<RuleStatus, typeof RuleStatus.EXPIRED>;
  tags: string[];
  maxDailyActions: number | null;
  dailyActionsRun: number;
  lastActionDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  orgId: string;
  creatorId: string;
  expirationTime: Date | null;
  conditionSet: ConditionSet;
  // Raw rows carry the Postgres enum as a plain string; cast in rowToPlainRuleWithLatest.
  alarmStatus: string;
  alarmStatusSetAt: Date;
  ruleType: RuleType;
  parentId: string | null;
  latestVersionString: string | null;
};

// Rules with the latest version string, as `RuleRow`s via getRawMany.
function selectRules(qb: SelectQueryBuilder<Rules>) {
  const [[firstColumn, firstAlias], ...rest] = ruleSelect;
  let query = qb
    .leftJoin(RulesLatestVersionsView, 'rlv', 'rlv.rule_id = r.id')
    .select(firstColumn, firstAlias);
  for (const [column, alias] of rest) {
    query = query.addSelect(column, alias);
  }
  return query;
}

function whereEnabled(qb: SelectQueryBuilder<Rules>, today: string) {
  return qb
    .andWhere('(r.expiration_time IS NULL OR r.expiration_time > now())')
    .andWhere('r.status_if_unexpired IN (:...enabledStatuses)', {
      enabledStatuses: [RuleStatus.LIVE, RuleStatus.BACKGROUND],
    })
    .andWhere(
      new Brackets((b) =>
        b
          .where('r.max_daily_actions IS NULL')
          .orWhere('r.last_action_date IS DISTINCT FROM CAST(:today AS date)', {
            today,
          })
          .orWhere('r.daily_actions_run < r.max_daily_actions'),
      ),
    );
}

function rowToPlainRuleWithLatest(row: RuleRow): PlainRuleWithLatestVersion {
  const status = computeRuleStatusFromRow(
    row.expirationTime,
    row.statusIfUnexpired,
  );
  const version = row.latestVersionString ?? '';
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    statusIfUnexpired: row.statusIfUnexpired,
    status,
    tags: row.tags,
    maxDailyActions: row.maxDailyActions,
    dailyActionsRun: row.dailyActionsRun,
    lastActionDate: row.lastActionDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orgId: row.orgId,
    creatorId: row.creatorId,
    expirationTime: row.expirationTime,
    conditionSet: row.conditionSet,
    alarmStatus: row.alarmStatus as RuleAlarmStatus,
    alarmStatusSetAt: row.alarmStatusSetAt,
    ruleType: row.ruleType,
    parentId: row.parentId,
    latestVersion: { ruleId: row.id, version },
  };
}

export default class RuleReadOperations {
  constructor(
    private readonly pgQuery: TypeormDb,
    private readonly pgQueryReplica: TypeormDb,
  ) {}

  async #rules(readFromReplica: boolean) {
    const manager = await managerOf(
      readFromReplica ? this.pgQueryReplica : this.pgQuery,
    );
    return selectRules(manager.createQueryBuilder(Rules, 'r'));
  }

  async getEnabledRulesForItemType(itemTypeId: string) {
    const today = String(getUtcDateOnlyString());
    const query = (await this.#rules(true))
      .innerJoin(RulesAndItemTypes, 'rit', 'rit.rule_id = r.id')
      .where('rit.item_type_id = :itemTypeId', { itemTypeId });
    const rows = await whereEnabled(query, today).getRawMany<RuleRow>();
    return rows.map(rowToPlainRuleWithLatest);
  }

  /**
   * Loads a single rule (with latest version row) scoped to an org.
   * Used for GraphQL rule parents and permission checks without Sequelize.
   *
   * @param opts.readFromReplica — When false, reads from the primary (e.g. immediately after writes).
   */
  async getRuleByIdAndOrg(
    ruleId: string,
    orgId: string,
    opts?: { readFromReplica?: boolean },
  ): Promise<PlainRuleWithLatestVersion | null> {
    const row = await (
      await this.#rules(opts?.readFromReplica ?? true)
    )
      .where('r.id = :ruleId AND r.org_id = :orgId', { ruleId, orgId })
      .getRawOne<RuleRow>();
    return row == null ? null : rowToPlainRuleWithLatest(row);
  }

  /**
   * All rules for an org (latest version string), for GraphQL org.rules and
   * similar list surfaces. Not filtered by enabled status.
   */
  async getRulesForOrg(
    orgId: string,
    opts?: { readFromReplica?: boolean },
  ): Promise<PlainRuleWithLatestVersion[]> {
    const rows = await (
      await this.#rules(opts?.readFromReplica ?? true)
    )
      .where('r.org_id = :orgId', { orgId })
      .orderBy('r.name', 'ASC')
      .getRawMany<RuleRow>();
    return rows.map(rowToPlainRuleWithLatest);
  }

  async findEnabledUserRules() {
    const today = String(getUtcDateOnlyString());
    const query = (await this.#rules(true))
      .where('r.rule_type = :ruleType', { ruleType: RuleType.USER })
      .andWhere(
        (qb) =>
          `NOT EXISTS ${qb
            .subQuery()
            .select('1')
            .from(RulesAndItemTypes, 'rit')
            .where('rit.rule_id = r.id')
            .getQuery()}`,
      );
    const rows = await whereEnabled(query, today).getRawMany<RuleRow>();
    return rows.map(rowToPlainRuleWithLatest);
  }
}
