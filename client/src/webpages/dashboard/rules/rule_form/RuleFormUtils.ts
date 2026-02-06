/**
 * @fileoverview Utils functions for the Rule Form. Used to reduce
 * complexity of RuleForm.tsx
 */
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import pickBy from 'lodash/pickBy';

import {
  GQLBaseField,
  GQLConditionConjunction,
  GQLConditionSetFieldsFragment,
  GQLContentType,
  GQLDerivedFieldSpec,
  GQLLeafConditionFieldsFragment,
  GQLScalarType,
  GQLSignalType,
  GQLValueComparator,
  type GQLConditionInput,
} from '../../../../graphql/generated';
import { taggedUnionToOneOfInput } from '../../../../graphql/inputHelpers';
import { locationAreaToLocationAreaInput } from '../../../../models/locationBank';
import { CoreSignal } from '../../../../models/signal';
import { safePick } from '../../../../utils/misc';
import { isValidRegexString } from '../../../../utils/regex';
import { CoopInput } from '../../types/enums';
import {
  conditionHasInvalidThreshold,
  ConditionInput,
  ConditionLocation,
  getFlattenedConditions,
  isConditionSet,
  RuleFormCondition,
  RuleFormConditionSet,
  RuleFormLeafCondition,
} from '../types';
import { completeConditionNeedsComparator } from './condition/comparator/comparatorUtils';
import { getDerivedFieldOutputType } from './condition/input/derivedField';

// The type returned for inputs after they go through the RuleFormConditionInput
// component, which removes some graphql keys (like __typename etc).
export type SimplifiedConditionInput =
  | Exclude<ConditionInput, { type: 'CONTENT_DERIVED_FIELD' }>
  | {
      type: 'CONTENT_DERIVED_FIELD';
      spec: Pick<GQLDerivedFieldSpec, 'derivationType' | 'source'>;
    };

export type RuleFormItemType = Pick<GQLContentType, 'id'> & {
  baseFields: readonly Pick<GQLBaseField, 'name' | 'container' | 'type'>[];
};

export function getEligibleSignalsForInput(
  input: SimplifiedConditionInput,
  ruleContentTypes: readonly RuleFormItemType[],
  allSignals: readonly CoreSignal[],
) {
  if (input.type === 'FULL_ITEM') {
    return allSignals.filter((signal) =>
      signal.eligibleInputs.includes('FULL_ITEM'),
    );
  }

  const scalarType = (() => {
    switch (input.type) {
      case 'CONTENT_DERIVED_FIELD':
        return getDerivedFieldOutputType(input.spec.derivationType);
      case 'CONTENT_FIELD':
      case 'CONTENT_COOP_INPUT':
      case 'USER_ID':
        return getConditionInputScalarType(ruleContentTypes, input)!;
    }
  })();

  // First, filter out user signals, which can only be run on FULL_ITEM
  // inputs.
  // Then, sort the remaining signals using the following rules:
  // 1) If both signals are Coop signals (or 3rd party signals), then sort by name.
  // 2) Otherwise, display Coop signals first.
  return allSignals
    .filter(
      (it) =>
        it.eligibleInputs.includes(scalarType) &&
        it.type !== GQLSignalType.Custom,
    )
    .sort((a, b) => {
      if (
        (a.integration == null && b.integration == null) ||
        (a.integration && b.integration)
      ) {
        return a.name.localeCompare(b.name);
      }
      return a.integration ? 1 : -1;
    });
}

export function isConditionComplete(condition: RuleFormCondition): boolean {
  if (isConditionSet(condition)) {
    return condition.conditions.every(isConditionComplete);
  }
  // If the input is null, return false
  if (!condition.input) {
    return false;
  }
  // If the input is nonnull and it has eligible signals, but no signal is selected, return false
  if (
    condition.eligibleSignals &&
    [...condition.eligibleSignals.values()].flat().length > 0 &&
    !condition.signal &&
    !(
      condition.input.type === 'CONTENT_COOP_INPUT' &&
      condition.input.name === 'Creation Source'
    )
  ) {
    return false;
  }
  // If the input or signal require matching values and they're not provided, return false
  if (
    !condition.matchingValues &&
    condition.signal?.shouldPromptForMatchingValues
  ) {
    return false;
  }
  // If the input or signal require a threshold and it's not provided, return false
  if (!condition.comparator && completeConditionNeedsComparator(condition)) {
    return false;
  }
  // If the input or signal require a comparator and it's not provided, return false
  if (
    !condition.threshold &&
    shouldConditionPromptForComparatorAndThreshold(condition) &&
    !isComparatorTerminal(condition)
  ) {
    return false;
  }
  return true;
}

