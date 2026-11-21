import { sql } from 'drizzle-orm';
import {
  foreignKey,
  jsonb,
  primaryKey,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  reportingRulesSchema,
  reportingRuleStatus,
  tstzrange,
} from './types.js';

export const reportingRuleHistory = reportingRulesSchema.table(
  'reporting_rule_history',
  {
    id: varchar({ length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    status: reportingRuleStatus().notNull(),
    creatorId: varchar('creator_id', { length: 255 }).notNull(),
    conditionSet: jsonb('condition_set').notNull(),
    sysPeriod: tstzrange('sys_period').notNull(),
  },
);

export const reportingRules = reportingRulesSchema.table(
  'reporting_rules',
  {
    id: varchar({ length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    status: reportingRuleStatus().default('DRAFT').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    creatorId: varchar('creator_id', { length: 255 }).notNull(),
    conditionSet: jsonb('condition_set').notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
  },
  (table) => [
    // DB: DEFERRABLE INITIALLY DEFERRED. Drizzle has no API for deferrable
    // constraints, and drizzle-kit neither emits nor detects it.
    unique('reporting_rules_org_id_name_key').on(table.orgId, table.name),
  ],
);

export const reportingRulesToActions = reportingRulesSchema.table(
  'reporting_rules_to_actions',
  {
    actionId: varchar('action_id', { length: 255 }).notNull(),
    reportingRuleId: varchar('reporting_rule_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.actionId, table.reportingRuleId],
      name: 'reporting_rules_to_actions_pkey',
    }),
    foreignKey({
      columns: [table.reportingRuleId],
      foreignColumns: [reportingRules.id],
      name: 'reporting_rules_to_actions_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reportingRuleId],
      foreignColumns: [reportingRules.id],
      name: 'reporting_rules_to_actions_reporting_rule_id_fkey',
    }),
  ],
);

export const reportingRulesToItemTypes = reportingRulesSchema.table(
  'reporting_rules_to_item_types',
  {
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    reportingRuleId: varchar('reporting_rule_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.itemTypeId, table.reportingRuleId],
      name: 'reporting_rules_to_item_types_pkey',
    }),
    foreignKey({
      columns: [table.reportingRuleId],
      foreignColumns: [reportingRules.id],
      name: 'reporting_rules_to_item_types_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reportingRuleId],
      foreignColumns: [reportingRules.id],
      name: 'reporting_rules_to_item_types_reporting_rule_id_fkey',
    }),
  ],
);

export const reportingRulesToPolicies = reportingRulesSchema.table(
  'reporting_rules_to_policies',
  {
    policyId: varchar('policy_id', { length: 255 }).notNull(),
    reportingRuleId: varchar('reporting_rule_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.policyId, table.reportingRuleId],
      name: 'reporting_rules_to_policies_pkey',
    }),
    foreignKey({
      columns: [table.reportingRuleId],
      foreignColumns: [reportingRules.id],
      name: 'reporting_rules_to_policies_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reportingRuleId],
      foreignColumns: [reportingRules.id],
      name: 'reporting_rules_to_policies_reporting_rule_id_fkey',
    }),
  ],
);
