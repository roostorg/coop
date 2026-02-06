import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';
import uniqBy from 'lodash/uniqBy';

import {
  GQLConditionConjunction,
  GQLScalarType,
  GQLSignalType,
  GQLValueComparator,
} from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import { getDerivedFieldOutputType } from '../../rules/rule_form/condition/input/derivedField';
import {
  getConditionInputScalarType,
  getEligibleSignalsForInput,
  getGQLScalarType,
  hasNestedConditionSets,
  SimplifiedConditionInput,
} from '../../rules/rule_form/RuleFormUtils';
import {
  ConditionInput,
  ConditionLocation,
  RuleFormConditionSet,
  RuleFormLeafCondition,
} from '../../rules/types';
import { CoopInput } from '../../types/enums';
import { RoutingRuleItemType } from './types';

/**
 * Given a list of selected content types, return a Map<input group name,
 * Array<Input>>. We want to figure out all the eligible inputs for this
 * condition based on the content types selected. We then need to group those
 * inputs into categories (e.g. aggregate "coop" inputs, custom fields on
 * content types, full content type objects, etc.). Those group names are the
 * map's keys, and each corresponding value is a list of inputs in that group.
 * The groups are added to the map in an order that's convenient for the UI.
 */
export function getNewEligibleInputs(
  selectedItemTypes: readonly RoutingRuleItemType[],
  allSignals: readonly CoreSignal[],
) {
  const allBaseFields = selectedItemTypes.flatMap((it) => it.baseFields);
  const allDerivedFields = selectedItemTypes.flatMap((it) => it.derivedFields);

  // Determine the eligible "aggregate inputs" (what the backend currently calls
  // "CoopInputs"), like "All text", and also aggregate derived field inputs
  // (like "Any video's transcription"). Because GraphQL doesn't recognize the
  // difference between NULL and an unprovided field, set contentTypeId to be
  // null to preserve shallow equality.
  const aggregateInputFor = (name: CoopInput) => ({
    type: 'CONTENT_COOP_INPUT' as const,
    name,
    contentTypeId: null,
  });

  type AggregateInputDerivedField = (typeof allDerivedFields)[number] & {
    spec: { source: { __typename: 'DerivedFieldCoopInputSource' } };
  };

  const aggregateInputs = uniqBy(
    [
      ...(allBaseFields.some(
        (it) => getGQLScalarType(it) === GQLScalarType.String,
      )
        ? [aggregateInputFor(CoopInput.ALL_TEXT)]
        : []),
      ...(allBaseFields.some(
        (it) => getGQLScalarType(it) === GQLScalarType.Image,
      )
        ? [aggregateInputFor(CoopInput.ANY_IMAGE)]
        : []),
      ...(allBaseFields.some(
        (it) => getGQLScalarType(it) === GQLScalarType.Video,
      )
        ? [aggregateInputFor(CoopInput.ANY_VIDEO)]
        : []),
      ...(allBaseFields.some(
        (it) => getGQLScalarType(it) === GQLScalarType.Geohash,
      )
        ? [aggregateInputFor(CoopInput.ANY_GEOHASH)]
        : []),
      ...[aggregateInputFor(CoopInput.POLICY_ID)],
      ...[aggregateInputFor(CoopInput.SOURCE)],
      ...allDerivedFields
        .filter(
          (it): it is AggregateInputDerivedField =>
            it.spec.source.__typename === 'DerivedFieldCoopInputSource',
        )
        .map((it) => ({
          type: 'CONTENT_DERIVED_FIELD' as const,
          name: it.name,
          spec: {
            ...it.spec,
            source: {
              // undo the aliasing of name -> coopInput.
              ...omit(it.spec.source, 'coopInput'),
              name: it.spec.source.coopInput,
            },
          },
        })),
    ],
    'name',
  );

  const customContentTypeInputs = selectedItemTypes
    .filter((itemType) => {
      const eligibleSignals = getEligibleSignalsForInput(
        { type: 'FULL_ITEM', contentTypeIds: [itemType.id] },
        [itemType],
        allSignals,
      );

      // If there are any custom signals that run on this content type, then
      // add the full content type object as an additional input.
      // Note: this filter isn't technically needed, but in the future we might
      // allow non-custom signals to run on content types, so we keep it here
      // so future devs don't need to remember to add it.
      return eligibleSignals.filter((it) => it.type === GQLSignalType.Custom)
        .length;
    })
    .map((contentType) => ({
      type: 'FULL_ITEM' as const,
      contentTypeIds: [contentType.id],
    }));

  const contentTypeFieldInputGroups = selectedItemTypes.map(
    (contentType) =>
      [
        `${contentType.name} Fields`,
        contentType.baseFields.map((field) => ({
          type: 'CONTENT_FIELD' as const,
          name: field.name,
          contentTypeId: contentType.id,
        })),
      ] as const,
  );

  // NB: type annotation here is important for making sure that all our input
  // groups built above are (and remain) assignable to ConditionInput[].
  const userInputs = [{ type: 'USER_ID' } as const];
  const finalInputGroups: readonly (readonly [string, ConditionInput[]])[] = [
    ['Aggregate Inputs', aggregateInputs],
    ['User Inputs', userInputs],
    ['Custom Content Types', customContentTypeInputs],
    ...contentTypeFieldInputGroups,
  ] as const;

  // We don't want to display any empty input groups, so we remove
  // key/value pairs where the value is an empty array.
  return new Map(finalInputGroups.filter((it) => it[1].length > 0));
}

