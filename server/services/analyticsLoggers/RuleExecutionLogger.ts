import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { type ConditionSetWithResult } from '../../models/rules/RuleModel.js';
import { type RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import { fromCorrelationId } from '../../utils/correlationIds.js';
import { jsonStringifyUnstable } from '../../utils/encoding.js';

import '../../utils/errors.js';

import {
  isFullSubmission,
  type RuleInput,
} from '../../rule_engine/RuleEvaluator.js';
import { getUtcDateOnlyString } from '../../utils/time.js';
import {
  pickConditionPropsToLog,
  type RuleExecutionCorrelationId,
} from './ruleExecutionLoggingUtils.js';

type RuleExecutionData = ReadonlyDeep<{
  orgId: string;
  rule: {
    id: string;
    name: string;
    version: string;
    tags: string[];
  };
  ruleInput: RuleInput;
  policies: { id: string; name: string }[];
  environment: RuleEnvironment;
  result: ConditionSetWithResult;
  passed: boolean;
  correlationId: RuleExecutionCorrelationId;
}>;

class RuleExecutionLogger {
  constructor(
    private readonly analytics: Dependencies['DataWarehouseAnalytics'],
  ) {}
  async logRuleExecutions(
    executions: readonly RuleExecutionData[],
    sync?: boolean,
  ) {
    const now = new Date();
    await this.analytics.bulkWrite(
      'RULE_EXECUTIONS',
      executions.map((data) => ({
        ds: getUtcDateOnlyString(now),
        ts: now.valueOf(),
        org_id: data.orgId,
        item_id: data.ruleInput.itemId,
        item_type_id: data.ruleInput.itemType.id,
        item_type_kind: data.ruleInput.itemType.kind,
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
        rule: data.rule.name,
        rule_id: data.rule.id,
        rule_version: data.rule.version,
        tags: data.rule.tags,
        policy_ids: data.policies.map((it) => it.id),
        policy_names: data.policies.map((it) => it.name),
        environment: data.environment,
        correlation_id: fromCorrelationId(data.correlationId),
        result: jsonStringifyUnstable(pickConditionPropsToLog(data.result)),
        passed: data.passed,
      })) as any,
      { batchTimeout: sync ? 0 : undefined },
    );
  }
}

export default inject(['DataWarehouseAnalytics'], RuleExecutionLogger);
export { type RuleExecutionLogger };
