-- Create ClickHouse databases mirroring Snowflake schemas
CREATE DATABASE IF NOT EXISTS analytics;
CREATE DATABASE IF NOT EXISTS ACTION_STATISTICS_SERVICE;
CREATE DATABASE IF NOT EXISTS MANUAL_REVIEW_TOOL;
CREATE DATABASE IF NOT EXISTS NCMEC_SERVICE;
CREATE DATABASE IF NOT EXISTS REPORTING_SERVICE;
CREATE DATABASE IF NOT EXISTS RULE_ANOMALY_DETECTION_SERVICE;
CREATE DATABASE IF NOT EXISTS USER_STATISTICS_SERVICE;

-------------------------------------------------------------------------------
-- ACTION_STATISTICS_SERVICE
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS;
CREATE TABLE ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS
(
  ds Date,
  org_id String,
  num_submissions Int64,
  submission_ids Array(String)
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id);

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_POLICY;
CREATE TABLE ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_POLICY
(
  ds Date,
  org_id String,
  num_submissions Int64,
  submission_ids Array(String),
  policy_id String,
  policy_name String
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, policy_id);

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_TAG;
CREATE TABLE ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_TAG
(
  ds Date,
  org_id String,
  num_submissions Int64,
  submission_ids Array(String),
  tag String
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, tag);

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.BY_ACTION;
CREATE TABLE ACTION_STATISTICS_SERVICE.BY_ACTION
(
  org_id String,
  item_id Nullable(String),
  item_type_id Nullable(String),
  action_id String,
  action_time DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(action_time)
ORDER BY (org_id, action_time, action_id);

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.BY_ITEM_TYPE;
CREATE TABLE ACTION_STATISTICS_SERVICE.BY_ITEM_TYPE
(
  org_id String,
  item_id Nullable(String),
  item_type_id Nullable(String),
  action_time DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(action_time)
ORDER BY (org_id, action_time, ifNull(item_type_id, ''));

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.BY_POLICY;
CREATE TABLE ACTION_STATISTICS_SERVICE.BY_POLICY
(
  org_id String,
  item_id Nullable(String),
  item_type_id Nullable(String),
  policy_id String,
  policy_name Nullable(String),
  action_time DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(action_time)
ORDER BY (org_id, action_time, ifNull(policy_id, ''));

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.BY_RULE;
CREATE TABLE ACTION_STATISTICS_SERVICE.BY_RULE
(
  org_id String,
  item_id Nullable(String),
  item_type_id Nullable(String),
  rule_id String,
  action_time DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(action_time)
ORDER BY (org_id, action_time, rule_id);

DROP TABLE IF EXISTS ACTION_STATISTICS_SERVICE.BY_SOURCE;
CREATE TABLE ACTION_STATISTICS_SERVICE.BY_SOURCE
(
  org_id String,
  item_id Nullable(String),
  item_type_id Nullable(String),
  source String,
  action_time DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(action_time)
ORDER BY (org_id, action_time, source);

-------------------------------------------------------------------------------
-- MANUAL_REVIEW_TOOL
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS;
CREATE TABLE MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS
(
  rule String NOT NULL,
  rule_id String NOT NULL,
  rule_version DateTime64(3) NOT NULL,
  destination_queue_id Nullable(String),
  org_id String NOT NULL,
  correlation_id Nullable(String),
  result Nullable(String),
  passed UInt8 NOT NULL,
  job_kind String NOT NULL,
  ts DateTime64(3) NOT NULL,
  ds Date NOT NULL,
  item_data Nullable(String),
  item_id String NOT NULL,
  item_type_name Nullable(String),
  item_type_id String NOT NULL,
  item_type_kind String NOT NULL,
  item_creator_id Nullable(String),
  item_creator_type_id Nullable(String),
  item_type_schema Nullable(String),
  item_type_schema_field_roles Nullable(String),
  item_type_version Nullable(String),
  item_type_schema_variant Nullable(String)
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, rule_id, item_id);

-------------------------------------------------------------------------------
-- PUBLIC (core analytics tables)
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS analytics.ALL_ORGS;
CREATE TABLE analytics.ALL_ORGS
(
  id String NOT NULL,
  name String NOT NULL,
  email String NOT NULL,
  website_url String NOT NULL,
  date_created Date NOT NULL
)
ENGINE = MergeTree
ORDER BY (id, date_created)
COMMENT 'Contains metadata about every organization, with one row per organization';

DROP TABLE IF EXISTS analytics.ACTION_EXECUTIONS;
CREATE TABLE analytics.ACTION_EXECUTIONS
(
  org_id String NOT NULL,
  action_id String NOT NULL,
  action_name String NOT NULL,
  rules String NOT NULL DEFAULT '[]',
  policies String NOT NULL DEFAULT '[]',
  rule_tags String NOT NULL DEFAULT '[]',
  policy_ids Array(String) NOT NULL DEFAULT [],
  policy_names Array(String) NOT NULL DEFAULT [],
  rule_environment Nullable(String),
  correlation_id String NOT NULL,
  ts DateTime64(3) NOT NULL,
  ds Date NOT NULL,
  item_type_id Nullable(String),
  item_submission_id Nullable(String),
  item_creator_id Nullable(String),
  item_creator_type_id Nullable(String),
  item_id Nullable(String),
  item_type_kind String NOT NULL,
  action_source String NOT NULL,
  actor_id Nullable(String),
  job_id Nullable(String),
  failed UInt8 NOT NULL DEFAULT 0
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, ts, org_id, action_id);

DROP TABLE IF EXISTS analytics.CONTENT_API_REQUESTS;
CREATE TABLE analytics.CONTENT_API_REQUESTS
(
  org_id String NOT NULL,
  event String NOT NULL,
  request_id String NOT NULL,
  submission_id String NOT NULL,
  failure_reason Nullable(String),
  ts DateTime64(3) NOT NULL,
  ds Date NOT NULL,
  item_id String NOT NULL,
  item_type_name String NOT NULL,
  item_type_id String NOT NULL,
  item_creator_id Nullable(String),
  item_data String NOT NULL,
  item_type_schema String NOT NULL,
  item_type_kind String NOT NULL,
  item_creator_type_id Nullable(String),
  item_type_version String NOT NULL,
  item_type_schema_variant String NOT NULL,
  item_type_schema_field_roles String NOT NULL DEFAULT '{}'
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, event, item_type_id, item_id);

DROP TABLE IF EXISTS analytics.CONTENT_DETAILS_API_REQUESTS;
CREATE TABLE analytics.CONTENT_DETAILS_API_REQUESTS
(
  content_id String,
  org_id String,
  event Nullable(String),
  failure_reason Nullable(String),
  ds Date DEFAULT toDate(0),
  ts Nullable(String)
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, content_id);

DROP TABLE IF EXISTS analytics.INGESTED_JSON;
CREATE TABLE analytics.INGESTED_JSON
(
  target_table String,
  data String,
  ds Date
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, target_table);

DROP TABLE IF EXISTS analytics.ITEM_MODEL_SCORES_LOG;
CREATE TABLE analytics.ITEM_MODEL_SCORES_LOG
(
  org_id String,
  model_id Nullable(String),
  model_version Nullable(Int64),
  model_score Nullable(Float64),
  event String,
  submission_id String,
  failure_reason Nullable(String),
  ts DateTime64(3),
  ds Date,
  item_id String,
  item_type_name String,
  item_type_id String,
  item_creator_id Nullable(String),
  item_data String,
  item_type_schema String,
  item_type_kind String,
  item_creator_type_id Nullable(String),
  item_type_version String,
  item_type_schema_variant String,
  item_type_schema_field_roles String DEFAULT '{}'
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, event, item_type_id, item_id);

DROP TABLE IF EXISTS analytics.RULE_EXECUTIONS;
CREATE TABLE analytics.RULE_EXECUTIONS
(
  rule String NOT NULL,
  rule_id String NOT NULL,
  rule_version Nullable(DateTime64(3)),
  org_id String NOT NULL,
  environment String NOT NULL,
  correlation_id Nullable(String),
  policy_ids Array(String) DEFAULT [],
  policy_names Array(String) DEFAULT [],
  tags Array(String) DEFAULT [],
  result Nullable(String),
  passed UInt8 NOT NULL,
  ts DateTime64(3) NOT NULL,
  ds Date NOT NULL,
  item_data Nullable(String),
  item_id String NOT NULL,
  item_submission_id Nullable(String),
  item_type_name Nullable(String),
  item_type_id String NOT NULL,
  item_type_kind String NOT NULL,
  item_creator_id Nullable(String),
  item_creator_type_id Nullable(String),
  item_type_schema Nullable(String),
  item_type_schema_field_roles Nullable(String),
  item_type_version Nullable(String),
  item_type_schema_variant Nullable(String)
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, rule_id, item_id);

DROP TABLE IF EXISTS analytics.RULE_EXECUTION_STATISTICS;
CREATE TABLE analytics.RULE_EXECUTION_STATISTICS
(
  org_id String,
  rule_id String,
  rule_version DateTime64(3),
  num_passes Int64,
  num_runs Int64,
  ts_start_inclusive DateTime64(3),
  ts_end_exclusive DateTime64(3),
  environment Nullable(String),
  rule_policy_names Array(String),
  rule_policy_ids Array(String),
  rule_tags Array(String)
)
ENGINE = MergeTree
PARTITION BY toDate(ts_start_inclusive)
ORDER BY (org_id, rule_id, ts_start_inclusive);

-------------------------------------------------------------------------------
-- REPORTING_SERVICE
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS REPORTING_SERVICE.APPEALS;
CREATE TABLE REPORTING_SERVICE.APPEALS
(
  org_id String NOT NULL,
  request_id String NOT NULL,
  appeal_id String NOT NULL,
  appealed_by_user_id Nullable(String),
  appealed_by_user_item_type_id Nullable(String),
  appealed_at DateTime64(3) NOT NULL,
  appeal_reason Nullable(String),
  actions_taken Array(String) NOT NULL DEFAULT [],
  actioned_item_data String NOT NULL,
  actioned_item_id String NOT NULL,
  actioned_item_type_id String NOT NULL,
  actioned_item_type_kind String NOT NULL,
  actioned_item_type_schema String NOT NULL,
  actioned_item_type_schema_field_roles String NOT NULL,
  actioned_item_type_version String NOT NULL,
  actioned_item_type_schema_variant String NOT NULL,
  additional_items String NOT NULL DEFAULT '[]',
  ts DateTime64(3) NOT NULL
)
ENGINE = MergeTree
PARTITION BY toDate(ts)
ORDER BY (org_id, appeal_id, ts);

DROP TABLE IF EXISTS REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS;
CREATE TABLE REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS
(
  rule_name String NOT NULL,
  rule_id String NOT NULL,
  rule_version DateTime64(3) NOT NULL,
  rule_environment String NOT NULL,
  org_id String NOT NULL,
  correlation_id String NOT NULL,
  result String NOT NULL,
  passed UInt8 NOT NULL,
  ts DateTime64(3) NOT NULL,
  ds Date NOT NULL,
  policy_ids Array(String) NOT NULL,
  policy_names Array(String) NOT NULL DEFAULT [],
  item_data String NOT NULL,
  item_id String NOT NULL,
  item_type_name String NOT NULL,
  item_type_id String NOT NULL,
  item_type_kind String NOT NULL,
  item_creator_id Nullable(String),
  item_creator_type_id Nullable(String),
  item_type_schema String NOT NULL,
  item_type_schema_field_roles String NOT NULL,
  item_type_version String NOT NULL,
  item_type_schema_variant String NOT NULL
)
ENGINE = MergeTree
PARTITION BY ds
ORDER BY (ds, org_id, rule_id, item_id);

DROP TABLE IF EXISTS REPORTING_SERVICE.REPORTING_RULE_EXECUTION_STATISTICS;
CREATE TABLE REPORTING_SERVICE.REPORTING_RULE_EXECUTION_STATISTICS
(
  org_id String,
  rule_id String,
  rule_version DateTime64(3),
  rule_environment Nullable(String),
  rule_policy_names Array(String),
  rule_policy_ids Array(String),
  num_passes Int64,
  num_runs Int64,
  ts_start_inclusive DateTime64(3),
  ts_end_exclusive DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(ts_start_inclusive)
ORDER BY (org_id, rule_id, ts_start_inclusive);

DROP TABLE IF EXISTS REPORTING_SERVICE.REPORTS;
CREATE TABLE REPORTING_SERVICE.REPORTS
(
  org_id String NOT NULL,
  request_id String NOT NULL,
  reporter_user_id Nullable(String),
  reported_at DateTime64(3) NOT NULL,
  policy_id Nullable(String),
  reported_for_reason Nullable(String),
  ts DateTime64(3) NOT NULL,
  reporter_user_item_type_id Nullable(String),
  reporter_kind String NOT NULL,
  reported_item_id String NOT NULL,
  reported_item_data String NOT NULL,
  reported_item_type_id String NOT NULL,
  reported_item_type_kind String NOT NULL,
  reported_item_type_schema String NOT NULL,
  reported_item_type_schema_field_roles String NOT NULL,
  reported_item_type_schema_variant String NOT NULL,
  reported_item_type_version String NOT NULL,
  reported_item_thread Nullable(String),
  reported_items_in_thread Nullable(String),
  additional_items String NOT NULL DEFAULT '[]'
)
ENGINE = MergeTree
PARTITION BY toDate(ts)
ORDER BY (org_id, request_id, ts);

-------------------------------------------------------------------------------
-- RULE_ANOMALY_DETECTION_SERVICE
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS;
CREATE TABLE RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
(
  org_id String,
  rule_id String,
  rule_version DateTime64(3),
  num_passes Int64,
  passes_distinct_user_ids String,
  num_runs Int64,
  ts_start_inclusive DateTime64(3),
  ts_end_exclusive DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(ts_start_inclusive)
ORDER BY (org_id, rule_id, ts_start_inclusive);

-------------------------------------------------------------------------------
-- USER_STATISTICS_SERVICE
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS USER_STATISTICS_SERVICE.LIFETIME_ACTION_STATS;
CREATE TABLE USER_STATISTICS_SERVICE.LIFETIME_ACTION_STATS
(
  org_id String,
  user_id String,
  action_id String,
  policy_id Nullable(String),
  item_submission_ids Array(String),
  count Int64,
  user_type_id String,
  actor_id Nullable(String)
)
ENGINE = MergeTree
ORDER BY (org_id, user_id, action_id, ifNull(policy_id, ''));

DROP TABLE IF EXISTS USER_STATISTICS_SERVICE.SUBMISSION_STATS;
CREATE TABLE USER_STATISTICS_SERVICE.SUBMISSION_STATS
(
  org_id String,
  user_id String,
  item_type_id String,
  num_submissions Int64,
  ts_start_inclusive DateTime64(3),
  ts_end_exclusive DateTime64(3),
  user_type_id Nullable(String)
)
ENGINE = MergeTree
PARTITION BY toDate(ts_start_inclusive)
ORDER BY (org_id, ifNull(user_id, ''), item_type_id, ts_start_inclusive);

DROP TABLE IF EXISTS USER_STATISTICS_SERVICE.USER_SCORES;
CREATE TABLE USER_STATISTICS_SERVICE.USER_SCORES
(
  org_id String,
  user_id String,
  score Float64,
  score_date DateTime64(3),
  user_type_id String
)
ENGINE = MergeTree
PARTITION BY toDate(score_date)
ORDER BY (org_id, user_id, score_date);

