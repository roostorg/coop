import { FormInstance } from 'antd';
import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';
import uniqBy from 'lodash/uniqBy';

import {
  GQLConditionConjunction,
  GQLConditionSetFieldsFragment,
  GQLReportingRuleFormOrgDataQuery,
  GQLScalarType,
  GQLSignalType,
  GQLValueComparator,
} from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import { CoopInput } from '../../types/enums';
import { ModalInfo } from '../../types/ModalInfo';
import {
  ConditionInput,
  ConditionLocation,
  RuleFormLeafCondition,
} from '../types';
import { ReportingRuleFormState } from './ReportingRuleForm';
import { VisibleSections } from './RuleForm';
import {
  conditionsIncludeInput,
  getConditionInputScalarType,
  getEligibleSignalsForInput,
  getGQLScalarType,
  getTypedConditionSetFromGQL,
  hasNestedConditionSets,
  removeCondition,
  removeConditionSet,
  SimplifiedConditionInput,
} from './RuleFormUtils';

export type ReportingRuleFormOrgDataResponse = NonNullable<
  GQLReportingRuleFormOrgDataQuery['myOrg']
>;

export enum ReportingRuleFormReducerActionType {
  HideModal = 'HIDE_MODAL',
  ShowModal = 'SHOW_MODAL',
  HideStatusModal = 'HIDE_STATUS_MODAL',
  ShowStatusModal = 'SHOW_STATUS_MODAL',
  DisableSubmitButton = 'DISABLE_SUBMIT_BUTTON',
  AddCondition = 'ADD_CONDITION',
  DeleteCondition = 'DELETE_CONDITION',
  AddConditionSet = 'ADD_CONDITION_SET',
  DeleteConditionSet = 'DELETE_CONDITION_SET',
  UpdateItemTypes = 'UPDATE_ITEM_TYPES',
  UpdateInput = 'UPDATE_INPUT',
  UpdateSignal = 'UPDATE_SIGNAL',
  UpdateSignalArgs = 'UPDATE_SIGNAL_ARGS',
  UpdateSignalSubcategory = 'UPDATE_SIGNAL_SUBCATEGORY',
  UpdateMatchingValues = 'UPDATE_MATCHING_VALUES',
  UpdateComparator = 'UPDATE_COMPARATOR',
  UpdateThreshold = 'UPDATE_THRESHOLD',
  UpdateTopLevelConjunction = 'UPDATE_TOP_LEVEL_CONJUNCTION',
  UpdateNestedConditionSetConjunction = 'UPDATE_NESTED_CONDITION_SET_CONJUNCTION',
  UpdatePolicies = 'UPDATE_POLICIES',
  ShowNextVisibleSection = 'SHOW_NEXT_VISIBLE_SECTION',
  HideRuleMutationError = 'HIDE_RULE_MUTATION_ERROR',
  ShowRuleMutationError = 'SHOW_RULE_MUTATION_ERROR',
  RuleQueryCompleted = 'RULE_QUERY_COMPLETED',
  UpdateRuleName = 'UPDATE_RULE_NAME',
  UpdateRuleDescription = 'UPDATE_RULE_DESCRIPTION',
}

