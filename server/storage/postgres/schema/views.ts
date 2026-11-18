import { sql } from 'drizzle-orm';
import {
  boolean as bool,
  date,
  integer,
  jsonb,
  pgMaterializedView,
  pgView,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  appealsRoutingRuleStatus,
  itemTypeKind,
  manualReviewToolSchema,
  reportingRulesSchema,
  reportingRuleStatus,
  routingRuleStatus,
  ruleType,
  userPenaltySeverity,
} from './types.js';

export const appealsRoutingRuleLatestVersions = manualReviewToolSchema
  .view('appeals_routing_rule_latest_versions', {
    appealsRoutingRuleId: varchar('appeals_routing_rule_id', { length: 255 }),
    version: text(),
  })
  .as(
    sql`SELECT appeals_routing_rule_versions.id AS appeals_routing_rule_id, to_char((appeals_routing_rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version FROM manual_review_tool.appeals_routing_rule_versions WHERE appeals_routing_rule_versions.is_current = true`,
  );

export const appealsRoutingRuleVersions = manualReviewToolSchema
  .materializedView('appeals_routing_rule_versions', {
    id: varchar({ length: 255 }),
    name: varchar({ length: 255 }),
    orgId: varchar('org_id', { length: 255 }),
    description: varchar({ length: 255 }),
    status: appealsRoutingRuleStatus(),
    creatorId: varchar('creator_id', { length: 255 }),
    conditionSet: jsonb('condition_set'),
    sequenceNumber: integer('sequence_number'),
    destinationQueueId: varchar('destination_queue_id', { length: 255 }),
    version: timestamp({ withTimezone: true }),
    isCurrent: bool('is_current'),
  })
  .as(
    sql`WITH appeals_routing_rule_versions AS ( SELECT appeals_routing_rules_1.id, appeals_routing_rules_1.name, appeals_routing_rules_1.org_id, appeals_routing_rules_1.description, appeals_routing_rules_1.status, appeals_routing_rules_1.creator_id, appeals_routing_rules_1.condition_set, appeals_routing_rules_1.sequence_number, appeals_routing_rules_1.destination_queue_id, appeals_routing_rules_1.sys_period FROM manual_review_tool.appeals_routing_rules appeals_routing_rules_1 UNION ALL SELECT appeals_routing_rule_history.id, appeals_routing_rule_history.name, appeals_routing_rule_history.org_id, appeals_routing_rule_history.description, appeals_routing_rule_history.status, appeals_routing_rule_history.creator_id, appeals_routing_rule_history.condition_set, appeals_routing_rule_history.sequence_number, appeals_routing_rule_history.destination_queue_id, appeals_routing_rule_history.sys_period FROM manual_review_tool.appeals_routing_rule_history ), appeals_routing_rules AS ( SELECT appeals_routing_rule_versions_1.id, max(lower(appeals_routing_rule_versions_1.sys_period)) AS max_period_start FROM appeals_routing_rule_versions appeals_routing_rule_versions_1 GROUP BY appeals_routing_rule_versions_1.id ) SELECT appeals_routing_rule_versions.id, appeals_routing_rule_versions.name, appeals_routing_rule_versions.org_id, appeals_routing_rule_versions.description, appeals_routing_rule_versions.status, appeals_routing_rule_versions.creator_id, appeals_routing_rule_versions.condition_set, appeals_routing_rule_versions.sequence_number, appeals_routing_rule_versions.destination_queue_id, lower(appeals_routing_rule_versions.sys_period) AS version, appeals_routing_rules.max_period_start = lower(appeals_routing_rule_versions.sys_period) AND upper_inf(appeals_routing_rule_versions.sys_period) AS is_current FROM appeals_routing_rule_versions JOIN appeals_routing_rules ON appeals_routing_rules.id::text = appeals_routing_rule_versions.id::text`,
  );

