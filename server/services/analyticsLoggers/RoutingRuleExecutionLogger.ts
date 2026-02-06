import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { type ConditionSetWithResult } from '../../models/rules/RuleModel.js';
import {
  isFullSubmission,
  type RuleInput,
} from '../../rule_engine/RuleEvaluator.js';
import { type ManualReviewJobKind } from '../../services/manualReviewToolService/index.js';
import { fromCorrelationId } from '../../utils/correlationIds.js';
import { jsonStringifyUnstable } from '../../utils/encoding.js';
import { getUtcDateOnlyString } from '../../utils/time.js';
import { type ActionExecutionCorrelationId } from './ActionExecutionLogger.js';
import {
  pickConditionPropsToLog,
  type RuleExecutionCorrelationId,
} from './ruleExecutionLoggingUtils.js';

type RoutingRuleExecutionData = {
  orgId: string;
  routingRule: ReadonlyDeep<{
    id: string;
    name: string;
    version: string;
    destinationQueueId: string;
  }>;
  ruleInput: RuleInput;
  result: ReadonlyDeep<ConditionSetWithResult>;
  passed: boolean;
  correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
  manualReviewJobKind: ManualReviewJobKind;
};

// TODO: should this live within the MRT service?
class RoutingRuleExecutionLogger {
  constructor(
    private readonly analytics: Dependencies['DataWarehouseAnalytics'],
  ) {}
  async logRoutingRuleExecutions(
    executions: readonly RoutingRuleExecutionData[],
  ) {
    const now = new Date();
    await this.analytics.bulkWrite(
      'MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS' as any,
      executions.map((data) => ({
        ds: getUtcDateOnlyString(now),
        ts: now.valueOf(),
        org_id: data.orgId,
        item_id: data.ruleInput.itemId,
        item_type_id: data.ruleInput.itemType.id,
        item_type_kind: data.ruleInput.itemType.kind,
        destination_queue_id: data.routingRule.destinationQueueId,
        ...(isFullSubmission(data.ruleInput)
          ? {
              item_submission_id: data.ruleInput.submissionId,
              item_data: jsonStringifyUnstable(data.ruleInput.data),
              item_type_name: data.ruleInput.itemType.name,
              item_creator_id: data.ruleInput.creator?.id,
              item_creator_type_id: data.ruleInput.creator?.typeId,
              item_type_schema: jsonStringifyUnstable(
                data.ruleInput.itemType.schema,
              ),
              item_type_schema_field_roles:
                data.ruleInput.itemType.schemaFieldRoles,
              item_type_schema_variant: data.ruleInput.itemType.schemaVariant,
              item_type_version: data.ruleInput.itemType.version,
            }
          : {}),
        rule: data.routingRule.name,
        rule_id: data.routingRule.id,
        rule_version: data.routingRule.version,
        correlation_id: fromCorrelationId(data.correlationId),
        result: pickConditionPropsToLog(data.result),
        passed: data.passed,
        job_kind: data.manualReviewJobKind,
      })),
    );
  }
}

export default inject(['DataWarehouseAnalytics'], RoutingRuleExecutionLogger);
export { type RoutingRuleExecutionLogger };
