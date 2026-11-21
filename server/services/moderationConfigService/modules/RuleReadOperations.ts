import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { schema, type CoopDbOrTx } from '../../../storage/postgres/drizzle.js';
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

const r = schema.rules;
const rlv = schema.rulesLatestVersions;

const ruleSelect = {
  id: r.id,
  name: r.name,
  description: r.description,
  statusIfUnexpired: r.statusIfUnexpired,
  tags: r.tags,
  maxDailyActions: r.maxDailyActions,
  dailyActionsRun: r.dailyActionsRun,
  lastActionDate: r.lastActionDate,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  orgId: r.orgId,
  creatorId: r.creatorId,
  expirationTime: r.expirationTime,
  conditionSet: r.conditionSet,
  alarmStatus: r.alarmStatus,
  alarmStatusSetAt: r.alarmStatusSetAt,
  ruleType: r.ruleType,
  parentId: r.parentId,
  latestVersionString: rlv.version,
};

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
  return sql<boolean>`(${r.maxDailyActions} is null or ${r.lastActionDate} is distinct from ${today}::date or (${r.maxDailyActions} is not null and ${r.dailyActionsRun} < ${r.maxDailyActions}))`;
}

function unexpiredAndEnabledWhere(today: string): SQL[] {
  return [
    or(isNull(r.expirationTime), gt(r.expirationTime, sql`now()`))!,
    inArray(r.statusIfUnexpired, [RuleStatus.LIVE, RuleStatus.BACKGROUND]),
    enabledQuotaWhere(today),
  ];
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
    private readonly pgQuery: CoopDbOrTx,
    private readonly pgQueryReplica: CoopDbOrTx,
  ) {}

  async getEnabledRulesForItemType(itemTypeId: string) {
    const today = String(getUtcDateOnlyString());
    const rit = schema.rulesAndItemTypes;
    const rows = (await this.pgQueryReplica
      .select(ruleSelect)
      .from(r)
      .innerJoin(rit, eq(rit.ruleId, r.id))
      .leftJoin(rlv, eq(rlv.ruleId, r.id))
      .where(
        and(eq(rit.itemTypeId, itemTypeId), ...unexpiredAndEnabledWhere(today)),
      )) as RuleRow[];

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
    const [row] = (await pg
      .select(ruleSelect)
      .from(r)
      .leftJoin(rlv, eq(rlv.ruleId, r.id))
      .where(and(eq(r.id, ruleId), eq(r.orgId, orgId)))
      .limit(1)) as RuleRow[];

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
      .select(ruleSelect)
      .from(r)
      .leftJoin(rlv, eq(rlv.ruleId, r.id))
      .where(eq(r.orgId, orgId))
      .orderBy(asc(r.name))) as RuleRow[];

    return rows.map(rowToPlainRuleWithLatest);
  }

  async findEnabledUserRules() {
    const today = String(getUtcDateOnlyString());
    const rit = schema.rulesAndItemTypes;
    const rows = (await this.pgQueryReplica
      .select(ruleSelect)
      .from(r)
      .leftJoin(rlv, eq(rlv.ruleId, r.id))
      .where(
        and(
          eq(r.ruleType, RuleType.USER),
          sql`not exists (select 1 from ${rit} where ${rit.ruleId} = ${r.id})`,
          ...unexpiredAndEnabledWhere(today),
        ),
      )) as RuleRow[];

    return rows.map(rowToPlainRuleWithLatest);
  }
}
