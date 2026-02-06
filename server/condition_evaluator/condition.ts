/**
 * @fileoverview Helper functions for the abstract Condition concept
 * (i.e., a Condition could be a ConditionSet or a LeafCondition).
 *
 * NB: We could avoid the need for much of this if we used a more OO approach
 * and let dynamic dispatch figure out whether to call, e.g, ConditionSet.run()
 * or LeafCondition.run(), but then we'd have to marshall all our condition JSON
 * data into class instances and likely mutate those instances as we got results.
 *
 * I think I'd rather have some `isConditionSet` checks than switch into a
 * mutable OO paradigm (and add a lot of boilerplate marshalling). Still, maybe
 * there's a version of that that's worth it? Or some better way to encapsulate
 * the traversal logic, while keeping the functional paradigm? `isConditionSet`
 * is leaking out a lot of places...
 */
import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import {
  ConditionCompletionOutcome,
  ConditionFailureOutcome,
  type ConditionOutcome,
} from '../models/rules/RuleModel.js';
import { getFieldDerivationCost } from '../services/derivedFieldsService/index.js';
import {
  type Condition,
  type ConditionSet,
} from '../services/moderationConfigService/index.js';
import { type SignalId } from '../services/signalsService/index.js';
import { jsonParse } from '../utils/encoding.js';
import { assertUnreachable } from '../utils/misc.js';

const { sum } = _;

export function isConditionSet(
  it: ReadonlyDeep<Condition>,
): it is ConditionSet | ReadonlyDeep<ConditionSet> {
  return 'conjunction' in it && 'conditions' in it;
}

/**
 * This function takes a ConditionCompletionOutcome and returns true, false,
 * or null, representing out how that outcome should be treated in the SQL-like
 * three-valued logic that we apply to condition outcomes.
 *
 * We need this because multiple outcomes have the same treatment
 * (e.g., FAILED and INAPPLICABLE both act as false).
 */
export function outcomeToNullableBool(outcome: ConditionOutcome) {
  switch (outcome) {
    case ConditionCompletionOutcome.PASSED:
      return true;
    case ConditionCompletionOutcome.FAILED:
    case ConditionCompletionOutcome.INAPPLICABLE:
      return false;
    case ConditionFailureOutcome.ERRORED:
      return null;
    default:
      return assertUnreachable(outcome);
  }
}

/**
 * TODO: allow condition + signal cost to be based on the actual input, not just
 * the condition definition. Until we do that, this cost calculation is not
 * gonna be very accurate. E.g., a condition that picks out ANY_VIDEO is gonna
 * have a very different cost if it runs on a content submission with multiple
 * fields that hold arrays of videos and a submission from a content type that
 * has no video fields at all. Similarly, a signal to transcribe a video is
 * gonna have a higher cost if the video is longer. And, a signal that's
 * computing something that's already been cached can run with 0 marginal cost.
 * But, the only way to capture all this is to pass the input to getCost().
 */
export async function getCost(
  condition: ReadonlyDeep<Condition>,
  getSignalCost: (id: SignalId) => Promise<number>,
): Promise<number> {
  if (isConditionSet(condition)) {
    return sum(
      await Promise.all(
        // We know the function passed to map will never throw synchronously
        // (which is what the lint rule is trying to guard against), as all it
        // does is call `getCost`, which is an asnyc function. So, making the
        // map callback async just poinlessly allocates extra promises.
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        condition.conditions.map((c) => getCost(c, getSignalCost)),
      ),
    );
  } else {
    const { signal } = condition;
    const signalCost =
      signal == null ? 0 : await getSignalCost(jsonParse(signal.id));
    const signalInputCost =
      condition.input.type !== 'CONTENT_DERIVED_FIELD'
        ? 0
        : await getFieldDerivationCost(getSignalCost, condition.input.spec);

    return signalInputCost + signalCost;
  }
}
