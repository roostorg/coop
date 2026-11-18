import { sql } from 'drizzle-orm';
import {
  boolean as bool,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { locationBanks, orgs, roles, rules } from './public-2.js';
import { users } from './public-3.js';
import {
  actionType,
  backtestStatus,
  itemTypeKind,
  tstzrange,
  userPenaltySeverity,
} from './types.js';

export const actions = pgTable(
  'actions',
  {
    id: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    callbackUrl: varchar('callback_url', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    callbackUrlHeaders: jsonb('callback_url_headers'),
    callbackUrlBody: jsonb('callback_url_body'),
    penalty: userPenaltySeverity().default('NONE').notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
    actionType: actionType('action_type').default('CUSTOM_ACTION').notNull(),
    appliesToAllItemsOfKind: itemTypeKind('applies_to_all_items_of_kind')
      .array()
      .default(sql`ARRAY[]::item_type_kind[]`)
      .notNull(),
    applyUserStrikes: bool('apply_user_strikes').default(false).notNull(),
    customMrtApiParams: jsonb('custom_mrt_api_params')
      .array()
      .default(sql`'{}'`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'actions_org_id_fkey',
    }).onDelete('cascade'),
    uniqueIndex('actions_unique_enqueue_to_mrt_action_type')
      .using(
        'btree',
        table.orgId.asc().nullsLast(),
        table.actionType.asc().nullsLast(),
      )
      .where(sql`(action_type = 'ENQUEUE_TO_MRT'::action_type)`),
    unique('actions_org_id_name_key').on(table.orgId, table.name),
    check(
      'callback_url_check',
      sql`(((action_type = 'CUSTOM_ACTION'::action_type) AND (callback_url IS NOT NULL)) OR ((action_type <> 'CUSTOM_ACTION'::action_type) AND (callback_url IS NULL)))`,
    ),
    check(
      'valid_callback_args',
      sql`(((callback_url_body IS NULL) OR (jsonb_typeof(callback_url_body) = 'object'::text)) AND ((callback_url_headers IS NULL) OR (jsonb_typeof(callback_url_headers) = 'object'::text)))`,
    ),
  ],
);

export const actionsAndItemTypes = pgTable(
  'actions_and_item_types',
  {
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    actionId: varchar('action_id', { length: 255 }).notNull(),
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.actionId, table.itemTypeId],
      name: 'actions_and_item_types_pkey',
    }),
    foreignKey({
      columns: [table.actionId],
      foreignColumns: [actions.id],
      name: 'actions_and_item_types_action_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.itemTypeId],
      foreignColumns: [itemTypes.id],
      name: 'actions_and_item_types_item_type_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const actionsAndItemTypesHistory = pgTable(
  'actions_and_item_types_history',
  {
    actionId: varchar('action_id', { length: 255 }).notNull(),
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    sysPeriod: tstzrange('sys_period').notNull(),
  },
);

export const actionsHistory = pgTable('actions_history', {
  id: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 255 }),
  callbackUrl: varchar('callback_url', { length: 255 }),
  orgId: varchar('org_id', { length: 255 }).notNull(),
  callbackUrlHeaders: jsonb('callback_url_headers'),
  callbackUrlBody: jsonb('callback_url_body'),
  penalty: userPenaltySeverity().notNull(),
  sysPeriod: tstzrange('sys_period').notNull(),
  actionType: actionType('action_type').default('CUSTOM_ACTION').notNull(),
  appliesToAllItemsOfKind: itemTypeKind('applies_to_all_items_of_kind')
    .array()
    .default(sql`ARRAY[]::item_type_kind[]`)
    .notNull(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid().defaultRandom().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    isActive: bool('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 255 }),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'api_keys_created_by_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'api_keys_org_id_fkey',
    }).onDelete('cascade'),
    index('idx_api_keys_active')
      .using(
        'btree',
        table.orgId.asc().nullsLast(),
        table.isActive.asc().nullsLast(),
      )
      .where(sql`(is_active = true)`),
    index('idx_api_keys_key_hash').using(
      'btree',
      table.keyHash.asc().nullsLast(),
    ),
    index('idx_api_keys_org_id').using('btree', table.orgId.asc().nullsLast()),
    unique('api_keys_key_hash_key').on(table.keyHash),
  ],
);

