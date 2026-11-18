import { sql } from 'drizzle-orm';
import {
  boolean as bool,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { actions, itemTypes } from './public-1.js';
import { users } from './public-3.js';
import {
  enumRuleAlarmStatus,
  policyType,
  ruleType,
  tstzrange,
  userPenaltySeverity,
} from './types.js';

export const locationBanks = pgTable(
  'location_banks',
  {
    id: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    fullPlacesApiResponses: jsonb('full_places_api_responses')
      .array()
      .default(sql`ARRAY[]::jsonb[]`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'location_banks_org_id_fkey',
    }),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: 'location_banks_owner_id_fkey',
    }),
    unique('location_banks_org_id_name_key').on(table.orgId, table.name),
  ],
);

export const mediaBanks = pgTable(
  'media_banks',
  {
    id: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'media_banks_org_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: 'media_banks_owner_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar({ length: 255 }).notNull(),
    type: varchar({ length: 255 }).notNull(),
    data: jsonb().notNull(),
    message: text().notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    readAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'notifications_userId_fkey',
    }).onDelete('cascade'),
  ],
);

export const orgSettings = pgTable(
  'org_settings',
  {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    partialItemsEndpoint: varchar('partial_items_endpoint', { length: 255 }),
    hasReportingRulesEnabled: bool('has_reporting_rules_enabled').default(
      false,
    ),
    hasAppealsEnabled: bool('has_appeals_enabled').default(false),
    appealCallbackUrl: text('appeal_callback_url'),
    appealCallbackHeaders: jsonb('appeal_callback_headers'),
    appealCallbackBody: jsonb('appeal_callback_body'),
    allowMultiplePoliciesPerAction: bool(
      'allow_multiple_policies_per_action',
    ).default(false),
    userStrikeTtlDays: integer('user_strike_ttl_days').default(90),
    samlEnabled: bool('saml_enabled').default(false).notNull(),
    ssoUrl: varchar('sso_url', { length: 255 }),
    cert: text(),
    showUsageStatistics: bool('show_usage_statistics').default(false).notNull(),
    partialItemsRequestHeaders: jsonb('partial_items_request_headers'),
  },
  () => [
    check(
      'saml_settings_constraint',
      sql`((saml_enabled = false) OR ((saml_enabled = true) AND (sso_url IS NOT NULL) AND (cert IS NOT NULL)))`,
    ),
  ],
);