export const dimMrtDecisions = manualReviewToolSchema
  .view('dim_mrt_decisions', {
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
  })
  .as(
    sql`WITH decisions AS ( SELECT manual_review_decisions.org_id, dc.dc ->> 'type'::text AS type, action.value ->> 'id'::text AS action_id, policy.value ->> 'id'::text AS policy_id, ((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) ->> 'itemId'::text AS item_id, (((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text AS item_type_id, manual_review_decisions.queue_id, manual_review_decisions.reviewer_id, manual_review_decisions.created_at, manual_review_decisions.job_payload ->> 'id'::text AS job_id FROM manual_review_tool.manual_review_decisions, LATERAL unnest(manual_review_decisions.decision_components) dc(dc) CROSS JOIN LATERAL jsonb_array_elements(dc.dc -> 'actions'::text) action(value), LATERAL jsonb_array_elements(dc.dc -> 'policies'::text) policy(value) WHERE (dc.dc ->> 'type'::text) = 'CUSTOM_ACTION'::text UNION ALL SELECT manual_review_decisions.org_id, dc.dc ->> 'type'::text AS type, NULL::text AS action_id, NULL::text AS policy_id, ((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) ->> 'itemId'::text AS item_id, (((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text AS item_type_id, manual_review_decisions.queue_id, manual_review_decisions.reviewer_id, manual_review_decisions.created_at, manual_review_decisions.job_payload ->> 'id'::text AS job_id FROM manual_review_tool.manual_review_decisions, LATERAL unnest(manual_review_decisions.decision_components) dc(dc) WHERE (dc.dc ->> 'type'::text) <> 'CUSTOM_ACTION'::text UNION ALL SELECT DISTINCT manual_review_decisions.org_id, 'RELATED_ACTION'::text AS type, action.value AS action_id, policy.value AS policy_id, item_id.value AS item_id, unnested_data.unnested_data ->> 'itemTypeId'::text AS item_type_id, manual_review_decisions.queue_id, manual_review_decisions.reviewer_id, manual_review_decisions.created_at, manual_review_decisions.job_payload ->> 'id'::text AS job_id FROM manual_review_tool.manual_review_decisions, LATERAL unnest(manual_review_decisions.related_actions) unnested_data(unnested_data), LATERAL jsonb_array_elements_text(unnested_data.unnested_data -> 'itemIds'::text) item_id(value), LATERAL jsonb_array_elements_text(unnested_data.unnested_data -> 'actionIds'::text) action(value), LATERAL jsonb_array_elements_text(unnested_data.unnested_data -> 'policyIds'::text) policy(value) ) SELECT DISTINCT decisions.org_id, decisions.item_id, decisions.action_id, decisions.policy_id, decisions.type, decisions.item_type_id, decisions.queue_id, decisions.reviewer_id, date(decisions.created_at) AS ds, decisions.job_id, decisions.created_at AS decided_at FROM decisions WHERE decisions.item_id IS NOT NULL AND decisions.item_type_id IS NOT NULL`,
  );

export const flattenedJobCreations = manualReviewToolSchema
  .view('flattened_job_creations', {
    id: text(),
    orgId: varchar('org_id', { length: 255 }),
    queueId: varchar('queue_id', { length: 255 }),
    itemId: text('item_id'),
    itemTypeId: text('item_type_id'),
    createdAt: timestamp('created_at', { withTimezone: true }),
    sourceKind: text('source_kind'),
    ruleId: text('rule_id'),
    policyId: text('policy_id'),
  })
  .as(
    sql`SELECT job_creations.id, job_creations.org_id, job_creations.queue_id, job_creations.item_id, job_creations.item_type_id, job_creations.created_at, job_creations.enqueue_source_info ->> 'kind'::text AS source_kind, rule_id.value AS rule_id, policy_id.policy_id FROM manual_review_tool.job_creations LEFT JOIN LATERAL jsonb_array_elements_text(job_creations.enqueue_source_info -> 'rules'::text) rule_id(value) ON true LEFT JOIN LATERAL unnest(job_creations.policy_ids) policy_id(policy_id) ON true`,
  );

export const routingRuleLatestVersions = manualReviewToolSchema
  .view('routing_rule_latest_versions', {
    routingRuleId: varchar('routing_rule_id', { length: 255 }),
    version: text(),
  })
  .as(
    sql`SELECT routing_rule_versions.id AS routing_rule_id, to_char((routing_rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version FROM manual_review_tool.routing_rule_versions WHERE routing_rule_versions.is_current = true`,
  );

