import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import {
  getAllAggregationsInConditionSet,
  getConditionSetResults,
} from '../condition_evaluator/conditionSet.js';
import { type Dependencies } from '../iocContainer/index.js';
import { inject } from '../iocContainer/utils.js';
import {
  ConditionCompletionOutcome,
  type RuleWithLatestVersion,
  type Rule as TRule,
} from '../models/rules/RuleModel.js';
import { evaluateAggregationRuntimeArgsForItem } from '../services/aggregationsService/index.js';
import { type ItemSubmission } from '../services/itemProcessingService/index.js';
import {
  RuleStatus,
  type Action,
  type ConditionSet,
} from '../services/moderationConfigService/index.js';
import { type RuleExecutionCorrelationId } from '../services/analyticsLoggers/index.js';
import {
  type CorrelationId,
  type CorrelationIdType,
} from '../utils/correlationIds.js';
import { equalLengthZip } from '../utils/fp-helpers.js';
import { safePick } from '../utils/misc.js';
import type SafeTracer from '../utils/SafeTracer.js';
import {
  isFullSubmission,
  type RuleEvaluationContext,
  // This is used for a {@link} in a jsdoc comments.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type RuleEvaluator,
  type RuleExecutionResult,
  type RuleInput,
} from './RuleEvaluator.js';

const { partition, uniqBy } = _;

// Represents the context from which a rule was triggered, which effects whether
// it passing will trigger actions and, if so, whether those actions will count
// against the rule's limit. Often, the rule environment is the same as the
// rule's status (e.g., a `LIVE` content rule will run in the `LIVE` rule
// environment when a new piece of content is submitted). However, sometimes the
// two fields come apart. E.g., a background rule can be backtested and a live
// rule can run under retroaction, among many other possibilities.
export enum RuleEnvironment {
  LIVE = 'LIVE',
  BACKGROUND = 'BACKGROUND',
  BACKTEST = 'BACKTEST',
  MANUAL = 'MANUAL',
  RETROACTION = 'RETROACTION',
}

/**
 * This is the main Rule Engine class. It's responsible for running
 * all of the user's Rules on a single piece of content sent to
 * our API.
 */
class RuleEngine {
  constructor(
    private readonly ruleExecutionLogger: Dependencies['RuleExecutionLogger'],
    private readonly ruleEvaluator: Dependencies['RuleEvaluator'],
    private readonly actionPublisher: Dependencies['ActionPublisher'],
    private readonly getEnabledRulesForItemTypeEventuallyConsistent: Dependencies['getEnabledRulesForItemTypeEventuallyConsistent'],
    private readonly getPoliciesForRulesEventuallyConsistent: Dependencies['getPoliciesForRulesEventuallyConsistent'],
    private readonly getRuleActionsEventuallyConsistent: Dependencies['getActionsForRuleEventuallyConsistent'],
    private readonly recordRuleActionLimitUsage: Dependencies['recordRuleActionLimitUsage'],
    private readonly aggregationsService: Dependencies['AggregationsService'],
    private readonly tracer: Dependencies['Tracer'],
  ) {}

  private readonly environmentsThatApplyActions = [
    RuleEnvironment.LIVE,
    RuleEnvironment.MANUAL,
    RuleEnvironment.RETROACTION,
  ];

  /**
   * @see {@link RuleEvaluator.makeRuleExecutionContext}.
   */
  makeRuleExecutionContext(args: {
    orgId: string;
    input: RuleInput;
  }): RuleEvaluationContext {
    return this.ruleEvaluator.makeRuleExecutionContext(args);
  }

