import { sql } from 'drizzle-orm';
import {
  foreignKey,
  jsonb,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { orgs } from './public-2.js';
import { signalAuthServiceSchema } from './types.js';

export const googleContentSafetyConfigs = signalAuthServiceSchema.table(
  'google_content_safety_configs',
  {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    apiKey: varchar('api_key', { length: 255 }).notNull(),
  },
);

export const integrationConfigs = signalAuthServiceSchema.table(
  'integration_configs',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    integrationId: varchar('integration_id', { length: 255 }).notNull(),
    config: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.orgId, table.integrationId],
      name: 'integration_configs_pkey',
    }),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'integration_configs_org_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const openAiConfigs = signalAuthServiceSchema.table(
  'open_ai_configs',
  {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    apiKey: varchar('api_key', { length: 255 }).notNull(),
    csamClassifierApiKey: varchar('csam_classifier_api_key', { length: 255 }),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: 'open_ai_configs_org_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const zentropiConfigs = signalAuthServiceSchema.table(
  'zentropi_configs',
  {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    apiKey: varchar('api_key', { length: 255 }).notNull(),
    labelerVersions: jsonb('labeler_versions').default([]),
  },
);
