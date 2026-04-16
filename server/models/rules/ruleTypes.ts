import { type ScalarType, type TaggedScalar } from '@roostorg/types';

import {
  type RuleAlarmStatus,
  RuleStatus,
  type RuleType,
  type ConditionSet,
  type LeafCondition,
  type Action,
  type Policy,
} from '../../services/moderationConfigService/index.js';
import { type SerializableError } from '../../utils/errors.js';
import {
  type NonEmptyArray,
  type WithUndefined,
} from '../../utils/typescript-types.js';
import { type User } from '../UserModel.js';
import { type TaggedItemData } from './item-type-fields.js';

export enum ConditionCompletionOutcome {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  INAPPLICABLE = 'INAPPLICABLE',
}

export enum ConditionFailureOutcome {
  ERRORED = 'ERRORED',
}

export type ConditionOutcome =
  | ConditionCompletionOutcome
  | ConditionFailureOutcome;

export type ConditionCompletionMetadata = {
  score?: string;
  matchedValue?: string;
};

export type ConditionFailureMetadata = {
  error?: SerializableError;
};

type ConditionResultCommonMetadata = {
  signalInputValues?: (TaggedScalar<ScalarType> | TaggedItemData)[];
};

// prettier-ignore
export type ConditionResult =
  | ({ outcome: ConditionCompletionOutcome }
        & ConditionCompletionMetadata
        & Partial<Pick<ConditionFailureMetadata, 'error'>>
        & ConditionResultCommonMetadata)
  | ({ outcome: ConditionFailureOutcome; }
        & ConditionFailureMetadata
        & WithUndefined<ConditionCompletionMetadata>
        & ConditionResultCommonMetadata)

export type ConditionWithResult =
  | LeafConditionWithResult
  | ConditionSetWithResult;

export type ConditionSetWithResult = Omit<ConditionSet, 'conditions'> & {
  conditions:
    | NonEmptyArray<LeafConditionWithResult>
    | NonEmptyArray<ConditionSetWithResult>;
  result?: ConditionResult;
};

export type LeafConditionWithResult = LeafCondition & {
  result?: ConditionResult;
};

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
