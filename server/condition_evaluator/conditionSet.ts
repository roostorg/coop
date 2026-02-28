import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import {
  ConditionCompletionOutcome,
  ConditionFailureOutcome,
  type ConditionOutcome,
  type ConditionSetWithResult,
  type ConditionWithResult,
  type LeafConditionWithResult,
} from '../models/rules/RuleModel.js';
import { type RuleEvaluationContext } from '../rule_engine/RuleEvaluator.js';
import { type AggregationClause } from '../services/aggregationsService/index.js';
import {
  ConditionConjunction,
  type ConditionSet,
  type LeafCondition,
} from '../services/moderationConfigService/index.js';
import { equalLengthZip } from '../utils/fp-helpers.js';
import { assertUnreachable } from '../utils/misc.js';
import type SafeTracer from '../utils/SafeTracer.js';
import { type NonEmptyArray } from '../utils/typescript-types.js';
import { getCost, isConditionSet, outcomeToNullableBool } from './condition.js';
import { runLeafCondition as defaultRunLeafCondition } from './leafCondition.js';

const { sortBy, groupBy } = _;

/**
 * This takes a ConditionSet, and piece of content, and recursively runs all
 * the necessary conditions in the ConditionSet to get a final outcome for the
 * condition set against that piece of content. It returns that outcomes, as
 * part of a larger object tracing the whole evaluation.
 *
 * There are really a bunch of different things going on as part of this process.
 * First, there's "running" the LeafConditions, which actually involves testing
 * the content. Then, there's "running" the condition sets, which is really
 * about choosing the order in which to run the child conditions, and trying to
 * short circuit that when possible. Then, there's getting the result of a
 * condition set, which just aggregates the outcomes of the already-run
 * conditions, in a totally content-agnostic way. Finally, there's also the
 * process of building the final result, which (in the implementation here) gets
 * interleaved with the traversal and condition evaluation. It's tempting to see
 * the traversal (i.e., recursively descending, down to all the leaf conditions)
 * as it's own thing, which we're sorta duplicating here and in `getCost`, and
 * which might be able to be centralized into its own function. Then, we'd have
 * "visitors" or similar that, e.g., compute a condition's cost or build a
 * condition's result object (as we're returning here). Although, that's not
 * quite so not super straightforward, because the traversal logic to iterate
 * through conditions needs to be customized in some cases (e.g., to evaluate
 * lowest cost first), so that complicates the standard/simple visitor parttern.
 *
 * My point is really just that this function is mixing together a lot of
 * different concerns that we might eventually want to separate. But that
 * separation is not totally trivial, and our condition evaluation strategy is
 * very likely to change (e.g., maybe to, at least sometimes/for some conditions,
 * evaluate conditions in parallel; or, to get much smarter about how we order
 * conditions to run). Those changes could all break any abstraction we try to
 * come up with now to decouple these different pieces, so I've decided to
 * tackle everything in one function for now.
 *
 * @returns An object describing whole path of the execution, i.e., the outcome
 *   of each leaf condition, the outcome of the condition sets aggregating
 *   individual leaf condition outcomes, and the outcome of the top-level
 *   condition set. This is ideal for logging and/or visualizing how the
 *   conditions applied to a piece of content.
 */
export async function getConditionSetResults(
  conditionSet: ReadonlyDeep<ConditionSet>,
  evaluationContext: RuleEvaluationContext,
  tracer: SafeTracer,
  runLeafCondition = defaultRunLeafCondition,
): Promise<Required<ConditionSetWithResult>> {
  const { conjunction } = conditionSet;
  const result: ConditionSetWithResult = {
    conjunction,
    conditions: [] as unknown as
      | NonEmptyArray<LeafConditionWithResult>
      | NonEmptyArray<ConditionSetWithResult>,
  };

  // The conditions, sorted with lowest cost ones first.
  const getSignalCost = evaluationContext.getSignalCost.bind(evaluationContext);
  const conditionCosts = await Promise.all(
    // We know the function passed to map will never throw synchronously
    // (which is what the lint rule is trying to guard against), as all it
    // does is call `getCost`, which is an asnyc function. So, making the
    // map callback async just poinlessly allocates extra promises.
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    conditionSet.conditions.map((c) => getCost(c, getSignalCost)),
  );

  const sortedConditions = sortBy(
    equalLengthZip<
      ReadonlyDeep<ConditionSet> | ReadonlyDeep<LeafCondition>,
      number
    >(conditionSet.conditions, conditionCosts),
    (it) => it[1],
  ).map((it) => it[0]);

  // The final conditionset outcome. Might get set early
  // if we can determine it before evaluating all conditions.
  let finalOutcome: ConditionOutcome | undefined;

  // This is basically mapping `conditions` to ConditionWithResult, and putting
  // the mapped array in result.conditions. But we don't use `map` because we
  // want to run the conditions in sequence (i.e., with an `await` on each loop
  // iteration), and map would run them in parallel.
  for (const condition of sortedConditions) {
    // If we already know the final outcome for the condition set, then we can
    // skip all subsequent conditions, and a condition that's skipped has an
    // identical representation for its ConditionWithResult, so we just push
    // the skipped condition into result.conditions.
    if (finalOutcome !== undefined) {
      result.conditions.push(condition as any);
      continue;
    }

    const conditionWithResult: ReadonlyDeep<ConditionWithResult> &
      Required<Pick<ReadonlyDeep<ConditionWithResult>, 'result'>> =
      isConditionSet(condition)
        ? await getConditionSetResults(condition, evaluationContext, tracer)
        : {
            ...condition,
            result: await runLeafCondition(
              condition,
              evaluationContext,
              // eslint-disable-next-line no-loop-func
            ).catch((e) => {
              // If evaluating a condition fails, we're eventually going to want
              // to retry before we give up but, for now, we just mark the result
              // as failed and move on.
              const activeSpan = tracer.getActiveSpan();
              if (activeSpan?.isRecording()) {
                activeSpan.recordException(e);
              }
              return { outcome: ConditionFailureOutcome.ERRORED };
            }),
          };

    result.conditions.push(conditionWithResult as any);
    // console.log('RESULT ' + conditionWithResult.result.outcome);

    // Attempt to determine the result for the whole condition set from the
    // outcomes so far. If we can, save that result to skip running each
    // condition for the rest of the loop
    const conditionSetOutcome = tryGetOutcomeFromPartialOutcomes(
      result.conditions.map((c) => c.result!.outcome),
      conjunction,
    );

    if (conditionSetOutcome !== undefined) {
      finalOutcome = conditionSetOutcome;
    }
  }

  return {
    ...result,
    result: {
      outcome:
        finalOutcome ??
        getConditionSetOutcome(
          result.conditions.map((c) => c.result!.outcome),
          conjunction,
        ),
    },
  };
}

