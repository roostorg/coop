import { type ReadonlyDeep } from 'type-fest';

import { isConditionSet } from '../../condition_evaluator/condition.js';
import { type DerivedFieldSpec } from '../../services/derivedFieldsService/index.js';
import {
  type ConditionResult,
  type ConditionSetWithResult,
  type CoopInput,
  type LeafConditionWithResult,
} from '../../services/moderationConfigService/index.js';
import { type CorrelationId } from '../../utils/correlationIds.js';
import { type JsonOf } from '../../utils/encoding.js';
import {
  type SafeErrorKey,
  type SerializableError,
} from '../../utils/errors.js';
import {
  type NonEmptyArray,
  type ReplaceDeep,
} from '../../utils/typescript-types.js';
import { type LocationArea } from '../moderationConfigService/index.js';

type ConditionResultAsLogged = ReplaceDeep<
  ConditionResult,
  SerializableError,
  Omit<SerializableError, SafeErrorKey>
>;

/**
 * A type for the subset of ConditionSetWithResults that we actually persist to
 * the data warehouse when recording a rule execution. This doesn't have signal instances,
 * etc. and it's all we can actually show to the user in the insights UI.
 */
export type ConditionSetWithResultAsLogged = Omit<
  ConditionSetWithResult,
  'conditions' | 'result'
> & {
  conditions:
    | NonEmptyArray<LeafConditionWithResultAsLogged>
    | NonEmptyArray<ConditionSetWithResultAsLogged>;
  result?: ConditionResultAsLogged;
};

export type ConditionWithResultAsLogged =
  ConditionSetWithResultAsLogged | LeafConditionWithResultAsLogged;

// NB: we make these types to ensure, at the type level, that we're generating
// correlation ids consistently for everything we log.
export type RuleExecutionSourceType =
  | 'post-content'
  | 'backtest'
  | 'retroaction'
  | 'user-rule-run'
  | 'post-items'
  | 'manual-action-run';

export type RuleExecutionCorrelationId = CorrelationId<RuleExecutionSourceType>;

// We write out this type explicitly, rather than deriving it with ReturnType,
// because it includes legacy cases that the inferred return type would not
// account for -- e.g., signal.id holding a SignalType string. Then, we annote
// the return type of pickConditionPropsToLog with this type to check that the
// implementation's current return type is compatible w/ this type that should
// be broader. More generally, we want to force ourselves to add new cases here
// when they appear (e.g., if some new ValueComparator or ConditionInput case is
// added), without having cases automatically disappear here (e.g., if we remove
// a case from ConditionInput), because we use this type when _reading_ from the
// logged data too, and the old cases will only go away in the db if we
// explicitly migrate old rows. We could (technically should) take this approach
// even further by inlining literally every type here (like `LocationArea`,
// `DerivedFieldSpec`, etc), but this is enough for now.
export type LeafConditionWithResultAsLogged = {
  input: ReadonlyDeep<
    | { type: 'USER_ID' }
    | { type: 'FULL_ITEM'; contentTypeIds?: string[] }
    | { type: 'CONTENT_FIELD'; name: string; contentTypeId: string }
    | { type: 'CONTENT_COOP_INPUT'; name: CoopInput }
    | { type: 'CONTENT_DERIVED_FIELD'; spec: DerivedFieldSpec }
  >;
  signal:
    | {
        // Given that, you'd expect `id` to be typed as
        // `JsonOf<SignalId> | SignalType | null`, but, instead, we use
        // `JsonOf<{ type: string; id?: string }> | string | null` for the same
        // reason we type `type` as string rather than SignalType. See below.
        id?: JsonOf<{ type: string; id?: string }> | string | null;
        // Intentionally `string` rather than `SignalType`, b/c we have some old
        // logged rows with a `type` that is no longer one of our current
        // SignalTypes (e.g., for the old language detection signal).
        type?: string;
        name?: string | null | undefined;
        subcategory?: string | null | undefined;
      }
    | null
    | undefined;
  matchingValues:
    | {
        strings?: readonly string[];
        textBankIds?: readonly string[];
        locations?: readonly ReadonlyDeep<LocationArea>[];
        locationBankIds?: readonly string[];
        imageBankIds?: readonly string[];
      }
    | null
    | undefined;
  comparator?:
    | 'EQUALS'
    | 'NOT_EQUAL_TO'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUALS'
    | 'IS_UNAVAILABLE'
    | 'IS_NOT_PROVIDED'
    | null;
  threshold?: string | number | null;
  result?: ConditionResultAsLogged;
};

export function pickConditionPropsToLog(
  condition: ReadonlyDeep<ConditionSetWithResult>,
): ConditionSetWithResultAsLogged;
export function pickConditionPropsToLog(
  condition: ReadonlyDeep<LeafConditionWithResult>,
): LeafConditionWithResultAsLogged;
export function pickConditionPropsToLog(
  condition:
    | ReadonlyDeep<ConditionSetWithResult>
    | ReadonlyDeep<LeafConditionWithResult>,
): ConditionWithResultAsLogged;
export function pickConditionPropsToLog(
  condition:
    | ReadonlyDeep<ConditionSetWithResult>
    | ReadonlyDeep<LeafConditionWithResult>,
): unknown {
  return isConditionSet(condition)
    ? {
        ...condition,
        conditions: condition.conditions.map((it) =>
          pickConditionPropsToLog(it),
        ) satisfies ConditionWithResultAsLogged[] as
          | NonEmptyArray<LeafConditionWithResultAsLogged>
          | NonEmptyArray<ConditionSetWithResultAsLogged>,
      }
    : pickLeafConditionPropsTolog(condition);
}

export function pickLeafConditionPropsTolog(
  condition: ReadonlyDeep<LeafConditionWithResult>,
): LeafConditionWithResultAsLogged {
  const { matchingValues, signal } = condition;

  return {
    comparator: condition.comparator,
    threshold: condition.threshold,
    input: condition.input,
    result: condition.result satisfies
      ReadonlyDeep<ConditionResult> | undefined as
      ConditionResultAsLogged | undefined,
    signal: signal && {
      id: signal.id,
      type: signal.type,
      name: signal.name,
      subcategory: signal.subcategory,
    },
    matchingValues: matchingValues && {
      ...(matchingValues.strings
        ? { strings: matchingValues.strings }
        : undefined),
      ...(matchingValues.textBankIds
        ? { textBankIds: matchingValues.textBankIds }
        : undefined),
      ...(matchingValues.locations
        ? { locations: matchingValues.locations }
        : undefined),
      ...(matchingValues.locationBankIds
        ? { locationBankIds: matchingValues.locationBankIds }
        : undefined),
      ...(matchingValues.imageBankIds
        ? { imageBankIds: matchingValues.imageBankIds }
        : undefined),
    },
  };
}