/**
 * This function can be used to see if the user has actually selected anything within a
 * given condition or condition set
 */
export function conditionHasUserInput(condition: RuleFormCondition): boolean {
  if (isConditionSet(condition)) {
    return condition.conditions.some((c) => conditionHasUserInput(c));
  }

  return (
    condition.input != null ||
    condition.signal != null ||
    condition.matchingValues != null ||
    condition.comparator != null ||
    condition.threshold != null
  );
}

/**
 * Looks for a ConditionInput object inside an Array. Objects need to be
 * shallow-compared to each other to determine equality of all the fields
 */
export function conditionsIncludeInput(
  arr: SimplifiedConditionInput[] | undefined,
  input: SimplifiedConditionInput | undefined,
) {
  return (
    arr != null &&
    input != null &&
    // This pickBy is necessary because the GraphQL server sends back optional
    // fields as null, and we need to remove them to compare properly. It's
    // possible that there's a scenario where we'd need to do it for the full
    // condition as well, but for now this works in the case of editing an
    // existing condition.
    arr.some((element) => isEqual(element, pickBy(input)))
  );
}

/**
 * NB: THE ONLY REASON THIS LOGIC CURRENTLY WORKS IS THAT WE DO NOT SUPPORT
 * SIGNALS WITH NUMBER INPUT TYPES. ONCE WE SUPPORT THAT, WE'RE GOING TO NEED
 * TO FIGURE OUT HOW TO MERGE THE SIGNAL AND COMPARATOR DROPDOWNS IN ORDER TO
 * ENABLE USERS TO PIPE NUMBERS INTO SIGNALS AS WELL AS PERFORM DIRECT COMPARISONS
 *
 * This function is used to determine whether the front-end should display
 * a comparator input and a threshold input for a given condition.
 *
 * For example, an ML model that outputs a score would require a threshold
 * and a comparison (i.e. "if the text scores greater than 0.8 on Hive's
 * hate speech model").
 *
 * Other models would not require threshold and comparators. For example,
 * given a signal that outputs a boolean, adding a comparator and threshold for
 * "equals true" is redundant, so things like whether text contains particular
 * words or match a specific regex do not need the threshold or comparator inputs.
 *
 * There are two scenarios to handle here. The first is for inputs with eligible
 * signals. The main cases here are:
 *    - The condition has no selected signal
 *        In this case, the condition should not prompt for a threshold because
 *        there's nothing to compare with yet
 *    - Signal returns a boolean
 *        This is mentioned above, but having a threshold and comparator for a
 *        signal that returns a boolean isn't necessary because "is true" is
 *        implied
 *    - Signal returns a non-boolean
 *        In this case, we require threshold and comparator inputs because
 *        non-boolean signal outputs like ML model scores or user scores
 *        must be compared to something to output a boolean result.
 *
 * The second scenario is for inputs without any eligible signals. In that case,
 * we always need comparator and threshold inputs to render in order to form a
 * logical statement with a boolean result.
 */
export function shouldConditionPromptForComparatorAndThreshold(
  condition: RuleFormLeafCondition,
) {
  const signal = condition.signal;
  if (
    condition.input?.type === 'CONTENT_COOP_INPUT' &&
    condition.input.name === 'Creation Source'
  ) {
    return true;
  }
  if (!signal) {
    // If there's no signal, check to see if a signal is even required,
    // by looking at the eligible signals for the given input.
    const eligibleSignals = condition.eligibleSignals;
    // TODO: should this actually be true? I'm not sure how a condition
    // would have a null eligible signals value
    if (!eligibleSignals) {
      return false;
    }

    // If there are no eligible signals, a comparator + threshold must be
    // required to form a statement for the rule to evaluate. If there
    // are eligible signals, then it means a signal just hasn't been selected
    // yet, and we should not show the threshold and comparator yet.
    return eligibleSignals.length === 0;
  }

  return signal.outputType.scalarType !== GQLScalarType.Boolean;
}

/**
 * See comment on serializeConditionSet for context. This is a helper
 * that serializes an individual LeafCondition into a GraphQL input–compatible
 * schema.
 */
