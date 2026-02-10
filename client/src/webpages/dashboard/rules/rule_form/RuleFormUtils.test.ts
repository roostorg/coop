import {
  GQLConditionConjunction,
  GQLScalarType,
  GQLSignalPricingStructureType,
  GQLSignalType,
} from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import { RuleFormConditionSet, RuleFormLeafCondition } from '../types';
import {
  getConditionInputScalarType,
  removeConditionSet,
  shouldConditionPromptForComparatorAndThreshold,
} from './RuleFormUtils';

jest.mock('./RuleFormUtils', () => {
  const origin = jest.requireActual('./RuleFormUtils');
  return { ...origin, getConditionInputScalarType: jest.fn() };
});

// NB: See docs above shouldConditionPromptForComparatorAndThreshold
// above the caveats for this particular implementation
describe('Test Rule Form Utils', () => {
  const sampleSignal: CoreSignal = {
    id: '1234',
    type: GQLSignalType.TextMatchingContainsRegex,
    shouldPromptForMatchingValues: false,
    eligibleSubcategories: [],
    eligibleInputs: [],
    name: 'Some signal',
    description: 'Some description',
    disabledInfo: { __typename: 'DisabledInfo', disabled: false },
    outputType: {
      __typename: 'ScalarSignalOutputType',
      scalarType: GQLScalarType.Boolean,
    },
    pricingStructure: {
      __typename: 'SignalPricingStructure',
      type: GQLSignalPricingStructureType.Free,
    },
    supportedLanguages: { __typename: 'AllLanguages', _: true },
    allowedInAutomatedRules: true,
  };

  describe('Test should show comparator/threshold for condition', () => {
    it('Empty condition should not show comparator/threshold', () => {
      const emptyCondition: RuleFormLeafCondition = {};
      expect(
        shouldConditionPromptForComparatorAndThreshold(emptyCondition),
      ).toEqual(false);
    });

    it('Condition with input, no eligible signals should show comparator/threshold', () => {
      const condition: RuleFormLeafCondition = {
        input: {
          type: 'CONTENT_FIELD',
          name: 'num_likes',
          contentTypeId: '12345',
        },
        eligibleSignals: [],
      };
      expect(shouldConditionPromptForComparatorAndThreshold(condition)).toEqual(
        true,
      );
    });

    it('Condition with input and eligible signals, but selected signal, should not show comparator/threshold', () => {
      const condition: RuleFormLeafCondition = {
        input: {
          type: 'CONTENT_FIELD',
          name: 'num_likes',
          contentTypeId: '12345',
        },
        eligibleSignals: [sampleSignal],
      };

      (getConditionInputScalarType as jest.Mock).mockReturnValue([
        sampleSignal,
      ]);
      expect(shouldConditionPromptForComparatorAndThreshold(condition)).toEqual(
        false,
      );
    });

    it('Condition with input and selected signal with boolean output should not show comparator/threshold', () => {
      const condition: RuleFormLeafCondition = {
        input: {
          type: 'CONTENT_FIELD',
          name: 'num_likes',
          contentTypeId: '12345',
        },
        eligibleSignals: [sampleSignal],
        signal: sampleSignal,
      };

      (getConditionInputScalarType as jest.Mock).mockReturnValue([
        sampleSignal,
      ]);
      expect(shouldConditionPromptForComparatorAndThreshold(condition)).toEqual(
        false,
      );
    });

    it('Condition with input and selected signal with non-boolean output should show comparator/threshold', () => {
      const condition: RuleFormLeafCondition = {
        input: {
          type: 'CONTENT_FIELD',
          name: 'num_likes',
          contentTypeId: '12345',
        },
        eligibleSignals: [sampleSignal],
        signal: sampleSignal,
      };

      const nonBooleanSignal = {
        ...sampleSignal,
        outputType: {
          __typename: 'ScalarSignalOutputType',
          scalarType: GQLScalarType.Number,
        },
      };

      (getConditionInputScalarType as jest.Mock).mockReturnValue([
        nonBooleanSignal,
      ]);
      expect(shouldConditionPromptForComparatorAndThreshold(condition)).toEqual(
        false,
      );
    });
  });

  describe('Test removeConditionSet', () => {
    it('should remove a condition set when there are multiple sets', () => {
      const conditionSet: RuleFormConditionSet = {
        conjunction: GQLConditionConjunction.Or,
        conditions: [
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field1',
                  contentTypeId: 'ct1',
                },
              },
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field2',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field3',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field4',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
        ],
      };

      const result = removeConditionSet(conditionSet, 1);

      expect(result.conditions).toHaveLength(2);
      expect(result.conjunction).toBe(GQLConditionConjunction.Or);
      // Verify the middle set was removed
      expect(
        (result.conditions[0] as RuleFormConditionSet).conditions,
      ).toHaveLength(2);
      expect(
        (result.conditions[1] as RuleFormConditionSet).conditions,
      ).toHaveLength(1);
      const input = (
        (result.conditions[1] as RuleFormConditionSet)
          .conditions[0] as RuleFormLeafCondition
      ).input;
      expect(input?.type).toBe('CONTENT_FIELD');
      expect((input as any)?.name).toBe('field4');
    });

    it('should flatten to top-level when only 2 sets remain and one is removed', () => {
      const conditionSet: RuleFormConditionSet = {
        conjunction: GQLConditionConjunction.Or,
        conditions: [
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field1',
                  contentTypeId: 'ct1',
                },
              },
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field2',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field3',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
        ],
      };

      const result = removeConditionSet(conditionSet, 1);

      // Should be flattened to the remaining condition set
      expect(result.conjunction).toBe(GQLConditionConjunction.And);
      expect(result.conditions).toHaveLength(2);
      const input0 = (result.conditions[0] as RuleFormLeafCondition).input;
      expect(input0?.type).toBe('CONTENT_FIELD');
      expect((input0 as any)?.name).toBe('field1');
      const input1 = (result.conditions[1] as RuleFormLeafCondition).input;
      expect(input1?.type).toBe('CONTENT_FIELD');
      expect((input1 as any)?.name).toBe('field2');
    });

    it('should not remove when there is only one condition set', () => {
      const conditionSet: RuleFormConditionSet = {
        conjunction: GQLConditionConjunction.Or,
        conditions: [
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field1',
                  contentTypeId: 'ct1',
                },
              },
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field2',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
        ],
      };

      const result = removeConditionSet(conditionSet, 0);

      // Should remain unchanged
      expect(result).toEqual(conditionSet);
    });

    it('should not modify non-nested condition sets', () => {
      const conditionSet: RuleFormConditionSet = {
        conjunction: GQLConditionConjunction.And,
        conditions: [
          {
            input: {
              type: 'CONTENT_FIELD',
              name: 'field1',
              contentTypeId: 'ct1',
            },
          },
          {
            input: {
              type: 'CONTENT_FIELD',
              name: 'field2',
              contentTypeId: 'ct1',
            },
          },
        ],
      };

      const result = removeConditionSet(conditionSet, 0);

      // Should remain unchanged
      expect(result).toEqual(conditionSet);
    });

    it('should remove the first condition set correctly', () => {
      const conditionSet: RuleFormConditionSet = {
        conjunction: GQLConditionConjunction.Or,
        conditions: [
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field1',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field2',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field3',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
        ],
      };

      const result = removeConditionSet(conditionSet, 0);

      expect(result.conditions).toHaveLength(2);
      const input0 = (
        (result.conditions[0] as RuleFormConditionSet)
          .conditions[0] as RuleFormLeafCondition
      ).input;
      expect(input0?.type).toBe('CONTENT_FIELD');
      expect((input0 as any)?.name).toBe('field2');
      const input1 = (
        (result.conditions[1] as RuleFormConditionSet)
          .conditions[0] as RuleFormLeafCondition
      ).input;
      expect(input1?.type).toBe('CONTENT_FIELD');
      expect((input1 as any)?.name).toBe('field3');
    });

    it('should remove the last condition set correctly', () => {
      const conditionSet: RuleFormConditionSet = {
        conjunction: GQLConditionConjunction.Or,
        conditions: [
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field1',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field2',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
          {
            conjunction: GQLConditionConjunction.And,
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'field3',
                  contentTypeId: 'ct1',
                },
              },
            ],
          },
        ],
      };

      const result = removeConditionSet(conditionSet, 2);

      expect(result.conditions).toHaveLength(2);
      const input0 = (
        (result.conditions[0] as RuleFormConditionSet)
          .conditions[0] as RuleFormLeafCondition
      ).input;
      expect(input0?.type).toBe('CONTENT_FIELD');
      expect((input0 as any)?.name).toBe('field1');
      const input1 = (
        (result.conditions[1] as RuleFormConditionSet)
          .conditions[0] as RuleFormLeafCondition
      ).input;
      expect(input1?.type).toBe('CONTENT_FIELD');
      expect((input1 as any)?.name).toBe('field2');
    });
  });
});
