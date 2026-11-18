import { sql } from 'drizzle-orm';
import {
  boolean as bool,
  check,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { type SigningKeyData } from './json-types.js';
import { orgs, roles, rules } from './public-2.js';
import { loginMethodEnum, ruleType, textBankType, tstzrange } from './types.js';

export const rulesAndPoliciesHistory = pgTable('rules_and_policies_history', {
  policyId: varchar('policy_id', { length: 255 }).notNull(),
  ruleId: varchar('rule_id', { length: 255 }).notNull(),
  sysPeriod: tstzrange('sys_period').notNull(),
});

export const rulesHistory = pgTable('rules_history', {
  id: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  statusIfUnexpired: varchar('status_if_unexpired', { length: 255 }).notNull(),
  tags: varchar({ length: 255 }).array().notNull(),
  maxDailyActions: integer('max_daily_actions'),
  orgId: varchar('org_id', { length: 255 }).notNull(),
  creatorId: varchar('creator_id', { length: 255 }).notNull(),
  expirationTime: timestamp('expiration_time', { withTimezone: true }),
  conditionSet: jsonb('condition_set').notNull(),
  sysPeriod: tstzrange('sys_period').notNull(),
  description: varchar({ length: 255 }),
  ruleType: ruleType('rule_type').default('CONTENT').notNull(),
  parentId: varchar('parent_id', { length: 255 }),
  rateLimitConfig: jsonb('rate_limit_config'),
});

export const session = pgTable(
  'session',
  {
    sid: varchar().primaryKey(),
    sess: json().notNull(),
    expire: timestamp({ precision: 6 }).notNull(),
  },
  (table) => [
    index('idx_session_expire').using('btree', table.expire.asc().nullsLast()),
  ],
);

export const signingKeys = pgTable(
  'signing_keys',
  {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    keyData: jsonb('key_data').$type<SigningKeyData>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'signing_keys_org_id_fkey',
    }).onDelete('cascade'),
    index('idx_signing_keys_org_id').using(
      'btree',
      table.orgId.asc().nullsLast(),
    ),
  ],
);

export const textBanks = pgTable(
  'text_banks',
  {
    id: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }),
    type: textBankType().default('STRING').notNull(),
    strings: varchar({ length: 2000 })
      .array()
      .default(sql`(ARRAY[]::character varying[])`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'text_banks_org_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: 'text_banks_owner_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const userStrikeThresholds = pgTable(
  'user_strike_thresholds',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    threshold: integer().notNull(),
    actions: varchar({ length: 255 })
      .array()
      .default(sql`(ARRAY[]::character varying[])`)
      .notNull(),
    actionParameters: jsonb('action_parameters').default({}).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'user_strike_thresholds_org_id_fkey',
    }).onDelete('cascade'),
    unique('unique_org_threshold_pair').on(table.orgId, table.threshold),
    check('user_strike_thresholds_threshold_check', sql`(threshold > 0)`),
  ],
);

export const users = pgTable(
  'users',
  {
    id: varchar({ length: 255 }).primaryKey(),
    email: varchar({ length: 255 }).notNull(),
    password: varchar({ length: 255 }),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    role: varchar({ length: 255 }),
    approvedByAdmin: bool('approved_by_admin').default(false),
    rejectedByAdmin: bool('rejected_by_admin').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    loginMethods: loginMethodEnum('login_methods')
      .array()
      .default(sql`ARRAY['password'::login_method_enum]`)
      .notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'users_org_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: 'users_role_id_fkey',
    }).onDelete('restrict'),
    index('users_role_id_idx').using('btree', table.roleId.asc().nullsLast()),
    unique('users_email_key').on(table.email),
    check(
      'password_null_when_not_present',
      sql`(((password IS NOT NULL) AND ('password'::login_method_enum = ANY (login_methods))) OR ((password IS NULL) AND (NOT ('password'::login_method_enum = ANY (login_methods)))))`,
    ),
  ],
);

export const usersAndFavoriteRules = pgTable(
  'users_and_favorite_rules',
  {
    userId: varchar('user_id', { length: 255 }).notNull(),
    ruleId: varchar('rule_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.ruleId],
      name: 'users_and_favorite_rules_pkey',
    }),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [rules.id],
      name: 'users_and_favorite_rules_rule_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'users_and_favorite_rules_user_id_fkey',
    }),
    index('user_favorite_rules_idx').using(
      'btree',
      table.userId.asc().nullsLast(),
    ),
  ],
);

export const viewMaintenanceMetadata = pgTable('view_maintenance_metadata', {
  tableName: text('table_name').primaryKey(),
  lastInsert: timestamp('last_insert')
    .default(sql`'-infinity'`)
    .notNull(),
});
