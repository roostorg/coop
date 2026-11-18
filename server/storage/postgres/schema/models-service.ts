import {
  integer,
  primaryKey,
  text,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  modelFamily,
  modelsServiceSchema,
  modelStatus,
  unknownType,
} from './types.js';

export const models = modelsServiceSchema.table(
  'models',
  {
    id: varchar({ length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    policyId: varchar('policy_id').notNull(),
    policySemanticVersion: integer('policy_semantic_version').notNull(),
    status: modelStatus().notNull(),
    family: modelFamily().notNull(),
    version: integer().notNull(),
    itemRequirement: text('item_requirement'),
    name: varchar({ length: 100 }).notNull(),
  },
  (table) => [unique('unique_org_name').on(table.orgId, table.name)],
);

export const orgToPartiallyLabeledDataset = modelsServiceSchema.table(
  'org_to_partially_labeled_dataset',
  {
    orgId: text('org_id').notNull(),
    partiallyLabeledDatasetId: text('partially_labeled_dataset_id').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.orgId, table.partiallyLabeledDatasetId],
      name: 'org_to_partially_labeled_dataset_pkey',
    }),
  ],
);

export const unknownLabeledItems = modelsServiceSchema.table(
  'unknown_labeled_items',
  {
    id: varchar({ length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    itemId: varchar('item_id', { length: 255 }).notNull(),
    itemTypeId: varchar('item_type_id', { length: 255 }).notNull(),
    policyId: varchar('policy_id', { length: 255 }).notNull(),
    policySemanticVersion: integer('policy_semantic_version').notNull(),
    unknownType: unknownType('unknown_type').notNull(),
    samplingStrategy: varchar('sampling_strategy', { length: 255 }).notNull(),
  },
);
