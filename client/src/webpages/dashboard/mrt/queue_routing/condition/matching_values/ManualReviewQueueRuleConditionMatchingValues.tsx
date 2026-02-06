import { GQLScalarType } from '../../../../../../graphql/generated';
import {
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../../rules/types';
import ManualReviewQueueRuleConditionLocationMatchingValues from './ManualReviewQueueRuleConditionLocationMatchingValues';
import ManualReviewQueueRuleConditionMediaMatchingValues from './ManualReviewQueueRuleConditionMediaMatchingValues';
import ManualReviewQueueRuleConditionTextMatchingValues from './ManualReviewQueueRuleConditionTextMatchingValues';

export default function ManualReviewQueueRuleConditionMatchingValues(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  inputScalarType: GQLScalarType | null;
  editing: boolean;
  onUpdateMatchingValues: (
    values: RuleFormLeafCondition['matchingValues'],
  ) => void;
  allConditions?: RuleFormLeafCondition[];
}) {
  const {
    condition,
    location,
    inputScalarType,
    editing,
    onUpdateMatchingValues,
    allConditions = [],
  } = props;

  if (
    !condition.input ||
    !condition.signal ||
    !inputScalarType ||
    !Boolean(condition.signal.shouldPromptForMatchingValues)
  ) {
    return null;
  }

  switch (inputScalarType) {
    case GQLScalarType.Id:
    case GQLScalarType.String:
    case GQLScalarType.Audio:
      return (
        <ManualReviewQueueRuleConditionTextMatchingValues
          condition={condition}
          location={location}
          editing={editing}
          onUpdateTextMatchingValues={(values) =>
            onUpdateMatchingValues({ strings: values })
          }
          onUpdateSelectedBankIds={(bankIds) =>
            onUpdateMatchingValues({ textBankIds: bankIds })
          }
        />
      );
    case GQLScalarType.Geohash:
      return (
        <ManualReviewQueueRuleConditionLocationMatchingValues
          condition={condition}
          editing={editing}
          onUpdateMatchingValues={onUpdateMatchingValues}
        />
      );
    case GQLScalarType.Image:
    case GQLScalarType.Video:
      return (
        <ManualReviewQueueRuleConditionMediaMatchingValues
          condition={condition}
          editing={editing}
          onUpdateSelectedBankIds={(bankIds) =>
            onUpdateMatchingValues({ imageBankIds: bankIds })
          }
          allConditions={allConditions}
        />
      );
    default:
      // The input selected was a custom content type
      return null;
  }
}
