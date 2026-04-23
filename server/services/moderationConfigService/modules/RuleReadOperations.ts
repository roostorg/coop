import { type Kysely, sql } from 'kysely';

import {
  type RuleAlarmStatus,
  RuleStatus,
  RuleType,
  type ConditionSet,
} from '../index.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
import { getUtcDateOnlyString } from '../../../utils/time.js';
import {
  type PlainRuleWithLatestVersion,
  computeRuleStatusFromRow,
} from '../../../models/rules/ruleTypes.js';

const ruleSelect = [
  'r.id',
  'r.name',
  'r.description',
  'r.status_if_unexpired as statusIfUnexpired',
  'r.tags',
  'r.max_daily_actions as maxDailyActions',
  'r.daily_actions_run as dailyActionsRun',
  'r.last_action_date as lastActionDate',
  'r.created_at as createdAt',
  'r.updated_at as updatedAt',
  'r.org_id as orgId',
  'r.creator_id as creatorId',
  'r.expiration_time as expirationTime',
  'r.condition_set as conditionSet',
  'r.alarm_status as alarmStatus',
  'r.alarm_status_set_at as alarmStatusSetAt',
  'r.rule_type as ruleType',
  'r.parent_id as parentId',
  'rlv.version as latestVersionString',
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
  // Kysely returns the Postgres enum as a plain string; cast in rowToPlainRuleWithLatest.
  alarmStatus: string;
  alarmStatusSetAt: Date;
  ruleType: RuleType;
  parentId: string | null;
  latestVersionString: string | null;
};

function enabledQuotaWhere(today: string) {
  return sql<boolean>`(r.max_daily_actions is null or r.last_action_date is distinct from ${today}::date or (r.max_daily_actions is not null and r.daily_actions_run < r.max_daily_actions))`;
}

function rowToPlainRuleWithLatest(row: RuleRow): PlainRuleWithLatestVersion {
  const status = computeRuleStatusFromRow(row.expirationTime, row.statusIfUnexpired);
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
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
  ) {}

  async getEnabledRulesForItemType(itemTypeId: string) {
    const today = String(getUtcDateOnlyString());
    const rows = (await this.pgQueryReplica
      .selectFrom('public.rules as r')
      .innerJoin('public.rules_and_item_types as rit', 'rit.rule_id', 'r.id')
      .leftJoin('public.rules_latest_versions as rlv', 'rlv.rule_id', 'r.id')
      .select(ruleSelect)
      .where('rit.item_type_id', '=', itemTypeId)
      .where((eb) =>
        eb.or([
          eb('r.expiration_time', 'is', null),
          eb('r.expiration_time', '>', sql<Date>`now()`),
        ]),
      )
      .where('r.status_if_unexpired', 'in', [
        RuleStatus.LIVE,
        RuleStatus.BACKGROUND,
      ])
      .where(enabledQuotaWhere(today))
      .execute()) as RuleRow[];

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
    const readFromReplica = opts?.readFromReplica ?? true;
    const pg = readFromReplica ? this.pgQueryReplica : this.pgQuery;
    const row = (await pg
      .selectFrom('public.rules as r')
      .leftJoin('public.rules_latest_versions as rlv', 'rlv.rule_id', 'r.id')
      .select(ruleSelect)
      .where('r.id', '=', ruleId)
      .where('r.org_id', '=', orgId)
      .executeTakeFirst()) as RuleRow | undefined;

    if (row == null) {
      return null;
    }
    return rowToPlainRuleWithLatest(row);
  }

  /**
   * All rules for an org (latest version string), for GraphQL org.rules and
   * similar list surfaces. Not filtered by enabled status.
   */
  async getRulesForOrg(
    orgId: string,
    opts?: { readFromReplica?: boolean },
  ): Promise<PlainRuleWithLatestVersion[]> {
    const readFromReplica = opts?.readFromReplica ?? true;
    const pg = readFromReplica ? this.pgQueryReplica : this.pgQuery;
    const rows = (await pg
      .selectFrom('public.rules as r')
      .leftJoin('public.rules_latest_versions as rlv', 'rlv.rule_id', 'r.id')
      .select(ruleSelect)
      .where('r.org_id', '=', orgId)
      .orderBy('r.name', 'asc')
      .execute()) as RuleRow[];

    return rows.map(rowToPlainRuleWithLatest);
  }

  async findEnabledUserRules() {
    const today = String(getUtcDateOnlyString());
    const rows = (await this.pgQueryReplica
      .selectFrom('public.rules as r')
      .leftJoin('public.rules_latest_versions as rlv', 'rlv.rule_id', 'r.id')
      .select(ruleSelect)
      .where('r.rule_type', '=', RuleType.USER)
      .where(
        sql<boolean>`not exists (select 1 from public.rules_and_item_types rit where rit.rule_id = r.id)`,
      )
      .where((eb) =>
        eb.or([
          eb('r.expiration_time', 'is', null),
          eb('r.expiration_time', '>', sql<Date>`now()`),
        ]),
      )
      .where('r.status_if_unexpired', 'in', [
        RuleStatus.LIVE,
        RuleStatus.BACKGROUND,
      ])
      .where(enabledQuotaWhere(today))
      .execute()) as RuleRow[];

    return rows.map(rowToPlainRuleWithLatest);
  }
}