export const backtests = pgTable(
  'backtests',
  {
    id: varchar({ length: 255 }).primaryKey(),
    ruleId: varchar('rule_id', { length: 255 }).notNull(),
    creatorId: varchar('creator_id', { length: 255 }).notNull(),
    sampleDesiredSize: integer('sample_desired_size').notNull(),
    sampleActualSize: integer('sample_actual_size').default(0).notNull(),
    sampleStartAt: timestamp('sample_start_at', {
      withTimezone: true,
    }).notNull(),
    sampleEndAt: timestamp('sample_end_at', { withTimezone: true }).notNull(),
    samplingComplete: bool('sampling_complete').default(false).notNull(),
    contentItemsProcessed: integer('content_items_processed')
      .default(0)
      .notNull(),
    contentItemsMatched: integer('content_items_matched').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    cancelationDate: timestamp('cancelation_date', { withTimezone: true }),
    status: backtestStatus().notNull().generatedAlwaysAs(sql`
CASE
    WHEN (cancelation_date IS NOT NULL) THEN 'CANCELED'::backtest_status
    WHEN ((sampling_complete = false) OR (content_items_processed < sample_actual_size)) THEN 'RUNNING'::backtest_status
    ELSE 'COMPLETE'::backtest_status
END`),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [users.id],
      name: 'backtests_creator_id_fkey',
    }),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [rules.id],
      name: 'backtests_rule_id_fkey',
    }),
  ],
);

export const hashBanks = pgTable(
  'hash_banks',
  {
    id: serial().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    hmaName: varchar('hma_name', { length: 255 }).notNull(),
    description: text(),
    source: varchar({ length: 255 }),
    enabledRatio: doublePrecision('enabled_ratio')
      .default(sql`1.0`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'hash_banks_org_id_fkey',
    }).onDelete('cascade'),
    index('idx_hash_banks_hma_name').using(
      'btree',
      table.hmaName.asc().nullsLast(),
    ),
    index('idx_hash_banks_org_id').using(
      'btree',
      table.orgId.asc().nullsLast(),
    ),
    unique('hash_banks_hma_name_key').on(table.hmaName),
    unique('unique_org_bank_name').on(table.orgId, table.name),
  ],
);

