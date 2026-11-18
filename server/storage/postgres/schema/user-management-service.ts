import {
  boolean as bool,
  integer,
  jsonb,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { userManagementServiceSchema } from './types.js';

export const orgDefaultUserInterfaceSettings =
  userManagementServiceSchema.table('org_default_user_interface_settings', {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    moderatorSafetyMuteVideo: bool('moderator_safety_mute_video')
      .default(true)
      .notNull(),
    moderatorSafetyGrayscale: bool('moderator_safety_grayscale')
      .default(true)
      .notNull(),
    moderatorSafetyBlurLevel: integer('moderator_safety_blur_level')
      .default(2)
      .notNull(),
    moderatorSafetySepia: bool('moderator_safety_sepia')
      .default(false)
      .notNull(),
  });

export const passwordResetTokens = userManagementServiceSchema.table(
  'password_reset_tokens',
  {
    hashedToken: varchar('hashed_token', { length: 255 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
  },
);

export const userInterfaceSettings = userManagementServiceSchema.table(
  'user_interface_settings',
  {
    userId: varchar('user_id', { length: 255 }).primaryKey(),
    moderatorSafetyMuteVideo: bool('moderator_safety_mute_video'),
    moderatorSafetyGrayscale: bool('moderator_safety_grayscale'),
    moderatorSafetyBlurLevel: integer('moderator_safety_blur_level'),
    mrtChartConfigurations: jsonb('mrt_chart_configurations').array(),
    moderatorSafetySepia: bool('moderator_safety_sepia'),
  },
);
