/**
 * Drizzle model of the api-server Postgres database, all schemas.
 *
 * Bootstrapped with `drizzle-kit pull` (1.0.0-rc.5) against a DB built by the
 * Umzug migrations in db/src/scripts/api-server-pg, then hand-fixed where the
 * round trip was lossy (empty-array defaults, enabled_ratio default).
 *
 * Not representable in Drizzle, so still owned by the SQL migrations:
 * the 22 PL/pgSQL functions and 26 triggers (temporal-table versioning,
 * strike-count inheritance), the jsonb_object_union aggregate, the 24 indexes
 * on the *_versions materialized views, DEFERRABLE on 3 unique constraints,
 * column/table COMMENTs and per-column STATISTICS targets.
 */
import { customType, pgEnum, pgSchema } from 'drizzle-orm/pg-core';

export const tstzrange = customType<{ data: string }>({
  dataType: () => 'tstzrange',
});

export const jobsSchema = pgSchema('jobs');

export const manualReviewToolSchema = pgSchema('manual_review_tool');

export const modelsServiceSchema = pgSchema('models_service');

export const ncmecReportingSchema = pgSchema('ncmec_reporting');

export const reportingRulesSchema = pgSchema('reporting_rules');

export const signalAuthServiceSchema = pgSchema('signal_auth_service');

export const signalsServiceSchema = pgSchema('signals_service');

export const userManagementServiceSchema = pgSchema('user_management_service');

export const userStatisticsServiceSchema = pgSchema('user_statistics_service');

export const appealsRoutingRuleStatus = manualReviewToolSchema.enum(
  'appeals_routing_rule_status',
  ['LIVE'],
);

export const routingRuleStatus = manualReviewToolSchema.enum(
  'routing_rule_status',
  ['LIVE'],
);

export const actionType = pgEnum('action_type', [
  'CUSTOM_ACTION',
  'ENQUEUE_TO_MRT',
  'ENQUEUE_TO_NCMEC',
  'ENQUEUE_AUTHOR_TO_MRT',
  'REJECT_APPEAL',
  'ACCEPT_APPEAL',
]);

export const backtestStatus = pgEnum('backtest_status', [
  'RUNNING',
  'COMPLETE',
  'CANCELED',
]);

export const enumConditionsType = pgEnum('enum_conditions_type', [
  'BASIC',
  'CUSTOM',
]);

export const enumJobsStatus = pgEnum('enum_jobs_status', ['open', 'closed']);

export const enumRuleAlarmStatus = pgEnum('enum_rule_alarm_status', [
  'ALARM',
  'OK',
  'INSUFFICIENT_DATA',
]);

export const enumRulesConditionSetConjunction = pgEnum(
  'enum_rules_condition_set_conjunction',
  ['AND', 'NONE', 'OR', 'XOR'],
);

export const enumRulesStatus = pgEnum('enum_rules_status', [
  'BACKGROUND',
  'DEPRECATED',
  'DRAFT',
  'LIVE',
  'ARCHIVED',
]);

export const enumSignalsType = pgEnum('enum_signals_type', [
  'CUSTOM',
  'TEXT_MATCHING_CONTAINS_TEXT',
  'TEXT_MATCHING_NOT_CONTAINS_TEXT',
  'TEXT_MATCHING_CONTAINS_REGEX',
  'TEXT_MATCHING_NOT_CONTAINS_REGEX',
  'TEXT_SIMILARITY_SCORE',
  'IMAGE_EXACT_MATCH',
  'IMAGE_SIMILARITY_SCORE',
  'GOOGLE_CONTENT_SAFETY_API',
  'ZENTROPI_LABELER',
]);

export const itemTypeKind = pgEnum('item_type_kind', [
  'CONTENT',
  'USER',
  'THREAD',
]);

export const loginMethodEnum = pgEnum('login_method_enum', [
  'password',
  'saml',
]);

export const modelFamily = pgEnum('model_family', [
  'embedded-text-kernelized-svm-001',
  'EMBEDDED_IMAGE_KERNELIZED_SVM_001',
  'EMBEDDED_TEXT_AND_IMAGE_ENSEMBLE_KERNELIZED_SVMS_001',
  'GPT_4O_MINI_001',
]);

export const modelStatus = pgEnum('model_status', [
  'READY_TO_TRAIN',
  'TRAINING',
  'FROZEN',
]);

export const ncmecReportErrorStatus = pgEnum('ncmec_report_error_status', [
  'RETRYABLE_ERROR',
  'PERMANENT_ERROR',
]);

export const policyType = pgEnum('policy_type', [
  'HATE',
  'VIOLENCE',
  'HARRASSMENT',
  'SEXUAL_CONTENT',
  'SPAM',
  'DRUG_SALES',
  'WEAPON_SALES',
  'TERRORISM',
  'SEXUAL_EXPLOITATION',
  'SELF_HARM_AND_SUICIDE',
  'GROOMING',
  'PROFANITY',
  'PRIVACY',
  'FRAUD_AND_DECEPTION',
]);

export const ruleType = pgEnum('rule_type', ['CONTENT', 'USER']);

export const textBankType = pgEnum('text_bank_type', ['STRING', 'REGEX']);

export const unknownType = pgEnum('unknown_type', [
  'EDGE_CASE',
  'NEEDS_CONTEXT',
]);

export const userPenaltySeverity = pgEnum('user_penalty_severity', [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'SEVERE',
]);

export const reportingRuleStatus = reportingRulesSchema.enum(
  'reporting_rule_status',
  ['DRAFT', 'BACKGROUND', 'LIVE', 'ARCHIVED'],
);
