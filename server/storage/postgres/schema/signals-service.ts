import { integer, primaryKey, varchar } from 'drizzle-orm/pg-core';

import { signalsServiceSchema } from './types.js';

export const modelsEligibleAsSignals = signalsServiceSchema.table(
  'models_eligible_as_signals',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    modelId: varchar('model_id', { length: 255 }).notNull(),
    version: integer().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.modelId, table.version],
      name: 'models_eligible_as_signals_pkey',
    }),
  ],
);