export type ReportingRuleFormReducerAction =
  | {
      type:
        | ReportingRuleFormReducerActionType.HideModal
        | ReportingRuleFormReducerActionType.HideStatusModal
        | ReportingRuleFormReducerActionType.ShowStatusModal
        | ReportingRuleFormReducerActionType.DisableSubmitButton
        | ReportingRuleFormReducerActionType.AddConditionSet
        | ReportingRuleFormReducerActionType.ShowNextVisibleSection
        | ReportingRuleFormReducerActionType.HideRuleMutationError
        | ReportingRuleFormReducerActionType.ShowRuleMutationError;
    }
  | {
      type: ReportingRuleFormReducerActionType.ShowModal;
      payload: { modalInfo: ModalInfo };
    }
  | {
      type: ReportingRuleFormReducerActionType.AddCondition;
      payload: { conditionSetIndex: number };
    }
  | {
      type: ReportingRuleFormReducerActionType.DeleteCondition;
      payload: { location: ConditionLocation };
    }
  | {
      type: ReportingRuleFormReducerActionType.DeleteConditionSet;
      payload: { conditionSetIndex: number };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateItemTypes;
      payload: {
        selectedItemTypes: ReportingRuleFormOrgDataResponse['itemTypes'];
        allActions: ReportingRuleFormOrgDataResponse['actions'];
        allSignals: readonly CoreSignal[];
        form: FormInstance<any>;
      };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateInput;
      payload: {
        location: ConditionLocation;
        input: SimplifiedConditionInput;
        allSignals: readonly CoreSignal[];
      };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateSignal;
      payload: { location: ConditionLocation; signal: CoreSignal };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateSignalArgs;
      payload: { location: ConditionLocation; args: CoreSignal['args'] };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateSignalSubcategory;
      payload: { location: ConditionLocation; subcategory: string };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateMatchingValues;
      payload: {
        location: ConditionLocation;
        matchingValues: RuleFormLeafCondition['matchingValues'];
      };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateComparator;
      payload: { location: ConditionLocation; comparator: GQLValueComparator };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateThreshold;
      payload: { location: ConditionLocation; threshold: string };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateTopLevelConjunction;
      payload: { conjunction: GQLConditionConjunction };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateNestedConditionSetConjunction;
      payload: { conjunction: GQLConditionConjunction };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdatePolicies;
      payload: { policyIds: readonly string[] };
    }
  | {
      type: ReportingRuleFormReducerActionType.RuleQueryCompleted;
      payload: {
        selectedItemTypes: ReportingRuleFormOrgDataResponse['itemTypes'];
        allActions: ReportingRuleFormOrgDataResponse['actions'];
        conditionSet: GQLConditionSetFieldsFragment;
        allSignals: readonly CoreSignal[];
        policyIds: string[];
      };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateRuleName;
      payload: { name: string };
    }
  | {
      type: ReportingRuleFormReducerActionType.UpdateRuleDescription;
      payload: { description: string };
    };

/**
 * This is the main Reducer function that delegates all actions
 */
export function reducer(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction,
): ReportingRuleFormState {
  const { type } = action;
  // Useful for determining the shape of the current conditionSet
  // (i.e. whether it contains ConditionSets or LeafConditions at
  // the top-level layer)
  switch (type) {
    case ReportingRuleFormReducerActionType.HideModal:
      return {
        ...state,
        modalInfo: {
          ...state.modalInfo,
          visible: false,
        },
      };
    case ReportingRuleFormReducerActionType.ShowModal:
      const { modalInfo } = action.payload;
      return {
        ...state,
        modalInfo: {
          ...modalInfo,
          visible: true,
        },
        submitButtonLoading: false,
      };
    case ReportingRuleFormReducerActionType.HideStatusModal:
      return {
        ...state,
        statusModalVisible: false,
      };
    case ReportingRuleFormReducerActionType.ShowStatusModal:
      return {
        ...state,
        statusModalVisible: true,
      };
    case ReportingRuleFormReducerActionType.DisableSubmitButton:
      return {
        ...state,
        submitButtonLoading: true,
      };
    case ReportingRuleFormReducerActionType.AddCondition:
      return addCondition(state, action);
    case ReportingRuleFormReducerActionType.DeleteCondition:
      return deleteCondition(state, action);
    case ReportingRuleFormReducerActionType.AddConditionSet:
      return addConditionSet(state, action);
    case ReportingRuleFormReducerActionType.DeleteConditionSet:
      return deleteConditionSet(state, action);
    case ReportingRuleFormReducerActionType.UpdateItemTypes:
      return updateItemTypes(state, action);
    case ReportingRuleFormReducerActionType.UpdateInput:
      return updateInput(state, action);
    case ReportingRuleFormReducerActionType.UpdateSignal:
      return updateSignal(state, action);
    case ReportingRuleFormReducerActionType.UpdateSignalArgs:
      return updateSignalArgs(state, action);
    case ReportingRuleFormReducerActionType.UpdateSignalSubcategory:
      return updateSignalSubcategory(state, action);
    case ReportingRuleFormReducerActionType.UpdateMatchingValues:
      return updateMatchingValues(state, action);
    case ReportingRuleFormReducerActionType.UpdateComparator:
      return updateComparator(state, action);
    case ReportingRuleFormReducerActionType.UpdateThreshold:
      return updateThreshold(state, action);
    case ReportingRuleFormReducerActionType.UpdateTopLevelConjunction:
      return updateTopLevelConjunction(state, action);
    case ReportingRuleFormReducerActionType.UpdateNestedConditionSetConjunction:
      return updateNestedConditionSetConjunction(state, action);
    case ReportingRuleFormReducerActionType.UpdatePolicies:
      return {
        ...state,
        policyIds: [...action.payload.policyIds],
        ruleMutationError: false,
      };
    case ReportingRuleFormReducerActionType.ShowNextVisibleSection:
      const { lastVisibleSection } = state;
      return {
        ...state,
        lastVisibleSection:
          lastVisibleSection === VisibleSections.ACTIONS_AND_METADATA
            ? lastVisibleSection
            : lastVisibleSection + 1,
      };
    case ReportingRuleFormReducerActionType.HideRuleMutationError:
      return {
        ...state,
        ruleMutationError: false,
      };
    case ReportingRuleFormReducerActionType.ShowRuleMutationError:
      return {
        ...state,
        ruleMutationError: true,
        submitButtonLoading: false,
      };
    case ReportingRuleFormReducerActionType.RuleQueryCompleted:
      return updateInitialStateWithRule(state, action);
    case ReportingRuleFormReducerActionType.UpdateRuleName: {
      const { name } = action.payload;
      return {
        ...state,
        ruleName: name,
      };
    }
    case ReportingRuleFormReducerActionType.UpdateRuleDescription: {
      const { description } = action.payload;
      return {
        ...state,
        ruleDescription: description,
      };
    }
  }
}

