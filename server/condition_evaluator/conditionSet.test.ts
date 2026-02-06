import fc from 'fast-check';
import _ from 'lodash';

import { ConditionCompletionOutcome } from '../models/rules/RuleModel.js';
import {
  ConditionConjunction,
  type LeafCondition,
} from '../services/moderationConfigService/index.js';
import {
  getSignalIdString,
  type ExternalSignalId,
  type SignalId,
} from '../services/signalsService/index.js';
import {
  ConditionOutcomeArbitrary as anyOutcomeArbitrary,
  ConditionConjunctionArbitrary,
  FalseyCompletionOutcomeArbitrary as falseyOutcomeArbitrary,
  LeafConditionArbitrary,
  makeConditionInputArbitrary,
  NullLikeConditionCompletionOutcomeArbitrary as nullOutcomeArbitrary,
  TruthyConditionCompletionOutcomeArbitrary as truthyOutcomeArbitrary,
} from '../test/arbitraries/Condition.js';
import { type NonEmptyArray } from '../utils/typescript-types.js';
import { getCost, outcomeToNullableBool } from './condition.js';
import {
  getConditionSetOutcome,
  getConditionSetResults,
  tryGetOutcomeFromPartialOutcomes,
} from './conditionSet.js';
import type { ReadonlyDeep } from 'type-fest';

const { sampleSize, shuffle, groupBy } = _;
const { AND, OR, XOR } = ConditionConjunction;