export const routingRuleVersions = manualReviewToolSchema
  .materializedView('routing_rule_versions', {
    id: varchar({ length: 255 }),
    name: varchar({ length: 255 }),
    orgId: varchar('org_id', { length: 255 }),
    description: varchar({ length: 255 }),
    status: routingRuleStatus(),
    creatorId: varchar('creator_id', { length: 255 }),
    conditionSet: jsonb('condition_set'),
    sequenceNumber: integer('sequence_number'),
    destinationQueueId: varchar('destination_queue_id', { length: 255 }),
    version: timestamp({ withTimezone: true }),
    isCurrent: bool('is_current'),
  })
  .as(
    sql`WITH routing_rule_versions AS ( SELECT routing_rules.id, routing_rules.name, routing_rules.org_id, routing_rules.description, routing_rules.status, routing_rules.creator_id, routing_rules.condition_set, routing_rules.sequence_number, routing_rules.destination_queue_id, routing_rules.sys_period FROM manual_review_tool.routing_rules UNION ALL SELECT routing_rule_history.id, routing_rule_history.name, routing_rule_history.org_id, routing_rule_history.description, routing_rule_history.status, routing_rule_history.creator_id, routing_rule_history.condition_set, routing_rule_history.sequence_number, routing_rule_history.destination_queue_id, routing_rule_history.sys_period FROM manual_review_tool.routing_rule_history ), routing_rules_max_period_starts AS ( SELECT routing_rule_versions_1.id, max(lower(routing_rule_versions_1.sys_period)) AS max_period_start FROM routing_rule_versions routing_rule_versions_1 GROUP BY routing_rule_versions_1.id ) SELECT routing_rule_versions.id, routing_rule_versions.name, routing_rule_versions.org_id, routing_rule_versions.description, routing_rule_versions.status, routing_rule_versions.creator_id, routing_rule_versions.condition_set, routing_rule_versions.sequence_number, routing_rule_versions.destination_queue_id, lower(routing_rule_versions.sys_period) AS version, routing_rules_max_period_starts.max_period_start = lower(routing_rule_versions.sys_period) AND upper_inf(routing_rule_versions.sys_period) AS is_current FROM routing_rule_versions JOIN routing_rules_max_period_starts ON routing_rules_max_period_starts.id::text = routing_rule_versions.id::text`,
  );

export const actionLatestVersions = pgView('action_latest_versions', {
  actionId: varchar('action_id', { length: 255 }),
  version: text(),
}).as(
  sql`SELECT action_versions.id AS action_id, to_char((action_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version FROM action_versions WHERE action_versions.is_current = true`,
);

export const actionVersions = pgMaterializedView('action_versions', {
  id: varchar({ length: 255 }),
  name: varchar({ length: 255 }),
  description: varchar({ length: 255 }),
  callbackUrl: varchar('callback_url', { length: 255 }),
  orgId: varchar('org_id', { length: 255 }),
  callbackUrlHeaders: jsonb('callback_url_headers'),
  callbackUrlBody: jsonb('callback_url_body'),
  penalty: userPenaltySeverity(),
  appliesToAllItemsOfKind: itemTypeKind('applies_to_all_items_of_kind')
    .array()
    .array('[][]'),
  version: timestamp({ withTimezone: true }),
  isCurrent: bool('is_current'),
}).as(
  sql`WITH action_versions AS ( SELECT actions.id, actions.name, actions.description, actions.callback_url, actions.org_id, actions.callback_url_headers, actions.callback_url_body, actions.penalty, actions.sys_period, actions.applies_to_all_items_of_kind FROM actions UNION ALL SELECT actions_history.id, actions_history.name, actions_history.description, actions_history.callback_url, actions_history.org_id, actions_history.callback_url_headers, actions_history.callback_url_body, actions_history.penalty, actions_history.sys_period, actions_history.applies_to_all_items_of_kind FROM actions_history ), action_max_period_starts AS ( SELECT action_versions_1.id, max(lower(action_versions_1.sys_period)) AS max_period_start FROM action_versions action_versions_1 GROUP BY action_versions_1.id ) SELECT action_versions.id, action_versions.name, action_versions.description, action_versions.callback_url, action_versions.org_id, action_versions.callback_url_headers, action_versions.callback_url_body, action_versions.penalty, action_versions.applies_to_all_items_of_kind, lower(action_versions.sys_period) AS version, action_max_period_starts.max_period_start = lower(action_versions.sys_period) AND upper_inf(action_versions.sys_period) AS is_current FROM action_versions JOIN action_max_period_starts ON action_max_period_starts.id::text = action_versions.id::text`,
);

export const itemTypeLatestVersions = pgView('item_type_latest_versions', {
  itemTypeId: varchar('item_type_id', { length: 255 }),
  version: text(),
}).as(
  sql`SELECT item_type_versions.id AS item_type_id, to_char((item_type_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version FROM item_type_versions WHERE item_type_versions.is_current = true`,
);

