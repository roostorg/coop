import { type ColumnType, type GeneratedAlways } from 'kysely';

import { type ConditionSetWithResultAsLogged } from '../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { type FilterableSfDate, type SfDate } from '../../snowflake/types.js';
import { type JsonOf } from '../../utils/encoding.js';
import { type NormalizedItemData } from '../itemProcessingService/toNormalizedItemDataOrErrors.js';
import {
  type ConditionSet,
  type ItemSchema,
  type ItemTypeKind,
  type ItemTypeSchemaVariant,
  type SchemaFieldRoles,
} from '../moderationConfigService/index.js';
import {
  type AppealEnqueueSourceInfo,
  type JobId,
  type ManualReviewAppealJob,
  type ManualReviewJobEnqueueSource,
  type ManualReviewJobEnqueueSourceInfo,
  type ManualReviewJobKind,
  type StoredManualReviewJob,
} from './manualReviewToolService.js';
import {
  type ManualReviewDecisionComponent,
  type ManualReviewDecisionRelatedAction,
  type ManualReviewDecisionType,
} from './modules/JobDecisioning.js';
import { type RoutingRuleStatus } from './modules/JobRouting.js';

export type RoutingRuleExecutionsRow = {
  RULE: string; // rule name
  RULE_ID: string;
  RULE_VERSION: string;
  ORG_ID: string;
  CORRELATION_ID: string | null;
  RESULT: ConditionSetWithResultAsLogged | null;
  PASSED: boolean;
  TS: ColumnType<SfDate, number, never>;
  DS: ColumnType<FilterableSfDate, string, never>;
  DESTINATION_QUEUE_ID: string;
  ITEM_ID: string;
  ITEM_TYPE_ID: string;
  ITEM_TYPE_KIND: ItemTypeKind;
  ITEM_TYPE_SCHEMA: JsonOf<ItemSchema> | null;
  ITEM_TYPE_SCHEMA_FIELD_ROLES: SchemaFieldRoles | null;
  ITEM_TYPE_VERSION: string | null;
  ITEM_TYPE_SCHEMA_VARIANT: ItemTypeSchemaVariant | null;
  JOB_KIND: ManualReviewJobKind;
} & (
  | {
      ITEM_DATA: JsonOf<NormalizedItemData>;
      ITEM_TYPE_NAME: string;
      ITEM_CREATOR_ID: string | null;
      ITEM_CREATOR_TYPE_ID: string | null;
    }
  | {
      ITEM_DATA: null;
      ITEM_TYPE_NAME: null;
      ITEM_CREATOR_ID: null;
      ITEM_CREATOR_TYPE_ID: null;
    }
);