export function updateConditionInput(params: {
  currentConditionSet: RuleFormConditionSet;
  location: ConditionLocation;
  input: SimplifiedConditionInput;
  selectedItemTypes: RoutingRuleItemType[];
  allSignals: readonly CoreSignal[];
}) {
  const {
    currentConditionSet,
    location,
    input,
    selectedItemTypes,
    allSignals,
  } = params;
  const { conditionIndex, conditionSetIndex } = location;
  const newConditionSet = cloneDeep(currentConditionSet);

  const hasNestedSets = hasNestedConditionSets(newConditionSet);

  const newConditions = hasNestedSets
    ? (newConditionSet.conditions[conditionSetIndex]
        .conditions as RuleFormLeafCondition[])
    : (newConditionSet.conditions as RuleFormLeafCondition[]);

  const newScalarType = getConditionInputScalarType(selectedItemTypes, input);

  // If the previously selected input was a different type than the newly
  // selected input, clear out all subsequent fields.
  const oldInput = newConditions[conditionIndex].input;
  if (oldInput != null) {
    const oldScalarType = getConditionInputScalarType(
      selectedItemTypes,
      oldInput,
    );
    if (oldScalarType !== newScalarType) {
      newConditions[conditionIndex] = {};
    }
  }

  // Update the state with that newly selected input
  newConditions[conditionIndex].input = input;

  // If the newly selected input is just a boolean or geohash field, then the only
  // possible comparator is EQUALS (i.e. === true OR === false).
  if (
    newScalarType === GQLScalarType.Boolean ||
    newScalarType === GQLScalarType.Geohash
  ) {
    newConditions[conditionIndex].comparator = GQLValueComparator.Equals;
    newConditions[conditionIndex].threshold = '1'; // numeric representation of true, in string form
  }

  // Update the eligibleSignals state with all the signals eligible for the new input
  const newEligibleSignals = getEligibleSignalsForInput(
    input,
    selectedItemTypes,
    allSignals,
  );
  newConditions[conditionIndex].eligibleSignals = newEligibleSignals;

  /**
   * If the newly selected input has one fixed signal associated
   * with it (e.g. the input is a geohash, and there's only one signal
   * associated with geohashes), we need to set that signal here.
   */
  const allNewSignals = Array.from(newEligibleSignals.values())
    .flat()
    .filter((signal) => !signal.disabledInfo.disabled);
  if (allNewSignals.length === 1) {
    newConditions[conditionIndex].signal = allNewSignals[0];
  }

  // If the previously selected signal on this condition is no
  // longer compatible with the newly selected input, clear it out,
  // and clear out all subsequent fields in the condition
  if (
    newConditions[conditionIndex].signal != null &&
    // Need to compare IDs instead of objects
    !allNewSignals
      .map((s) => s.type)
      .includes(newConditions[conditionIndex].signal!.type)
  ) {
    // Clear out all other fields on the Condition
    newConditions[conditionIndex] = {
      input,
      eligibleSignals: newEligibleSignals,
    };
  }

  if (hasNestedSets) {
    const nestedConditionSet = {
      ...newConditionSet.conditions[conditionSetIndex],
    };
    nestedConditionSet.conditions.splice(conditionIndex, 1, {
      ...newConditions[conditionIndex],
    });
    newConditionSet.conditions.splice(conditionSetIndex, 1, {
      ...nestedConditionSet,
    });
  } else {
    newConditionSet.conditions.splice(conditionIndex, 1, {
      ...newConditions[conditionIndex],
    });
  }
  return newConditionSet;
}

export function updateTopLevelConjunction(
  currentConditionSet: RuleFormConditionSet,
  conjunction: GQLConditionConjunction,
) {
  return { ...currentConditionSet, conjunction };
}

