import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { manualReviewQueues } from './manual-review-tool-1.js';
import { roles } from './public-2.js';
import {
  manualReviewToolSchema,
  routingRuleStatus,
  tstzrange,
} from './types.js';

export const queuesAndHiddenActions = manualReviewToolSchema.table(
  'queues_and_hidden_actions',
  {
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    actionId: varchar('action_id', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.queueId, table.actionId],
      name: 'queues_and_actions_pkey',
    }),
    foreignKey({
      columns: [table.queueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'queue_fkey',
    }).onDelete('cascade'),
  ],
);

export const rolesAndAccessibleQueues = manualReviewToolSchema.table(
  'roles_and_accessible_queues',
  {
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.queueId, table.roleId],
      name: 'roles_and_accessible_queues_pkey',
    }),
    foreignKey({
      columns: [table.queueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'roles_and_accessible_queues_queue_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: 'roles_and_accessible_queues_role_id_fkey',
    }).onDelete('cascade'),
    index('roles_and_accessible_queues_role_id_idx').using(
      'btree',
      table.roleId.asc().nullsLast(),
    ),
  ],
);

export const routingRuleHistory = manualReviewToolSchema.table(
  'routing_rule_history',
  {
    id: varchar({ length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    status: routingRuleStatus().notNull(),
    creatorId: varchar('creator_id', { length: 255 }).notNull(),
    conditionSet: jsonb('condition_set').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),
    destinationQueueId: varchar('destination_queue_id', {
      length: 255,
    }).notNull(),
    sysPeriod: tstzrange('sys_period').notNull(),
  },
);

export const routingRules = manualReviewToolSchema.table(
  'routing_rules',
  {
    id: varchar({ length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    status: routingRuleStatus().default('LIVE').notNull(),
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
      name: 'routing_rules_destination_queue_id_fkey',
    }).onDelete('restrict'),
    // DB: DEFERRABLE INITIALLY DEFERRED. Drizzle has no API for deferrable
    // constraints, and drizzle-kit neither emits nor detects it.
    unique('routing_rules_org_id_name_key').on(table.orgId, table.name),
    unique('routing_rules_org_id_sequence_number_key').on(
      table.orgId,
      table.sequenceNumber,
    ),
  ],
);

export const routingRulesToItemTypes = manualReviewToolSchema.table(
  'routing_rules_to_item_types',
  {
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    routingRuleId: varchar('routing_rule_id', { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.itemTypeId, table.routingRuleId],
      name: 'routing_rules_to_item_types_pkey',
    }),
    foreignKey({
      columns: [table.routingRuleId],
      foreignColumns: [routingRules.id],
      name: 'routing_rules_to_item_types_routing_rule_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const usersAndAccessibleQueues = manualReviewToolSchema.table(
  'users_and_accessible_queues',
  {
    userId: varchar('user_id', { length: 255 }).notNull(),
    queueId: varchar('queue_id', { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.queueId],
      name: 'user_to_accessible_queues_pkey',
    }),
    foreignKey({
      columns: [table.queueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'users_and_accessible_queues_queue_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const usersAndFavoriteMrtQueues = manualReviewToolSchema.table(
  'users_and_favorite_mrt_queues',
  {
    userId: varchar('user_id', { length: 255 }).notNull(),
    queueId: varchar('queue_id', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.queueId],
      name: 'users_and_favorite_mrt_queues_pkey',
    }),
    foreignKey({
      columns: [table.queueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'users_and_favorite_mrt_queues_queue_id_fkey',
    }).onDelete('cascade'),
    index('user_favorite_mrt_queues_idx').using(
      'btree',
      table.userId.asc().nullsLast(),
    ),
  ],
);
