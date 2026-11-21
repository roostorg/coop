import { sql } from 'drizzle-orm';
import {
  boolean as bool,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  type ClearReportsDisposition,
  type ClearReportsScope,
  type JobSortType,
} from './json-types/mrt-queues.js';
import { orgs } from './public-2.js';
import {
  appealsRoutingRuleStatus,
  manualReviewToolSchema,
  tstzrange,
} from './types.js';

export const appealsRoutingRuleHistory = manualReviewToolSchema.table(
  'appeals_routing_rule_history',
  {
    id: varchar({ length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    status: appealsRoutingRuleStatus().notNull(),
    creatorId: varchar('creator_id', { length: 255 }).notNull(),
    conditionSet: jsonb('condition_set').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),
    destinationQueueId: varchar('destination_queue_id', {
      length: 255,
    }).notNull(),
    sysPeriod: tstzrange('sys_period').notNull(),
  },
);

export const appealsRoutingRules = manualReviewToolSchema.table(
  'appeals_routing_rules',
  {
    id: varchar({ length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    status: appealsRoutingRuleStatus().default('LIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    creatorId: varchar('creator_id', { length: 255 }).notNull(),
    conditionSet: jsonb('condition_set').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),
    destinationQueueId: varchar('destination_queue_id', {
      length: 255,
    }).notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.destinationQueueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'appeals_routing_rules_destination_queue_id_fkey',
    }).onDelete('restrict'),
    uniqueIndex('appeals_routing_rules_org_id_name_key').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.name.asc().nullsLast(),
    ),
    uniqueIndex('appeals_routing_rules_org_id_sequence_number_key').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.sequenceNumber.asc().nullsLast(),
    ),
  ],
);

export const appealsRoutingRulesToItemTypes = manualReviewToolSchema.table(
  'appeals_routing_rules_to_item_types',
  {
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    appealsRoutingRuleId: varchar('appeals_routing_rule_id', {
      length: 255,
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.itemTypeId, table.appealsRoutingRuleId],
      name: 'appeals_routing_rules_to_item_types_pkey',
    }),
    foreignKey({
      columns: [table.appealsRoutingRuleId],
      foreignColumns: [appealsRoutingRules.id],
      name: 'appeals_routing_rules_to_item_type_appeals_routing_rule_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const dimMrtDecisionsMaterialized = manualReviewToolSchema.table(
  'dim_mrt_decisions_materialized',
  {
    orgId: varchar('org_id', { length: 255 }),
    itemId: text('item_id'),
    actionId: text('action_id'),
    policyId: text('policy_id'),
    type: text(),
    itemTypeId: text('item_type_id'),
    queueId: varchar('queue_id', { length: 255 }),
    reviewerId: varchar('reviewer_id', { length: 255 }),
    ds: date(),
    jobId: text('job_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => [
    index('manual_decisions_view_dec_at_idx').using(
      'btree',
      table.decidedAt.asc().nullsLast(),
    ),
    uniqueIndex('mrt_materialized_decisions_unique_row_idx').using(
      'btree',
      sql`COALESCE(job_id, ''::text)`,
      sql`COALESCE(action_id, ''::text)`,
      sql`COALESCE(policy_id, ''::text)`,
      sql`COALESCE(type, ''::text)`,
      sql`COALESCE(item_id, ''::text)`,
      sql`COALESCE(item_type_id, ''::text)`,
    ),
  ],
);

export const jobClaims = manualReviewToolSchema.table(
  'job_claims',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    jobId: text('job_id').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.queueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'job_claims_queue_id_fkey',
    }).onDelete('cascade'),
    index('idx_job_claims_org_claimed_at').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.claimedAt.asc().nullsLast(),
    ),
    index('idx_job_claims_org_job_claimed_at').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.jobId.asc().nullsLast(),
      table.claimedAt.desc().nullsFirst(),
    ),
    index('idx_job_claims_org_job_user_claimed_at').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.jobId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.claimedAt.desc().nullsFirst(),
    ),
  ],
);

export const jobComments = manualReviewToolSchema.table('job_comments', {
  id: varchar({ length: 255 }).primaryKey(),
  jobId: text('job_id').notNull(),
  orgId: varchar('org_id', { length: 255 }).notNull(),
  authorId: varchar('author_id', { length: 255 }).notNull(),
  commentText: text('comment_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const jobCreations = manualReviewToolSchema.table(
  'job_creations',
  {
    id: text().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    itemId: text('item_id').notNull(),
    itemTypeId: text('item_type_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    enqueueSourceInfo: jsonb('enqueue_source_info').notNull(),
    policyIds: text('policy_ids')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
  },
  (table) => [
    index('jobs_created_at_brin_idx').using(
      'brin',
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const jobPriorityWeights = manualReviewToolSchema.table(
  'job_priority_weights',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    property: varchar({ length: 64 }).notNull(),
    weight: numeric({ mode: 'number' }).default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.orgId, table.property],
      name: 'job_priority_weights_pkey',
    }),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'job_priority_weights_org_id_fkey',
    }).onDelete('cascade'),
    check('job_priority_weights_weight_check', sql`(weight >= (0)::numeric)`),
  ],
);