export const itemTypeVersions = pgMaterializedView('item_type_versions', {
  id: varchar({ length: 255 }),
  name: varchar({ length: 255 }),
  description: varchar({ length: 255 }),
  fields: jsonb().array().array('[][]'),
  orgId: varchar('org_id', { length: 255 }),
  kind: itemTypeKind(),
  displayNameField: varchar('display_name_field', { length: 255 }),
  creatorIdField: varchar('creator_id_field', { length: 255 }),
  threadIdField: varchar('thread_id_field', { length: 255 }),
  parentIdField: varchar('parent_id_field', { length: 255 }),
  createdAtField: varchar('created_at_field', { length: 255 }),
  isDeletedField: varchar('is_deleted_field', { length: 255 }),
  profileIconField: varchar('profile_icon_field', { length: 255 }),
  backgroundImageField: varchar('background_image_field', { length: 255 }),
  ipAddressField: varchar('ip_address_field', { length: 255 }),
  emailField: varchar('email_field', { length: 255 }),
  isDefaultUser: bool('is_default_user'),
  version: timestamp({ withTimezone: true }),
  isCurrent: bool('is_current'),
}).as(
  sql`WITH item_type_versions AS ( SELECT item_types.id, item_types.name, item_types.description, item_types.fields, item_types.org_id, item_types.sys_period, item_types.kind, item_types.display_name_field, item_types.creator_id_field, item_types.thread_id_field, item_types.parent_id_field, item_types.created_at_field, item_types.is_deleted_field, item_types.profile_icon_field, item_types.background_image_field, item_types.ip_address_field, item_types.email_field, item_types.is_default_user FROM item_types UNION ALL SELECT item_types_history.id, item_types_history.name, item_types_history.description, item_types_history.fields, item_types_history.org_id, item_types_history.sys_period, item_types_history.kind, item_types_history.display_name_field, item_types_history.creator_id_field, item_types_history.thread_id_field, item_types_history.parent_id_field, item_types_history.created_at_field, item_types_history.is_deleted_field, item_types_history.profile_icon_field, item_types_history.background_image_field, item_types_history.ip_address_field, item_types_history.email_field, item_types_history.is_default_user FROM item_types_history ), item_type_max_period_starts AS ( SELECT item_type_versions_1.id, max(lower(item_type_versions_1.sys_period)) AS max_period_start FROM item_type_versions item_type_versions_1 GROUP BY item_type_versions_1.id ) SELECT item_type_versions.id, item_type_versions.name, item_type_versions.description, item_type_versions.fields, item_type_versions.org_id, item_type_versions.kind, item_type_versions.display_name_field, item_type_versions.creator_id_field, item_type_versions.thread_id_field, item_type_versions.parent_id_field, item_type_versions.created_at_field, item_type_versions.is_deleted_field, item_type_versions.profile_icon_field, item_type_versions.background_image_field, item_type_versions.ip_address_field, item_type_versions.email_field, item_type_versions.is_default_user, lower(item_type_versions.sys_period) AS version, item_type_max_period_starts.max_period_start = lower(item_type_versions.sys_period) AND upper_inf(item_type_versions.sys_period) AS is_current FROM item_type_versions JOIN item_type_max_period_starts ON item_type_max_period_starts.id::text = item_type_versions.id::text`,
);

export const policyLatestVersions = pgView('policy_latest_versions', {
  policyId: varchar('policy_id', { length: 255 }),
  version: text(),
}).as(
  sql`SELECT policy_versions.id AS policy_id, to_char((policy_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version FROM policy_versions WHERE policy_versions.is_current = true`,
);

export const policyVersions = pgMaterializedView('policy_versions', {
  id: varchar({ length: 255 }),
  name: varchar({ length: 255 }),
  orgId: varchar('org_id', { length: 255 }),
  parentId: varchar('parent_id', { length: 255 }),
  penalty: userPenaltySeverity(),
  version: timestamp({ withTimezone: true }),
  isCurrent: bool('is_current'),
}).as(
  sql`WITH policy_versions AS ( SELECT policies.id, policies.name, policies.org_id, policies.parent_id, policies.penalty, policies.sys_period FROM policies UNION ALL SELECT policy_history.id, policy_history.name, policy_history.org_id, policy_history.parent_id, policy_history.penalty, policy_history.sys_period FROM policy_history ), policies_max_period_starts AS ( SELECT policy_versions_1.id, max(lower(policy_versions_1.sys_period)) AS max_period_start FROM policy_versions policy_versions_1 GROUP BY policy_versions_1.id ) SELECT policy_versions.id, policy_versions.name, policy_versions.org_id, policy_versions.parent_id, policy_versions.penalty, lower(policy_versions.sys_period) AS version, policies_max_period_starts.max_period_start = lower(policy_versions.sys_period) AND upper_inf(policy_versions.sys_period) AS is_current FROM policy_versions JOIN policies_max_period_starts ON policies_max_period_starts.id::text = policy_versions.id::text`,
);