export const orgs = pgTable(
  'orgs',
  {
    id: varchar({ length: 255 }).primaryKey(),
    email: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    websiteUrl: varchar('website_url', { length: 255 }).notNull(),
    apiKeyId: varchar('api_key_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    onCallAlertEmail: varchar('on_call_alert_email', { length: 255 }),
  },
  (table) => [
    unique('orgs_email_key').on(table.email),
    unique('orgs_name_key').on(table.name),
    unique('orgs_website_url_key').on(table.websiteUrl),
  ],
);

export const policies = pgTable(
  'policies',
  {
    id: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    parentId: varchar('parent_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    penalty: userPenaltySeverity().default('NONE').notNull(),
    policyText: varchar('policy_text'),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
    policyType: policyType('policy_type'),
    semanticVersion: integer('semantic_version').default(1).notNull(),
    enforcementGuidelines: varchar('enforcement_guidelines'),
    userStrikeCount: integer('user_strike_count').default(1).notNull(),
    applyUserStrikeCountConfigToChildren: bool(
      'apply_user_strike_count_config_to_children',
    )
      .default(false)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'policies_org_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'policies_parent_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    uniqueIndex('idx_unique_orgid_name').using(
      'btree',
      table.orgId.asc().nullsLast(),
      table.name.asc().nullsLast(),
    ),
  ],
);

export const policyHistory = pgTable('policy_history', {
  id: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  orgId: varchar('org_id', { length: 255 }).notNull(),
  parentId: varchar('parent_id', { length: 255 }),
  penalty: userPenaltySeverity().notNull(),
  policyText: varchar('policy_text'),
  sysPeriod: tstzrange('sys_period').notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id').notNull(),
    permission: varchar({ length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permission],
      name: 'role_permissions_pkey',
    }),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: 'role_permissions_role_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const roles = pgTable(
  'roles',
  {
    id: uuid().defaultRandom().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    key: varchar({ length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text(),
    isSystem: bool('is_system').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'roles_org_id_fkey',
    }).onDelete('cascade'),
    index('roles_org_id_idx').using('btree', table.orgId.asc().nullsLast()),
    unique('roles_org_key_unique').on(table.orgId, table.key),
  ],
);

export const rules = pgTable(
  'rules',
  {
    id: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    statusIfUnexpired: varchar('status_if_unexpired', { length: 255 })
      .default('DRAFT')
      .notNull(),
    tags: varchar({ length: 255 })
      .array()
      .default(sql`(ARRAY[]::character varying[])`)
      .notNull(),
    maxDailyActions: integer('max_daily_actions'),
    dailyActionsRun: integer('daily_actions_run').default(0),
    lastActionDate: date('last_action_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    creatorId: varchar('creator_id', { length: 255 }).notNull(),
    expirationTime: timestamp('expiration_time', { withTimezone: true }),
    conditionSet: jsonb('condition_set').notNull(),
    alarmStatus: enumRuleAlarmStatus('alarm_status')
      .default('INSUFFICIENT_DATA')
      .notNull(),
    alarmStatusSetAt: timestamp('alarm_status_set_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
    ruleType: ruleType('rule_type').default('CONTENT').notNull(),
    parentId: varchar('parent_id', { length: 255 }),
    rateLimitConfig: jsonb('rate_limit_config'),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [users.id],
      name: 'rules_creator_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'rules_org_id_fkey',
    }).onDelete('cascade'),
    unique('rules_org_id_name_key').on(table.orgId, table.name),
  ],
);

export const rulesAndActions = pgTable(
  'rules_and_actions',
  {
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    actionId: varchar('action_id', { length: 255 }).notNull(),
    ruleId: varchar('rule_id', { length: 255 }).notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
    actionParameters: jsonb('action_parameters').default({}).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.actionId, table.ruleId],
      name: 'rules_and_actions_pkey',
    }),
    foreignKey({
      columns: [table.actionId],
      foreignColumns: [actions.id],
      name: 'rules_and_actions_action_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [rules.id],
      name: 'rules_and_actions_rule_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    index('rules_and_actions_rule_id_idx').using(
      'btree',
      table.ruleId.asc().nullsLast(),
    ),
  ],
);

export const rulesAndActionsHistory = pgTable('rules_and_actions_history', {
  actionId: varchar('action_id', { length: 255 }).notNull(),
  ruleId: varchar('rule_id', { length: 255 }).notNull(),
  sysPeriod: tstzrange('sys_period').notNull(),
  actionParameters: jsonb('action_parameters'),
});

export const rulesAndItemTypes = pgTable(
  'rules_and_item_types',
  {
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    ruleId: varchar('rule_id', { length: 255 }).notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.ruleId, table.itemTypeId],
      name: 'rules_and_item_types_pkey',
    }),
    foreignKey({
      columns: [table.itemTypeId],
      foreignColumns: [itemTypes.id],
      name: 'rules_and_item_types_item_type_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [rules.id],
      name: 'rules_and_item_types_rule_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const rulesAndItemTypesHistory = pgTable(
  'rules_and_item_types_history',
  {
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    ruleId: varchar('rule_id', { length: 255 }).notNull(),
    sysPeriod: tstzrange('sys_period').notNull(),
  },
);

export const rulesAndPolicies = pgTable(
  'rules_and_policies',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    policyId: varchar('policy_id', { length: 255 }).notNull(),
    ruleId: varchar('rule_id', { length: 255 }).notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.policyId, table.ruleId],
      name: 'rules_and_policies_pkey',
    }),
    foreignKey({
      columns: [table.policyId],
      foreignColumns: [policies.id],
      name: 'rules_and_policies_policy_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [rules.id],
      name: 'rules_and_policies_rule_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);