export type ManualReviewToolServicePg = {
  'manual_review_tool.manual_review_queues': {
    id: string;
    name: string;
    description: string | null;
    org_id: string;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
    is_default_queue: boolean;
    is_appeals_queue: boolean;
    auto_close_jobs: boolean;
  };
  'manual_review_tool.manual_review_decisions': {
    id: string;
    job_payload: StoredManualReviewJob | ManualReviewAppealJob;
    queue_id: string;
    reviewer_id: string | null;
    org_id: string;
    created_at: GeneratedAlways<Date>;
    decision_components: ManualReviewDecisionComponent[];
    related_actions: ManualReviewDecisionRelatedAction[];
    enqueue_source_info:
      | ManualReviewJobEnqueueSourceInfo
      | AppealEnqueueSourceInfo
      | null;
    item_created_at: Date | null;
    decision_reason: string | null;
  };
  'manual_review_tool.routing_rules': {
    id: string;
    org_id: string;
    name: string;
    description: string | null;
    status: RoutingRuleStatus;
    created_at: GeneratedAlways<Date>;
    creator_id: string;
    condition_set: ConditionSet;
    sequence_number: number;
    destination_queue_id: string;
  };
  'manual_review_tool.routing_rule_versions': {
    id: GeneratedAlways<string>;
    org_id: GeneratedAlways<string>;
    name: GeneratedAlways<string>;
    description: GeneratedAlways<string | null>;
    status: GeneratedAlways<RoutingRuleStatus>;
    created_at: GeneratedAlways<Date>;
    creator_id: GeneratedAlways<string>;
    condition_set: GeneratedAlways<ConditionSet>;
    sequence_number: GeneratedAlways<number>;
    destination_queue_id: GeneratedAlways<string>;
    is_current: GeneratedAlways<boolean>;
    version: GeneratedAlways<string>;
  };
  'manual_review_tool.routing_rules_to_item_types': {
    routing_rule_id: string;
    item_type_id: string;
  };
  'manual_review_tool.appeals_routing_rules': {
    id: string;
    org_id: string;
    name: string;
    description: string | null;
    status: RoutingRuleStatus;
    created_at: GeneratedAlways<Date>;
    creator_id: string;
    condition_set: ConditionSet;
    sequence_number: number;
    destination_queue_id: string;
  };
  'manual_review_tool.appeals_routing_rule_versions': {
    id: GeneratedAlways<string>;
    org_id: GeneratedAlways<string>;
    name: GeneratedAlways<string>;
    description: GeneratedAlways<string | null>;
    status: GeneratedAlways<RoutingRuleStatus>;
    created_at: GeneratedAlways<Date>;
    creator_id: GeneratedAlways<string>;
    condition_set: GeneratedAlways<ConditionSet>;
    sequence_number: GeneratedAlways<number>;
    destination_queue_id: GeneratedAlways<string>;
    is_current: GeneratedAlways<boolean>;
    version: GeneratedAlways<string>;
  };
  'manual_review_tool.appeals_routing_rules_to_item_types': {
    appeals_routing_rule_id: string;
    item_type_id: string;
  };
  'manual_review_tool.users_and_accessible_queues': {
    user_id: string;
    queue_id: string;
  };
  'manual_review_tool.dim_mrt_decisions': {
    org_id: GeneratedAlways<string>;
    job_id: GeneratedAlways<string>;
    item_id: GeneratedAlways<string>;
    action_id: GeneratedAlways<string | null>;
    policy_id: GeneratedAlways<string | null>;
    queue_id: GeneratedAlways<string>;
    type: GeneratedAlways<ManualReviewDecisionType>;
    item_type_id: GeneratedAlways<string>;
    reviewer_id: GeneratedAlways<string>;
    ds: GeneratedAlways<string>;
    decided_at: GeneratedAlways<Date>;
  };
  // Table that stores the results of the `dim_mrt_decisions` view, should be
  // preference for reads over decisions and decision analytics
  'manual_review_tool.dim_mrt_decisions_materialized': ManualReviewToolServicePg['manual_review_tool.dim_mrt_decisions'];
  'manual_review_tool.job_creations': {
    id: JobId;
    org_id: string;
    item_id: string;
    queue_id: string;
    item_type_id: string;
    created_at: Date;
    enqueue_source_info:
      | ManualReviewJobEnqueueSourceInfo
      | AppealEnqueueSourceInfo;
    policy_ids: string[];
  };
  'manual_review_tool.flattened_job_creations': {
    id: JobId;
    org_id: string;
    queue_id: string;
    item_id: string;
    item_type_id: string;
    created_at: Date;
    source_kind: ManualReviewJobEnqueueSource;
    policy_id: string;
    rule_id: string;
  };
  'manual_review_tool.manual_review_hidden_item_fields': {
    org_id: string;
    item_type_id: string;
    hidden_fields: string[];
  };
  'manual_review_tool.manual_review_tool_settings': {
    org_id: string;
    requires_policy_for_decisions: boolean;
    mrt_requires_decision_reason: boolean;
    hide_skip_button_for_non_admins: boolean;
    ignore_callback_url?: string;
    preview_jobs_view_enabled: boolean;
  };
  'manual_review_tool.job_comments': {
    id: string;
    job_id: string;
    org_id: string;
    author_id: string;
    comment_text: string;
    created_at: GeneratedAlways<Date>;
  };
  'manual_review_tool.users_and_favorite_mrt_queues': {
    user_id: string;
    queue_id: string;
    org_id: string;
    createdAt: GeneratedAlways<Date>;
    updatedAt: GeneratedAlways<Date>;
  };
  'manual_review_tool.queues_and_hidden_actions': {
    queue_id: string;
    action_id: string;
    org_id: string;
  };
  'manual_review_tool.moderator_skips': {
    org_id: string;
    user_id: string;
    job_id: string;
    queue_id: string;
    ts: GeneratedAlways<Date>;
  };
  // This table is more general than the ManualReviewToolService, and
  // doesn't need to be exclusively managed by it - but we don't really have a
  // good place for pg internal tables, so for now it lives here
  'public.view_maintenance_metadata': {
    // This should be an enum of all the tables we plan to use the incremental
    // maintenance strategy on, that way we get type errors if we
    // try to read/write a table name that we don't expect to exist
    // (instead of simply typing this as 'string')
    table_name: 'manual_review_tool.dim_mrt_decisions_materialized';
    last_insert: Date;
  };
};

export type ManualReviewToolServiceSnowflakeSchema = {
  'MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS': RoutingRuleExecutionsRow;
};
