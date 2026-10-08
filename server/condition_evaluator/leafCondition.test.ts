import fc from 'fast-check';

import type { RuleEvaluationContext } from '../rule_engine/RuleEvaluator.js';
import { type ItemSubmission } from '../services/itemProcessingService/index.js';
import {
  ConditionCompletionOutcome,
  CoopInput,
  type LeafCondition,
} from '../services/moderationConfigService/index.js';
import { SignalType } from '../services/signalsService/index.js';
import {
  LeafConditionArbitrary,
  makeConditionInputReferencingContentArbitrary,
} from '../test/arbitraries/Condition.js';
import { jsonStringify } from '../utils/encoding.js';
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

  describe('with multiple input values', () => {
    // Regression: only the first value used to be considered, so a condition
    // that should pass on any value failed whenever the first value didn't
    // match.
    const policyCondition: LeafCondition = {
      input: { type: 'CONTENT_COOP_INPUT', name: CoopInput.POLICY_ID },
      comparator: 'EQUALS',
      threshold: 'wanted',
    };
    const contextWithPolicies = (policyIds: string[]) =>
      ({
        input: { policyIds },
        org: { id: 'dummy' },
      }) as unknown as RuleEvaluationContext;

    test.each([
      [['wanted', 'other'], ConditionCompletionOutcome.PASSED],
      [['other', 'wanted'], ConditionCompletionOutcome.PASSED],
      [['other', 'another'], ConditionCompletionOutcome.FAILED],
    ])(
      'passes on any matching value without a signal (%j)',
      async (policyIds, outcome) => {
        const res = await runLeafCondition(
          policyCondition,
          contextWithPolicies(policyIds),
        );
        expect(res.outcome).toBe(outcome);
      },
    );

    // NOT_EQUAL_TO is also evaluated per value, so it passes when any value
    // differs, not only when none of them equal the threshold.
    test.each([
      [['unwanted', 'other'], ConditionCompletionOutcome.PASSED],
      [['unwanted'], ConditionCompletionOutcome.FAILED],
    ])(
      'passes "is not equal to" when any value differs (%j)',
      async (policyIds, outcome) => {
        const res = await runLeafCondition(
          {
            input: { type: 'CONTENT_COOP_INPUT', name: CoopInput.POLICY_ID },
            comparator: 'NOT_EQUAL_TO',
            threshold: 'unwanted',
          },
          contextWithPolicies(policyIds),
        );
        expect(res.outcome).toBe(outcome);
      },
    );

    const tagsSubmission = (tags: string[]) =>
      ({
        submissionId: 'submission',
        itemId: 'item',
        data: { tags },
        itemType: {
          id: 'type',
          kind: 'CONTENT',
          name: 'Post',
          schema: [
            {
              name: 'tags',
              type: 'ARRAY',
              required: false,
              container: {
                containerType: 'ARRAY',
                keyScalarType: null,
                valueScalarType: 'STRING',
              },
            },
          ],
          schemaFieldRoles: {},
        },
      }) as unknown as ItemSubmission;

    const scoreCondition: LeafCondition = {
      input: { type: 'CONTENT_FIELD', name: 'tags', contentTypeId: 'type' },
      signal: {
        id: jsonStringify({ type: 'TEXT_MATCHING_CONTAINS_TEXT' }),
        type: 'TEXT_MATCHING_CONTAINS_TEXT',
      },
      comparator: 'GREATER_THAN',
      threshold: 0.5,
    };
    const scores: Record<string, number> = { low: 0.1, high: 0.9, mid: 0.3 };
    const contextWithTags = (tags: string[]) =>
      ({
        input: tagsSubmission(tags),
        org: { id: 'dummy' },
        runSignal: async ({ value }: { value: { value: string } }) => ({
          score: scores[value.value],
          outputType: { scalarType: 'NUMBER' },
        }),
      }) as unknown as RuleEvaluationContext;

    test('passes when a later value passes the signal threshold', async () => {
      const res = await runLeafCondition(
        scoreCondition,
        contextWithTags(['low', 'high']),
      );
      expect(res).toMatchObject({
        outcome: ConditionCompletionOutcome.PASSED,
        score: '0.9',
      });
    });

    test('reports the first failure when no value passes', async () => {
      const res = await runLeafCondition(
        scoreCondition,
        contextWithTags(['mid', 'low']),
      );
      expect(res).toMatchObject({
        outcome: ConditionCompletionOutcome.FAILED,
        score: '0.3',
      });
    });
  });
});
