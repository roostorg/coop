import fc from 'fast-check';

import { ConditionCompletionOutcome } from '../models/rules/RuleModel.js';
import type { RuleEvaluationContext } from '../rule_engine/RuleEvaluator.js';
import { SignalType } from '../services/signalsService/index.js';
import {
  LeafConditionArbitrary,
  makeConditionInputReferencingContentArbitrary,
} from '../test/arbitraries/Condition.js';
import { runLeafCondition } from './leafCondition.js';

describe('LeafCondition handling', () => {
  test(
    'should return inapplicable if the condition references contentSubmission ' +
      "values, but there's no content, except if testing for IS_NOT_PROVIDED",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate conditions that reference contentSubmission values, but
          // don't use a custom Signal, since custom signals currently get a
          // different error.
          LeafConditionArbitrary(
            makeConditionInputReferencingContentArbitrary(),
          ).filter((it) => it.signal?.type !== SignalType.CUSTOM),
          async (condition) => {
            const res = await runLeafCondition(condition, {
              input: {},
              org: { id: 'dummy' },
              getSignal() {},
              runSignal() {},
            } as unknown as RuleEvaluationContext);

            expect(res).toEqual({
              outcome:
                condition.comparator === 'IS_NOT_PROVIDED'
                  ? ConditionCompletionOutcome.PASSED
                  : ConditionCompletionOutcome.INAPPLICABLE,
            });
          },
        ),
      );
    },
  );
});
