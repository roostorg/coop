import {
  type RuleAlarmStatus,
  RuleStatus,
  type RuleType,
  type ConditionSet,
  type Action,
  type Policy,
} from '../../services/moderationConfigService/index.js';
import { type User } from '../UserModel.js';

export type RuleLatestVersionRow = {
  ruleId: string;
  version: string;
};

/**
 * Rule row fields shared by the rule engine (no GraphQL resolver methods).
 */
export type PlainRuleWithLatestVersion = {
  id: string;
  name: string;
  description: string | null;
  statusIfUnexpired: Exclude<RuleStatus, typeof RuleStatus.EXPIRED>;
  status: RuleStatus;
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
  alarmStatus: RuleAlarmStatus;
  alarmStatusSetAt: Date;
  ruleType: RuleType;
  parentId: string | null;
  latestVersion: RuleLatestVersionRow;
};

export function computeRuleStatusFromRow(
  expirationTime: Date | null,
  statusIfUnexpired: Exclude<RuleStatus, typeof RuleStatus.EXPIRED>,
): RuleStatus {
  if (expirationTime && expirationTime.valueOf() < Date.now()) {
    return RuleStatus.EXPIRED;
  }
  return statusIfUnexpired;
}

export type RuleGraphqlMethods = {
  getCreator(): Promise<User>;
  getActions(): Promise<Action[]>;
  getPolicies(): Promise<Policy[]>;
};

/** GraphQL parent for Rule / ContentRule / UserRule / RuleInsights. */
export type Rule = PlainRuleWithLatestVersion & RuleGraphqlMethods;

/** @deprecated Use {@link PlainRuleWithLatestVersion} directly. Remove after Kysely migration. */
export type RuleWithLatestVersion = PlainRuleWithLatestVersion;
