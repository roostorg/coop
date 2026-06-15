import {
  GQLConditionConjunction,
  GQLConditionResult,
  GQLDerivedFieldSpec,
  GQLLeafConditionWithResult,
  GQLLocationAreaInput,
  GQLMatchingValues,
  GQLScalarType,
  GQLValueComparator,
} from '../../../graphql/generated';
import { CoreSignal } from '../../../models/signal';
import { CoopInput } from '../types/enums';
import {
  isComparatorTerminal,
  SimplifiedConditionInput,
} from './rule_form/RuleFormUtils';

// GQLConditionInput is (for now) a bit less precise than this, b/c of limits
// of the GQL type system. So, this is just a more precise replacement.
export type ConditionInput =
  | { type: 'USER_ID' } // refers to user id on RuleEvaluationContext. Only makes sense in 'user rules'.
  | { type: 'FULL_ITEM'; contentTypeIds?: string[] }
  | { type: 'CONTENT_FIELD'; name: string; contentTypeId: string }
  | { type: 'CONTENT_COOP_INPUT'; name: CoopInput }
  | { type: 'CONTENT_DERIVED_FIELD'; name: string; spec: GQLDerivedFieldSpec };

export enum MatchingValueType {
  STRING = 'STRING',
  TEXT_BANK = 'TEXT_BANK',
  LOCATION = 'LOCATION',
  LOCATION_BANK = 'LOCATION_BANK',
  IMAGE_BANK = 'IMAGE_BANK',
}

export function getMatchingValuesType(matchingValues: GQLMatchingValues) {
  if (matchingValues.strings?.length) {
    return MatchingValueType.STRING;
  }
  if (matchingValues.textBankIds?.length) {
    return MatchingValueType.TEXT_BANK;
  }
  if (matchingValues.locations?.length) {
    return MatchingValueType.LOCATION;
  }
  if (matchingValues.locationBankIds?.length) {
    return MatchingValueType.LOCATION_BANK;
  }
  if (matchingValues.imageBankIds?.length) {
    return MatchingValueType.IMAGE_BANK;
  }

  return undefined;
}

export type ConditionWithResult =
  | LeafConditionWithResult
  | ConditionSetWithResult;

export type ConditionSetWithResult = {
  conditions: [ConditionWithResult, ...ConditionWithResult[]];
  conjunction: GQLConditionConjunction;
  result?: GQLConditionResult;
};

export type LeafConditionWithResult = Omit<
  GQLLeafConditionWithResult,
  'input' | 'signal'
> & {
  input?: SimplifiedConditionInput;
  signal?: GQLLeafConditionWithResult['signal'] & { name: string };
};

export type RuleFormCondition = RuleFormConditionSet | RuleFormLeafCondition;

export type RuleFormConditionSet = {
  conjunction: GQLConditionConjunction;
  conditions: RuleFormCondition[];
};

// The shape used to store each leaf condition in the rule form's state.
export type RuleFormLeafCondition = {
  input?: SimplifiedConditionInput;
  eligibleSignals?: CoreSignal[];
  signal?: CoreSignal;
  matchingValues?: {
    strings?: readonly string[];
    textBankIds?: readonly string[];
    locations?: readonly GQLLocationAreaInput[];
    locationBankIds?: readonly string[];
    imageBankIds?: readonly string[];
  };
  comparator?: GQLValueComparator;
  // Must be converted to a number before GraphQL mutation
  threshold?: string;
};

export function conditionHasInvalidThreshold(
  cond: RuleFormLeafCondition,
): boolean {
  const outputScalarType = cond.signal?.outputType?.scalarType;
  return (
    !isComparatorTerminal(cond) &&
    outputScalarType === GQLScalarType.Number &&
    isNaN(Number(cond.threshold))
  );
}

export function isConditionSet(
  it: RuleFormCondition,
): it is RuleFormConditionSet {
  return 'conjunction' in it && 'conditions' in it;
}

export type ConditionLocation = {
  conditionIndex: number;
  conditionSetIndex: number;
};

export function getFlattenedConditions(
  conditions: RuleFormCondition[],
): RuleFormLeafCondition[] {
  return conditions.flatMap((it) =>
    isConditionSet(it) ? getFlattenedConditions(it.conditions) : [it],
  );
}
