import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import { RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import { type RuleEvaluationContext } from '../../rule_engine/RuleEvaluator.js';
import { equalLengthZip } from '../../utils/fp-helpers.js';
import { safePick } from '../../utils/misc.js';
import { type ItemSubmission } from '../itemProcessingService/makeItemSubmission.js';
import { type Action } from '../moderationConfigService/index.js';
import type ReportingRules from './ReportingRules.js';
import { ReportingRuleStatus, type ReportingRule } from './ReportingRules.js';
import { type ReportingRuleExecutionCorrelationId } from './reportingService.js';

const { uniqBy } = _;

export default class ReportingRuleEngine {
  constructor(
    private readonly ruleEvaluator: Dependencies['RuleEvaluator'],
    private readonly reportingRuleExecutionLogger: Dependencies['ReportingRuleExecutionLogger'],
    private readonly actionPublisher: Dependencies['ActionPublisher'],
    private readonly getActionsByIdEventuallyConsistent: Dependencies['getActionsByIdEventuallyConsistent'],
    private readonly getPoliciesByIdEventuallyConsistent: Dependencies['getPoliciesByIdEventuallyConsistent'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly reportingRules: ReportingRules,
  ) {}

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
    executionsCorrelationId: ReportingRuleExecutionCorrelationId,
  ) {
    const enabledRules = await this.reportingRules.getReportingRules({
      orgId: itemSubmission.itemType.orgId,
    });

    const liveRules = enabledRules.filter(
      (it) => it.status === ReportingRuleStatus.LIVE,
    );
    const backgroundRules = enabledRules.filter(
      (it) => it.status === ReportingRuleStatus.BACKGROUND,
    );

    const evaluationContext = this.ruleEvaluator.makeRuleExecutionContext({
      orgId: itemSubmission.itemType.orgId,
      input: itemSubmission,
    });

    await Promise.all([
      this.runRuleSet(
        liveRules,
        evaluationContext,
        RuleEnvironment.LIVE,
        executionsCorrelationId,
      ),
      this.runRuleSet(
        backgroundRules,
        evaluationContext,
        RuleEnvironment.BACKGROUND,
        executionsCorrelationId,
      ),
    ]);
  }

  async runRuleSet(
    rules: ReadonlyDeep<ReportingRule[]>,
    evaluationContext: RuleEvaluationContext,
    environment: RuleEnvironment,
    executionsCorrelationId: ReportingRuleExecutionCorrelationId,
  ) {
    if (!rules.length) {
      return;
    }

    const shouldRunActions = environment === 'LIVE';

    const ruleResults = await Promise.all(
      rules.map(async (it) =>
        this.ruleEvaluator.runRule(it.conditionSet, evaluationContext),
      ),
    );

    const rulesToResults = new Map(equalLengthZip(rules, ruleResults));

    const passingRules = [...rulesToResults.entries()]
      .filter(([_rule, result]) => result.passed)
      .map(([rule, _result]) => rule);

    const passingRuleActions = await Promise.all(
      passingRules.map(async (it) =>
        this.getActionsByIdEventuallyConsistent({
          ids: it.actionIds,
          orgId: it.orgId,
        }),
      ),
    );
    const passingRulePolicies = await Promise.all(
      passingRules.map(async (it) =>
        this.getPoliciesByIdEventuallyConsistent({
          ids: it.actionIds,
          orgId: it.orgId,
        }),
      ),
    );
    const passingRulesToPolicies = new Map(
      equalLengthZip(
        passingRules.map((it) => it.id),
        passingRulePolicies,
      ),
    );
    const passingRulesToActions = new Map(
      equalLengthZip(passingRules, passingRuleActions),
    );

    // NB: while we only run _deduped_ actions, we record the actions and
    // update the rule action run counts as though no deduping took place,
    // since, logically, each rule triggered the action.
    const { org, input: ruleInput } = evaluationContext;

    const logRuleExecutionsPromise =
      this.reportingRuleExecutionLogger.logReportingRuleExecutions(
        [...rulesToResults.entries()].map(([rule, result]) => ({
          orgId: org.id,
          reportingRule: {
            id: rule.id,
            name: rule.name,
            version: rule.version,
            environment,
          },
          ruleInput: ruleInput as ItemSubmission,
          result: result.conditionResults,
          correlationId: executionsCorrelationId,
          passed: result.passed,
          policyNames:
            passingRulesToPolicies.get(rule.id)?.map((policy) => policy.name) ??
            [],
          policyIds: rule.policyIds,
        })),
      );

    if (!shouldRunActions) {
      await logRuleExecutionsPromise;
      return { rulesToResults, actions: [] };
    }

    const dedupedActions = uniqBy(
      [...passingRulesToActions.values()].flat(),
      (it) => it.id,
    ) as Action[];

    // Publish all (deduped) actions + update the rule action counts if appropriate.
    const publishActionsPromise = this.actionPublisher
      .publishActions(
        dedupedActions.map((action) => {
          return {
            action,
            ruleEnvironment: environment,
            matchingRules: [...passingRulesToActions.entries()].flatMap(
              ([rule, actions]) =>
                actions.includes(action)
                  ? [
                      {
                        ...safePick(rule, ['id', 'name']),
                        version: rule.version,
                        policies: passingRulesToPolicies.get(rule.id) ?? [],
                        tags: [],
                      },
                    ]
                  : [],
            ),
            policies: _.uniqBy(
              [...passingRulesToActions.keys()].flatMap(
                (rule) => passingRulesToPolicies.get(rule.id) ?? [],
              ),
              'id',
            ),
          };
        }),
        {
          orgId: org.id,
          targetItem: ruleInput,
          correlationId: executionsCorrelationId,
        },
      )
      .catch((e) => {
        this.tracer.logActiveSpanFailedIfAny(e);
        throw e;
      });

    await Promise.all([publishActionsPromise, logRuleExecutionsPromise]);
    return;
  }
}
