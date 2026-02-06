import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Form, Select, Tooltip } from 'antd';

import {
  GQLConditionConjunction,
  GQLScalarType,
  GQLValueComparator,
} from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import { CoopInput } from '../../types/enums';
import {
  ConditionInput,
  ConditionLocation,
  RuleFormConditionSet,
  RuleFormLeafCondition,
  isConditionSet,
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

const { Option } = Select;

export function optionWithTooltip(
  title: string,
  value: string,
  disabled: boolean,
  description: string | undefined,
  key: string, // custom key for the <div> tag - should be unique
  index: number,
  isInOptionGroup: boolean = true,
) {
  return (
    <Option
      key={key + index}
      value={value}
      disabled={disabled}
      style={{ paddingLeft: isInOptionGroup ? 24 : 12 }}
      label={title}
    >
      <div className="flex items-center justify-between">
        <div style={{ paddingRight: 24 }}>{title}</div>
        {description && (
          <Tooltip
            placement="right"
            title={description}
            style={{ background: 'white' }}
          >
            <InfoCircleOutlined style={{ color: 'lightslategray' }} />
          </Tooltip>
        )}
      </div>
    </Option>
  );
}

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
  onUpdateInput: (
    input: SimplifiedConditionInput,
    allSignals: readonly CoreSignal[],
  ) => void;
  onUpdateSignal: (signal: CoreSignal) => void;
  onUpdateSignalSubcategory: (subcategory: string) => void;
  onUpdateSignalArgs: (args: CoreSignal['args']) => void;
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
    <Form.Item
      className={`!mb-0 !align-middle !text-start ${
        parentConditionSet.conditions.length === 1 ? '!w-8' : '!w-[72px]'
      }`}
      name="prefix"
      key={`condition_${conditionSetIndex}_${conditionIndex}`}
    >
      {conditionIndex === 0 ? (
        <span className="pl-3 whitespace-nowrap">If</span>
      ) : (
        <Select
          defaultValue={parentConditionSet.conjunction}
          dropdownMatchSelectWidth={false}
          value={parentConditionSet.conjunction}
          onSelect={(value) => onUpdateNestedConditionSetConjunction(value)}
        >
          <Option
            className="whitespace-nowrap"
            key={GQLConditionConjunction.Or}
            value={GQLConditionConjunction.Or}
          >
            or
          </Option>
          <Option
            className="whitespace-nowrap"
            key={GQLConditionConjunction.And}
            value={GQLConditionConjunction.And}
          >
            and
          </Option>
        </Select>
      )}
    </Form.Item>
  );

  const deleteButton = (
    <Form.Item
      key={`RuleFormCondition-delete-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      name="button"
      // Override default form item styles
      style={{
        width: 32,
        verticalAlign: 'middle',
        marginBottom: 0,
        paddingLeft: 16,
        marginRight: 16,
      }}
    >
      <Button
        key={`RuleFormCondition-delete_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        shape="circle"
        icon={<DeleteOutlined />}
        onClick={onDeleteCondition}
      />
    </Form.Item>
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
        allConditions={parentConditionSet.conditions.filter((c): c is RuleFormLeafCondition => !isConditionSet(c))}
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
