import { Button } from '@/coop-ui/Button';
import { Combobox } from '@/coop-ui/Combobox';
import { Trash2 } from 'lucide-react';

import {
  GQLConditionConjunction,
  GQLScalarType,
  GQLSignal,
  GQLValueComparator,
} from '../../../../graphql/generated';
import { CoopInput } from '../../types/enums';
import {
  ConditionInput,
  ConditionLocation,
  isConditionSet,
  RuleFormConditionSet,
  RuleFormLeafCondition,
} from '../types';
import RuleFormConditionComparator from './condition/comparator/RuleFormConditionComparator';
import { getDerivedFieldOutputType } from './condition/input/derivedField';
import RuleFormConditionInput from './condition/input/RuleFormConditionInput';
import RuleFormConditionMatchingValues from './condition/matching_values/RuleFormConditionMatchingValues';
import RuleFormConditionSignal from './condition/signal/RuleFormConditionSignal';
import RuleFormConditionSignalArgs from './condition/signal/RuleFormConditionSignalArgs';
import RuleFormConditionThreshold from './condition/threshold/RuleFormConditionThreshold';
import { RuleFormConfigResponse } from './RuleFormReducers';
import { getGQLScalarType, SimplifiedConditionInput } from './RuleFormUtils';

function getInputScalarType(
  itemTypes: RuleFormConfigResponse['itemTypes'],
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

/**
 * Condition Options:
 *
 * exact matching selected --> matching values input
 * similarity score selected --> matching values input, comparator, threshold
 * other (later) selected --> comparator, threshold
 *
 * Use signals fetched from GraphQL to determine what to render. Those
 * already store this mapping
 */
export default function RuleFormCondition(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  parentConditionSet: RuleFormConditionSet;
  eligibleInputs: Map<string, ConditionInput[]>;
  selectedItemTypes: RuleFormConfigResponse['itemTypes'];
  allSignals: RuleFormConfigResponse['signals'];
  isAutomatedRule?: boolean;
  onUpdateInput: (
    input: SimplifiedConditionInput,
    allSignals: readonly GQLSignal[],
  ) => void;
  onUpdateSignal: (signal: GQLSignal) => void;
  onUpdateSignalSubcategory: (subcategory: string) => void;
  onUpdateSignalArgs: (args: GQLSignal['args']) => void;
  onUpdateMatchingValues: (
    matchingValues: RuleFormLeafCondition['matchingValues'],
  ) => void;
  onUpdateConditionComparator: (comparator: GQLValueComparator) => void;
  onUpdateThreshold: (threshold: string) => void;
  onDeleteCondition: () => void;
  onUpdateNestedConditionSetConjunction: (
    conjunction: GQLConditionConjunction,
  ) => void;
}) {
  const {
    condition,
    location,
    parentConditionSet,
    eligibleInputs,
    selectedItemTypes,
    allSignals,
    isAutomatedRule,
    onUpdateInput,
    onUpdateSignal,
    onUpdateSignalSubcategory,
    onUpdateSignalArgs,
    onUpdateMatchingValues,
    onUpdateConditionComparator,
    onUpdateThreshold,
    onDeleteCondition,
    onUpdateNestedConditionSetConjunction,
  } = props;
  const { conditionIndex, conditionSetIndex } = location;

  const prefix = (
    <div
      className={`!mb-0 !align-middle !text-start ${
        parentConditionSet.conditions.length === 1 ? '!w-8' : '!w-[72px]'
      }`}
      key={`condition_${conditionSetIndex}_${conditionIndex}`}
    >
      {conditionIndex === 0 ? (
        <span className="pl-3 whitespace-nowrap">If</span>
      ) : (
        <Combobox
          className="whitespace-nowrap"
          showSearch={false}
          value={parentConditionSet.conjunction}
          onValueChange={(value) => {
            if (value != null) {
              onUpdateNestedConditionSetConjunction(
                value as GQLConditionConjunction,
              );
            }
          }}
          options={[
            { value: GQLConditionConjunction.Or, label: 'or' },
            { value: GQLConditionConjunction.And, label: 'and' },
          ]}
        />
      )}
    </div>
  );

  const deleteButton = (
    <div
      key={`RuleFormCondition-delete-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      // Override default form item styles
      style={{
        width: 32,
        marginBottom: 0,
        paddingLeft: 16,
        marginRight: 16,
      }}
    >
      <Button
        type="button"
        key={`RuleFormCondition-delete_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        variant="outline"
        color="gray"
        size="icon"
        className="rounded-full"
        onClick={onDeleteCondition}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  const inputScalarType = getInputScalarType(
    selectedItemTypes,
    condition.input,
  );

  return (
    <div className="flex items-center py-3">
      {prefix}
      <RuleFormConditionInput
        condition={condition}
        location={location}
        eligibleInputs={eligibleInputs}
        selectedItemTypes={selectedItemTypes}
        allSignals={allSignals}
        onUpdateInput={onUpdateInput}
      />
      <RuleFormConditionSignal
        condition={condition}
        location={location}
        onUpdateSignal={onUpdateSignal}
        onUpdateSignalSubcategory={onUpdateSignalSubcategory}
        isAutomatedRule={isAutomatedRule}
      />
      <RuleFormConditionSignalArgs
        condition={condition}
        location={location}
        onUpdateSignalArgs={onUpdateSignalArgs}
      />
      <RuleFormConditionMatchingValues
        condition={condition}
        location={location}
        inputScalarType={inputScalarType}
        onUpdateMatchingValues={onUpdateMatchingValues}
        allConditions={parentConditionSet.conditions.filter(
          (c): c is RuleFormLeafCondition => !isConditionSet(c),
        )}
      />
      <RuleFormConditionComparator
        condition={condition}
        location={location}
        inputScalarType={inputScalarType}
        onUpdateConditionComparator={onUpdateConditionComparator}
      />
      <RuleFormConditionThreshold
        condition={condition}
        location={location}
        onUpdateThreshold={onUpdateThreshold}
      />
      {deleteButton}
    </div>
  );
}