export function addCondition(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.AddCondition;
  },
): ReportingRuleFormState {
  const { conditionSetIndex } = action.payload;

  const newConditionSet = cloneDeep(state.conditionSet);
  if (hasNestedConditionSets(newConditionSet)) {
    const nestedConditionSet = cloneDeep(
      newConditionSet.conditions[conditionSetIndex],
    );
    nestedConditionSet.conditions.push({});
    newConditionSet.conditions.splice(conditionSetIndex, 1, nestedConditionSet);
  } else {
    newConditionSet.conditions.push({});
  }
  // Need to spread the array - otherwise React thinks the state hasn't changed
  return {
    ...state,
    ruleMutationError: false,
    conditionSet: newConditionSet,
  };
}

export function deleteCondition(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.DeleteCondition;
  },
): ReportingRuleFormState {
  const { location } = action.payload;

  return {
    ...state,
    ruleMutationError: false,
    conditionSet: removeCondition(state.conditionSet, location),
  };
}

function addConditionSet(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction,
): ReportingRuleFormState {
  let newConditionSet = cloneDeep(state.conditionSet);

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
  return {
    ...state,
    conditionSet: { ...newConditionSet },
    ruleMutationError: false,
  };
}

function deleteConditionSet(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.DeleteConditionSet;
  },
): ReportingRuleFormState {
  const { conditionSetIndex } = action.payload;

  return {
    ...state,
    ruleMutationError: false,
    conditionSet: removeConditionSet(state.conditionSet, conditionSetIndex),
  };
}

/**
 * Given a list of selected item types, return a Map<input group name,
 * Array<Input>>. We want to figure out all the eligible inputs for this
 * condition based on the item types selected. We then need to group those
 * inputs into categories (e.g. aggregate "coop" inputs, custom fields on
 * item types, full item type objects, etc.). Those group names are the
 * map's keys, and each corresponding value is a list of inputs in that group.
 * The groups are added to the map in an order that's convenient for the UI.
 */
export function getNewEligibleInputs(
  selectedItemTypes: ReportingRuleFormOrgDataResponse['itemTypes'],
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

  const customItemTypeInputs = selectedItemTypes
    .filter((itemType) => {
      const eligibleSignals = getEligibleSignalsForInput(
        { type: 'FULL_ITEM', contentTypeIds: [itemType.id] },
        [itemType],
        allSignals,
      );

      // If there are any custom signals that run on this item type, then
      // add the full item type object as an additional input.
      // Note: this filter isn't technically needed, but in the future we might
      // allow non-custom signals to run on item types, so we keep it here
      // so future devs don't need to remember to add it.
      return eligibleSignals.filter((it) => it.type === GQLSignalType.Custom)
        .length;
    })
    .map((itemType) => ({
      type: 'FULL_ITEM' as const,
      contentTypeIds: [itemType.id],
    }));

  const itemTypeFieldInputGroups = selectedItemTypes.map(
    (itemType) =>
      [
        `${itemType.name} Fields`,
        itemType.baseFields.map((field) => ({
          type: 'CONTENT_FIELD' as const,
          name: field.name,
          contentTypeId: itemType.id,
        })),
      ] as const,
  );

  // NB: type annotation here is important for making sure that all our input
  // groups built above are (and remain) assignable to ConditionInput[].
  // const userInputs = [{ type: 'USER_ID' } as const];
  const finalInputGroups: readonly (readonly [string, ConditionInput[]])[] = [
    ['Aggregate Inputs', aggregateInputs],
    // TODO: Figure out what to do with user scores
    // ['User Inputs', userInputs],
    ['Custom Item Types', customItemTypeInputs],
    ...itemTypeFieldInputGroups,
  ] as const;

  // We don't want to display any empty input groups, so we remove
  // key/value pairs where the value is an empty array.
  return new Map(finalInputGroups.filter((it) => it[1].length > 0));
}