  /**
   * Runs the rules that are "enabled" ({@see ItemType.getEnabledRules}) for
   * this item type, against the given itemSubmission.
   *
   * @param itemSubmission
   * @param executionsCorrelationId - An id that should be associated with all
   *   rule executions generated as part of running these rules, for correlating
   *   the execution with the event in the system that caused it.
   *   {@see getCorrelationId}
   */
  async runEnabledRules(
    itemSubmission: ItemSubmission,
    executionsCorrelationId: RuleExecutionCorrelationId,
    sync: boolean = false,
  ) {
    // enabledRules can be null when the contentType can't be found.
    // getEnabledRulesForContentTypeEventuallyConsistent has `null` in its
    // return type primarily in case the contentTypeId points to a content type
    // that doesn't exist. However, even though we know that the contentTypeId
    // is for a content type that does exist (because we have the full
    // ContentType model object), we still must handle `null` b/c it could be
    // that contentType was _just_ created and can't be seen yet by
    // getEnabledRulesForContentTypeEventuallyConsistent, which, as the name
    // implies, is eventually consistent.
    const enabledRules =
      (await this.getEnabledRulesForItemTypeEventuallyConsistent(
        itemSubmission.itemType.id,
      )) ?? [];

    const [liveRules, backgroundRules] = partition(
      enabledRules,
      (rule) => rule.status === RuleStatus.LIVE,
    );


    const evaluationContext = this.makeRuleExecutionContext({
      orgId: itemSubmission.itemType.orgId,
      input: itemSubmission,
    });

    const resultsPromise = Promise.all([
      this.runRuleSet(
        liveRules,
        evaluationContext,
        RuleEnvironment.LIVE,
        executionsCorrelationId,
        sync,
      ),
      this.runRuleSet(
        backgroundRules,
        evaluationContext,
        RuleEnvironment.BACKGROUND,
        executionsCorrelationId,
        sync,
      ),
    ]);

    return {
      // Just return a promise for the actions that were triggered (which
      // doesn't necessarily mean they've run just yet, w/ queueing +
      // retrying, etc.) and a way to get this submission's derived field
      // values (leveraging the cache), because that's actually all we need
      // right now.
      actionsTriggered: resultsPromise.then<readonly Action[]>(
        (it) => it[0].actions,
      ),
      getDerivedFieldValue: evaluationContext.getDerivedFieldValue,
    };
  }

  /**
   * This function runs a rule set, which is an array of rules that all apply to
   * the same item/rule input and must be run as a group (because the actions
   * they'd trigger if they pass must be deduplicated).
   *
   * As part of running the rule set, it publishes all the Actions that the
   * Rules determine should be run. There is an option to not execute the
   * Actions for Rules that are running in Background mode or in a Backtest.
   *
   * @param rules - the list of Rules that will be run
   * @param evaluationContext - the context needed to run each rule, including,
   *   most notably, the user-generated content to run the rule against and/or a
   *   user id that can be selected as an input to (future) user-scoring
   *   signals.
   * @param environment - the RuleEnvironment that this rule is running in. This
   *   influences whether actions should be executed, whether they should count
   *   against daily limits, etc.
   * @param executionsCorrelationId - An id that should be associated with all
   *   rule executions generated as part of this rule set, for correlating the
   *   execution with the event in the system that caused it.
   *   {@see getCorrelationId}
   * @param sync - whether the request should run synchronously
   */
  async runRuleSet(
    rules: ReadonlyDeep<RuleWithLatestVersion[]>,
    evaluationContext: RuleEvaluationContext,
    environment: RuleEnvironment,
    executionsCorrelationId: RuleExecutionCorrelationId,
    sync?: boolean,
  ): Promise<{
    rulesToResults: Map<ReadonlyDeep<TRule>, RuleExecutionResult>;
    actions: readonly Action[];
  }> {
    if (!rules.length) {
      return { rulesToResults: new Map(), actions: [] };
    }

    const shouldRunActions =
      this.environmentsThatApplyActions.includes(environment);

    // In some cases, even when we run actions, we don't count the action
    // against a rule's daily limit. E.g., retroaction/manual.
    const shouldCountActions =
      shouldRunActions && environment === RuleEnvironment.LIVE;

    // Do aggregation preprocessing here.
    await Promise.all(
      rules.map(async (rule) =>
        this.preprocessAggregationConditions(
          rule.conditionSet,
          evaluationContext,
          this.tracer,
        ),
      ),
    );

    const ruleResults = await Promise.all(
      rules.map(async (it) =>
        this.ruleEvaluator.runRule(it.conditionSet, evaluationContext),
      ),
    );


    const rulesToResults = new Map(equalLengthZip(rules, ruleResults));

    const passingRules = [...rulesToResults.entries()]
      .filter(([_rule, result]) => result.passed)
      .map(([rule, _result]) => rule);

    const actionableRules = passingRules;

    const actionableRulesToActions = new Map(
      await Promise.all(
        actionableRules.map(
          async (rule) => {
            const actions = (await this.getRuleActionsEventuallyConsistent(
              rule.id,
            )) satisfies readonly ReadonlyDeep<Action>[] as readonly Action[];
            
            
            return [rule, actions] as const;
          }
        ),
      ),
    );

    // NB: while we only run _deduped_ actions, we record the actions and
    // update the rule action run counts as though no deduping took place,
    // since, logically, each rule triggered the action.
    const { org, input: ruleInput } = evaluationContext;

    const policiesByRule = await this.getPoliciesForRulesEventuallyConsistent(
      rules.map((it) => it.id),
    );

    const logRuleExecutionsPromise = this.ruleExecutionLogger.logRuleExecutions(
      [...rulesToResults.entries()].map(([rule, result]) => ({
        orgId: org.id,
        rule: {
          id: rule.id,
          name: rule.name,
          version: rule.latestVersion.version,
          tags: rule.tags,
        },
        ruleInput,
        environment,
        result: result.conditionResults,
        correlationId: executionsCorrelationId,
        passed: result.passed,
        policies: policiesByRule[rule.id] ?? [],
      })),
      sync,
    );

    if (!shouldRunActions) {
      await logRuleExecutionsPromise;
      return { rulesToResults, actions: [] };
    }

    const dedupedActions = uniqBy(
      [...actionableRulesToActions.values()].flat(),
      (it) => it.id,
    ) satisfies Action[] as readonly Action[];

    // Publish all (deduped) actions + update the rule action counts if appropriate.
    const publishActionsPromise = this.actionPublisher
      .publishActions(
        dedupedActions.map((action) => {
          return {
            action,
            ruleEnvironment: environment,
            matchingRules: [...actionableRulesToActions.entries()].flatMap(
              ([rule, actions]) =>
                actions.includes(action)
                  ? [
                      {
                        ...safePick(rule, ['id', 'name', 'tags']),
                        version: rule.latestVersion.version,
                        policies: policiesByRule[rule.id] ?? [],
                      },
                    ]
                  : [],
            ),
            policies: _.uniqBy(
              [...actionableRulesToActions.keys()].flatMap(
                (rule) => policiesByRule[rule.id] ?? [],
              ),
              'id',
            ),
          };
        }),
        {
          orgId: org.id,
          targetItem: ruleInput,
          correlationId: executionsCorrelationId as CorrelationId<
            Exclude<CorrelationIdType<RuleExecutionCorrelationId>, 'backtest'>
          >,
          sync,
        },
      )
      .catch((e) => {
        this.tracer.logActiveSpanFailedIfAny(e);
        throw e;
      });

    const updateRuleActionCountsPromise = shouldCountActions
      ? this.recordRuleActionLimitUsage(
          actionableRules.map((it) => it.id),
        ).catch(() => {
          // This query sometimes fails from a Sequelize Acquire Connection
          // timeout. While we're debugging the root cause of that further,
          // swallow the error rather than crashing the process.
        })
      : undefined;

    await Promise.all([
      publishActionsPromise,
      logRuleExecutionsPromise,
      updateRuleActionCountsPromise,
    ]);

    return { rulesToResults, actions: dedupedActions };
  }