const serializeLeafCondition = (
  condition: RuleFormLeafCondition,
): GQLConditionInput => {
  const input = condition.input!;
  const { matchingValues } = condition;
  const { strings, textBankIds, locations, locationBankIds, imageBankIds } =
    matchingValues ?? {};

  const signalArgs = (() => {
    if (!condition.signal?.args) {
      return null;
    }
    switch (condition.signal.args.__typename) {
      case 'AggregationSignalArgs':
        // TODO: Implement this when we build the spam rules UI
        return null;
      default:
        // Exhaustiveness check - should never reach here
        return null;
    }
  })();

  return {
    input: (() => {
      switch (input.type) {
        case 'CONTENT_DERIVED_FIELD':
          return {
            ...input,
            spec: {
              derivationType: input.spec.derivationType,
              source: taggedUnionToOneOfInput(input.spec.source, {
                DerivedFieldFieldSource: 'contentField',
                DerivedFieldFullItemSource: 'fullItem',
                DerivedFieldCoopInputSource: 'contentCoopInput',
              }),
            },
          };
        case 'CONTENT_COOP_INPUT':
          return safePick(input, ['type', 'name']);
        case 'CONTENT_FIELD':
        case 'FULL_ITEM':
        case 'USER_ID':
          return input;
      }
    })(),
    signal: condition.signal && {
      ...safePick(condition.signal, ['id', 'type', 'name', 'subcategory']),
      args: signalArgs,
    },
    // Condense MatchingValues so we don't send the entire matching banks
    // to the server, but rather just the bank IDs.
    matchingValues: matchingValues
      ? {
          ...(strings ? { strings } : undefined),
          ...(locations
            ? { locations: locations.map(locationAreaToLocationAreaInput) }
            : undefined),
          ...(textBankIds ? { textBankIds } : undefined),
          ...(locationBankIds ? { locationBankIds } : undefined),
          ...(imageBankIds ? { imageBankIds } : undefined),
        }
      : null,
    comparator: condition.comparator,
    threshold: condition.threshold
      ? isNaN(Number(condition.threshold))
        ? condition.threshold
        : Number(condition.threshold)
      : null,
  };
};

type SerializedLeafCondition = ReturnType<typeof serializeLeafCondition>;
type SerializedConditionSet = {
  conjunction: GQLConditionConjunction;
  conditions: (SerializedConditionSet | SerializedLeafCondition)[];
};

/**
 * This function serializes a ConditionSet object into a format compatible
 * with our GraphQL input types. This object is passed into the createRule and
 * updateRule mutations. The original ConditionSet has much more information
 * than the GraphQL mutations need, so we strip a lot of it away.
 */
export const serializeConditionSet = (
  conditionSet: RuleFormConditionSet,
): SerializedConditionSet => {
  const { conjunction, conditions } = conditionSet;
  return {
    conjunction,
    conditions: conditions.map((it) =>
      isConditionSet(it)
        ? serializeConditionSet(it)
        : serializeLeafCondition(it),
    ),
  };
};

export function getInvalidRegexesInCondition(
  condition: RuleFormCondition,
): string[] {
  if (isConditionSet(condition)) {
    return condition.conditions.flatMap(getInvalidRegexesInCondition);
  } else {
    return (
      condition.matchingValues?.strings?.filter(
        (regex) => regex && !isValidRegexString(regex),
      ) ?? []
    );
  }
}

export function containsInvalidThreshold(
  condition: RuleFormCondition,
): boolean {
  // handle condition sets and leaf conditions
  return 'conditions' in condition
    ? condition.conditions.some(containsInvalidThreshold)
    : conditionHasInvalidThreshold(condition);
}

export function isComparatorTerminal(condition: RuleFormLeafCondition) {
  return (
    condition.comparator === GQLValueComparator.IsUnavailable ||
    condition.comparator === GQLValueComparator.IsNotProvided
  );
}

export function getGQLScalarType(it: Pick<GQLBaseField, 'container' | 'type'>) {
  return it.container
    ? it.container.valueScalarType
    : (it.type as GQLScalarType);
}

