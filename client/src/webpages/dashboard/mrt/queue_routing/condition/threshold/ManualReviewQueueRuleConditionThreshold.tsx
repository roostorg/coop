import { Combobox } from '@/coop-ui/Combobox';
import { Input } from '@/coop-ui/Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { AlertCircle } from 'lucide-react';

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
    <Combobox
      key={`RuleFormCondition-boolean-threshold-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      placeholder="Select true or false"
      value={condition.threshold ?? undefined}
      onValueChange={(value) => onUpdateThreshold(value ?? '')}
      allowClear
      // Threshold is treated as a string until the CreateRule / UpdateRule
      // mutations are called
      options={[
        { value: '1', label: 'True' },
        { value: '0', label: 'False' },
      ]}
    />
  );

  const defaultThreshold = (
    <Input
      key={`RuleFormCondition-threshold-input_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      value={condition.threshold}
      placeholder="Input a threshold"
      className={
        hasInvalidThreshold ? 'rounded-lg border-red-500' : 'rounded-lg'
      }
      startSlot={
        hasInvalidThreshold ? (
          <span className="flex items-center px-3 border border-r-0 border-red-500 rounded-l-lg bg-white">
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="w-4 h-4 text-red-500" />
              </TooltipTrigger>
              <TooltipContent>Enter a number</TooltipContent>
            </Tooltip>
          </span>
        ) : undefined
      }
      onChange={(event) => onUpdateThreshold(event.target.value)}
    />
  );

  const selectThreshold = (options: string[]) => {
    const comboOptions = (() => {
      if (
        outputType?.__typename === 'EnumSignalOutputType' &&
        !outputType.ordered
      ) {
        return options
          .sort((a, b) => a.localeCompare(b))
          .map((option) => ({
            value: option,
            label: titleCaseEnumString(option),
          }));
      }

      /**
       * We reverse the order because the output options should always
       * be received in lowest-to-highest order, which is what the RuleEngine
       * requires. We want to display the options in highest-to-lowest order
       * in the UI, which is more intuitive.
       */
      return [...signalOutputOptions]
        .reverse()
        .map((option) => ({ value: option, label: option }));
    })();

    return (
      <Combobox
        allowClear
        placeholder="Select a threshold"
        value={condition.threshold ?? undefined}
        onValueChange={(threshold) => onUpdateThreshold(threshold ?? '')}
        options={comboOptions}
      />
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
    ].map((source) => ({
      value: source.value,
      label: source.displayName,
    }));
    return (
      <Combobox
        allowClear
        placeholder="Select a source"
        value={condition.threshold ?? undefined}
        onValueChange={(threshold) => onUpdateThreshold(threshold ?? '')}
        options={sourceTypes}
      />
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