describe('Condition Evaluation', () => {
  describe('getConditionSetResults', () => {
    test('should run conditions in cost order, skipping unnecessary ones', async () => {
      const stubRunLeafCondition = jest.fn(async (_it: ReadonlyDeep<LeafCondition>) => ({
        outcome: ConditionCompletionOutcome.PASSED,
      }));

      await fc.assert(
        fc
          .asyncProperty(
            fc.array(
              fc.tuple(
                LeafConditionArbitrary(makeConditionInputArbitrary()),
                fc.nat(),
              ),
              { minLength: 1 },
            ),
            async (leafConditionsWithCosts) => {
              // Take all the generated conditions, and only keep one for each
              // signal (including for a null signal) so that we can return
              // sensible/consistent costs across conditions.
              const leafConditionsAndCostsWithUniqueSignalIds = _.uniqBy(
                leafConditionsWithCosts,
                (it) => (it[0].signal ? it[0].signal.id : null),
              );

              const getSignalCost = (() => {
                const costsBySignalId = new Map(
                  leafConditionsAndCostsWithUniqueSignalIds
                    .filter((it) => it[0].signal) // this fn only handles signals that are defined
                    .map(
                      ([condition, cost]) =>
                        [condition.signal!.id, cost] as const,
                    ),
                );

                return async (id: ExternalSignalId) =>
                  costsBySignalId.get(getSignalIdString(id))!;
              })() satisfies (id: ExternalSignalId) => Promise<number> as (
                id: SignalId,
              ) => Promise<number>;

              const conditions = leafConditionsAndCostsWithUniqueSignalIds.map(
                (it) => it[0],
              ) satisfies LeafCondition[] as NonEmptyArray<LeafCondition>;

              const lowestConditionCost = Math.min(
                ...(await Promise.all(
                  conditions.map(async (it) => getCost(it, getSignalCost)),
                )),
              );

              await getConditionSetResults(
                { conditions, conjunction: ConditionConjunction.OR },
                { getSignalCost } as any,
                jest.fn() as any,
                stubRunLeafCondition,
              );

              // We should've only evaluated one condition (the lowest cost one)
              // because it will pass, and the condition conjuction is OR, so
              // the remaining ones can be skipped.
              expect(stubRunLeafCondition).toHaveBeenCalledTimes(1);

              // We don't know exactly which condition will have been run,
              // because multiple conditions could be tied for having the lowest
              // cost, but we assert that whatever condition was evaluated has
              // the lowest cost.
              expect(
                await getCost(
                  stubRunLeafCondition.mock.calls[0][0],
                  getSignalCost,
                ),
              ).toEqual(lowestConditionCost);
            },
          )
          .afterEach(() => {
            stubRunLeafCondition.mockClear();
          }),
      );
    });
  });

  describe('getConditionSetOutcome', () => {
    describe('AND', () => {
      test('should return false if there are any falsey outcomes', () => {
        fc.assert(
          fc.property(
            fc.array(anyOutcomeArbitrary),
            falseyOutcomeArbitrary,
            (outcomes, falseyOutcome) => {
              const withFalseOutcomes = shuffle(outcomes.concat(falseyOutcome));
              const result = getConditionSetOutcome(withFalseOutcomes, AND);
              expect(outcomeToNullableBool(result)).toBe(false);
            },
          ),
        );
      });

      test("should preserve the particular falsey outcome when there's only one", () => {
        fc.assert(
          fc.property(
            fc.array(fc.oneof(truthyOutcomeArbitrary, nullOutcomeArbitrary)),
            falseyOutcomeArbitrary,
            (nonFalseyOutcomes, falseyOutcome) => {
              const withFalseOutcome = shuffle(
                nonFalseyOutcomes.concat(falseyOutcome),
              );

              const result = getConditionSetOutcome(withFalseOutcome, AND);
              expect(result).toBe(falseyOutcome);
            },
          ),
        );
      });

      test('should return a truthy outcome if there are only truthy outcomes', () => {
        fc.assert(
          fc.property(fc.array(truthyOutcomeArbitrary), (outcomes) => {
            const result = getConditionSetOutcome(outcomes, AND);
            expect(outcomeToNullableBool(result)).toBe(true);
          }),
        );
      });

      test('should return null for any mix of null-like and truthy outcomes', () => {
        fc.assert(
          fc.property(
            fc.array(truthyOutcomeArbitrary),
            fc.array(nullOutcomeArbitrary, { minLength: 1 }),
            (trueOutcomes, nullOutcomes) => {
              const trueOrNullOutcomes = trueOutcomes.concat(nullOutcomes);
              const result = getConditionSetOutcome(trueOrNullOutcomes, AND);
              expect(outcomeToNullableBool(result)).toBe(null);
            },
          ),
        );
      });
    });

    describe('OR', () => {
      test('should return true if there are any truthy outcomes', () => {
        fc.assert(
          fc.property(
            fc.array(anyOutcomeArbitrary),
            truthyOutcomeArbitrary,
            (outcomes, truthyOutcome) => {
              const withTrueOutcomes = shuffle(outcomes.concat(truthyOutcome));
              const result = getConditionSetOutcome(withTrueOutcomes, OR);
              expect(outcomeToNullableBool(result)).toBe(true);
            },
          ),
        );
      });

      test("should preserve the particular truthy outcome when there's only one", () => {
        fc.assert(
          fc.property(
            fc.array(fc.oneof(falseyOutcomeArbitrary, nullOutcomeArbitrary)),
            truthyOutcomeArbitrary,
            (nonTruthyOutcomes, truthyOutcome) => {
              const withTrueOutcome = shuffle(
                nonTruthyOutcomes.concat(truthyOutcome),
              );

              const result = getConditionSetOutcome(withTrueOutcome, OR);
              expect(result).toBe(truthyOutcome);
            },
          ),
        );
      });

      test('should return a falsey outcome if there are only falsey outcomes', () => {
        fc.assert(
          fc.property(fc.array(falseyOutcomeArbitrary), (outcomes) => {
            const result = getConditionSetOutcome(outcomes, OR);
            expect(outcomeToNullableBool(result)).toBe(false);
          }),
        );
      });

      test('should return null for any mix of null-like and falsey outcomes', () => {
        fc.assert(
          fc.property(
            fc.array(falseyOutcomeArbitrary),
            fc.array(nullOutcomeArbitrary, { minLength: 1 }),
            (falseyOutcomes, nullOutcomes) => {
              const falseOrNullOutcomes = falseyOutcomes.concat(nullOutcomes);
              const result = getConditionSetOutcome(falseOrNullOutcomes, OR);
              expect(outcomeToNullableBool(result)).toBe(null);
            },
          ),
        );
      });
    });

    describe('XOR', () => {
      test("should return true if there's exactly one truthy outcome", () => {
        fc.assert(
          fc.property(fc.array(anyOutcomeArbitrary), (outcomes) => {
            const result = getConditionSetOutcome(outcomes, XOR);
            const outcomesByType = groupBy(
              outcomes.map(outcomeToNullableBool),
              (it) => it,
            ) as { null: null[]; true: true[]; false: false[] };
            expect(outcomeToNullableBool(result)).toBe(
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              outcomesByType['true']?.length === 1 && !outcomesByType['null']
                ? true
                : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                outcomesByType['null']?.length > 0 &&
                  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                  (outcomesByType['true']?.length ?? 0) < 2
                ? null
                : false,
            );
          }),
        );
      });
    });
  });

  describe('tryGetOutcomeFromPartialOutcomes', () => {
    test("should never return a different logical result than we'd get from all outcomes", () => {
      fc.assert(
        fc.property(
          fc.array(anyOutcomeArbitrary),
          ConditionConjunctionArbitrary,
          (outcomes, conjunction) => {
            const resultFromAllOutcomes = getConditionSetOutcome(
              outcomes,
              conjunction,
            );
            const randomOutcomeSubset = sampleSize(
              outcomes,
              Math.floor(Math.random() * outcomes.length),
            );
            const resultFromPartialOutcomes = tryGetOutcomeFromPartialOutcomes(
              randomOutcomeSubset,
              conjunction,
            );

            // We have to cast to a nullable bool because the exact
            // ConditionCompletionOutcome is undetermined; e.g., if outcomes is
            // [INAPPLICABLE, FAILED] with conjunction AND, we could get either
            // when calling `tryGetOutcomeFromPartialOutcomes` w/ a subset.
            return (
              resultFromPartialOutcomes === undefined ||
              outcomeToNullableBool(resultFromAllOutcomes) ===
                outcomeToNullableBool(resultFromPartialOutcomes)
            );
          },
        ),
      );
    });
  });
});
