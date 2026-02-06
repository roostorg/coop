import { Form, Select } from 'antd';

import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';

import {
  GQLScalarType,
  GQLValueComparator,
} from '../../../../../../graphql/generated';
import { outputTypeToComparators } from '../../../../../../models/signal';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';
import { comparableToHumanReadableString } from '../../RuleFormUtils';
import { completeConditionNeedsComparator } from './comparatorUtils';

const { Option } = Select;

export default function RuleFormConditionComparator(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  inputScalarType: GQLScalarType | null;
  onUpdateConditionComparator: (comparator: GQLValueComparator) => void;
}) {
  const { condition, location, inputScalarType, onUpdateConditionComparator } =
    props;
  if (!completeConditionNeedsComparator(condition)) {
    return null;
  }

  const { conditionSetIndex, conditionIndex } = location;

  const comparatorTypes = condition.signal?.outputType
    ? outputTypeToComparators(condition.signal.outputType)
    : inputScalarType === GQLScalarType.Number
    ? [
        GQLValueComparator.Equals,
        GQLValueComparator.NotEqualTo,
        GQLValueComparator.GreaterThan,
        GQLValueComparator.LessThan,
        GQLValueComparator.GreaterThanOrEquals,
        GQLValueComparator.LessThanOrEquals,
        GQLValueComparator.IsUnavailable,
        GQLValueComparator.IsNotProvided,
      ]
    : [
        GQLValueComparator.Equals,
        GQLValueComparator.NotEqualTo,
        GQLValueComparator.IsUnavailable,
        GQLValueComparator.IsNotProvided,
      ];

  // If there is only one valid comparator to choose from, we should set
  // the condition.comparator value to that value by default
  if (comparatorTypes.length === 1) {
    condition.comparator = comparatorTypes[0];
  }

  return (
    <Form.Item
      key={`RuleFormCondition-comparator-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      className="!mb-0 !pl-4 !align-middle"
      name={[conditionSetIndex, conditionIndex, 'comparator']}
      initialValue={condition.comparator}
    >
      {/* Needs to be wrapped in a div for the state to work properly */}
      <div
        key={`RuleFormCondition-comparator-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="flex flex-col items-start"
      >
        <div className="pb-1 text-xs font-bold">Comparison</div>
        <Select
          key={`RuleFormCondition-comparator-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          placeholder="Select a comparison"
          defaultValue={condition.comparator}
          value={condition.comparator}
          onChange={(value) => onUpdateConditionComparator(value)}
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          dropdownMatchSelectWidth={false}
        >
          {comparatorTypes.map((comparator) => (
            <Option
              key={`RuleFormCondition-comparator-option_set_index_${conditionSetIndex}_index_${conditionIndex}_${comparator}`}
              value={comparator}
              label={comparableToHumanReadableString(comparator)}
            >
              {comparableToHumanReadableString(comparator)}
            </Option>
          ))}
        </Select>
        <div className="invisible pb-1 text-xs font-bold">Comparison</div>
      </div>
    </Form.Item>
  );
}