// Figure out which Actions can be selected in the Action dropdown based
// on the selected item types
function getNewEligibleActions(
  selectedItemTypes: ReportingRuleFormOrgDataResponse['itemTypes'],
  allActions: ReportingRuleFormOrgDataResponse['actions'],
) {
  return allActions.filter((action) =>
    selectedItemTypes.every((itemType) =>
      action.itemTypes.map((it) => it.id).includes(itemType.id),
    ),
  );
}

export function updateItemTypes(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateItemTypes;
  },
): ReportingRuleFormState {
  const { selectedItemTypes, allActions, allSignals } = action.payload;
  const newEligibleInputs = getNewEligibleInputs(selectedItemTypes, allSignals);

  // Delete any conditions that now have ineligible inputs if a
  // ContentType was deselected. We have to delete conditions one at a time
  // in reverse order. If we started with the first condition, all other conditions
  // would shift up and the indices would change before we delete the rest.
  const conditionsToDelete: ConditionLocation[] = [];
  let newConditionSet = cloneDeep(state.conditionSet);
  const flattenedNewEligibleInputs = Array.from(
    newEligibleInputs.values(),
  ).flat();
  if (hasNestedConditionSets(newConditionSet)) {
    const conditionSets = newConditionSet.conditions;
    conditionSets.forEach((conditionSet, conditionSetIndex) =>
      conditionSet.conditions.forEach((condition, conditionIndex) => {
        const leafCondition = condition as RuleFormLeafCondition;
        if (
          leafCondition.input != null &&
          !conditionsIncludeInput(
            flattenedNewEligibleInputs,
            leafCondition.input,
          )
        ) {
          conditionsToDelete.push({ conditionIndex, conditionSetIndex });
        }
      }),
    );
  } else {
    newConditionSet.conditions.forEach((condition, conditionIndex) => {
      const leafCondition = condition as RuleFormLeafCondition;
      if (
        leafCondition.input != null &&
        !conditionsIncludeInput(flattenedNewEligibleInputs, leafCondition.input)
      ) {
        conditionsToDelete.push({ conditionIndex, conditionSetIndex: 0 });
      }
    });
  }
  // Delete in reverse order
  conditionsToDelete.sort((first, second) => {
    if (first.conditionSetIndex > second.conditionSetIndex) {
      return -1;
    } else if (first.conditionSetIndex < second.conditionSetIndex) {
      return 1;
    }
    return first.conditionIndex > second.conditionIndex ? -1 : 1;
  });
  conditionsToDelete.forEach((conditionLocation) => {
    newConditionSet = removeCondition(newConditionSet, conditionLocation);
  });

  const newEligibleActions = getNewEligibleActions(
    selectedItemTypes,
    allActions,
  );

  return {
    ...state,
    ruleMutationError: false,
    conditionSet: { ...newConditionSet },
    selectedItemTypes,
    eligibleInputs: newEligibleInputs,
    eligibleActions: [...newEligibleActions],
  };
}