export function addCondition(
  currentConditionSet: RuleFormConditionSet,
  conditionSetIndex: number,
) {
  const newConditionSet = cloneDeep(currentConditionSet);
  if (hasNestedConditionSets(newConditionSet)) {
    const nestedConditionSet = cloneDeep(
      newConditionSet.conditions[conditionSetIndex],
    );
    nestedConditionSet.conditions.push({});
    newConditionSet.conditions.splice(conditionSetIndex, 1, nestedConditionSet);
  } else {
    newConditionSet.conditions.push({});
  }

  return newConditionSet;
}

export function addConditionSet(currentConditionSet: RuleFormConditionSet) {
  let newConditionSet = cloneDeep(currentConditionSet);

  if (hasNestedConditionSets(newConditionSet)) {
    // There are already multiple conditionSets in the
    // array newConditionSet.conditions, so we just push
    // a new empty one onto the array
    newConditionSet.conditions.push({
      conjunction: newConditionSet.conditions[0].conjunction,
      conditions: [{}],
    });
  } else {
    // newConditionSet.conditions is just an array of
    // LeafConditions, so we place those LeafConditions
    // into a new ConditionSet wrapper, then add an
    // empty ConditionSet at the end.
    newConditionSet = {
      conjunction:
        newConditionSet.conjunction === GQLConditionConjunction.And
          ? GQLConditionConjunction.Or
          : GQLConditionConjunction.And,
      conditions: [
        newConditionSet,
        {
          conjunction: newConditionSet.conjunction,
          conditions: [{}],
        },
      ],
    };
  }

  return newConditionSet;
}

export function updateComparator(params: {
  conditionSet: RuleFormConditionSet;
  location: ConditionLocation;
  comparator: GQLValueComparator;
}) {
  const { conditionSet, location, comparator } = params;

  return updateConditionComponent(
    conditionSet,
    location,
    comparator,
    (condition, value) => ({ ...condition, comparator: value }),
  );
}

export function updateThreshold(params: {
  conditionSet: RuleFormConditionSet;
  location: ConditionLocation;
  threshold: string;
}) {
  const { conditionSet, location, threshold } = params;
  return updateConditionComponent(
    conditionSet,
    location,
    threshold,
    (condition, value) => ({ ...condition, threshold: value }),
  );
}

/**
 *
 * @param conditionSet - Parent condition set for the rule
 * @param location - Location of the condition to update
 * @param value - the new value that was selected/inputed into one
 * of the condition's fields
 * @param updateProp - a function that takes a LeafCondition object,
 * updates it to contain the newly selected/inputed value, and returns
 * the mutated LeafCondition
 * @returns - an updated RuleFormState object with the conditionSet property
 * properly updated.
 */
export function updateConditionComponent<T>(
  conditionSet: RuleFormConditionSet,
  location: ConditionLocation,
  value: T,
  updateProp: (
    condition: RuleFormLeafCondition,
    value: T,
  ) => RuleFormLeafCondition,
) {
  const { conditionIndex, conditionSetIndex } = location;
  let newConditionSet = cloneDeep(conditionSet);
  if (hasNestedConditionSets(newConditionSet)) {
    const nestedConditionSets = [...newConditionSet.conditions];
    const newCondition = updateProp(
      {
        ...nestedConditionSets[conditionSetIndex].conditions[conditionIndex],
      } as RuleFormLeafCondition,
      value,
    );
    nestedConditionSets[conditionSetIndex].conditions.splice(
      conditionIndex,
      1,
      { ...newCondition },
    );
    newConditionSet = {
      ...newConditionSet,
      conditions: [...nestedConditionSets],
    };
  } else {
    newConditionSet.conditions.splice(
      conditionIndex,
      1,
      updateProp(
        newConditionSet.conditions[conditionIndex] as RuleFormLeafCondition,
        value,
      ),
    );
  }

  return newConditionSet;
}

export function getInputScalarType(
  itemTypes: RoutingRuleItemType[],
  input?: SimplifiedConditionInput,
): GQLScalarType | null {
  if (!input) {
    return null;
  }
  switch (input.type) {
    case 'USER_ID':
      return GQLScalarType.UserId;
    case 'FULL_ITEM':
      return null;
    case 'CONTENT_FIELD':
      const field = itemTypes
        .filter((it) => input.contentTypeId === it.id)
        .flatMap((it) => it.baseFields)
        .find((field) => field.name === input.name);

      return field ? getGQLScalarType(field) : null;
    case 'CONTENT_COOP_INPUT':
      switch (input.name) {
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
        case CoopInput.SOURCE:
          return GQLScalarType.String;
      }
    case 'CONTENT_DERIVED_FIELD':
      return getDerivedFieldOutputType(input.spec.derivationType);
  }
}
