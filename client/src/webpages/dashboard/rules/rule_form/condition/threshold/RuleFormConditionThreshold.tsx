import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Form, Input, Select, Tooltip } from 'antd';

import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';

import { GQLScalarType } from '../../../../../../graphql/generated';
import { titleCaseEnumString } from '../../../../../../utils/string';
import {
  conditionHasInvalidThreshold,
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../types';
import {
  isComparatorTerminal,
  shouldConditionPromptForComparatorAndThreshold,
} from '../../RuleFormUtils';

const { Option } = Select;

export default function RuleFormConditionThreshold(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onUpdateThreshold: (threshold: string) => void;
}) {
  const { condition, location, onUpdateThreshold } = props;
  const hasInvalidThreshold =
    condition.threshold != null && conditionHasInvalidThreshold(condition);

  if (
    !shouldConditionPromptForComparatorAndThreshold(condition) ||
    isComparatorTerminal(condition)
  ) {
    return null;
  }

  const { conditionSetIndex, conditionIndex } = location;
  const outputType = condition.signal?.outputType;
  const outputScalarType = outputType?.scalarType;

  const signalOutputOptions =
    outputType?.__typename === 'EnumSignalOutputType' ? outputType.enum : [];
  const renderSelectThreshold = signalOutputOptions?.length;

  const renderBooleanThreshold = outputScalarType === GQLScalarType.Geohash;

  const booleanThreshold = (
    <Select
      key={`RuleFormCondition-boolean-threshold-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      placeholder="Select true or false"
      defaultValue={condition.threshold}
      onChange={(value) => onUpdateThreshold(value)}
      allowClear
      dropdownMatchSelectWidth={false}
    >
      <Option
        key={`RuleFormCondition-comparator-option_set_index_${conditionSetIndex}_index_${conditionIndex}_true`}
        // Threshold is treated as a string until the CreateRule
        // or UpdateRule mutations are called
        value="1"
      >
        true
      </Option>
      <Option
        key={`RuleFormCondition-comparator-option_set_index_${conditionSetIndex}_index_${conditionIndex}_false`}
        // Threshold is treated as a string until the CreateRule
        // or UpdateRule mutations are called
        value="0"
      >
        false
      </Option>
    </Select>
  );

  const defaultThreshold = (
    <Input
      key={`RuleFormCondition-threshold-input_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      value={condition.threshold}
      placeholder="Input a threshold"
      style={{ borderRadius: '8px' }}
      status={hasInvalidThreshold ? 'error' : ''}
      prefix={
        hasInvalidThreshold ? (
          <Tooltip title="Enter a number">
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          </Tooltip>
        ) : (
          <span />
        )
      }
      onChange={(event) => onUpdateThreshold(event.target.value)}
    />
  );

  const selectThreshold = (options: string[]) => {
    const selectOptions = (() => {
      if (
        outputType?.__typename === 'EnumSignalOutputType' &&
        !outputType.ordered
      ) {
        return options
          .sort((a, b) => a.localeCompare(b))
          .map((option) => (
            <Option
              key={option}
              value={option}
              label={titleCaseEnumString(option)}
            >
              {titleCaseEnumString(option)}
            </Option>
          ));
      }

      /**
       * We reverse the order because the output options should always
       * be received in lowest-to-highest order, which is what the RuleEngine
       * requires. We want to display the options in highest-to-lowest order
       * in the UI, which is more intuitive.
       */
      return [...signalOutputOptions].reverse().map((option) => (
        <Option key={option} value={option} label={option}>
          {option}
        </Option>
      ));
    })();

    return (
      <Select
        allowClear
        showSearch
        filterOption={selectFilterByLabelOption}
        placeholder="Select a threshold"
        dropdownMatchSelectWidth={false}
        value={condition.threshold}
        onChange={(threshold) => onUpdateThreshold(threshold)}
      >
        {selectOptions}
      </Select>
    );
  };

  return (
    <div className="flex items-center">
      <Form.Item
        key={`RuleFormCondition-threshold-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="!mb-0 !pl-4 !align-middle"
        name={[conditionSetIndex, conditionIndex, 'threshold']}
        initialValue={condition.threshold}
      >
        {/* Needs to be wrapped in a div for the state to work properly */}
        <div
          key={`RuleFormCondition-threshold-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          className="flex flex-col items-start"
        >
          <div className="pb-1 text-xs font-bold">
            {renderBooleanThreshold ? 'Value' : 'Threshold'}
          </div>
          {renderBooleanThreshold
            ? booleanThreshold
            : renderSelectThreshold
            ? selectThreshold([...signalOutputOptions])
            : defaultThreshold}
          <div className="invisible pb-1 text-xs font-bold">
            {renderBooleanThreshold ? 'Value' : 'Threshold'}
          </div>
        </div>
      </Form.Item>
    </div>
  );
}
