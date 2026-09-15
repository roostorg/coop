import { Combobox } from '@/coop-ui/Combobox';

import {
  GQLScalarType,
  GQLValueComparator,
} from '../../../../../../graphql/generated';
import { outputTypeToComparators } from '../../../../../../models/signal';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';
import { comparableToHumanReadableString } from '../../RuleFormUtils';
import { completeConditionNeedsComparator } from './comparatorUtils';

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
    <div
      key={`RuleFormCondition-comparator-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      className="!mb-0 !pl-4 !align-middle"
    >
      {/* Needs to be wrapped in a div for the state to work properly */}
      <div
        key={`RuleFormCondition-comparator-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="flex flex-col items-start"
      >
        <div className="pb-1 text-xs font-bold">Comparison</div>
        <Combobox
          key={`RuleFormCondition-comparator-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          placeholder="Select a comparison"
          value={condition.comparator ?? undefined}
          onValueChange={(value) => {
            if (value != null) {
              onUpdateConditionComparator(value as GQLValueComparator);
            }
          }}
          allowClear
          options={comparatorTypes.map((comparator) => ({
            value: comparator,
            label: comparableToHumanReadableString(comparator),
          }))}
        />
        <div className="invisible pb-1 text-xs font-bold">Comparison</div>
      </div>
    </div>
  );
}
