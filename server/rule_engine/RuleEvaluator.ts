import _ from 'lodash';
import { type Opaque, type ReadonlyDeep } from 'type-fest';

import { outcomeToNullableBool } from '../condition_evaluator/condition.js';
import { getConditionSetResults } from '../condition_evaluator/conditionSet.js';
import makeGetDerivedFieldValueWithCache from '../condition_evaluator/getDerivedFieldValue.js';
import { type Dependencies } from '../iocContainer/index.js';
import { inject } from '../iocContainer/utils.js';
import { type ConditionSetWithResult } from '../models/rules/RuleModel.js';
import {
  type DerivedFieldSpec,
  type DerivedFieldValue,
} from '../services/derivedFieldsService/index.js';
import { type ItemSubmission } from '../services/itemProcessingService/index.js';
import {
  type ConditionSet,
  type ItemType,
} from '../services/moderationConfigService/index.js';
import { type TransientRunSignalWithCache } from '../services/orgAwareSignalExecutionService/index.js';
import { type SignalId } from '../services/signalsService/index.js';
import type {
  ActionExecutionSourceType,
  RuleExecutionSourceType,
} from '../services/analyticsLoggers/index.js';
import { instantiateOpaqueType } from '../utils/typescript-types.js';

// A rule can be run on either a full submission, or on just the identifier of
// an item (namely, in the case of user rules).
export type RuleInput =
  // Policies only present in reporting + routing rules;
  // refers to the policy of the report.
  | (ItemSubmission & {
      policyIds?: string[];
      sourceType?: RuleExecutionSourceType | ActionExecutionSourceType;
    })
  | ReadonlyDeep<{ itemId: string; itemType: Pick<ItemType, 'id' | 'kind'> }>;

export function isFullSubmission(input: RuleInput): input is ItemSubmission {
  return 'data' in input && 'submissionId' in input && Boolean(input.data);
}

export function getUserFromRuleInput(it: RuleInput) {
  return isFullSubmission(it)
    ? it.creator
    : it.itemType.kind === 'USER'
    ? { id: it.itemId, typeId: it.itemType.id }
    : undefined;
}

type RuleEvaluationContextImpl = Readonly<{
  org: { id: string /* TODO: might add api keys or api key ids here too */ };
  input: RuleInput;
  runSignal: TransientRunSignalWithCache;
  getSignalCost: (id: SignalId) => Promise<number>;
  getDerivedFieldValue: (spec: DerivedFieldSpec) => Promise<DerivedFieldValue>;
}>;

export type RuleEvaluationContext = Opaque<
  RuleEvaluationContextImpl,
  RuleEvaluationContextImpl
>;

export type RuleExecutionResult = {
  passed: boolean;
  conditionResults: ConditionSetWithResult;
};

/**
 * This is the main Rule Engine class. It's responsible for running
 * all of the user's Rules on a single piece of content sent to
 * our API.
 */
class RuleEvaluator {
  constructor(
    private readonly makeRunSignal: Dependencies['TransientRunSignalWithCacheFactory'],
    private readonly signalsService: Dependencies['SignalsService'],
    private readonly tracer: Dependencies['Tracer'],
  ) {}

  /**
   * Evaluating a rule's conditionSet requires some arguments, like the content
   * against which you want to evaluate the conditions (see RuleInput).
   *
   * However, in addition to these data arguments, running a rule also requires
   * various "capabilities", e.g., the ability to evaluate a signal for some
   * value (as required by one of the rule's conditions) and the ability to
   * compute derived values from the content.
   *
   * For these "capabilities", we may want to retain some state between from one
   * rule evaluation to the next, for the purpose of caching. E.g., if multiple
   * conditions (in the same rule, or across rules) run the same signal against
   * the same input, we'd like to be able to cache and reuse that result.
   * Similarly, if multiple conditions reference the same derived field, we'd
   * like to only have to compute its value once.
   *
   * The scope of this cache -- e.g., is it distributed, in a way all api
   * servers can access? if not, and it just lives in one server's memory, does
   * it persist across requests to that server (and expire on a TTL), or does it
   * get created at the start of some request/unit of work and discarded at the
   * end? -- is likely to change over time, as we evolve the system.
   *
   * For now, though, we have an explicit object that holds this cached state,
   * and which is expected to be created at the start of some unit of work (like
   * a rule set execution) and then discarded shortly thereafter. That object is
   * a "rule execution context", and it's what's returned here. Because, again,
   * this concept may change over time, I'm treating it as a detail of the
   * RuleEngine, by having the RuleEngine be the only code (in the method below)
   * that can create the context (using an opaque type), and the only code that
   * will consume it.
   *
   * As implied by this method's arguments, a context cannot be reused across
   * different RuleInputs/different item submissions, in part to help enforce
   * that these objects be short-lived, but also because the RuleInput data
   * contributes to the cache keys used within the evaluation context (e.g., for
   * `getDerivedFieldValue`).
   */
  makeRuleExecutionContext(args: {
    orgId: string;
    input: RuleInput;
  }): RuleEvaluationContext {
    const { orgId, input } = args;
    const runSignal = this.makeRunSignal();
    const getDerivedFieldValue = makeGetDerivedFieldValueWithCache(
      runSignal,
      orgId,
    );

    return instantiateOpaqueType<RuleEvaluationContext>({
      org: { id: orgId },
      input,
      runSignal,
      getSignalCost: async (signalId: SignalId) =>
        this.signalsService
          .getSignalOrThrow({ orgId, signalId })
          .then((s) => s.getCost())
          .catch(() => Infinity),
      // If the item data is missing, as it will be in user rule
      // RuleEvaluationContexts, then we can't extract a derived field value
      // (at least for now, since we don't have a notion of derived fields
      // from from item ids), so we return undefined.
      getDerivedFieldValue: isFullSubmission(input)
        ? async (spec: DerivedFieldSpec) => getDerivedFieldValue(input, spec)
        : async (_spec: DerivedFieldSpec) => undefined,
    });
  }

  /**
   * This function runs a piece of content through a single Rule and returns the
   * results.
   *
   * Note that this function _does not_ perform any of the side effects that
   * usually attend a rule execution, including (even) logging that execution to
   * Snowflake. For that reason, this function is private, and should only be
   * called as an implementation detail of the RuleEngine.
   *
   * @param ruleConditions - The conditions that logically define the rule
   *   (i.e., determine whether the it passes, independent of metadata about it
   *   like its name etc). We don't need full Rule instance from our db, which
   *   is a fact we might leverage later (e.g., if we wanna cache the results of
   *   this function, we'd do it by ruleConditions, rather than rule id + version,
   *   as the conditions might not change between versions).
   * @param context - the context needed to run the rule, including, most
   *   notably, the user-generated content to run the rule against and/or a user
   *   id that can be selected as an input to (future) user-scoring signals.
   * @return Whether the content passed the rule's conditions, and details
   *   about which subconditions did/didn't match.
   */
  public async runRule(
    ruleConditions: ReadonlyDeep<ConditionSet>,
    context: RuleEvaluationContext,
  ): Promise<RuleExecutionResult> {
    const results = await getConditionSetResults(
      ruleConditions,
      context,
      this.tracer,
    );

    return {
      // If the rule outcome was null (e.g., if some critical condition errored),
      // coalesce to false to treat the rule as though it didn't pass
      passed: outcomeToNullableBool(results.result.outcome) ?? false,
      conditionResults: results,
    };
  }
}

export default inject(
  ['TransientRunSignalWithCacheFactory', 'SignalsService', 'Tracer'],
  RuleEvaluator,
);
export { type RuleEvaluator };
