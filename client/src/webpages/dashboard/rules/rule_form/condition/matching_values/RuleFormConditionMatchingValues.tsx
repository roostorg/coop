/* eslint-disable no-console */
import { GQLScalarType } from '../../../../../../graphql/generated';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';
import RuleFormConditionLocationMatchingValues from './RuleFormConditionLocationMatchingValues';
import RuleFormConditionMediaMatchingValues from './RuleFormConditionMediaMatchingValues';
import RuleFormConditionTextMatchingValues from './RuleFormConditionTextMatchingValues';

export default function RuleFormConditionMatchingValues(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  inputScalarType: GQLScalarType | null;
  onUpdateMatchingValues: (
    matchingValues: RuleFormLeafCondition['matchingValues'],
  ) => void;
  allConditions?: RuleFormLeafCondition[];
}) {
  const { condition, location, inputScalarType, onUpdateMatchingValues, allConditions = [] } = props;

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
        <RuleFormConditionTextMatchingValues
          condition={condition}
          location={location}
          onUpdateMatchingValues={onUpdateMatchingValues}
        />
      );
    case GQLScalarType.Geohash:
      return (
        <RuleFormConditionLocationMatchingValues
          condition={condition}
          onUpdateMatchingValues={onUpdateMatchingValues}
        />
      );
    case GQLScalarType.Image:
    case GQLScalarType.Video:
      return (
        <RuleFormConditionMediaMatchingValues
          condition={condition}
          location={location}
          onUpdateMatchingValues={onUpdateMatchingValues}
          allConditions={allConditions}
        />
      );
    default:
      // The input selected was a custom content type
      return null;
  }
}