export function getConditionInputScalarType(
  contentTypes: readonly RuleFormItemType[],
  input: SimplifiedConditionInput,
) {
  switch (input.type) {
    case 'FULL_ITEM':
      return null;
    case 'USER_ID':
      return GQLScalarType.UserId;
    case 'CONTENT_FIELD':
      const contentType = contentTypes.find(
        (it) => it.id === input.contentTypeId,
      )!;
      return getGQLScalarType(
        contentType.baseFields.find((it) => it.name === input.name)!,
      );
    case 'CONTENT_COOP_INPUT':
      switch (input.name) {
        case CoopInput.SOURCE:
        case CoopInput.ALL_TEXT:
          return GQLScalarType.String;
        case CoopInput.ANY_IMAGE:
          return GQLScalarType.Image;
        case CoopInput.ANY_VIDEO:
          return GQLScalarType.Video;
        case CoopInput.ANY_GEOHASH:
          return GQLScalarType.Geohash;
        case CoopInput.AUTHOR_USER:
          return GQLScalarType.UserId;
        case CoopInput.POLICY_ID:
          return GQLScalarType.PolicyId;
      }
    case 'CONTENT_DERIVED_FIELD':
      return getDerivedFieldOutputType(input.spec.derivationType);
  }
}

// NB: The current implementation assumes that ConditionSets and LeafConditions
// won't be mixed at the same level w/i a ConditionSet's conditions.
export function hasNestedConditionSets(
  conditionSet: RuleFormConditionSet,
): conditionSet is Omit<RuleFormConditionSet, 'conditions'> & {
  conditions: RuleFormConditionSet[];
} {
  return isConditionSet(conditionSet.conditions[0]);
}

export function removeCondition(
  conditionSet: RuleFormConditionSet,
  location: ConditionLocation,
) {
  const { conditionIndex, conditionSetIndex } = location;
  let newConditionSet = cloneDeep(conditionSet);
  if (hasNestedConditionSets(newConditionSet)) {
    const nestedConditionSets = newConditionSet.conditions;
    const newConditions = cloneDeep(
      nestedConditionSets[conditionSetIndex].conditions,
    );
    newConditions.splice(conditionIndex, 1);
    if (newConditions.length > 0) {
      // We haven't deleted every condition in the set
      nestedConditionSets[conditionSetIndex].conditions = [...newConditions];
    } else {
      nestedConditionSets.splice(conditionSetIndex, 1);
    }
    // If, after removing this condition, we now only have one ConditionSet
    // left, then we make it a top-level ConditionSet (rather than a ConditionSet
    // that just contains one ConditionSet within it).
    if (nestedConditionSets.length === 1) {
      newConditionSet = { ...nestedConditionSets[0] };
    } else {
      newConditionSet = {
        ...newConditionSet,
        conditions: [...nestedConditionSets],
      };
    }
  } else {
    newConditionSet.conditions.splice(conditionIndex, 1);
    if (newConditionSet.conditions.length === 0) {
      newConditionSet.conditions = [{}];
    }
  }

  return newConditionSet;
}

export function removeConditionSet(
  conditionSet: RuleFormConditionSet,
  conditionSetIndex: number,
) {
  let newConditionSet = cloneDeep(conditionSet);
  
  if (hasNestedConditionSets(newConditionSet)) {
    const nestedConditionSets = newConditionSet.conditions;
    
    // Only allow deletion if there are multiple condition sets
    if (nestedConditionSets.length > 1) {
      nestedConditionSets.splice(conditionSetIndex, 1);
      
      // If, after removing this condition set, we now only have one ConditionSet
      // left, then we make it a top-level ConditionSet (rather than a ConditionSet
      // that just contains one ConditionSet within it).
      if (nestedConditionSets.length === 1) {
        newConditionSet = { ...nestedConditionSets[0] };
      } else {
        newConditionSet = {
          ...newConditionSet,
          conditions: [...nestedConditionSets],
        };
      }
    }
  }
  
  return newConditionSet;
}

export function ruleHasValidConditions(conditionSet: RuleFormConditionSet) {
  return getFlattenedConditions(conditionSet.conditions).some(
    (condition) =>
      condition.input?.type !== 'USER_ID' && isConditionComplete(condition),
  );
}

/**
 * This function is called when we are editing an existing rule. When we query
 * for the existing rule from the server, we only query for the minimally
 * necessary fields (e.g. we don't query the entire ContentType and Action
 * objects associated with the rule because we only need the IDs and names of
 * those objects).
 *
 * But, the RuleForm component requires us to fill in lots of the missing
 * information that we didn't query for. We do that here.
 *
 * This function takes the LeafCondition of a rule queried via GraphQL, and
 * inserts lots of additional data to make it compatible with the types that the
 * RuleForm expects.
 */
