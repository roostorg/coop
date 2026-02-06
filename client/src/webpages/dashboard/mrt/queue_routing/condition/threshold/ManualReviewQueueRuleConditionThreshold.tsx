import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Input, Select, Tooltip } from 'antd';

import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';
import PolicyDropdown from '@/webpages/dashboard/components/PolicyDropdown';

import {
  GQLScalarType,
  useGQLPoliciesQuery,
} from '../../../../../../graphql/generated';
import { titleCaseEnumString } from '../../../../../../utils/string';
import {
  isComparatorTerminal,
  shouldConditionPromptForComparatorAndThreshold,
} from '../../../../rules/rule_form/RuleFormUtils';
import {
  conditionHasInvalidThreshold,
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../../rules/types';
import { CoopInput } from '../../../../types/enums';
import { ManualReviewQueueRoutingStaticTextField } from '../../ManualReviewQueueRoutingStaticField';
import { RoutingRuleItemType } from '../../types';
import { getInputScalarType } from '../../utils';

const { Option } = Select;

export default function ManualReviewQueueRuleConditionThreshold(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  selectedItemTypes: RoutingRuleItemType[];
  editing: boolean;
  onUpdateThreshold: (threshold: string) => void;
}) {
  const { data } = useGQLPoliciesQuery();

  const { condition, location, selectedItemTypes, editing, onUpdateThreshold } =
    props;
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

  const renderBooleanThreshold =
    outputScalarType === GQLScalarType.Geohash ||
    (!condition.signal &&
      condition.input?.type === 'CONTENT_FIELD' &&
      getInputScalarType(selectedItemTypes, condition.input) === 'BOOLEAN');
  const renderPolicyThreshold =
    condition.input?.type === 'CONTENT_COOP_INPUT' &&
    condition.input.name === CoopInput.POLICY_ID;

  const renderStringThreshold =
    condition.input?.type === 'CONTENT_COOP_INPUT' &&
    condition.input.name === CoopInput.SOURCE;

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
        True
      </Option>
      <Option
        key={`RuleFormCondition-comparator-option_set_index_${conditionSetIndex}_index_${conditionIndex}_false`}
        // Threshold is treated as a string until the CreateRule
        // or UpdateRule mutations are called
        value="0"
      >
        False
      </Option>
    </Select>
  );

  const defaultThreshold = (
    <Input
      key={`RuleFormCondition-threshold-input_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      value={condition.threshold}
      placeholder="Input a threshold"
      className="rounded-lg"
      status={hasInvalidThreshold ? 'error' : ''}
      prefix={
        hasInvalidThreshold ? (
          <Tooltip title="Enter a number">
            <ExclamationCircleOutlined className="text-red-500" />
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

  const policyThreshold = (
    <PolicyDropdown
      policies={data?.myOrg?.policies ?? []}
      onChange={(policyId) => onUpdateThreshold(policyId)}
      selectedPolicyIds={condition.threshold}
      multiple={false}
      placement="topLeft"
    />
  );

  const sourceTypeThreshold = () => {
    const sourceTypes = [
      { value: 'post-actions', displayName: 'Actions Endpoint' },
      { value: 'automated-rule', displayName: 'Automated Rule' },
      { value: 'manual-action-run', displayName: 'Manual Action Run' },
      { value: 'mrt-decision', displayName: 'Reviewer Decision' },
    ].map((source) => (
      <Option
        key={source.value}
        value={source.value}
        label={source.displayName}
      >
        {source.displayName}
      </Option>
    ));
    return (
      <Select
        allowClear
        showSearch
        filterOption={selectFilterByLabelOption}
        placeholder="Select a source"
        dropdownMatchSelectWidth={false}
        value={condition.threshold}
        onChange={(threshold) => onUpdateThreshold(threshold)}
      >
        {sourceTypes}
      </Select>
    );
  };

  return (
    <div className="flex items-center">
      <div
        key={`RuleFormCondition-threshold-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="flex flex-col items-start pl-4 mb-0 align-middle"
      >
        <div className="pb-1 text-sm font-bold whitespace-nowrap">
          {renderBooleanThreshold
            ? 'Value'
            : renderPolicyThreshold
            ? 'Policy'
            : renderStringThreshold
            ? 'Creation Source'
            : 'Threshold'}
        </div>
        {!editing ? (
          <ManualReviewQueueRoutingStaticTextField
            text={
              (renderPolicyThreshold
                ? data?.myOrg?.policies.find(
                    (it) => it.id === condition.threshold,
                  )?.name
                : condition.threshold) ?? ''
            }
          />
        ) : renderBooleanThreshold ? (
          booleanThreshold
        ) : renderSelectThreshold ? (
          selectThreshold([...signalOutputOptions])
        ) : renderPolicyThreshold ? (
          policyThreshold
        ) : renderStringThreshold ? (
          sourceTypeThreshold()
        ) : (
          defaultThreshold
        )}
        <div className="invisible pb-1 text-sm font-bold whitespace-nowrap">
          {renderBooleanThreshold
            ? 'Value'
            : renderPolicyThreshold
            ? 'Policy'
            : renderStringThreshold
            ? 'Creation Source'
            : 'Threshold'}
        </div>
      </div>
    </div>
  );
}
