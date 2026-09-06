import { Combobox } from '@/coop-ui/Combobox';
import { Input } from '@/coop-ui/Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { AlertCircle } from 'lucide-react';

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
    <Combobox
      key={`RuleFormCondition-boolean-threshold-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      placeholder="Select true or false"
      value={condition.threshold ?? undefined}
      onValueChange={(value) => onUpdateThreshold(value ?? '')}
      allowClear
      // Threshold is treated as a string until the CreateRule
      // or UpdateRule mutations are called
      options={[
        { value: '1', label: 'true' },
        { value: '0', label: 'false' },
      ]}
    />
  );

  const defaultThreshold = (
    <Input
      key={`RuleFormCondition-threshold-input_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      value={condition.threshold ?? ''}
      placeholder="Input a threshold"
      className={`rounded-lg ${hasInvalidThreshold ? 'border-red-500' : ''}`}
      startSlot={
        hasInvalidThreshold ? (
          <span className="flex items-center px-3 border border-r-0 border-gray-200 bg-white">
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
    const selectOptions: { value: string; label: string }[] = (() => {
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
      return [...signalOutputOptions].reverse().map((option) => ({
        value: option,
        label: option,
      }));
    })();

    return (
      <Combobox
        allowClear
        placeholder="Select a threshold"
        value={condition.threshold ?? undefined}
        onValueChange={(threshold) => onUpdateThreshold(threshold ?? '')}
        options={selectOptions}
      />
    );
  };

  return (
    <div className="flex items-center">
      <div
        key={`RuleFormCondition-threshold-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="!mb-0 !pl-4 !align-middle"
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
      </div>
    </div>
  );
}
