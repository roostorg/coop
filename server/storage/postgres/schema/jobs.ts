import { timestamp, varchar } from 'drizzle-orm/pg-core';

import { jobsSchema } from './types.js';

export const scheduledJobsInfo = jobsSchema.table('scheduled_jobs_info', {
  jobName: varchar('job_name', { length: 255 }).primaryKey(),
  lastRun: timestamp('last_run', { withTimezone: true }).notNull(),
});
