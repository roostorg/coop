import _ from 'lodash';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  isFullSubmission,
  type ActionExecutionData,
} from '../../rule_engine/ActionPublisher.js';
import {
  fromCorrelationId,
  getSourceType,
  type CorrelationId,
} from '../../utils/correlationIds.js';
import { safePick } from '../../utils/misc.js';
import { getUtcDateOnlyString } from '../../utils/time.js';
import {
  type ActionExecutionMatchingRule,
  type ActionExecutionPolicy,
} from '../../snowflake/types.js';

export type ActionExecutionSourceType =
  | 'post-content'
  | 'manual-action-run'
  | 'user-rule-run'
  | 'retroaction'
  | 'post-items'
  | 'mrt-decision'
  | 'submit-report'
  | 'submit-appeal'
  | 'user-strike-action-execution'
  | 'post-actions';

export type ActionExecutionCorrelationId = {
  [K in ActionExecutionSourceType]: CorrelationId<K>;
}[ActionExecutionSourceType];

export type Policy = Required<ActionExecutionPolicy>;
export type MatchingRule = Omit<
  ActionExecutionMatchingRule,
  'tags' | 'policies'
> & {
  tags: string[];
  policies: Policy[];
};

class ActionExecutionLogger {
  constructor(
    private readonly analytics: Dependencies['DataWarehouseAnalytics'],
  ) {}
  async logActionExecutions<T extends ActionExecutionCorrelationId>(opts: {
    executions: ActionExecutionData<T>[];
    failed: boolean;
    sync?: boolean;
  }) {
    const { executions, failed, sync } = opts;
    const now = new Date();
    await this.analytics.bulkWrite(
      'ACTION_EXECUTIONS',
      executions.map((data) => {
        // Remove excess properties from the matching rules and policies. We
        // need to do this, or all kinds of junk (including json null
        // values that cause perf problems) can end up in our snowflake table.
        const matchingRules = data.matchingRules?.map((rule) => ({
          ...safePick(rule, ['id', 'name', 'version', 'tags']),
          policies: rule.policies.map((it) =>
            safePick(it, ['id', 'name', 'userStrikeCount']),
          ),
        }));

        return {
          ds: getUtcDateOnlyString(now),
          ts: now.valueOf(),
          org_id: data.orgId,
          action_id: data.action.id,
          action_name: data.action.name,
          action_source: getSourceType(data.correlationId),
          correlation_id: fromCorrelationId(data.correlationId),
          item_id: data.targetItem.itemId,
          item_type_id: data.targetItem.itemType.id,
          item_type_kind: data.targetItem.itemType.kind,
          ...(isFullSubmission(data.targetItem)
            ? {
                item_submission_id: data.targetItem.submissionId,
                item_creator_id: data.targetItem.creator?.id,
                item_creator_type_id: data.targetItem.creator?.typeId,
              }
            : {}),
          ...(matchingRules
            ? {
                rule_environment: data.ruleEnvironment,
                rules: matchingRules,
                rule_tags: _.uniq(matchingRules.flatMap((it) => it.tags)),
              }
            : {}),
          policies: data.policies,
          actor_id: data.actorId,
          job_id: data.jobId,
          failed,
        };
      }),
      { batchTimeout: sync ? 0 : undefined },
    );
  }
}

export default inject(['DataWarehouseAnalytics'], ActionExecutionLogger);
export { type ActionExecutionLogger };
