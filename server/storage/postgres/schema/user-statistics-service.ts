import { doublePrecision, primaryKey, varchar } from 'drizzle-orm/pg-core';

import { userStatisticsServiceSchema } from './types.js';

export const userScores = userStatisticsServiceSchema.table(
  'user_scores',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    score: doublePrecision().notNull(),
    userTypeId: varchar('user_type_id', { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.orgId, table.userId, table.userTypeId],
      name: 'user_scores_pkey',
    }),
  ],
);