export const manualReviewDecisions = manualReviewToolSchema.table(
  'manual_review_decisions',
  {
    id: uuid().primaryKey(),
    jobPayload: jsonb('job_payload').notNull(),
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    reviewerId: varchar('reviewer_id', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    decisionComponents: jsonb('decision_components').array().notNull(),
    relatedActions: jsonb('related_actions')
      .array()
      .default(sql`ARRAY[]::jsonb[]`)
      .notNull(),
    enqueueSourceInfo: jsonb('enqueue_source_info'),
    itemCreatedAt: timestamp('item_created_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_decisions_job_payload_id').using(
      'btree',
      sql`(job_payload ->> 'id'::text)`,
    ),
    index('idx_job_item_id').using(
      'btree',
      sql`(((job_payload -> 'payload'::text) -> 'item'::text) ->> 'itemId'::text)`,
    ),
    index('idx_manual_review_decisions_org_created_assigned')
      .using(
        'btree',
        table.orgId.asc().nullsLast(),
        table.createdAt.asc().nullsLast(),
      )
      .where(sql`(assigned_at IS NOT NULL)`),
    index('idx_mrt_decisions_org_created_id').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index('manual_review_decisions_created_at_idx').using(
      'btree',
      table.createdAt.asc().nullsLast(),
    ),
    index('mrt_decisions_org_id_idx').using(
      'btree',
      table.orgId.asc().nullsLast(),
    ),
  ],
);

export const manualReviewHiddenItemFields = manualReviewToolSchema.table(
  'manual_review_hidden_item_fields',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    hiddenFields: text('hidden_fields')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.orgId, table.itemTypeId],
      name: 'manual_review_hidden_item_fields_pkey',
    }),
  ],
);

export const manualReviewQueues = manualReviewToolSchema.table(
  'manual_review_queues',
  {
    id: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    isDefaultQueue: bool('is_default_queue').default(false).notNull(),
    description: varchar({ length: 255 }),
    isAppealsQueue: bool('is_appeals_queue').default(false).notNull(),
    autoCloseJobs: bool('auto_close_jobs').default(false),
    clearReportsDisposition: varchar('clear_reports_disposition', {
      length: 64,
    }).$type<ClearReportsDisposition>(),
    clearReportsScope: varchar('clear_reports_scope', { length: 64 })
      .$type<ClearReportsScope>()
      .default('CURRENT_QUEUE')
      .notNull(),
    jobSortType: varchar('job_sort_type', { length: 16 })
      .$type<JobSortType>()
      .default('FIFO')
      .notNull(),
  },
  (table) => [
    index('manual_review_decisions_org_id').using(
      'btree',
      table.orgId.asc().nullsLast(),
    ),
    uniqueIndex('manual_review_queue_is_default')
      .using(
        'btree',
        table.orgId.asc().nullsLast(),
        table.isDefaultQueue.asc().nullsLast(),
        table.isAppealsQueue.asc().nullsLast(),
      )
      .where(sql`(is_default_queue = true)`),
    index('manual_review_queue_org_id').using(
      'btree',
      table.orgId.asc().nullsLast(),
    ),
    uniqueIndex('manual_review_queue_unique_name').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.name.asc().nullsLast(),
      table.isAppealsQueue.asc().nullsLast(),
    ),
    check(
      'manual_review_queues_clear_reports_disposition_check',
      sql`((clear_reports_disposition IS NULL) OR ((clear_reports_disposition)::text = ANY ((ARRAY['AUTOMATIC_CLOSE'::character varying, 'IGNORE'::character varying, 'SAME_ACTION'::character varying])::text[])))`,
    ),
    check(
      'manual_review_queues_clear_reports_scope_check',
      sql`((clear_reports_scope)::text = ANY ((ARRAY['CURRENT_QUEUE'::character varying, 'ALL_QUEUES'::character varying])::text[]))`,
    ),
    check(
      'manual_review_queues_description_check',
      sql`((description)::text <> ''::text)`,
    ),
    check(
      'manual_review_queues_job_sort_type_check',
      sql`((job_sort_type)::text = ANY ((ARRAY['FIFO'::character varying, 'NUM_REPORTS'::character varying, 'WEIGHTED'::character varying])::text[]))`,
    ),
  ],
);

export const manualReviewToolSettings = manualReviewToolSchema.table(
  'manual_review_tool_settings',
  {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    requiresPolicyForDecisions: bool('requires_policy_for_decisions')
      .default(false)
      .notNull(),
    mrtRequiresDecisionReasonOnAction: bool(
      'mrt_requires_decision_reason_on_action',
    )
      .default(false)
      .notNull(),
    hideSkipButtonForNonAdmins: bool('hide_skip_button_for_non_admins').default(
      false,
    ),
    ignoreCallbackUrl: varchar('ignore_callback_url', { length: 255 }),
    previewJobsViewEnabled: bool('preview_jobs_view_enabled')
      .default(false)
      .notNull(),
    mrtRequiresDecisionReasonOnIgnore: bool(
      'mrt_requires_decision_reason_on_ignore',
    )
      .default(false)
      .notNull(),
  },
);

export const moderatorSkips = manualReviewToolSchema.table(
  'moderator_skips',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    jobId: text('job_id').notNull(),
    ts: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.queueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'moderator_skips_queue_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const queuesAndClearReportsTriggerActions = manualReviewToolSchema.table(
  'queues_and_clear_reports_trigger_actions',
  {
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    actionId: varchar('action_id', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.queueId, table.actionId],
      name: 'queues_and_clear_reports_trigger_actions_pkey',
    }),
    foreignKey({
      columns: [table.queueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'queues_and_clear_reports_trigger_actions_queue_fkey',
    }).onDelete('cascade'),
    index('idx_queues_and_clear_reports_trigger_actions_org_id').using(
      'btree',
      table.orgId.asc().nullsLast(),
    ),
  ],
);
