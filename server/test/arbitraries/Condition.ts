import fc, { type Arbitrary } from 'fast-check';

import { outcomeToNullableBool } from '../../condition_evaluator/condition.js';
import {
  ConditionCompletionOutcome,
  ConditionFailureOutcome,
} from '../../models/rules/RuleModel.js';
import {
  ConditionConjunction,
  ValueComparator,
  type ConditionInput,
  type ConditionSet,
  type LeafCondition,
} from '../../services/moderationConfigService/index.js';
import { ExternalSignalIdArbitrary } from '../../services/signalsService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { type NonEmptyArray } from '../../utils/typescript-types.js';
import { enumToArbitrary } from '../propertyTestingHelpers.js';
import { LocationAreaArbitrary } from './ContentType.js';
import { CoopInputArbitrary } from './Shared.js';

export const ConditionConjunctionArbitrary =
  enumToArbitrary(ConditionConjunction);

export const ValueComparatorArbitrary = enumToArbitrary(ValueComparator);

// "nullish" is js speak for null or undefined
const NullishArbitrary = fc.oneof(fc.constant(undefined), fc.constant(null));

// An arbitrary for ConditionInput values that read their contents from a
// content object.
export const makeConditionInputReferencingContentArbitrary = (
  contentFieldNameArbitrary?: Arbitrary<string>,
  contentTypeIdArbitrary?: Arbitrary<string>,
): Arbitrary<ConditionInput> =>
  fc.oneof(
    fc.constant({ type: 'FULL_ITEM' as const }),
    fc.record({
      type: fc.constant('CONTENT_FIELD' as const),
      name: contentFieldNameArbitrary ?? fc.string(),
      contentTypeId: contentTypeIdArbitrary ?? fc.string(),
    }),
    fc.record({
      type: fc.constant('CONTENT_COOP_INPUT' as const),
      name: CoopInputArbitrary,
    }),
  );

export const makeConditionInputArbitrary = (
  contentFieldNameArbitrary?: Arbitrary<string>,
  contentTypeIdArbitrary?: Arbitrary<string>,
): Arbitrary<ConditionInput> =>
  fc.oneof(
    fc.constant({ type: 'USER_ID' as const }),
    makeConditionInputReferencingContentArbitrary(
      contentFieldNameArbitrary,
      contentTypeIdArbitrary,
    ),
  );

const SignalAggregationArgsArbitrary = fc.record({
  aggregationClause: fc.record({
    id: fc.string(),
    // TODO(rui): this should be one of null or some condition set arbitrary,
    // but there's some maximum call size issue I'm running into due to the
    // recursive nature of all of these definitions so I'm currently making
    // this only null.
    conditionSet: NullishArbitrary,
    aggregation: fc.constant({ type: 'COUNT' as const }),
    groupBy: fc.array(makeConditionInputArbitrary(), {
      minLength: 1,
      maxLength: 1,
    }),
    window: fc.record({
      sizeMs: fc.integer(),
      hopMs: fc.integer(),
    }),
  }),
});

const SignalGpt4oMiniArgsArbitrary = fc.record({
  policyId: fc.string(),
});

const MatchingValuesArbitrary = fc.record({
  strings: fc.oneof(fc.array(fc.string()), NullishArbitrary),
  locations: fc.oneof(fc.array(LocationAreaArbitrary), NullishArbitrary),
  textBankIds: fc.oneof(fc.array(fc.string()), NullishArbitrary),
  locationBankIds: fc.oneof(fc.array(fc.string()), NullishArbitrary),
  imageBankIds: fc.oneof(fc.array(fc.string()), NullishArbitrary),
});

const ThresholdArbitrary = fc.oneof(fc.string(), fc.integer(), fc.double());

// TODO: make fields in input (name, scalarType, etc) correlated with a
// ContentType arbitrary's generated value. Will be simpler to do in a way that
// makes for reliable tests when we solve the content object–content type schema
// mismatch that can occur with backtests.
export const LeafConditionArbitrary = <T extends Arbitrary<ConditionInput>>(
  conditionInputArbitrary: T,
): Arbitrary<LeafCondition> =>
  fc.oneof(
    // IS_NOT_PROVIDED comparators
    fc.record({
      input: conditionInputArbitrary,
      comparator: fc.constant('IS_NOT_PROVIDED' as const),
      signal: NullishArbitrary,
      matchingValues: NullishArbitrary,
      threshold: NullishArbitrary,
    }),
    // Any condition _except_ IS_NOT_PROVIDED comparators
    fc.record({
      input: conditionInputArbitrary,
      signal: fc.oneof(ConditionSignalInfoArbitrary, NullishArbitrary),
      matchingValues: fc.oneof(MatchingValuesArbitrary, NullishArbitrary),
      comparator: fc.oneof(
        NullishArbitrary,
        ValueComparatorArbitrary.filter((it) => it !== 'IS_NOT_PROVIDED'),
      ),
      threshold: fc.oneof(ThresholdArbitrary, NullishArbitrary),
    }),
  );

export const ConditionSetArbitrary = (
  leafConditionArbitrary: Arbitrary<LeafCondition>,
): Arbitrary<ConditionSet> =>
  fc.letrec((tie) => ({
    conditionSet: fc.record({
      conjunction: ConditionConjunctionArbitrary,
      conditions: fc.oneof(
        fc.array(tie('conditionSet'), { minLength: 1 }) as unknown as Arbitrary<
          NonEmptyArray<ConditionSet>
        >,
        fc.array(leafConditionArbitrary, {
          minLength: 1,
        }) as unknown as Arbitrary<NonEmptyArray<LeafCondition>>,
      ),
    }),
  })).conditionSet;

const ConditionSignalInfoArbitrary = fc
  .tuple(
    fc.record({
      name: fc.oneof(fc.string(), NullishArbitrary),
      subcategory: fc.oneof(fc.string(), NullishArbitrary),
    }),
    ExternalSignalIdArbitrary,
    SignalAggregationArgsArbitrary,
    SignalGpt4oMiniArgsArbitrary,
  )
  .map(([signalInfo, signalId, aggregationArgs, _gpt4oMiniArgs]) => ({
    id: jsonStringify(signalId),
    ...signalInfo,
    ...(signalId.type === 'AGGREGATION'
      ? {
          type: signalId.type,
          args: aggregationArgs,
        }
      : {
          type: signalId.type,
        }),
  }));

export const ConditionFailureOutcomeArbitrary = enumToArbitrary(
  ConditionFailureOutcome,
);

export const ConditionCompletionOutcomeArbitrary = enumToArbitrary(
  ConditionCompletionOutcome,
);

export const ConditionOutcomeArbitrary = fc.oneof(
  ConditionFailureOutcomeArbitrary,
  ConditionCompletionOutcomeArbitrary,
);

export const TruthyConditionCompletionOutcomeArbitrary =
  ConditionOutcomeArbitrary.filter((it) => outcomeToNullableBool(it) === true);

export const NullLikeConditionCompletionOutcomeArbitrary =
  ConditionOutcomeArbitrary.filter((it) => outcomeToNullableBool(it) === null);

export const FalseyCompletionOutcomeArbitrary =
  ConditionOutcomeArbitrary.filter((it) => outcomeToNullableBool(it) === false);