export const ruleVersions = pgMaterializedView('rule_versions', {
  id: varchar({ length: 255 }),
  name: varchar({ length: 255 }),
  description: varchar({ length: 255 }),
  statusIfUnexpired: varchar('status_if_unexpired', { length: 255 }),
  tags: varchar({ length: 255 }).array().array('[][]'),
  maxDailyActions: integer('max_daily_actions'),
  orgId: varchar('org_id', { length: 255 }),
  creatorId: varchar('creator_id', { length: 255 }),
  expirationTime: timestamp('expiration_time', { withTimezone: true }),
  ruleType: ruleType('rule_type'),
  conditionSet: jsonb('condition_set'),
  isCurrent: bool('is_current'),
  actionIds: varchar('action_ids').array().array('[][]'),
  itemTypeIds: varchar('item_type_ids').array().array('[][]'),
  policyIds: varchar('policy_ids').array().array('[][]'),
  version: timestamp({ withTimezone: true }),
}).as(
  sql`WITH action_association_versions AS ( SELECT rules_and_actions.action_id, rules_and_actions.rule_id, rules_and_actions.sys_period FROM rules_and_actions UNION ALL SELECT rules_and_actions_history.action_id, rules_and_actions_history.rule_id, rules_and_actions_history.sys_period FROM rules_and_actions_history ), item_type_association_versions AS ( SELECT rules_and_item_types.item_type_id, rules_and_item_types.rule_id, rules_and_item_types.sys_period FROM rules_and_item_types UNION ALL SELECT rules_and_item_types_history.item_type_id, rules_and_item_types_history.rule_id, rules_and_item_types_history.sys_period FROM rules_and_item_types_history ), policy_association_versions AS ( SELECT rules_and_policies.policy_id, rules_and_policies.rule_id, rules_and_policies.sys_period FROM rules_and_policies UNION ALL SELECT rules_and_policies_history.policy_id, rules_and_policies_history.rule_id, rules_and_policies_history.sys_period FROM rules_and_policies_history ), rule_versions AS ( SELECT rules.id, rules.name, rules.description, rules.status_if_unexpired, rules.tags, rules.max_daily_actions, rules.org_id, rules.creator_id, rules.expiration_time, rules.condition_set, rules.rule_type, rules.sys_period FROM rules UNION ALL SELECT rules_history.id, rules_history.name, rules_history.description, rules_history.status_if_unexpired, rules_history.tags, rules_history.max_daily_actions, rules_history.org_id, rules_history.creator_id, rules_history.expiration_time, rules_history.condition_set, rules_history.rule_type, rules_history.sys_period FROM rules_history ), rule_change_times AS ( SELECT t.rule_id, unnest(t.change_times_with_duplicates) AS change_time FROM ( SELECT rule_versions_1.id AS rule_id, array_remove((((((array_agg(DISTINCT lower(rule_versions_1.sys_period)) || array_agg(DISTINCT lower(action_association_versions.sys_period))) || array_agg(DISTINCT upper(action_association_versions.sys_period))) || array_agg(DISTINCT lower(item_type_association_versions.sys_period))) || array_agg(DISTINCT upper(item_type_association_versions.sys_period))) || array_agg(DISTINCT lower(policy_association_versions.sys_period))) || array_agg(DISTINCT upper(policy_association_versions.sys_period)), NULL::timestamp with time zone) AS change_times_with_duplicates FROM rule_versions rule_versions_1 LEFT JOIN action_association_versions ON rule_versions_1.id::text = action_association_versions.rule_id::text LEFT JOIN item_type_association_versions ON rule_versions_1.id::text = item_type_association_versions.rule_id::text LEFT JOIN policy_association_versions ON rule_versions_1.id::text = policy_association_versions.rule_id::text GROUP BY rule_versions_1.id) t GROUP BY t.rule_id, (unnest(t.change_times_with_duplicates)) ), rule_max_change_times AS ( SELECT rule_change_times_1.rule_id, max(rule_change_times_1.change_time) AS max_change_time FROM rule_change_times rule_change_times_1 GROUP BY rule_change_times_1.rule_id ) SELECT rule_versions.id, rule_versions.name, rule_versions.description, rule_versions.status_if_unexpired, rule_versions.tags, rule_versions.max_daily_actions, rule_versions.org_id, rule_versions.creator_id, rule_versions.expiration_time, rule_versions.rule_type, rule_versions.condition_set, rule_max_change_times.max_change_time = rule_change_times.change_time AND upper_inf(rule_versions.sys_period) AS is_current, ( SELECT COALESCE(array_agg(action_association_versions.action_id), '{}'::character varying[]) AS "coalesce" FROM action_association_versions WHERE action_association_versions.rule_id::text = rule_versions.id::text AND action_association_versions.sys_period @> rule_change_times.change_time) AS action_ids, ( SELECT COALESCE(array_agg(item_type_association_versions.item_type_id), '{}'::character varying[]) AS "coalesce" FROM item_type_association_versions WHERE item_type_association_versions.rule_id::text = rule_versions.id::text AND item_type_association_versions.sys_period @> rule_change_times.change_time) AS item_type_ids, ( SELECT COALESCE(array_agg(policy_association_versions.policy_id), '{}'::character varying[]) AS "coalesce" FROM policy_association_versions WHERE policy_association_versions.rule_id::text = rule_versions.id::text AND policy_association_versions.sys_period @> rule_change_times.change_time) AS policy_ids, rule_change_times.change_time AS version FROM rule_change_times JOIN rule_versions ON rule_change_times.rule_id::text = rule_versions.id::text AND rule_versions.sys_period @> rule_change_times.change_time JOIN rule_max_change_times ON rule_max_change_times.rule_id::text = rule_versions.id::text ORDER BY rule_versions.id, rule_change_times.change_time`,
);