function getTypedLeafConditionFromGQL(
  condition: GQLLeafConditionFieldsFragment,
  selectedContentTypes: readonly RuleFormItemType[],
  allSignals: readonly CoreSignal[],
): RuleFormCondition {
  /** Unfortunately in the RuleFormConfig query, when we query for a
   * derived field spec and fetch different fields based on the
   * GQL object type of the spec's source (e.g. DerivedFieldCoopInputSource
   * vs. DerivedFieldFullItemSource), we had to alias the 'name'
   * field because, due to GQL limitations, we couldn't run a query like
   *
   *  query Q {
   *    ... on DerivedFieldFieldSource {
   *      name
   *    }
   *    ... on DerivedFieldCoopInputSource {
   *      name
   *    }
   *  }
   *
   * So we had to alias the 2nd name param to 'coopInput'. This if
   * statement converts that 'coopInput' prop back to 'name'.
   */
  const { spec } = condition.input;
  const input = {
    ...safePick(condition.input, [
      'type',
      'name',
      'contentTypeId',
      'contentTypeIds',
    ]),
    ...(spec
      ? {
          spec: {
            ...spec,
            source: {
              // fix aliasing of name -> coopInput
              ...omit(spec.source, 'coopInput'),
              ...(spec.source.__typename === 'DerivedFieldCoopInputSource'
                ? { name: spec.source.coopInput }
                : {}),
            },
          },
        }
      : {}),
  } as ConditionInput;

  const eligibleSignals = getEligibleSignalsForInput(
    input,
    selectedContentTypes,
    allSignals,
  );

  // Take the GraphQL signal (just id, type, subcategory) and transform
  // it into the more robust Signal object. Make sure the subcategory
  // is properly set.
  let signal = [...eligibleSignals.values()]
    .flat()
    .find((signal) =>
      signal.type === GQLSignalType.Custom
        ? signal.id === condition.signal?.id
        : signal.type === condition.signal?.type,
    );
  if (signal != null) {
    signal = {
      ...signal,
      subcategory: condition.signal?.subcategory ?? undefined,
      args: condition.signal?.args ?? undefined,
    };
  }

  const { strings, textBankIds, locations, locationBankIds, imageBankIds } = {
    ...condition.matchingValues,
  };

  return {
    input,
    eligibleSignals,
    signal,
    matchingValues: {
      ...(locations
        ? { locations: locations.map(locationAreaToLocationAreaInput) }
        : undefined),
      ...(strings ? { strings } : undefined),
      ...(textBankIds ? { textBankIds } : undefined),
      ...(locationBankIds ? { locationBankIds } : undefined),
      ...(imageBankIds ? { imageBankIds } : undefined),
    },
    comparator: condition.comparator ?? undefined,
    threshold:
      condition.threshold != null ? String(condition.threshold) : undefined,
  };
}

export function getTypedConditionSetFromGQL(
  conditionSet: GQLConditionSetFieldsFragment,
  selectedContentTypes: readonly RuleFormItemType[],
  allSignals: readonly CoreSignal[],
): RuleFormConditionSet {
  return {
    ...conditionSet,
    conditions: conditionSet.conditions.map((condition) =>
      'conjunction' in condition
        ? getTypedConditionSetFromGQL(
            condition as GQLConditionSetFieldsFragment,
            selectedContentTypes,
            allSignals,
          )
        : getTypedLeafConditionFromGQL(
            condition as GQLLeafConditionFieldsFragment,
            selectedContentTypes,
            allSignals,
          ),
    ),
  };
}

export function comparableToHumanReadableString(
  comparator: GQLValueComparator,
) {
  switch (comparator) {
    case GQLValueComparator.Equals:
      return 'is equal to';
    case GQLValueComparator.NotEqualTo:
      return 'is not equal to';
    case GQLValueComparator.GreaterThan:
      return 'is greater than';
    case GQLValueComparator.GreaterThanOrEquals:
      return 'is greater than or equal to';
    case GQLValueComparator.LessThan:
      return 'is less than';
    case GQLValueComparator.LessThanOrEquals:
      return 'is less than or equal to';
    case GQLValueComparator.IsUnavailable:
      return 'could not be determined';
    case GQLValueComparator.IsNotProvided:
      return 'is not provided';
  }
}
