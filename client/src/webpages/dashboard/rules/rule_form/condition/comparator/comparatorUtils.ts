import { isConditionSet, RuleFormCondition } from '../../../types';
import { shouldConditionPromptForComparatorAndThreshold } from '../../RuleFormUtils';

/**
 * Helper function that returns whether or not a Condition (in its complete,
 * filled out form), needs a comparator to be considered valid.
 */
export function completeConditionNeedsComparator(condition: RuleFormCondition) {
  return isConditionSet(condition)
    ? false
    : shouldConditionPromptForComparatorAndThreshold(condition);
}