export const rulesLatestVersions = pgView('rules_latest_versions', {
  ruleId: varchar('rule_id', { length: 255 }),
  version: text(),
}).as(
  sql`SELECT rule_versions.id AS rule_id, to_char((rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version FROM rule_versions WHERE rule_versions.is_current = true`,
);

export const reportingRuleLatestVersions = reportingRulesSchema
  .view('reporting_rule_latest_versions', {
    reportingRuleId: varchar('reporting_rule_id', { length: 255 }),
    version: text(),
  })
  .as(
    sql`SELECT reporting_rule_versions.id AS reporting_rule_id, to_char((reporting_rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version FROM reporting_rules.reporting_rule_versions WHERE reporting_rule_versions.is_current = true`,
  );

export const reportingRuleVersions = reportingRulesSchema
  .materializedView('reporting_rule_versions', {
    id: varchar({ length: 255 }),
    name: varchar({ length: 255 }),
    orgId: varchar('org_id', { length: 255 }),
    description: varchar({ length: 255 }),
    status: reportingRuleStatus(),
    creatorId: varchar('creator_id', { length: 255 }),
    conditionSet: jsonb('condition_set'),
    version: timestamp({ withTimezone: true }),
    isCurrent: bool('is_current'),
  })
  .as(
    sql`WITH reporting_rule_versions AS ( SELECT reporting_rules.id, reporting_rules.name, reporting_rules.org_id, reporting_rules.description, reporting_rules.status, reporting_rules.creator_id, reporting_rules.condition_set, reporting_rules.sys_period FROM reporting_rules.reporting_rules UNION ALL SELECT reporting_rule_history.id, reporting_rule_history.name, reporting_rule_history.org_id, reporting_rule_history.description, reporting_rule_history.status, reporting_rule_history.creator_id, reporting_rule_history.condition_set, reporting_rule_history.sys_period FROM reporting_rules.reporting_rule_history ), reporting_rules_max_period_starts AS ( SELECT reporting_rule_versions_1.id, max(lower(reporting_rule_versions_1.sys_period)) AS max_period_start FROM reporting_rule_versions reporting_rule_versions_1 GROUP BY reporting_rule_versions_1.id ) SELECT reporting_rule_versions.id, reporting_rule_versions.name, reporting_rule_versions.org_id, reporting_rule_versions.description, reporting_rule_versions.status, reporting_rule_versions.creator_id, reporting_rule_versions.condition_set, lower(reporting_rule_versions.sys_period) AS version, reporting_rules_max_period_starts.max_period_start = lower(reporting_rule_versions.sys_period) AND upper_inf(reporting_rule_versions.sys_period) AS is_current FROM reporting_rule_versions JOIN reporting_rules_max_period_starts ON reporting_rules_max_period_starts.id::text = reporting_rule_versions.id::text`,
  );