export function updateInput(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateInput;
  },
): ReportingRuleFormState {
  const { location, input, allSignals } = action.payload;
  const { conditionIndex, conditionSetIndex } = location;
  const newConditionSet = cloneDeep(state.conditionSet);

  const hasNestedSets = hasNestedConditionSets(newConditionSet);

  const newConditions = hasNestedSets
    ? (newConditionSet.conditions[conditionSetIndex]
        .conditions as RuleFormLeafCondition[])
    : (newConditionSet.conditions as RuleFormLeafCondition[]);

  const newScalarType = getConditionInputScalarType(
    state.selectedItemTypes,
    input,
  );

  // If the previously selected input was a different type than the newly
  // selected input, clear out all subsequent fields.
  const oldInput = newConditions[conditionIndex].input;
  if (oldInput != null) {
    const oldScalarType = getConditionInputScalarType(
      state.selectedItemTypes,
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
    state.selectedItemTypes,
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
  return {
    ...state,
    ruleMutationError: false,
    conditionSet: { ...newConditionSet },
  };
}

/**
 *
 * @param state - RuleForm's state
 * @param location - Location of the condition to update
 * @param value - the new value that was selected/inputed into one
 * of the condition's fields
 * @param updateProp - a function that takes a LeafCondition object,
 * updates it to contain the newly selected/inputed value, and returns
 * the mutated LeafCondition
 * @returns - an updated ReportingRuleFormState object with the conditionSet property
 * properly updated.
 */
function updateConditionComponent<T>(
  state: ReportingRuleFormState,
  location: ConditionLocation,
  value: T,
  updateProp: (
    condition: RuleFormLeafCondition,
    value: T,
  ) => RuleFormLeafCondition,
): ReportingRuleFormState {
  const { conditionIndex, conditionSetIndex } = location;
  let newConditionSet = cloneDeep(state.conditionSet);
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

  return {
    ...state,
    ruleMutationError: false,
    conditionSet: { ...newConditionSet },
  };
}

export function updateSignal(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateSignal;
  },
): ReportingRuleFormState {
  const { location, signal } = action.payload;
  return updateConditionComponent(
    state,
    location,
    signal,
    (condition, value) => {
      condition.signal = value;
      condition.threshold = undefined;
      return condition;
    },
  );
}

export function updateSignalArgs(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateSignalArgs;
  },
): ReportingRuleFormState {
  const { location, args } = action.payload;
  return updateConditionComponent(state, location, args, (condition, value) => {
    condition.signal = { ...condition.signal!, args: value };
    return condition;
  });
}

export function updateSignalSubcategory(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateSignalSubcategory;
  },
): ReportingRuleFormState {
  const { location, subcategory } = action.payload;
  return updateConditionComponent(
    state,
    location,
    subcategory,
    (condition, value) => {
      condition.signal = { ...condition.signal!, subcategory: value };
      return condition;
    },
  );
}

export function updateMatchingValues(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateMatchingValues;
  },
): ReportingRuleFormState {
  const { location, matchingValues } = action.payload;
  return updateConditionComponent(
    state,
    location,
    matchingValues,
    (condition, value) => {
      condition.matchingValues = value;
      return condition;
    },
  );
}

export function updateComparator(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateComparator;
  },
): ReportingRuleFormState {
  const { location, comparator } = action.payload;
  return updateConditionComponent(
    state,
    location,
    comparator,
    (condition, value) => {
      condition.comparator = value;
      return condition;
    },
  );
}

export function updateThreshold(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateThreshold;
  },
): ReportingRuleFormState {
  const { location, threshold } = action.payload;
  return updateConditionComponent(
    state,
    location,
    threshold,
    (condition, value) => {
      condition.threshold = value;
      return condition;
    },
  );
}

function updateTopLevelConjunction(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateTopLevelConjunction;
  },
): ReportingRuleFormState {
  const { conjunction } = action.payload;
  return {
    ...state,
    conditionSet: {
      ...state.conditionSet,
      conjunction,
    },
  };
}

function updateNestedConditionSetConjunction(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.UpdateNestedConditionSetConjunction;
  },
): ReportingRuleFormState {
  const { conjunction } = action.payload;
  const { conditionSet } = state;
  return {
    ...state,
    conditionSet: hasNestedConditionSets(conditionSet)
      ? // There are multiple nested condition sets, so we
        // have to update the conjunction of all of them
        {
          ...conditionSet,
          conditions: conditionSet.conditions.map((set) => ({
            ...set,
            conjunction,
          })),
        }
      : { ...conditionSet, conjunction },
  };
}

export function updateInitialStateWithRule(
  state: ReportingRuleFormState,
  action: ReportingRuleFormReducerAction & {
    type: ReportingRuleFormReducerActionType.RuleQueryCompleted;
  },
): ReportingRuleFormState {
  const { selectedItemTypes, conditionSet, allActions, allSignals, policyIds } =
    action.payload;
  return {
    ...state,
    selectedItemTypes,
    conditionSet: getTypedConditionSetFromGQL(
      conditionSet,
      selectedItemTypes,
      allSignals,
    ),
    eligibleInputs: getNewEligibleInputs(selectedItemTypes, allSignals),
    eligibleActions: getNewEligibleActions(selectedItemTypes, allActions),
    policyIds,
    lastVisibleSection: VisibleSections.ACTIONS_AND_METADATA,
  };
}
