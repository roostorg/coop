import { type ReadonlyDeep } from 'type-fest';

import { isConditionSet } from '../../condition_evaluator/condition.js';
import {
  type ConditionResult,
  type ConditionSetWithResult,
  type LeafConditionWithResult,
} from '../../models/rules/RuleModel.js';
import { type LocationArea } from '../../models/types/locationArea.js';
import { type DerivedFieldSpec } from '../../services/derivedFieldsService/index.js';
import { type CoopInput } from '../../services/moderationConfigService/index.js';
import { isSignalId } from '../../services/signalsService/index.js';
import { type CorrelationId } from '../../utils/correlationIds.js';
import { jsonParse, tryJsonParse, type JsonOf } from '../../utils/encoding.js';
import {
  type SafeErrorKey,
  type SerializableError,
} from '../../utils/errors.js';
import {
  type NonEmptyArray,
  type ReplaceDeep,
} from '../../utils/typescript-types.js';

type ConditionResultAsLogged = ReplaceDeep<
  ConditionResult,
  SerializableError,
  Omit<SerializableError, SafeErrorKey>
>;

/**
 * A type for the subset of ConditionSetWithResults that we actually persist to
 * Snowflake when recording a rule execution. This doesn't have signal instances,
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
  | ConditionSetWithResultAsLogged
  | LeafConditionWithResultAsLogged;

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
  /**
   * NB: to figure out which Signal a logged condition references, use
   * {@link signalIdFromLoggedCondition}. Do not try to read the fields of the
   * condition directly, as there are too many legacy formats to account for.
   */
  signal:
    | {
        // NB: billions of legacy leaf conditions in Snowflake have this `id`
        // logged as just the SignalType | null, so callers should be prepared
        // for this when handling signal results from Aug 2022 through July 2023.
        //
        // We attempted to migrate those conditions (see
        // https://github.com/roostorg/coop/pull/1386) so that we
        // could simplify the code here, but the migrations kept timing out (in
        // some mix of CodePipeline and Snowflake, thanks to its UDF runtime
        // limit), so we ultimately gave up, and only migrated records from
        // before Aug 2022. You can verify that legacy conditions still exist by
        // running the following query, which uses 2023-04-01 as an arbitrary
        // date to search:
        //
        // WITH RECURSIVE condition_tree AS (
        //   SELECT
        //     r.rule_id,
        //     r.DS,
        //     t.value as condition_or_set
        //     FROM rule_executions r,
        //       LATERAL FLATTEN(INPUT => parse_json(result):conditions) t
        //     WHERE DS = '2023-04-01'
        //   UNION ALL
        //   SELECT
        //     condition_tree.rule_id,
        //     condition_tree.DS,
        //     t2.value
        //     FROM condition_tree,
        //       LATERAL FLATTEN(INPUT => condition_or_set:conditions) t2
        //     WHERE DS = '2023-04-01'
        // )
        // SELECT * from condition_tree
        //   WHERE condition_or_set:conditions is null
        //     AND condition_or_set:signal:id NOT LIKE '{"%'
        //     AND DS = '2023-04-01'
        //
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
      | ReadonlyDeep<ConditionResult>
      | undefined as ConditionResultAsLogged | undefined,
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

/**
 * Signal ids have been logged in conditions in very haphazard ways over-time.
 * This function attempts to account for all the different iterations in order
 * to return a SignalId if at all possible.
 */
export function signalIdFromLoggedCondition(
  it: LeafConditionWithResultAsLogged,
) {
  if (!it.signal) {
    return undefined;
  }

  // Very old logged conditions have `signal.id` as `null` or omit it when the
  // condition was targeting a built-in signal; in that case, we build a
  // `SignalId` from the type. Slightly newer conditions contain the bare signal
  // type in `condition.signal.id`, which isn't a valid JSON string. So, if we
  // try to parse it as JSON and it fails, we assume we're in that case and
  // likewise construct the id from the type. Finally, newer conditions contain
  // `JsonOf<SignalId>` (or, really, `JsonOf<SignalId>` where `SignalId` is
  // whatever shape it had when the row was written -- not necessarily its
  // current shape), so we parse that.
  const candidateSignalId =
    !it.signal.id || !tryJsonParse(it.signal.id)
      ? { type: it.signal.type }
      : jsonParse(it.signal.id satisfies string | JsonOf<JSON> as JsonOf<JSON>);

  // Finally, it's possible that the stored condition references a signal that
  // no longer has a corresponding SignalType in our codebase (e.g., the deleted
  // LangaugeDetection signal). In that case, we just return undefined.
  return isSignalId(candidateSignalId) ? candidateSignalId : undefined;
}
