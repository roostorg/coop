import { sql } from 'drizzle-orm';
import {
  boolean as bool,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { manualReviewQueues } from './manual-review-tool-1.js';
import { ncmecReportErrorStatus, ncmecReportingSchema } from './types.js';

export const ncmecOrgSettings = ncmecReportingSchema.table(
  'ncmec_org_settings',
  {
    orgId: varchar('org_id', { length: 255 }).primaryKey(),
    username: varchar({ length: 255 }).notNull(),
    password: varchar({ length: 255 }).notNull(),
    contactEmail: varchar('contact_email', { length: 255 }),
    moreInfoUrl: varchar('more_info_url', { length: 255 }),
    companyTemplate: varchar('company_template', { length: 255 }),
    legalUrl: varchar('legal_url', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    ncmecPreservationEndpoint: varchar('ncmec_preservation_endpoint', {
      length: 255,
    }),
    ncmecAdditionalInfoEndpoint: varchar('ncmec_additional_info_endpoint', {
      length: 255,
    }),
    policiesAppliedToActionsRunOnReportCreation: varchar(
      'policies_applied_to_actions_run_on_report_creation',
      { length: 255 },
    ).array(),
    actionsToRunUponReportCreation: varchar(
      'actions_to_run_upon_report_creation',
      { length: 255 },
    ).array(),
    defaultNcmecQueueId: varchar('default_ncmec_queue_id', { length: 255 }),
    defaultInternetDetailType: varchar('default_internet_detail_type', {
      length: 50,
    }),
    termsOfService: text('terms_of_service'),
    contactPersonEmail: varchar('contact_person_email', { length: 255 }),
    contactPersonFirstName: varchar('contact_person_first_name', {
      length: 255,
    }),
    contactPersonLastName: varchar('contact_person_last_name', { length: 255 }),
    contactPersonPhone: varchar('contact_person_phone', { length: 50 }),
    mediaReviewRequirement: varchar('media_review_requirement', { length: 16 })
      .default('ALL')
      .notNull(),
    minMediaToReview: integer('min_media_to_review'),
  },
  (table) => [
    foreignKey({
      columns: [table.defaultNcmecQueueId],
      foreignColumns: [manualReviewQueues.id],
      name: 'ncmec_org_settings_default_ncmec_queue_fkey',
    }).onDelete('set null'),
    check(
      'ncmec_org_settings_media_review_requirement_check',
      sql`((media_review_requirement)::text = ANY ((ARRAY['ALL'::character varying, 'MINIMUM'::character varying])::text[]))`,
    ),
    check(
      'ncmec_org_settings_min_media_to_review_check',
      sql`((min_media_to_review IS NULL) OR (min_media_to_review >= 1))`,
    ),
    check(
      'ncmec_org_settings_must_have_both_policy_and_actions_on_submiss',
      sql`(((policies_applied_to_actions_run_on_report_creation IS NULL) AND (actions_to_run_upon_report_creation IS NULL)) OR ((policies_applied_to_actions_run_on_report_creation IS NOT NULL) AND (actions_to_run_upon_report_creation IS NOT NULL) AND (array_length(actions_to_run_upon_report_creation, 1) > 0) AND (array_length(policies_applied_to_actions_run_on_report_creation, 1) > 0)))`,
    ),
  ],
);

export const ncmecReports = ncmecReportingSchema.table(
  'ncmec_reports',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    reportId: varchar('report_id', { length: 255 }).primaryKey(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    userItemTypeId: text('user_item_type_id').notNull(),
    reportedMedia: jsonb('reported_media').array().notNull(),
    reportXml: customType({ dataType: () => 'xml' })('report_xml').notNull(),
    additionalFiles: jsonb('additional_files').array(),
    reviewerId: varchar('reviewer_id', { length: 255 }),
    isTest: bool('is_test'),
    reportedMessages: jsonb('reported_messages').array(),
    incidentType: text('incident_type'),
  },
  (table) => [
    index('idx_user_type_org_test')
      .using(
        'btree',
        table.userId.asc().nullsLast(),
        table.userItemTypeId.asc().nullsLast(),
        table.orgId.asc().nullsLast(),
      )
      .where(sql`(is_test = false)`),
    check(
      'reported_media_or_messages_non_empty',
      sql`((COALESCE(array_length(reported_media, 1), 0) > 0) OR (COALESCE(array_length(reported_messages, 1), 0) > 0))`,
    ),
  ],
);

export const ncmecReportsErrors = ncmecReportingSchema.table(
  'ncmec_reports_errors',
  {
    jobId: text('job_id').primaryKey(),
    userId: text('user_id').notNull(),
    userTypeId: text('user_type_id').notNull(),
    status: ncmecReportErrorStatus().notNull(),
    retryCount: integer('retry_count').notNull(),
    lastError: varchar('last_error').notNull(),
  },
);
