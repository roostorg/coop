import { Combobox } from '@/coop-ui/Combobox';

import {
  GQLScalarType,
  GQLValueComparator,
} from '../../../../../../graphql/generated';
import { outputTypeToComparators } from '../../../../../../models/signal';
import { completeConditionNeedsComparator } from '../../../../rules/rule_form/condition/comparator/comparatorUtils';
import { comparableToHumanReadableString } from '../../../../rules/rule_form/RuleFormUtils';
import {
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../../rules/types';
import { ManualReviewQueueRoutingStaticTextField } from '../../ManualReviewQueueRoutingStaticField';

export default function ManualReviewQueueRuleConditionComparator(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  inputScalarType: GQLScalarType | null;
  editing: boolean;
  onUpdateComparator: (comparator: GQLValueComparator) => void;
}) {
  const { condition, location, inputScalarType, editing, onUpdateComparator } =
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
      key={`RuleFormCondition-comparator-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      className="flex flex-col items-start pl-3"
    >
      <div className="pb-1 text-sm font-bold whitespace-nowrap">Comparison</div>
      {editing ? (
        <Combobox
          key={`RuleFormCondition-comparator-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          placeholder="Select a comparison"
          value={condition.comparator ?? undefined}
          onValueChange={(value) => {
            if (value != null) {
              onUpdateComparator(value as GQLValueComparator);
            }
          }}
          options={comparatorTypes.map((comparator) => ({
            value: comparator,
            label: comparableToHumanReadableString(comparator),
          }))}
        />
      ) : (
        <ManualReviewQueueRoutingStaticTextField
          text={
            condition.comparator
              ? comparableToHumanReadableString(condition.comparator)
              : ''
          }
        />
      )}
      <div className="invisible pb-1 text-sm font-bold whitespace-nowrap">
        Comparison
      </div>
    </div>
  );
}