/**
 * Aggregate the outcomes of child conditions to get a single outcome
 * for a conditiion set, based on its conjunction.
 */
export function getConditionSetOutcome(
  outcomes: ConditionOutcome[],
  conjunction: ConditionConjunction,
) {
  const {
    false: falseOutcomes,
    true: trueOutcomes,
    null: nullOutcomes,
  } = groupBy(outcomes, outcomeToNullableBool) as {
    true?: NonEmptyArray<ConditionOutcome>;
    false?: NonEmptyArray<ConditionOutcome>;
    null?: NonEmptyArray<ConditionOutcome>;
  };

  switch (conjunction) {
    case ConditionConjunction.AND:
      // With AND, a single FALSE swallows NULL. I.e., NULL && FALSE = FALSE.
      // But no false + no null = passed.
      return falseOutcomes && falseOutcomes.length > 0
        ? falseOutcomes[0]
        : nullOutcomes
        ? nullOutcomes[0]
        : ConditionCompletionOutcome.PASSED;
    case ConditionConjunction.OR:
      // With OR, it's TRUE that swallows null (TRUE || NULL = TRUE), while
      // we have to propogate any NULLs when there's no true outcomes.
      return trueOutcomes && trueOutcomes.length > 0
        ? ConditionCompletionOutcome.PASSED
        : nullOutcomes
        ? nullOutcomes[0]
        : ConditionCompletionOutcome.FAILED;
    case ConditionConjunction.XOR:
      // Similar to OR, but we must ensure there's one true with no NULLs.
      return trueOutcomes?.length === 1 && !nullOutcomes
        ? ConditionCompletionOutcome.PASSED
        : (!trueOutcomes || trueOutcomes.length === 1) && nullOutcomes
        ? nullOutcomes[0]
        : ConditionCompletionOutcome.FAILED;
    default:
      return assertUnreachable(conjunction);
  }
}

/**
 * Sometimes, a subset of the conditions in a condition set can be evaluated,
 * and that's enough to know the result of the whole set. E.g., if the set uses
 * AND as its conjunction, then we know that the set FAILED upon encountering
 * the first FAILED or INAPPLICABLE condition. Similarly, if the set uses OR, we
 * know it PASSED upon encountering the first PASSED condition.
 *
 * This function takes some condition outcomes, and a condition set conjunction,
 * and returns undefined if those outcomes aren't enough information to
 * definitely determine the result of a condition set using that conjunction.
 * If the given outcomes are enough info, though, it returns the ConditionOutcome
 * that must apply to the set.
 *
 * For AND and OR, it's actually a bit wasteful to look at all the condition
 * outcomes, as we could just look at each individual outcome as it's produced
 * to decide whether to short circuit. But the overhead is truly negligible, and
 * this design lets us support conjunctions like XOR, which isn't decided until
 * we see a second passing condition.
 */
export function tryGetOutcomeFromPartialOutcomes(
  conditionOutcomes: ConditionOutcome[],
  conjunction: ConditionConjunction,
) {
  const { false: falseOutcomes, true: trueOutcomes } = groupBy(
    conditionOutcomes,
    outcomeToNullableBool,
  ) as {
    true?: NonEmptyArray<ConditionOutcome>;
    false?: NonEmptyArray<ConditionOutcome>;
  };

  switch (conjunction) {
    case ConditionConjunction.AND:
      return falseOutcomes ? falseOutcomes[0] : undefined;
    case ConditionConjunction.OR:
      return trueOutcomes ? ConditionCompletionOutcome.PASSED : undefined;
    case ConditionConjunction.XOR:
      return (trueOutcomes?.length ?? 0) > 1
        ? ConditionCompletionOutcome.FAILED
        : undefined;
    default:
      return assertUnreachable(conjunction);
  }
}

export function getAllAggregationsInConditionSet(
  conditionSet: ReadonlyDeep<ConditionSet>,
): ReadonlyDeep<AggregationClause>[] {
  return conditionSet.conditions.flatMap((condition) => {
    if (isConditionSet(condition)) {
      return getAllAggregationsInConditionSet(condition);
    }
    const sig = condition.signal;
    const args =
      sig?.type === 'AGGREGATION' ? sig.args : undefined;
    return args != null ? [args.aggregationClause] : [];
  });
}
