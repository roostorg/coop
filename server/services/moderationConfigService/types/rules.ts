import { makeEnumLike } from '@roostorg/types';

import { type MatchingValues } from '../../../models/rules/matchingValues.js';
import { type JsonOf } from '../../../utils/encoding.js';
import {
  type NonEmptyArray,
  type Satisfies,
} from '../../../utils/typescript-types.js';
import { type DerivedFieldSpec } from '../../derivedFieldsService/helpers.js';
import {
  type ExternalSignalId,
  type SignalArgsByType,
  type SignalType,
} from '../../signalsService/index.js';

export const RuleStatus = makeEnumLike([
  'BACKGROUND',
  'DEPRECATED',
  'DRAFT',
  'EXPIRED',
  'LIVE',
  'ARCHIVED',
]);
export type RuleStatus = keyof typeof RuleStatus;

export const RuleType = makeEnumLike(['CONTENT', 'USER']);
export type RuleType = keyof typeof RuleType;

export enum RuleAlarmStatus {
  ALARM = 'ALARM',
  OK = 'OK',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
}

// TODO: we really shouldn't be storing the signal name in the condition, as
// that's derived state liable to come out of sync. Instead, we just wanna store
// the SignalId, plus the args that the condition feeds to the signal (which,
// right now, is subcategory). `type` is also no longer necessary here.
export type ConditionSignalInfo = {
  id: JsonOf<ExternalSignalId>;
  name?: string | null;
  subcategory?: string | null;
} & (
  | {
      type: 'AGGREGATION';
      args: SignalArgsByType['AGGREGATION'];
    }
  | {
      // Exclude<SignalType, 'AGGREGATION'> | string to support plugin signal types (e.g. RANDOM_SIGNAL_SELECTION)
      type: Exclude<SignalType, 'AGGREGATION'> | string;
      args?: Satisfies<
        SignalArgsByType[Exclude<SignalType, 'AGGREGATION'>],
        undefined
      >;
    }
);

export type ConditionInput =
  | { type: 'USER_ID' } // refers to user id on RuleEvaluationContext. Only makes sense in 'user rules'.
  | { type: 'FULL_ITEM'; contentTypeIds?: readonly string[] } // contentTypeIds is misnamed; can actually hold any itemTypeIds
  | { type: 'CONTENT_FIELD'; name: string; contentTypeId: string } // similarly, contentTypeId is really itemTypeId
  | { type: 'CONTENT_COOP_INPUT'; name: CoopInput }
  | { type: 'CONTENT_DERIVED_FIELD'; spec: DerivedFieldSpec };

// Values should be human-readable, but should not be changed lightly,
// as it may make prior condition results uninterpretable by the UI
// and will also break exposed derived field specs. Similarly, the cases cannot
// be renamed, as they must match the GQL schema definition of this type (for
// the resolver to work), and the frontend is expecting the current names.
export const CoopInput = {
  ALL_TEXT: 'All text' as const,
  ANY_IMAGE: 'Any image' as const,
  ANY_GEOHASH: 'Any geohash' as const,
  ANY_VIDEO: 'Any video' as const,
  AUTHOR_USER: 'Content author (user)' as const,
  POLICY_ID: 'Relevant Policy' as const,
  SOURCE: 'Source' as const,
};
export type CoopInput = (typeof CoopInput)[keyof typeof CoopInput];

export const ValueComparator = makeEnumLike([
  'EQUALS',
  'NOT_EQUAL_TO',
  'LESS_THAN',
  'LESS_THAN_OR_EQUALS',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUALS',
  // IS_UNAVAILABLE means that the value that is to be compared against the
  // threshold was unavailable _because the signal that would have produced it
  // failed or returned a nonsensical result_. Conditions using this comparator
  // _usually_ have a signal, but they might not have an explicitl signal if the
  // ConditionInput referenced a derived field (which could also be unavailable
  // if the signal producing the derived field failed).
  'IS_UNAVAILABLE',
  // IS_NOT_PROVIDED means that the value that is to be compared against the
  // threshold was unavailable _because there was no corresponding value in the
  // ruleInput_. (This could happen, e.g., for rules that target multiple item
  // types where the condition looks for a field that's only present on some of
  // those types.) Conditions with this comparator can't have a signal, because
  // their result is always determinable before any signal would run.
  //
  // NB: We could maybe have re-used `IS_EQUAL` with `undefined` as a threshold
  // to represent this idea, but that's a bit trickier with how our code is
  // currently set up, and anything involving `undefined` is gonna be harder to
  // marshall reliably (e.g., to and from the db), because `undefined` isn't
  // valid JSON.
  'IS_NOT_PROVIDED',
]);
export type ValueComparator = keyof typeof ValueComparator;

export const ConditionConjunction = makeEnumLike(['AND', 'OR', 'XOR']);
export type ConditionConjunction = keyof typeof ConditionConjunction;

export type Condition = LeafCondition | ConditionSet;

export type ConditionSet = {
  conjunction: ConditionConjunction;
  conditions: NonEmptyArray<LeafCondition> | NonEmptyArray<ConditionSet>;
};

// TODO: When we have the bandwidth for breaking changes, I'd like to clean this
// type up a lot, including:
//
//  - Moving LeafCondition.matchingValues -> LeafCondition.signal.args.matchingValues
//    to indicate that it controls how the signal executes, rather than what
//    happens with the signal's result (which threshold + comparator control).
//
//  - Creating a new LeafCondition.signal.args key, to hold all static signal
//    args that might wanna be configured with the condition (like lookback
//    window lengths on spam/rate-limiting rules), and moving
//    LeafCondition.signal.subcategory into it, since it's just a kind of arg.
//
//   - Remove the mixture of null + undefined, which just makes extra work/extra states.
//
// So, the final type would be something like:
//
// type LeafCondition = {
//   contentTypeIds?: string[] // limit the condition to only running on certain content types
//   input: ConditionInput
//   signal?: {
//     id: SignalId;
//     args?: { [k: string]: JSON } // subcategory, matchingValues, future things like time window, etc.
//   }
//   comparator?: ValueComparator;
//   threshold?: number;
// }
export type LeafCondition =
  | {
      input: ConditionInput;
      // Conditions that check whether a value isn't provided in the RuleInput
      // as filtered by the ConditionInput cannot specify a signal.
      comparator: 'IS_NOT_PROVIDED';
      signal?: null;
      matchingValues?: null;
      threshold?: null;
    }
  | {
      input: ConditionInput;
      comparator?: Exclude<ValueComparator, 'IS_NOT_PROVIDED'> | null;
      signal?: ConditionSignalInfo | null;
      matchingValues?: MatchingValues | null;
      threshold?: string | number | null;
    };

