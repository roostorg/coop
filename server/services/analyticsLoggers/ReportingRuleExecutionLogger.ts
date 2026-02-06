import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { type ConditionSetWithResult } from '../../models/rules/RuleModel.js';
import { type RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import { type ItemSubmission } from '../../services/itemProcessingService/index.js';
import { type ReportingRuleExecutionCorrelationId } from '../../services/reportingService/index.js';
import { fromCorrelationId } from '../../utils/correlationIds.js';
import { jsonStringify } from '../../utils/encoding.js';
import { getUtcDateOnlyString } from '../../utils/time.js';
import { pickConditionPropsToLog } from './ruleExecutionLoggingUtils.js';

type ReportingRuleExecutionData = {
  orgId: string;
  reportingRule: ReadonlyDeep<{
    id: string;
    name: string;
    version: string;
    environment: RuleEnvironment;
  }>;
  ruleInput: ItemSubmission;
  result: ReadonlyDeep<ConditionSetWithResult>;
  passed: boolean;
  correlationId: ReportingRuleExecutionCorrelationId;
  policyNames: readonly string[];
  policyIds: readonly string[];
};

class ReportingRuleExecutionLogger {
  constructor(
    private readonly analytics: Dependencies['DataWarehouseAnalytics'],
  ) {}
  async logReportingRuleExecutions(
    executions: readonly ReportingRuleExecutionData[],
  ) {
    const now = new Date();
    await this.analytics.bulkWrite(
      'REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS' as any,
      executions.map((data) => ({
        ds: getUtcDateOnlyString(now),
        ts: now.valueOf(),
        org_id: data.orgId,
        item_id: data.ruleInput.itemId,
        item_type_id: data.ruleInput.itemType.id,
        item_type_kind: data.ruleInput.itemType.kind,
        item_submission_id: data.ruleInput.submissionId,
        item_data: jsonStringify(data.ruleInput.data),
        item_type_name: data.ruleInput.itemType.name,
        item_creator_id: data.ruleInput.creator?.id,
        item_creator_type_id: data.ruleInput.creator?.typeId,
        item_type_schema: jsonStringify(data.ruleInput.itemType.schema),
        item_type_schema_field_roles: data.ruleInput.itemType.schemaFieldRoles,
        item_type_schema_variant: data.ruleInput.itemType.schemaVariant,
        item_type_version: data.ruleInput.itemType.version,
        policy_names: data.policyNames,
        policy_ids: data.policyIds,
        rule_name: data.reportingRule.name,
        rule_id: data.reportingRule.id,
        rule_version: data.reportingRule.version,
        rule_environment: data.reportingRule.environment,
        correlation_id: fromCorrelationId(data.correlationId),
        result: pickConditionPropsToLog(data.result),
        passed: data.passed,
      })),
    );
  }
}

export default inject(['DataWarehouseAnalytics'], ReportingRuleExecutionLogger);
export { type ReportingRuleExecutionLogger };
