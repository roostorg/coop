import {
  Prisma,
  type PrismaPgQueryable,
} from '../../../storage/prisma/index.js';
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

const ruleSelect = Prisma.sql`
  r.id,
  r.name,
  r.description,
  r.status_if_unexpired AS "statusIfUnexpired",
  r.tags,
  r.max_daily_actions AS "maxDailyActions",
  r.daily_actions_run AS "dailyActionsRun",
  r.last_action_date AS "lastActionDate",
  r.created_at AS "createdAt",
  r.updated_at AS "updatedAt",
  r.org_id AS "orgId",
  r.creator_id AS "creatorId",
  r.expiration_time AS "expirationTime",
  r.condition_set AS "conditionSet",
  r.alarm_status::text AS "alarmStatus",
  r.alarm_status_set_at AS "alarmStatusSetAt",
  r.rule_type::text AS "ruleType",
  r.parent_id AS "parentId",
  rlv.version AS "latestVersionString"`;

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
  // Selected as text; cast in rowToPlainRuleWithLatest.
  alarmStatus: string;
  alarmStatusSetAt: Date;
  ruleType: RuleType;
  parentId: string | null;
  latestVersionString: string | null;
};

function enabledQuotaWhere(today: string) {
  return Prisma.sql`(r.max_daily_actions is null or r.last_action_date is distinct from ${today}::date or (r.max_daily_actions is not null and r.daily_actions_run < r.max_daily_actions))`;
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
    private readonly pgQuery: PrismaPgQueryable,
    private readonly pgQueryReplica: PrismaPgQueryable,
  ) {}

  async getEnabledRulesForItemType(itemTypeId: string) {
    const today = String(getUtcDateOnlyString());
    // prisma-raw: join to a view with no relation (rules_latest_versions) + column-to-column quota predicate
    const rows = await this.pgQueryReplica.$queryRaw<RuleRow[]>`
      SELECT ${ruleSelect}
      FROM public.rules AS r
      INNER JOIN public.rules_and_item_types AS rit ON rit.rule_id = r.id
      LEFT JOIN public.rules_latest_versions AS rlv ON rlv.rule_id = r.id
      WHERE rit.item_type_id = ${itemTypeId}
        AND (r.expiration_time IS NULL OR r.expiration_time > now())
        AND r.status_if_unexpired IN (${RuleStatus.LIVE}, ${RuleStatus.BACKGROUND})
        AND ${enabledQuotaWhere(today)}`;

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
    // prisma-raw: join to a view with no relation (rules_latest_versions)
    const [row] = await pg.$queryRaw<RuleRow[]>`
      SELECT ${ruleSelect}
      FROM public.rules AS r
      LEFT JOIN public.rules_latest_versions AS rlv ON rlv.rule_id = r.id
      WHERE r.id = ${ruleId} AND r.org_id = ${orgId}
      LIMIT 1`;

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
    // prisma-raw: join to a view with no relation (rules_latest_versions)
    const rows = await pg.$queryRaw<RuleRow[]>`
      SELECT ${ruleSelect}
      FROM public.rules AS r
      LEFT JOIN public.rules_latest_versions AS rlv ON rlv.rule_id = r.id
      WHERE r.org_id = ${orgId}
      ORDER BY r.name ASC`;

    return rows.map(rowToPlainRuleWithLatest);
  }

  async findEnabledUserRules() {
    const today = String(getUtcDateOnlyString());
    // prisma-raw: join to a view with no relation (rules_latest_versions) + column-to-column quota predicate
    const rows = await this.pgQueryReplica.$queryRaw<RuleRow[]>`
      SELECT ${ruleSelect}
      FROM public.rules AS r
      LEFT JOIN public.rules_latest_versions AS rlv ON rlv.rule_id = r.id
      WHERE r.rule_type = ${RuleType.USER}::rule_type
        AND NOT EXISTS (
          SELECT 1 FROM public.rules_and_item_types rit WHERE rit.rule_id = r.id
        )
        AND (r.expiration_time IS NULL OR r.expiration_time > now())
        AND r.status_if_unexpired IN (${RuleStatus.LIVE}, ${RuleStatus.BACKGROUND})
        AND ${enabledQuotaWhere(today)}`;

    return rows.map(rowToPlainRuleWithLatest);
  }
}