export const inviteUserTokens = pgTable(
  'invite_user_tokens',
  {
    id: serial().primaryKey(),
    token: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    role: varchar({ length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    orgId: varchar('org_id', { length: 255 }),
    roleId: uuid('role_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'invite_user_tokens_org_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: 'invite_user_tokens_role_id_fkey',
    }).onDelete('restrict'),
    index('invite_user_tokens_role_id_idx').using(
      'btree',
      table.roleId.asc().nullsLast(),
    ),
  ],
);

export const itemTypes = pgTable(
  'item_types',
  {
    id: varchar({ length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    kind: itemTypeKind().notNull(),
    fields: jsonb().array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    displayNameField: varchar('display_name_field', { length: 255 }),
    creatorIdField: varchar('creator_id_field', { length: 255 }),
    threadIdField: varchar('thread_id_field', { length: 255 }),
    parentIdField: varchar('parent_id_field', { length: 255 }),
    createdAtField: varchar('created_at_field', { length: 255 }),
    profileIconField: varchar('profile_icon_field', { length: 255 }),
    sysPeriod: tstzrange('sys_period')
      .default('tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone)')
      .notNull(),
    isDefaultUser: bool('is_default_user').default(false).notNull(),
    backgroundImageField: varchar('background_image_field', { length: 255 }),
    isDeletedField: varchar('is_deleted_field', { length: 255 }),
    ipAddressField: varchar('ip_address_field', { length: 255 }),
    emailField: varchar('email_field', { length: 255 }),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'item_types_org_id_fkey',
    }).onDelete('cascade'),
    uniqueIndex('item_types_is_default_user')
      .using(
        'btree',
        table.orgId.asc().nullsLast(),
        table.isDefaultUser.asc().nullsLast(),
      )
      .where(sql`(is_default_user = true)`),
    unique('org_id_name_key').on(table.orgId, table.name),
    check(
      'item_type_field_roles',
      sql`(((kind = 'CONTENT'::item_type_kind) AND (profile_icon_field IS NULL) AND (background_image_field IS NULL)) OR ((kind = 'THREAD'::item_type_kind) AND (thread_id_field IS NULL) AND (parent_id_field IS NULL) AND (profile_icon_field IS NULL) AND (background_image_field IS NULL)) OR ((kind = 'USER'::item_type_kind) AND (thread_id_field IS NULL) AND (parent_id_field IS NULL) AND (creator_id_field IS NULL)))`,
    ),
    check(
      'valid_default_user',
      sql`((is_default_user = false) OR (kind = 'USER'::item_type_kind))`,
    ),
    check(
      'valid_email_field_field_type',
      sql`((email_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "EMAIL_ADDRESS")'::jsonpath, jsonb_build_object('name', email_field)))`,
    ),
    check(
      'valid_field_role_field_type',
      sql`(((profile_icon_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "IMAGE")'::jsonpath, jsonb_build_object('name', profile_icon_field))) AND ((background_image_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "IMAGE")'::jsonpath, jsonb_build_object('name', background_image_field))) AND ((parent_id_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "RELATED_ITEM")'::jsonpath, jsonb_build_object('name', parent_id_field))) AND ((thread_id_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "RELATED_ITEM")'::jsonpath, jsonb_build_object('name', thread_id_field))) AND ((creator_id_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "RELATED_ITEM")'::jsonpath, jsonb_build_object('name', creator_id_field))) AND ((display_name_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "STRING")'::jsonpath, jsonb_build_object('name', display_name_field))) AND ((is_deleted_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "BOOLEAN")'::jsonpath, jsonb_build_object('name', is_deleted_field))))`,
    ),
    check(
      'valid_ip_address_field_field_type',
      sql`((ip_address_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "IP_ADDRESS")'::jsonpath, jsonb_build_object('name', ip_address_field)))`,
    ),
    check(
      'validate_content_parent_field_dependencies',
      sql`((parent_id_field IS NULL) OR ((created_at_field IS NOT NULL) AND (thread_id_field IS NOT NULL)))`,
    ),
    check(
      'validate_content_thread_field_dependencies',
      sql`((thread_id_field IS NULL) OR (created_at_field IS NOT NULL))`,
    ),
    check(
      'validate_thread_field_roles',
      sql`(((parent_id_field IS NULL) OR (thread_id_field IS NOT NULL)) AND ((thread_id_field IS NULL) OR (created_at_field IS NOT NULL)))`,
    ),
  ],
);

export const itemTypesHistory = pgTable('item_types_history', {
  id: varchar({ length: 255 }).notNull(),
  orgId: varchar('org_id', { length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 255 }),
  kind: itemTypeKind().notNull(),
  fields: jsonb().array().notNull(),
  displayNameField: varchar('display_name_field', { length: 255 }),
  creatorIdField: varchar('creator_id_field', { length: 255 }),
  threadIdField: varchar('thread_id_field', { length: 255 }),
  parentIdField: varchar('parent_id_field', { length: 255 }),
  createdAtField: varchar('created_at_field', { length: 255 }),
  profileIconField: varchar('profile_icon_field', { length: 255 }),
  sysPeriod: tstzrange('sys_period').notNull(),
  isDefaultUser: bool('is_default_user').default(false).notNull(),
  backgroundImageField: varchar('background_image_field', { length: 255 }),
  isDeletedField: varchar('is_deleted_field', { length: 255 }),
  ipAddressField: varchar('ip_address_field', { length: 255 }),
  emailField: varchar('email_field', { length: 255 }),
});

export const locationBankLocations = pgTable(
  'location_bank_locations',
  {
    id: varchar({ length: 255 }).primaryKey(),
    bankId: varchar('bank_id', { length: 255 }).notNull(),
    geometry: jsonb().notNull(),
    bounds: jsonb(),
    name: varchar({ length: 255 }),
    googlePlaceInfo: jsonb('google_place_info'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.bankId],
      foreignColumns: [locationBanks.id],
      name: 'location_bank_locations_bank_id_fkey',
    }).onDelete('cascade'),
    index('location_bank_locations_bank_id_idx').using(
      'btree',
      table.bankId.asc().nullsLast(),
    ),
  ],
);