  async preprocessAggregationConditions(
    ruleConditions: ReadonlyDeep<ConditionSet>,
    context: RuleEvaluationContext,
    tracer: SafeTracer,
  ) {
    const { input } = context;

    if (isFullSubmission(input)) {
      const aggregations = getAllAggregationsInConditionSet(ruleConditions);

      const aggregationAndConditionResults = await Promise.all(
        aggregations.map(async (aggregation) => {
          if (!aggregation.conditionSet) {
            return { aggregation, shouldUpdate: true };
          }

          const results = await getConditionSetResults(
            aggregation.conditionSet,
            context,
            tracer,
          );

          return {
            aggregation,
            shouldUpdate:
              results.result.outcome === ConditionCompletionOutcome.PASSED,
          };
        }),
      );

      await Promise.all(
        aggregationAndConditionResults
          .filter(({ shouldUpdate }) => shouldUpdate)
          .map(async ({ aggregation }) => {
            const runtimeArgs = await evaluateAggregationRuntimeArgsForItem(
              context,
              input,
              aggregation,
            );

            if (!runtimeArgs) {
              return;
            }

            await this.aggregationsService.updateAggregation(
              aggregation,
              runtimeArgs,
              tracer,
            );
          }),
      );
    }
  }

}

export default inject(
  [
    'RuleExecutionLogger',
    'RuleEvaluator',
    'ActionPublisher',
    'getEnabledRulesForItemTypeEventuallyConsistent',
    'getPoliciesForRulesEventuallyConsistent',
    'getActionsForRuleEventuallyConsistent',
    'recordRuleActionLimitUsage',
    'AggregationsService',
    'Tracer',
  ],
  RuleEngine,
);
export { type RuleEngine };
