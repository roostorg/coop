-- ================================================================================
-- SNOWFLAKE SCHEMA - FLATTENED
-- Generated: 2025-12-02
-- ================================================================================

-- ================================================================================
-- SCHEMA: PUBLIC
-- ================================================================================

create or replace schema PUBLIC;

create or replace TABLE PUBLIC.ACTION_EXECUTIONS cluster by (ds, org_id)(
ORG_ID VARCHAR(16777216) NOT NULL,
ACTION_ID VARCHAR(16777216) NOT NULL,
ACTION_NAME VARCHAR(16777216) NOT NULL,
RULES ARRAY,
POLICIES ARRAY,
RULE_TAGS ARRAY,
RULE_ENVIRONMENT VARCHAR(16777216),
CORRELATION_ID VARCHAR(16777216) NOT NULL,
TS TIMESTAMP_NTZ(9) NOT NULL,
DS DATE NOT NULL,
ITEM_TYPE_ID VARCHAR(16777216),
ITEM_SUBMISSION_ID VARCHAR(16777216),
ITEM_CREATOR_ID VARCHAR(16777216),
ITEM_CREATOR_TYPE_ID VARCHAR(16777216),
ITEM_ID VARCHAR(16777216),
ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
ACTION_SOURCE VARCHAR(16777216) NOT NULL,
ACTOR_ID VARCHAR(16777216),
JOB_ID VARCHAR(16777216),
FAILED BOOLEAN DEFAULT FALSE
);

create or replace TABLE PUBLIC.ALL_ORGS (
ID VARCHAR(16777216) NOT NULL,
NAME VARCHAR(16777216) NOT NULL,
EMAIL VARCHAR(16777216) NOT NULL,
WEBSITE_URL VARCHAR(16777216) NOT NULL,
DATE_CREATED DATE NOT NULL
)COMMENT='Contains metadata about every customer, with one row per customer organization'
;

create or replace TABLE PUBLIC.CONTENT_API_REQUESTS cluster by (ds, org_id, event, item_type_id)(
ORG_ID VARCHAR(16777216) NOT NULL,
EVENT VARCHAR(16777216) NOT NULL,
REQUEST_ID VARCHAR(16777216) NOT NULL,
SUBMISSION_ID VARCHAR(16777216) NOT NULL,
FAILURE_REASON VARCHAR(16777216),
TS TIMESTAMP_NTZ(9) NOT NULL,
DS DATE NOT NULL,
ITEM_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_NAME VARCHAR(16777216) NOT NULL,
ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
ITEM_CREATOR_ID VARCHAR(16777216),
ITEM_DATA VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA VARCHAR(16777216) NOT NULL,
ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
ITEM_CREATOR_TYPE_ID VARCHAR(16777216),
ITEM_TYPE_VERSION VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA_VARIANT VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA_FIELD_ROLES OBJECT NOT NULL DEFAULT '{}'
);

create or replace TABLE PUBLIC.CONTENT_DETAILS_API_REQUESTS (
CONTENT_ID VARCHAR(16777216) NOT NULL,
ORG_ID VARCHAR(16777216) NOT NULL,
EVENT VARCHAR(16777216),
FAILURE_REASON VARCHAR(16777216),
DS DATE,
TS VARCHAR(16777216)
)COMMENT='This table contains one row per API request to the Content Deatils API, which returns details about the rules matched on - and actions run on - a piece of content'
;

create or replace TABLE PUBLIC.INGESTED_JSON (
TARGET_TABLE VARCHAR(16777216),
DATA VARIANT,
DS DATE
);

create or replace TABLE PUBLIC.ITEM_MODEL_SCORES_LOG cluster by (ds, org_id, event, item_type_id)(
ORG_ID VARCHAR(16777216) NOT NULL,
MODEL_ID VARCHAR(16777216),
MODEL_VERSION NUMBER(38,0),
MODEL_SCORE FLOAT,
EVENT VARCHAR(16777216) NOT NULL,
SUBMISSION_ID VARCHAR(16777216) NOT NULL,
FAILURE_REASON VARCHAR(16777216),
TS TIMESTAMP_NTZ(9) NOT NULL,
DS DATE NOT NULL,
ITEM_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_NAME VARCHAR(16777216) NOT NULL,
ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
ITEM_CREATOR_ID VARCHAR(16777216),
ITEM_DATA VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA VARCHAR(16777216) NOT NULL,
ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
ITEM_CREATOR_TYPE_ID VARCHAR(16777216),
ITEM_TYPE_VERSION VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA_VARIANT VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA_FIELD_ROLES OBJECT NOT NULL DEFAULT '{}'
);

create or replace TABLE PUBLIC.RULE_EXECUTIONS cluster by (ds, org_id, passed, rule_id, LOWER(SUBSTRING(item_id, 0, 3)))(
RULE VARCHAR(16777216) NOT NULL,
RULE_ID VARCHAR(16777216) NOT NULL,
RULE_VERSION TIMESTAMP_NTZ(9),
ORG_ID VARCHAR(16777216) NOT NULL,
ENVIRONMENT VARCHAR(16777216) NOT NULL,
CORRELATION_ID VARCHAR(16777216),
POLICY_IDS ARRAY,
POLICY_NAMES ARRAY,
TAGS ARRAY,
RESULT VARCHAR(16777216),
PASSED BOOLEAN NOT NULL,
TS TIMESTAMP_NTZ(9) NOT NULL,
DS DATE NOT NULL,
ITEM_DATA VARCHAR(16777216),
ITEM_ID VARCHAR(16777216) NOT NULL,
ITEM_SUBMISSION_ID VARCHAR(16777216),
ITEM_TYPE_NAME VARCHAR(16777216),
ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
ITEM_CREATOR_ID VARCHAR(16777216),
ITEM_CREATOR_TYPE_ID VARCHAR(16777216),
ITEM_TYPE_SCHEMA VARCHAR(16777216),
ITEM_TYPE_SCHEMA_FIELD_ROLES OBJECT,
ITEM_TYPE_VERSION VARCHAR(16777216),
ITEM_TYPE_SCHEMA_VARIANT VARCHAR(16777216)
);

create or replace TABLE PUBLIC.RULE_EXECUTION_STATISTICS cluster by (ORG_ID, TIME_SLICE(TS_START_INCLUSIVE, 1, 'day'), RULE_ID)(
ORG_ID VARCHAR(16777216) NOT NULL,
RULE_ID VARCHAR(16777216) NOT NULL,
RULE_VERSION TIMESTAMP_NTZ(9) NOT NULL,
NUM_PASSES NUMBER(38,0) NOT NULL,
NUM_RUNS NUMBER(38,0) NOT NULL,
TS_START_INCLUSIVE TIMESTAMP_NTZ(9) NOT NULL,
TS_END_EXCLUSIVE TIMESTAMP_NTZ(9) NOT NULL,
ENVIRONMENT VARCHAR(16777216),
RULE_POLICY_NAMES ARRAY,
RULE_POLICY_IDS ARRAY,
RULE_TAGS ARRAY
);

create or replace TABLE PUBLIC."SequelizeMeta" (
"name" VARCHAR(255) NOT NULL,
"createdAt" TIMESTAMP_NTZ(9) NOT NULL,
"updatedAt" TIMESTAMP_NTZ(9) NOT NULL,
primary key ("name")
);

CREATE OR REPLACE FUNCTION PUBLIC.ARRAY_DCAT("ARRAY1" ARRAY, "ARRAY2" ARRAY)
RETURNS ARRAY
LANGUAGE JAVASCRIPT
STRICT
IMMUTABLE
COMMENT='Returns a distinct concatenation of two arrays'
AS '
return Array.from(new Set(ARRAY1.concat(ARRAY2)));
';

CREATE OR REPLACE PROCEDURE PUBLIC.INGEST_NEW_ROWS()
RETURNS VARCHAR(16777216)
LANGUAGE SQL
EXECUTE AS OWNER
AS '
declare
unknown_table_exception exception;
begin
BEGIN TRANSACTION;
INSERT INTO ACTION_EXECUTIONS (
ORG_ID,
ACTION_ID,
ACTION_NAME,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
ITEM_SUBMISSION_ID,
ITEM_ID,
ITEM_TYPE_KIND,
ITEM_TYPE_ID,
RULES,
POLICIES,
RULE_TAGS,
RULE_ENVIRONMENT,
CORRELATION_ID,
ACTION_SOURCE,
ACTOR_ID,
JOB_ID,
FAILED,
TS,
DS)
SELECT
data:data:org_id::string,
data:data:action_id::string,
data:data:action_name::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:item_submission_id::string,
data:data:item_id::string,
data:data:item_type_kind::string,
data:data:item_type_id::string,
data:data:rules::array,
data:data:policies::array,
data:data:rule_tags::array,
data:data:rule_environment::string,
data:data:correlation_id::string,
data:data:action_source::string,
data:data:actor_id::string,
data:data:job_id::string,
data:data:failed::boolean,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''ACTION_EXECUTIONS'';
INSERT INTO RULE_EXECUTIONS (
ITEM_DATA,
ITEM_ID,
item_submission_id,
item_type_name,
item_type_id,
ITEM_TYPE_KIND,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_SCHEMA_VARIANT,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
RULE,
RULE_ID,
RULE_VERSION,
ORG_ID,
ENVIRONMENT,
CORRELATION_ID,
POLICY_IDS,
POLICY_NAMES,
TAGS,
RESULT,
PASSED,
TS,
DS)
SELECT
data:data:item_data::string,
data:data:item_id::string,
data:data:item_submission_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_kind::string,
data:data:item_type_version::string,
data:data:item_type_schema::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_schema_variant::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:rule::string,
data:data:rule_id::string,
data:data:rule_version::datetime,
data:data:org_id::string,
data:data:environment::string,
data:data:correlation_id::string,
data:data:policy_ids::array,
data:data:policy_names::array,
data:data:tags::array,
data:data:result::string,
data:data:passed::boolean,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''RULE_EXECUTIONS'';
INSERT INTO CONTENT_API_REQUESTS (
ORG_ID,
EVENT,
REQUEST_ID,
SUBMISSION_ID,
ITEM_DATA,
ITEM_ID,
ITEM_TYPE_NAME,
ITEM_TYPE_ID,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_KIND,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA_VARIANT,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
FAILURE_REASON,
TS,
DS)
SELECT
data:data:org_id::string,
data:data:event::string,
data:data:request_id::string,
data:data:submission_id::string,
data:data:item_data::string,
data:data:item_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_schema::string,
data:data:item_type_kind::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_version::string,
data:data:item_type_schema_variant::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:failure_reason::string,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''CONTENT_API_REQUESTS'';
INSERT INTO ITEM_MODEL_SCORES_LOG (
ORG_ID,
EVENT,
MODEL_ID,
MODEL_VERSION,
MODEL_SCORE,
SUBMISSION_ID,
ITEM_DATA,
ITEM_ID,
ITEM_TYPE_NAME,
ITEM_TYPE_ID,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_KIND,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA_VARIANT,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
FAILURE_REASON,
TS,
DS)
SELECT
data:data:org_id::string,
data:data:event::string,
data:data:model_id::string,
data:data:model_version::number,
data:data:model_score::float,
data:data:submission_id::string,
data:data:item_data::string,
data:data:item_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_schema::string,
data:data:item_type_kind::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_version::string,
data:data:item_type_schema_variant::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:failure_reason::string,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''ITEM_MODEL_SCORES_LOG'';
INSERT INTO REPORTING_SERVICE.APPEALS (
ORG_ID,
REQUEST_ID,
APPEAL_ID,
APPEALED_BY_USER_ID,
APPEALED_BY_USER_ITEM_TYPE_ID,
APPEALED_AT,
APPEAL_REASON,
ACTIONS_TAKEN,
ACTIONED_ITEM_DATA,
ACTIONED_ITEM_ID,
ACTIONED_ITEM_TYPE_ID,
ACTIONED_ITEM_TYPE_KIND,
ACTIONED_ITEM_TYPE_SCHEMA,
ACTIONED_ITEM_TYPE_SCHEMA_FIELD_ROLES,
ACTIONED_ITEM_TYPE_VERSION,
ACTIONED_ITEM_TYPE_SCHEMA_VARIANT,
ADDITIONAL_ITEMS,
TS
)
SELECT
data:data:org_id::string,
data:data:request_id::string,
data:data:appeal_id::string,
data:data:appealed_by_user_id::string,
data:data:appealed_by_user_item_type_id::string,
COALESCE(TO_TIMESTAMP_NTZ(data:data:appealed_at::string), TO_TIMESTAMP_NTZ(CURRENT_TIMESTAMP)),
data:data:appeal_reason::string,
data:data:actions_taken::array,
data:data:actioned_item_data::string,
data:data:actioned_item_id::string,
data:data:actioned_item_type_id::string,
data:data:actioned_item_type_kind::string,
data:data:actioned_item_type_schema::string,
data:data:actioned_item_type_schema_field_roles::object,
data:data:actioned_item_type_version::string,
data:data:actioned_item_type_schema_variant::string,
COALESCE(data:data:additional_items, [])::array,
TO_TIMESTAMP_NTZ(data:data:ts::string)
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''REPORTING_SERVICE.APPEALS'';
INSERT INTO MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS (
ITEM_DATA,
ITEM_ID,
ITEM_TYPE_NAME,
ITEM_TYPE_ID,
ITEM_TYPE_KIND,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_SCHEMA_VARIANT,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
RULE,
RULE_ID,
RULE_VERSION,
DESTINATION_QUEUE_ID,
ORG_ID,
CORRELATION_ID,
RESULT,
PASSED,
JOB_KIND,
TS,
DS)
SELECT
data:data:item_data::string,
data:data:item_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_kind::string,
data:data:item_type_version::string,
data:data:item_type_schema::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_schema_variant::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:rule::string,
data:data:rule_id::string,
data:data:rule_version::datetime,
data:data:destination_queue_id::string,
data:data:org_id::string,
data:data:correlation_id::string,
data:data:result::variant,
data:data:passed::boolean,
data:data:job_kind::string,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS'';
INSERT INTO REPORTING_SERVICE.REPORTS (
ORG_ID,
REQUEST_ID,
REPORTER_USER_ID,
REPORTER_USER_ITEM_TYPE_ID,
REPORTER_KIND,
REPORTED_AT,
POLICY_ID,
REPORTED_FOR_REASON,
REPORTED_ITEM_DATA,
REPORTED_ITEM_ID,
REPORTED_ITEM_TYPE_ID,
REPORTED_ITEM_TYPE_KIND,
REPORTED_ITEM_TYPE_SCHEMA,
REPORTED_ITEM_TYPE_SCHEMA_FIELD_ROLES,
REPORTED_ITEM_TYPE_VERSION,
REPORTED_ITEM_TYPE_SCHEMA_VARIANT,
REPORTED_ITEM_THREAD,
REPORTED_ITEMS_IN_THREAD,
ADDITIONAL_ITEMS,
TS
)
SELECT
data:data:org_id::string,
data:data:request_id::string,
data:data:reporter_user_id::string,
data:data:reporter_user_item_type_id::string,
data:data:reporter_kind::string,
COALESCE(TO_TIMESTAMP_NTZ(data:data:reported_at::string), TO_TIMESTAMP_NTZ(CURRENT_TIMESTAMP)),
data:data:policy_id::string,
data:data:reported_for_reason::string,
data:data:reported_item_data::object,
data:data:reported_item_id::string,
data:data:reported_item_type_id::string,
data:data:reported_item_type_kind::string,
data:data:reported_item_type_schema::array,
data:data:reported_item_type_schema_field_roles::object,
data:data:reported_item_type_version::string,
data:data:reported_item_type_schema_variant::string,
data:data:reported_item_thread::array,
COALESCE(data:data:reported_items_in_thread, [])::array,
COALESCE(data:data:additional_items, [])::array,
TO_TIMESTAMP_NTZ(data:data:ts::string)
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''REPORTING_SERVICE.REPORTS'';
INSERT INTO MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS (
ITEM_DATA,
ITEM_ID,
ITEM_TYPE_NAME,
ITEM_TYPE_ID,
ITEM_TYPE_KIND,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_SCHEMA_VARIANT,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
RULE,
RULE_ID,
RULE_VERSION,
DESTINATION_QUEUE_ID,
ORG_ID,
CORRELATION_ID,
RESULT,
PASSED,
JOB_KIND,
TS,
DS)
SELECT
data:data:item_data::string,
data:data:item_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_kind::string,
data:data:item_type_version::string,
data:data:item_type_schema::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_schema_variant::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:rule::string,
data:data:rule_id::string,
data:data:rule_version::datetime,
data:data:destination_queue_id::string,
data:data:org_id::string,
data:data:correlation_id::string,
data:data:result::variant,
data:data:passed::boolean,
data:data:job_kind::string,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS'';
INSERT INTO REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS (
RULE_NAME,
RULE_ID,
RULE_VERSION,
RULE_ENVIRONMENT,
ORG_ID,
CORRELATION_ID,
RESULT,
PASSED,
TS,
DS,
POLICY_NAMES,
POLICY_IDS,
ITEM_DATA,
ITEM_ID,
ITEM_TYPE_NAME,
ITEM_TYPE_ID,
ITEM_TYPE_KIND,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA_VARIANT)
SELECT
data:data:rule_name::string,
data:data:rule_id::string,
data:data:rule_version::datetime,
data:data:rule_environment::string,
data:data:org_id::string,
data:data:correlation_id::string,
data:data:result::variant,
data:data:passed::boolean,
to_timestamp(data:data:ts::number, 3),
ds,
data:data:policy_names::array,
data:data:policy_ids::array,
data:data:item_data::string,
data:data:item_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_kind::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:item_type_schema::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_version::string,
data:data:item_type_schema_variant::string
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS'';
COMMIT;
end;
';

CREATE OR REPLACE FUNCTION PUBLIC.REFORMAT_CONDITION_SIGNALS("V" VARIANT)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
IMMUTABLE
AS '
function reformatCondition(condition) {
if (condition.conditions) {
return {
...condition,
conditions: condition.conditions.map(it => reformatCondition(it)),
};
}
const { signal } = condition;
// conditions w/ no signals stay as-is.
if(!signal) {
return condition;
}
// conditions w/ a valid signal id stay as-is.
if(signal.id && signal.id[0] === "{") {
return condition;
}
condition.signal.id = JSON.stringify({ type: signal.type });
return condition;
}
return reformatCondition(V);
';

create or replace stream PUBLIC.INGESTED_JSON_TO_TABLES on table INGESTED_JSON append_only = true;

create or replace stream PUBLIC.POPULATE_RULE_EXECUTION_STATISTICS_STREAM on table RULE_EXECUTIONS append_only = true;

create or replace task PUBLIC.INGEST_JSON_TO_TABLES_TASK
schedule='1 MINUTE'
error_integration=AWS_NOTIFICATION_INTEGRATION
when SYSTEM$STREAM_HAS_DATA('ingested_json_to_tables')
as CALL ingest_new_rows();

create or replace view PUBLIC.NGL_ALL_SCORES(
ITEM_DATA,
COUNTRY,
TRANSLATED_CONTENT,
HIVE_BULLYING,
HIVE_HATE,
HIVE_VIOLENCE,
HIVE_MAX,
HIVE_BULLYING_TRANSLATED,
OPEN_AI_HATE,
OPEN_AI_HATE_THREATENING,
OPEN_AI_SELF_HARM,
OPEN_AI_VIOLENCE,
PERSPECTIVE_IDENTITY_ATTACK,
PERSPECTIVE_INSULT,
PERSPECTIVE_SEVERE_TOXICITY,
PERSPECTIVE_THREAT,
PERSPECTIVE_TOXICITY,
PERSPECTIVE_MAX,
PERSPECTIVE_IDENTITY_ATTACK_TRANSLATED,
PERSPECTIVE_INSULT_TRANSLATED,
PERSPECTIVE_SEVERE_TOXICITY_TRANSLATED,
PERSPECTIVE_THREAT_TRANSLATED,
PERSPECTIVE_TOXICITY_TRANSLATED,
PERSPECTIVE_TRANSLATED_MAX,
CLARIFAI_HATE,
CLARIFAI_INSULT,
CLARIFAI_THREAT,
CLARIFAI_MAX,
ITEM_ID,
DETECTED_LANGUAGE,
DS
) as
WITH rule_execs AS (
SELECT
item_id,
rule_id,
ANY_VALUE(item_data) as item_data,
ANY_VALUE(result) as result,
ANY_VALUE(ts) as ts,
ANY_VALUE(org_id) as org_id,
ANY_VALUE(ds) as ds
FROM PUBLIC.rule_executions
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30' AND ds <= '2023-03-08'
GROUP BY 1, 2
)
SELECT
PARSE_JSON(hive_bullying.item_data):text as item_data,
SUBSTRING(PARSE_JSON(hive_bullying.item_data):country, 1, LEN(PARSE_JSON(hive_bullying.item_data):country)) as country,
translated_content,
CAST(hive_bullying_score as int) as hive_bullying,
CAST(hive_hate as int) as hive_hate,
CAST(hive_violence as int) as hive_violence,
GREATEST(
CAST(hive_bullying_score as int),
CAST(hive_hate as int),
CAST(hive_violence as int)
) as hive_max,
CAST(hive_bullying_translated as int) as hive_bullying_translated,
ROUND(CAST(open_ai_hate as float), 4) as open_ai_hate,
ROUND(CAST(open_ai_hate_threatening as float), 4) as open_ai_hate_threatening,
ROUND(CAST(open_ai_self_harm as float), 4) as open_ai_self_harm,
ROUND(CAST(open_ai_violence as float), 4) as open_ai_violence,
ROUND(CAST(perspective_identity_attack as float), 4) as perspective_identity_attack,
ROUND(CAST(perspective_insult as float), 4) as perspective_insult,
ROUND(CAST(perspective_severe_toxicity as float), 4) as perspective_severe_toxicity,
ROUND(CAST(perspective_threat as float), 4) as perspective_threat,
ROUND(CAST(perspective_toxicity as float), 4) as perspective_toxicity,
GREATEST(
ROUND(CAST(perspective_identity_attack as float), 4),
ROUND(CAST(perspective_insult as float), 4),
ROUND(CAST(perspective_severe_toxicity as float), 4),
ROUND(CAST(perspective_threat as float), 4),
ROUND(CAST(perspective_toxicity as float), 4)
) as perspective_max,
ROUND(CAST(perspective_identity_attack_translated as float), 4) as perspective_identity_attack_translated,
ROUND(CAST(perspective_insult_translated as float), 4) as perspective_insult_translated,
ROUND(CAST(perspective_severe_toxicity_translated as float), 4) as perspective_severe_toxicity_translated,
ROUND(CAST(perspective_threat_translated as float), 4) as perspective_threat_translated,
ROUND(CAST(perspective_toxicity_translated as float), 4) as perspective_toxicity_translated,
GREATEST(
ROUND(CAST(perspective_identity_attack_translated as float), 4),
ROUND(CAST(perspective_insult_translated as float), 4),
ROUND(CAST(perspective_severe_toxicity_translated as float), 4),
ROUND(CAST(perspective_threat_translated as float), 4),
ROUND(CAST(perspective_toxicity_translated as float), 4)
) as perspective_translated_max,
ROUND(CAST(clarifai_hate as float), 4) as clarifai_hate,
ROUND(CAST(clarifai_insult as float), 4) as clarifai_insult,
ROUND(CAST(clarifai_threat as float), 4) as clarifai_threat,
GREATEST(
ROUND(CAST(clarifai_hate as float), 4),
ROUND(CAST(clarifai_insult as float), 4),
ROUND(CAST(clarifai_threat as float), 4)
) as clarifai_max,
hive_bullying.item_id,
detected_language,
ds
FROM (
SELECT
item_data,
GET(PARSE_JSON(result):conditions, 0):result.score as hive_bullying_score,
result,
item_id,
ds
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = 'ec9165c5652'
AND item_id != 'hO3RvmWdpc0nq3sR87pb'
) hive_bullying
LEFT JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as hive_hate, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '575e9852e2c'
) hive_hate
ON hive_bullying.item_id = hive_hate.item_id
LEFT JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as hive_violence, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = 'eec9165c565'
) hive_violence
ON hive_bullying.item_id = hive_violence.item_id
LEFT JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as detected_language, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '8e32c1e856d'
) language
ON hive_bullying.item_id = language.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as open_ai_hate, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '9165c5652ae'
) open_ai_hate
ON hive_bullying.item_id = open_ai_hate.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as open_ai_hate_threatening, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '165c5652aec'
) open_ai_hate_threatening
ON hive_bullying.item_id = open_ai_hate_threatening.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as open_ai_self_harm, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '5c5652aec17'
) open_ai_self_harm
ON hive_bullying.item_id = open_ai_self_harm.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as open_ai_violence, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '65c5652aec1'
) open_ai_violence
ON hive_bullying.item_id = open_ai_violence.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_identity_attack, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = 'f224d9ca08a'
) perspective_identity_attack
ON hive_bullying.item_id = perspective_identity_attack.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_insult, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = 'ee189024f28'
) perspective_insult
ON hive_bullying.item_id = perspective_insult.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_profanity, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '1724e465115'
) perspective_profanity
ON hive_bullying.item_id = perspective_profanity.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_severe_toxicity, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '224d9ca08a5'
) perspective_severe_toxicity
ON hive_bullying.item_id = perspective_severe_toxicity.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_threat, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '91724e46511'
) perspective_threat
ON hive_bullying.item_id = perspective_threat.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_toxicity, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '24d9ca08a59'
) perspective_toxicity
ON hive_bullying.item_id = perspective_toxicity.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_identity_attack_translated, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '6b66dc40019'
) perspective_identity_attack_translated
ON hive_bullying.item_id = perspective_identity_attack_translated.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_insult_translated, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = 'b66dc400198'
) perspective_insult_translated
ON hive_bullying.item_id = perspective_insult_translated.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_severe_toxicity_translated, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '66dc4001984'
) perspective_severe_toxicity_translated
ON hive_bullying.item_id = perspective_severe_toxicity_translated.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_threat_translated, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = 'da7bf615b84'
) perspective_threat_translated
ON hive_bullying.item_id = perspective_threat_translated.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as perspective_toxicity_translated, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND ds >= '2023-01-30'
AND rule_id = '6dc40019843'
) perspective_toxicity_translated_translated
ON hive_bullying.item_id = perspective_toxicity_translated_translated.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as clarifai_hate, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND rule_id = '61fb88ec276'
AND ds >= '2023-01-30'
) clarifai_hate
ON hive_bullying.item_id = clarifai_hate.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as clarifai_insult, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND rule_id = 'fb88ec27602'
AND ds >= '2023-01-30'
) clarifai_insult
ON hive_bullying.item_id = clarifai_insult.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as clarifai_threat, result, item_id, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND rule_id = '1fb88ec2760'
AND ds >= '2023-01-30'
) clarifai_threat
ON hive_bullying.item_id = clarifai_threat.item_id
INNER JOIN (
SELECT item_data, GET(PARSE_JSON(result):conditions, 0):result.score as hive_bullying_translated, result, item_id,     SUBSTRING(GET(GET(PARSE_JSON(result):conditions, 0):result.signalInputValues, 0):value, 1, LEN(GET(GET(PARSE_JSON(result):conditions, 0):result.signalInputValues, 0):value) - 16) AS translated_content, ts
FROM rule_execs
WHERE org_id = '8dee189024f'
AND rule_id = '779764f2a81'
AND ds >= '2023-01-30'
) hive_bullying_translated
ON hive_bullying.item_id = hive_bullying_translated.item_id;

CREATE OR REPLACE FUNCTION PUBLIC.FIX_NULL_INPUT_TYPES("V" VARCHAR(16777216))
RETURNS VARCHAR(16777216)
LANGUAGE JAVASCRIPT
AS '
function isConditionSet(it) {
return ''conjunction'' in it && ''conditions'' in it;
}
function mapLeafCondition(condition) {
// Skip all conditions that got migrated already.
// Needed because this migration often times out and must be
// idempotent so we can re-run it until it completes.
if (condition.input.type != null) {
return condition;
}
if (condition.input.name !== ''All text'' && condition.input.name !== ''Any geohash'') {
return condition;
}
return {
input: {
name: condition.input.name,
type: ''CONTENT_PROTEGO_INPUT''
},
type: ''CONTENT_PROTEGO_INPUT''
};
}
function mapCondition(condition) {
return isConditionSet(condition)
? {
...condition,
conditions: condition.conditions.map(mapCondition),
}
: mapLeafCondition(condition);
}
function replaceConditions(resultString) {
const result = JSON.parse(resultString);
const { conditions } = result;
return JSON.stringify({
...result,
conditions: conditions.map(mapCondition)
});
}
return replaceConditions(V);
';

CREATE OR REPLACE FUNCTION PUBLIC.HAS_OLD_GEOHASH_CONDITIONS("V" VARIANT)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
AS '
function hasOldCondition(conditions) {
return conditions?.some((it) => {
if (it.conditions) {
return hasOldCondition(it.conditions);
}
return it.input?.scalarType === ''GEOHASH''
&& it.threshold === Number(it.threshold)
&& it.comparator !== ''LOCATED_IN''
&& it.comparator !== ''NOT_LOCATED_IN'';
}) ?? false;
}
return hasOldCondition(V);
';

CREATE OR REPLACE FUNCTION PUBLIC.MIGRATE_RESULT_CONDITIONS("V" VARIANT)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
AS '
function replaceConditions(conditions) {
return conditions.map(function mapCondition(condition) {
return isConditionSet(condition)
? { ...condition, conditions: condition.conditions.map(mapCondition) }
: mapLeafCondition(condition);
})
}
// Helpers copied from the PG migration, but changed because old results
// stored in snowflake refrence a min-distance signal that no longer exists.
function isConditionSet(it) {
return ''conjunction'' in it && ''conditions'' in it;
}
function mapLeafCondition(it) {
return it.input?.scalarType === ''GEOHASH'' && !it.signal?.type
? {
...it,
signal: { ...(it.signal ?? {}), type: ''GEO_CONTAINED_WITHIN'' },
comparator: ''EQUALS'',
threshold: it.comparator === ''LOCATED_IN'',
}
: it;
}
return replaceConditions(V);
';

CREATE OR REPLACE FUNCTION PUBLIC.VALIDATE_RULE_RESULTS("V" VARCHAR(16777216))
RETURNS VARCHAR(16777216)
LANGUAGE JAVASCRIPT
AS '
function validateCondition(it) {
return ''conditions'' in it
? it.conditions.every(innerCondition => validateCondition(innerCondition))
: it.input.type != null
}
return validateCondition(JSON.parse(V));
';

create or replace task PUBLIC.POPULATE_RULE_EXECUTION_STATISTICS
schedule='5 MINUTE'
error_integration=AWS_NOTIFICATION_INTEGRATION
when SYSTEM$STREAM_HAS_DATA('populate_rule_execution_statistics_stream')
as MERGE INTO rule_execution_statistics
USING (
SELECT
org_id,
rule_id,
rule_version,
environment,
-- Every execution row for a (org_id, rule_id, rule_version) group should
-- have the same policy names + policy ids + tags, so we can pick any value.
-- This is safe because a change to any of these values in the app would
-- create a new rule version.
any_value(policy_names) as policy_names,
any_value(policy_ids) as policy_ids,
any_value(tags) as tags,
SUM(passed::number) as num_passes,
COUNT(*) as num_runs,
TIMESTAMP_NTZ_FROM_PARTS(year(ds), month(ds), day(ds), hour(ts), 0, 0) as ts_start
FROM populate_rule_execution_statistics_stream
WHERE METADATA$ACTION = 'INSERT'
GROUP BY org_id, rule_id, rule_version, environment, ds, hour(ts)
) as executions
ON executions.ts_start = rule_execution_statistics.ts_start_inclusive
AND executions.rule_id = rule_execution_statistics.rule_id
AND executions.rule_version = rule_execution_statistics.rule_version
AND executions.environment = rule_execution_statistics.environment
WHEN MATCHED THEN
UPDATE
SET num_passes = (rule_execution_statistics.num_passes + executions.num_passes),
num_runs = (rule_execution_statistics.num_runs + executions.num_runs)
WHEN NOT MATCHED THEN
INSERT (
org_id,
rule_id,
rule_version,
rule_tags,
rule_policy_names,
rule_policy_ids,
environment,
num_passes,
num_runs,
ts_start_inclusive,
ts_end_exclusive)
VALUES (
executions.org_id,
executions.rule_id,
executions.rule_version,
executions.tags,
executions.policy_names,
executions.policy_ids,
executions.environment,
executions.num_passes,
executions.num_runs,
executions.ts_start,
timestampadd(hour, 1, executions.ts_start));

-- ================================================================================
-- SCHEMA: ACTION_STATISTICS_SERVICE
-- ================================================================================

create or replace schema ACTION_STATISTICS_SERVICE;

create or replace TABLE ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS (
DS DATE NOT NULL,
ORG_ID VARCHAR(16777216) NOT NULL,
NUM_SUBMISSIONS NUMBER(38,0) NOT NULL,
SUBMISSION_IDS ARRAY
);

create or replace TABLE ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_POLICY (
DS DATE NOT NULL,
ORG_ID VARCHAR(16777216) NOT NULL,
NUM_SUBMISSIONS NUMBER(38,0) NOT NULL,
SUBMISSION_IDS ARRAY,
POLICY_ID VARCHAR(16777216) NOT NULL,
POLICY_NAME VARCHAR(16777216) NOT NULL
);

create or replace TABLE ACTION_STATISTICS_SERVICE.ACTIONED_SUBMISSION_COUNTS_BY_TAG (
DS DATE NOT NULL,
ORG_ID VARCHAR(16777216) NOT NULL,
NUM_SUBMISSIONS NUMBER(38,0) NOT NULL,
SUBMISSION_IDS ARRAY,
TAG VARCHAR(16777216) NOT NULL
);

create or replace TABLE ACTION_STATISTICS_SERVICE.BY_ACTION cluster by (org_id, TIME_SLICE(action_time, 12, 'HOUR'))(
ORG_ID VARCHAR(16777216) NOT NULL,
ITEM_ID VARCHAR(16777216),
ITEM_TYPE_ID VARCHAR(16777216),
ACTION_ID VARCHAR(16777216) NOT NULL,
ACTION_TIME TIMESTAMP_NTZ(9) NOT NULL
);

create or replace TABLE ACTION_STATISTICS_SERVICE.BY_ITEM_TYPE cluster by (org_id, TIME_SLICE(action_time, 12, 'HOUR'))(
ORG_ID VARCHAR(16777216) NOT NULL,
ITEM_ID VARCHAR(16777216),
ITEM_TYPE_ID VARCHAR(16777216),
ACTION_TIME TIMESTAMP_NTZ(9) NOT NULL
);

create or replace TABLE ACTION_STATISTICS_SERVICE.BY_POLICY cluster by (org_id, TIME_SLICE(action_time, 12, 'HOUR'))(
ORG_ID VARCHAR(16777216) NOT NULL,
ITEM_ID VARCHAR(16777216),
ITEM_TYPE_ID VARCHAR(16777216),
POLICY_ID VARCHAR(16777216) NOT NULL,
ACTION_TIME TIMESTAMP_NTZ(9) NOT NULL
);

create or replace TABLE ACTION_STATISTICS_SERVICE.BY_RULE cluster by (org_id, TIME_SLICE(action_time, 12, 'HOUR'))(
ORG_ID VARCHAR(16777216) NOT NULL,
ITEM_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
RULE_ID VARCHAR(16777216) NOT NULL,
ACTION_TIME TIMESTAMP_NTZ(9) NOT NULL
);

create or replace TABLE ACTION_STATISTICS_SERVICE.BY_SOURCE cluster by (org_id, TIME_SLICE(action_time, 12, 'HOUR'))(
ORG_ID VARCHAR(16777216) NOT NULL,
ITEM_ID VARCHAR(16777216),
ITEM_TYPE_ID VARCHAR(16777216),
SOURCE VARCHAR(16777216) NOT NULL,
ACTION_TIME TIMESTAMP_NTZ(9) NOT NULL
);

CREATE OR REPLACE FUNCTION ACTION_STATISTICS_SERVICE.ARRAY_DCAT("ARRAY1" ARRAY, "ARRAY2" ARRAY)
RETURNS ARRAY
LANGUAGE JAVASCRIPT
STRICT
IMMUTABLE
COMMENT='Returns a distinct concatenation of two arrays'
AS '
return Array.from(new Set(ARRAY1.concat(ARRAY2)));
';

CREATE OR REPLACE PROCEDURE ACTION_STATISTICS_SERVICE.MATERIALIZE_STATS()
RETURNS VARCHAR(16777216)
LANGUAGE SQL
EXECUTE AS OWNER
AS '
BEGIN
BEGIN TRANSACTION;
-- OLD TABLES, will be removed once code is updated and deployed
MERGE INTO action_statistics_service.actioned_submission_counts
USING (
SELECT
org_id,
ds,
count(DISTINCT item_submission_id) AS num_submissions
FROM action_statistics_service.materialize_stats_stream
GROUP BY org_id, ds
) AS new_submissions_by_date
ON new_submissions_by_date.ds = action_statistics_service.actioned_submission_counts.ds
AND new_submissions_by_date.org_id = action_statistics_service.actioned_submission_counts.org_id
WHEN MATCHED THEN
UPDATE SET
num_submissions = actioned_submission_counts.num_submissions + new_submissions_by_date.num_submissions
WHEN NOT MATCHED THEN
INSERT (org_id, ds, num_submissions)
VALUES (
new_submissions_by_date.org_id,
new_submissions_by_date.ds,
new_submissions_by_date.num_submissions
);
MERGE INTO action_statistics_service.actioned_submission_counts_by_policy
USING (
SELECT
org_id,
count(DISTINCT item_submission_id) AS num_submissions,
policies.value:id as policy_id,
any_value(policies.value:name) policy_name,
ds
FROM action_statistics_service.materialize_stats_stream,
lateral flatten(input => materialize_stats_stream.POLICIES) policies
GROUP BY org_id, ds, policies.value:id
) AS new_submissions_by_date
ON new_submissions_by_date.ds = action_statistics_service.actioned_submission_counts_by_policy.ds
AND new_submissions_by_date.org_id = action_statistics_service.actioned_submission_counts_by_policy.org_id
AND new_submissions_by_date.policy_id = action_statistics_service.actioned_submission_counts_by_policy.policy_id
WHEN MATCHED THEN
UPDATE SET
num_submissions = actioned_submission_counts_by_policy.num_submissions + new_submissions_by_date.num_submissions
WHEN NOT MATCHED THEN
INSERT (org_id, ds, num_submissions, policy_id, policy_name)
VALUES (
new_submissions_by_date.org_id,
new_submissions_by_date.ds,
new_submissions_by_date.num_submissions,
new_submissions_by_date.policy_id,
new_submissions_by_date.policy_name);
MERGE INTO action_statistics_service.actioned_submission_counts_by_tag
USING (
SELECT
org_id,
count(DISTINCT item_submission_id) AS num_submissions,
tags.value as tag,
ds
FROM action_statistics_service.materialize_stats_stream,
lateral flatten(input => materialize_stats_stream.RULE_TAGS) tags
GROUP BY org_id, ds, tag
) AS new_submissions_by_date
ON new_submissions_by_date.ds = action_statistics_service.actioned_submission_counts_by_tag.ds
AND new_submissions_by_date.tag = action_statistics_service.actioned_submission_counts_by_tag.tag
AND new_submissions_by_date.org_id = action_statistics_service.actioned_submission_counts_by_tag.org_id
WHEN MATCHED THEN
UPDATE SET
num_submissions = actioned_submission_counts_by_tag.num_submissions + new_submissions_by_date.num_submissions
WHEN NOT MATCHED THEN
INSERT (org_id, ds, num_submissions, tag)
VALUES (
new_submissions_by_date.org_id,
new_submissions_by_date.ds,
new_submissions_by_date.num_submissions,
new_submissions_by_date.tag);
-- NEW TABLES, will stick around after we remove the old ones
-- Populate by_item_type table
INSERT INTO action_statistics_service.by_item_type (org_id, item_id, item_type_id, action_time)
WITH new_actions_by_item_type AS (
SELECT
ORG_ID,
ITEM_ID,
ITEM_TYPE_ID,
TS as action_time
FROM action_statistics_service.materialize_stats_stream
)
SELECT ORG_ID, ITEM_ID, ITEM_TYPE_ID, action_time
FROM new_actions_by_item_type;
-- Populate by_policy table
INSERT INTO action_statistics_service.by_policy (org_id, item_id, item_type_id, policy_id, action_time)
WITH new_actions_by_policy AS (
SELECT
ORG_ID,
ITEM_ID,
ITEM_TYPE_ID,
policies.value:id as policy_id,
TS as action_time
FROM action_statistics_service.materialize_stats_stream,
LATERAL FLATTEN(input => materialize_stats_stream.POLICIES) policies
)
SELECT ORG_ID, ITEM_ID, ITEM_TYPE_ID, policy_id, action_time
FROM new_actions_by_policy;
-- Populate by_rule table
INSERT INTO action_statistics_service.by_rule (org_id, item_id, item_type_id, rule_id, action_time)
WITH new_actions_by_rule AS (
SELECT
ORG_ID,
ITEM_ID,
ITEM_TYPE_ID,
rules.value:id as rule_id,
TS as action_time
FROM action_statistics_service.materialize_stats_stream,
LATERAL FLATTEN(input => materialize_stats_stream.RULES) rules
)
SELECT ORG_ID, ITEM_ID, ITEM_TYPE_ID, rule_id, action_time
FROM new_actions_by_rule;
-- Populate by_action table
INSERT INTO action_statistics_service.by_action (org_id, item_id, item_type_id, action_id, action_time)
WITH new_actions_by_action AS (
SELECT
ORG_ID,
ITEM_ID,
ITEM_TYPE_ID,
ACTION_ID,
TS as action_time
FROM action_statistics_service.materialize_stats_stream
)
SELECT ORG_ID, ITEM_ID, ITEM_TYPE_ID, ACTION_ID, action_time
FROM new_actions_by_action;
-- Populate by_source table
INSERT INTO action_statistics_service.by_source (org_id, item_id, item_type_id, source, action_time)
WITH new_actions_by_action AS (
SELECT
ORG_ID,
ITEM_ID,
ITEM_TYPE_ID,
ACTION_SOURCE,
TS as action_time
FROM action_statistics_service.materialize_stats_stream
)
SELECT
ORG_ID,
ITEM_ID,
ITEM_TYPE_ID,
ACTION_SOURCE,
action_time
FROM new_actions_by_action;
COMMIT;
END;
';

create or replace stream ACTION_STATISTICS_SERVICE.MATERIALIZE_STATS_STREAM on table ACTION_EXECUTIONS append_only = true;

create or replace task ACTION_STATISTICS_SERVICE.MATERIALIZE_STATS_TASK
schedule='10 MINUTE'
error_integration=AWS_NOTIFICATION_INTEGRATION
when SYSTEM$STREAM_HAS_DATA('ACTION_STATISTICS_SERVICE.MATERIALIZE_STATS_STREAM')
as CALL ACTION_STATISTICS_SERVICE.MATERIALIZE_STATS();

-- ================================================================================
-- SCHEMA: MANUAL_REVIEW_TOOL
-- ================================================================================

create or replace schema MANUAL_REVIEW_TOOL;

create or replace TABLE MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS cluster by (ds, org_id, passed, rule_id, LOWER(SUBSTRING(item_id, 0, 3)))(
RULE VARCHAR(16777216) NOT NULL,
RULE_ID VARCHAR(16777216) NOT NULL,
RULE_VERSION TIMESTAMP_NTZ(9) NOT NULL,
DESTINATION_QUEUE_ID VARCHAR(16777216),
ORG_ID VARCHAR(16777216) NOT NULL,
CORRELATION_ID VARCHAR(16777216),
RESULT VARIANT,
PASSED BOOLEAN NOT NULL,
JOB_KIND VARCHAR(16777216) NOT NULL,
TS TIMESTAMP_NTZ(9) NOT NULL,
DS DATE NOT NULL,
ITEM_DATA VARCHAR(16777216),
ITEM_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_NAME VARCHAR(16777216),
ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
ITEM_CREATOR_ID VARCHAR(16777216),
ITEM_CREATOR_TYPE_ID VARCHAR(16777216),
ITEM_TYPE_SCHEMA VARCHAR(16777216),
ITEM_TYPE_SCHEMA_FIELD_ROLES OBJECT,
ITEM_TYPE_VERSION VARCHAR(16777216),
ITEM_TYPE_SCHEMA_VARIANT VARCHAR(16777216)
);

-- ================================================================================
-- SCHEMA: NCMEC_SERVICE
-- ================================================================================

create or replace schema NCMEC_SERVICE;

CREATE OR REPLACE PROCEDURE NCMEC_SERVICE.INGEST_NEW_ROWS()
RETURNS VARCHAR(16777216)
LANGUAGE SQL
EXECUTE AS OWNER
AS '
declare
unknown_table_exception exception;
begin
BEGIN TRANSACTION;
INSERT INTO ACTION_EXECUTIONS (
ORG_ID,
ACTION_ID,
ACTION_NAME,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
ITEM_SUBMISSION_ID,
ITEM_ID,
ITEM_TYPE_KIND,
ITEM_TYPE_ID,
RULES,
POLICIES,
RULE_TAGS,
RULE_ENVIRONMENT,
CORRELATION_ID,
TS,
DS)
SELECT
data:data:org_id::string,
data:data:action_id::string,
data:data:action_name::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:item_submission_id::string,
data:data:item_id::string,
data:data:item_type_kind::string,
data:data:item_type_id::string,
data:data:rules::array,
data:data:policies::array,
data:data:rule_tags::array,
data:data:rule_environment::string,
data:data:correlation_id::string,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''ACTION_EXECUTIONS'';
INSERT INTO RULE_EXECUTIONS (
ITEM_DATA,
ITEM_ID,
item_submission_id,
item_type_name,
item_type_id,
ITEM_TYPE_KIND,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_SCHEMA_VARIANT,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
RULE,
RULE_ID,
RULE_VERSION,
ORG_ID,
ENVIRONMENT,
CORRELATION_ID,
POLICY_IDS,
POLICY_NAMES,
TAGS,
RESULT,
PASSED,
TS,
DS)
SELECT
data:data:item_data::string,
data:data:item_id::string,
data:data:item_submission_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_kind::string,
data:data:item_type_version::string,
data:data:item_type_schema::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_schema_variant::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:rule::string,
data:data:rule_id::string,
data:data:rule_version::datetime,
data:data:org_id::string,
data:data:environment::string,
data:data:correlation_id::string,
data:data:policy_ids::array,
data:data:policy_names::array,
data:data:tags::array,
data:data:result::string,
data:data:passed::boolean,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''RULE_EXECUTIONS'';
INSERT INTO CONTENT_API_REQUESTS (
ORG_ID,
EVENT,
REQUEST_ID,
SUBMISSION_ID,
ITEM_DATA,
ITEM_ID,
ITEM_TYPE_NAME,
ITEM_TYPE_ID,
ITEM_TYPE_SCHEMA,
ITEM_TYPE_KIND,
ITEM_TYPE_SCHEMA_FIELD_ROLES,
ITEM_TYPE_VERSION,
ITEM_TYPE_SCHEMA_VARIANT,
ITEM_CREATOR_ID,
ITEM_CREATOR_TYPE_ID,
FAILURE_REASON,
TS,
DS)
SELECT
data:data:org_id::string,
data:data:event::string,
data:data:request_id::string,
data:data:submission_id::string,
data:data:item_data::string,
data:data:item_id::string,
data:data:item_type_name::string,
data:data:item_type_id::string,
data:data:item_type_schema::string,
data:data:item_type_kind::string,
data:data:item_type_schema_field_roles::object,
data:data:item_type_version::string,
data:data:item_type_schema_variant::string,
data:data:item_creator_id::string,
data:data:item_creator_type_id::string,
data:data:failure_reason::string,
to_timestamp(data:data:ts::number, 3),
ds
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''CONTENT_API_REQUESTS'';
INSERT INTO REPORTING_SERVICE.REPORTS (
ORG_ID,
REQUEST_ID,
REPORTER_USER_ID,
REPORTER_USER_ITEM_TYPE_ID,
REPORTER_KIND,
REPORTED_AT,
POLICY_ID,
REPORTED_FOR_REASON,
REPORTED_ITEM_DATA,
REPORTED_ITEM_ID,
REPORTED_ITEM_TYPE_ID,
REPORTED_ITEM_TYPE_KIND,
REPORTED_ITEM_TYPE_SCHEMA,
REPORTED_ITEM_TYPE_SCHEMA_FIELD_ROLES,
REPORTED_ITEM_TYPE_VERSION,
REPORTED_ITEM_TYPE_SCHEMA_VARIANT,
REPORTED_ITEM_THREAD,
ADDITIONAL_ITEMS,
TS
)
SELECT
data:data:org_id::string,
data:data:request_id::string,
data:data:reporter_user_id::string,
data:data:reporter_user_item_type_id::string,
data:data:reporter_kind::string,
TO_TIMESTAMP_NTZ(data:data:reported_at::string),
data:data:policy_id::string,
data:data:reported_for_reason::string,
data:data:reported_item_data::object,
data:data:reported_item_id::string,
data:data:reported_item_type_id::string,
data:data:reported_item_type_kind::string,
data:data:reported_item_type_schema::array,
data:data:reported_item_type_schema_field_roles::object,
data:data:reported_item_type_version::string,
data:data:reported_item_type_schema_variant::string,
data:data:reported_item_thread::array,
COALESCE(data:data:additional_items, [])::array,
TO_TIMESTAMP_NTZ(data:data:ts::string)
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''REPORTING_SERVICE.REPORTS'';
INSERT INTO NCMEC_SERVICE.NCMEC_JOBS (
ORG_ID,
REPORTED_ITEM_DATA,
REPORTED_ITEM_ID,
REPORTED_ITEM_TYPE_ID,
REPORTED_ITEM_TYPE_KIND,
REPORTED_ITEM_TYPE_SCHEMA,
REPORTED_ITEM_TYPE_SCHEMA_FIELD_ROLES,
REPORTED_ITEM_TYPE_VERSION,
REPORTED_ITEM_TYPE_SCHEMA_VARIANT,
REPORTED_ITEM_SUBMISSION_ID,
ENQUEUE_SOURCE,
REENQUEUED_FROM,
TS
)
SELECT
data:data:org_id::string,
data:data:reported_item_data::object,
data:data:reported_item_id::string,
data:data:reported_item_type_id::string,
data:data:reported_item_type_kind::string,
data:data:reported_item_type_schema::array,
data:data:reported_item_type_schema_field_roles::object,
data:data:reported_item_type_version::string,
data:data:reported_item_type_schema_variant::string,
data:data:reported_item_submission_id::string,
data:data:enqueue_source::string,
data:data:reenqueued_from::object,
TO_TIMESTAMP_NTZ(data:data:ts::string)
FROM ingested_json_to_tables new_rows
WHERE METADATA$ACTION = ''INSERT''
AND TARGET_TABLE = ''NCMEC_SERVICE.NCMEC_JOBS'';
COMMIT;
end;
';


-- ================================================================================
-- SCHEMA: REPORTING_SERVICE
-- ================================================================================

create or replace schema REPORTING_SERVICE;

create or replace TABLE REPORTING_SERVICE.APPEALS cluster by (TIME_SLICE(TS, 1, 'DAY'), org_id, appeal_id)(
ORG_ID VARCHAR(16777216) NOT NULL,
REQUEST_ID VARCHAR(16777216) NOT NULL,
APPEAL_ID VARCHAR(16777216) NOT NULL,
APPEALED_BY_USER_ID VARCHAR(16777216),
APPEALED_BY_USER_ITEM_TYPE_ID VARCHAR(16777216),
APPEALED_AT TIMESTAMP_NTZ(9) NOT NULL,
APPEAL_REASON VARCHAR(16777216),
ACTIONS_TAKEN ARRAY NOT NULL DEFAULT '[]',
ACTIONED_ITEM_DATA VARCHAR(16777216) NOT NULL,
ACTIONED_ITEM_ID VARCHAR(16777216) NOT NULL,
ACTIONED_ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
ACTIONED_ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
ACTIONED_ITEM_TYPE_SCHEMA VARCHAR(16777216) NOT NULL,
ACTIONED_ITEM_TYPE_SCHEMA_FIELD_ROLES OBJECT NOT NULL,
ACTIONED_ITEM_TYPE_VERSION VARCHAR(16777216) NOT NULL,
ACTIONED_ITEM_TYPE_SCHEMA_VARIANT VARCHAR(16777216) NOT NULL,
ADDITIONAL_ITEMS ARRAY NOT NULL DEFAULT '[]',
TS TIMESTAMP_NTZ(9) NOT NULL
);

create or replace TABLE REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS cluster by (ds, org_id, passed, rule_id, LOWER(SUBSTRING(item_id, 0, 3)))(
RULE_NAME VARCHAR(16777216) NOT NULL,
RULE_ID VARCHAR(16777216) NOT NULL,
RULE_VERSION TIMESTAMP_NTZ(9) NOT NULL,
RULE_ENVIRONMENT VARCHAR(16777216) NOT NULL,
ORG_ID VARCHAR(16777216) NOT NULL,
CORRELATION_ID VARCHAR(16777216) NOT NULL,
RESULT VARIANT NOT NULL,
PASSED BOOLEAN NOT NULL,
TS TIMESTAMP_NTZ(9) NOT NULL,
DS DATE NOT NULL,
POLICY_IDS ARRAY NOT NULL,
ITEM_DATA VARCHAR(16777216) NOT NULL,
ITEM_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_NAME VARCHAR(16777216) NOT NULL,
ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
ITEM_CREATOR_ID VARCHAR(16777216),
ITEM_CREATOR_TYPE_ID VARCHAR(16777216),
ITEM_TYPE_SCHEMA VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA_FIELD_ROLES OBJECT NOT NULL,
ITEM_TYPE_VERSION VARCHAR(16777216) NOT NULL,
ITEM_TYPE_SCHEMA_VARIANT VARCHAR(16777216) NOT NULL,
POLICY_NAMES ARRAY
);

create or replace TABLE REPORTING_SERVICE.REPORTING_RULE_EXECUTION_STATISTICS cluster by (ORG_ID, TIME_SLICE(TS_START_INCLUSIVE, 1, 'day'), RULE_ID)(
ORG_ID VARCHAR(16777216) NOT NULL,
RULE_ID VARCHAR(16777216) NOT NULL,
RULE_VERSION TIMESTAMP_NTZ(9) NOT NULL,
RULE_ENVIRONMENT VARCHAR(16777216),
RULE_POLICY_NAMES ARRAY,
RULE_POLICY_IDS ARRAY,
NUM_PASSES NUMBER(38,0) NOT NULL,
NUM_RUNS NUMBER(38,0) NOT NULL,
TS_START_INCLUSIVE TIMESTAMP_NTZ(9) NOT NULL,
TS_END_EXCLUSIVE TIMESTAMP_NTZ(9) NOT NULL
);

create or replace TABLE REPORTING_SERVICE.REPORTS cluster by (TIME_SLICE(TS, 1, 'DAY'), org_id, policy_id, reporter_user_id)(
ORG_ID VARCHAR(16777216) NOT NULL,
REQUEST_ID VARCHAR(16777216) NOT NULL,
REPORTER_USER_ID VARCHAR(16777216),
REPORTED_AT TIMESTAMP_NTZ(9) NOT NULL,
POLICY_ID VARCHAR(16777216),
REPORTED_FOR_REASON VARCHAR(16777216),
TS TIMESTAMP_NTZ(9) NOT NULL,
REPORTER_USER_ITEM_TYPE_ID VARCHAR(16777216),
REPORTER_KIND VARCHAR(16777216) NOT NULL,
REPORTED_ITEM_ID VARCHAR(16777216) NOT NULL,
REPORTED_ITEM_DATA OBJECT NOT NULL,
REPORTED_ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
REPORTED_ITEM_TYPE_KIND VARCHAR(16777216) NOT NULL,
REPORTED_ITEM_TYPE_SCHEMA ARRAY NOT NULL,
REPORTED_ITEM_TYPE_SCHEMA_FIELD_ROLES OBJECT NOT NULL,
REPORTED_ITEM_TYPE_SCHEMA_VARIANT VARCHAR(16777216) NOT NULL,
REPORTED_ITEM_TYPE_VERSION VARCHAR(16777216) NOT NULL,
REPORTED_ITEM_THREAD ARRAY,
ADDITIONAL_ITEMS ARRAY NOT NULL DEFAULT '[]',
REPORTED_ITEMS_IN_THREAD ARRAY
);

CREATE OR REPLACE FUNCTION REPORTING_SERVICE.REFORMAT_CONDITION_SIGNALS("V" VARIANT)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
IMMUTABLE
AS '
function reformatCondition(condition) {
if (condition.conditions) {
return {
...condition,
conditions: condition.conditions.map(it => reformatCondition(it)),
};
}
const { signal } = condition;
// conditions w/ no signals stay as-is.
if(!signal) {
return condition;
}
// conditions w/ a valid signal id stay as-is.
if(signal.id && signal.id[0] === "{") {
return condition;
}
condition.signal.id = JSON.stringify({ type: signal.type });
return condition;
}
return reformatCondition(V);
';

create or replace stream REPORTING_SERVICE.POPULATE_REPORTING_RULE_EXECUTION_STATISTICS_STREAM on table REPORTING_RULE_EXECUTIONS append_only = true;

create or replace task REPORTING_SERVICE.POPULATE_REPORTING_RULE_EXECUTION_STATISTICS
schedule='5 MINUTE'
when SYSTEM$STREAM_HAS_DATA('reporting_service.populate_reporting_rule_execution_statistics_stream')
as MERGE INTO reporting_service.reporting_rule_execution_statistics
USING (
SELECT
org_id,
rule_id,
rule_version,
rule_environment,
-- Every execution row for a (org_id, rule_id, rule_version) group should
-- have the same policy names + policy ids + tags, so we can pick any value.
-- This is safe because a change to any of these values in the app would
-- create a new rule version.
any_value(policy_names) as policy_names,
any_value(policy_ids) as policy_ids,
SUM(passed::number) as num_passes,
COUNT(*) as num_runs,
TIMESTAMP_NTZ_FROM_PARTS(year(ds), month(ds), day(ds), hour(ts), 0, 0) as ts_start
FROM reporting_service.populate_reporting_rule_execution_statistics_stream
WHERE METADATA$ACTION = 'INSERT'
GROUP BY org_id, rule_id, rule_version, rule_environment, ds, hour(ts)
) as executions
ON executions.ts_start = reporting_service.reporting_rule_execution_statistics.ts_start_inclusive
AND executions.rule_id = reporting_service.reporting_rule_execution_statistics.rule_id
AND executions.rule_version = reporting_service.reporting_rule_execution_statistics.rule_version
AND executions.rule_environment = reporting_service.reporting_rule_execution_statistics.rule_environment
WHEN MATCHED THEN
UPDATE
SET num_passes = (reporting_service.reporting_rule_execution_statistics.num_passes + executions.num_passes),
num_runs = (reporting_service.reporting_rule_execution_statistics.num_runs + executions.num_runs)
WHEN NOT MATCHED THEN
INSERT (
org_id,
rule_id,
rule_version,
rule_policy_names,
rule_policy_ids,
rule_environment,
num_passes,
num_runs,
ts_start_inclusive,
ts_end_exclusive)
VALUES (
executions.org_id,
executions.rule_id,
executions.rule_version,
executions.policy_names,
executions.policy_ids,
executions.rule_environment,
executions.num_passes,
executions.num_runs,
executions.ts_start,
timestampadd(hour, 1, executions.ts_start));

-- ================================================================================
-- SCHEMA: RULE_ANOMALY_DETECTION_SERVICE
-- ================================================================================

create or replace schema RULE_ANOMALY_DETECTION_SERVICE;

create or replace TABLE RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS (
ORG_ID VARCHAR(16777216),
RULE_ID VARCHAR(16777216),
RULE_VERSION TIMESTAMP_NTZ(9),
NUM_PASSES NUMBER(38,0),
PASSES_DISTINCT_USER_IDS ARRAY,
NUM_RUNS NUMBER(38,0),
TS_START_INCLUSIVE TIMESTAMP_NTZ(9),
TS_END_EXCLUSIVE TIMESTAMP_NTZ(9)
);

create or replace stream RULE_ANOMALY_DETECTION_SERVICE.RULE_STATS_STREAM on table RULE_EXECUTIONS append_only = true;

create or replace task RULE_ANOMALY_DETECTION_SERVICE.POPULATE_RULE_STATS
schedule='5 MINUTE'
error_integration=AWS_NOTIFICATION_INTEGRATION
when SYSTEM$STREAM_HAS_DATA('rule_anomaly_detection_service.rule_stats_stream')
as MERGE INTO rule_anomaly_detection_service.rule_execution_statistics
USING (
SELECT
org_id,
rule_id,
rule_version,
array_agg(
DISTINCT IFF(
passed AND
item_creator_id IS NOT NULL AND
item_creator_type_id IS NOT NULL,
OBJECT_CONSTRUCT(
'id', item_creator_id,
'typeId', item_creator_type_id),
NULL
)
) as passes_distinct_user_ids,
SUM(passed::number) as num_passes,
COUNT(*) as num_runs,
time_slice(ts, 1, 'hour') as ts_start
FROM rule_anomaly_detection_service.rule_stats_stream
-- we don't care about executions from before versioning existed,
-- which is beautiful.
WHERE rule_version IS NOT NULL
GROUP BY org_id, rule_id, rule_version, time_slice(ts, 1, 'hour')
) as executions
ON executions.ts_start = rule_execution_statistics.ts_start_inclusive
AND executions.rule_id = rule_execution_statistics.rule_id
AND executions.rule_version = rule_execution_statistics.rule_version
WHEN MATCHED THEN
UPDATE
SET num_passes = (rule_execution_statistics.num_passes + executions.num_passes),
num_runs = (rule_execution_statistics.num_runs + executions.num_runs),
passes_distinct_user_ids =
array_dcat(rule_execution_statistics.passes_distinct_user_ids, executions.passes_distinct_user_ids)
WHEN NOT MATCHED THEN
INSERT (
org_id,
rule_id,
rule_version,
num_passes,
num_runs,
passes_distinct_user_ids,
ts_start_inclusive,
ts_end_exclusive)
VALUES (
executions.org_id,
executions.rule_id,
executions.rule_version,
executions.num_passes,
executions.num_runs,
executions.passes_distinct_user_ids,
executions.ts_start,
timestampadd(hour, 1, executions.ts_start));

-- ================================================================================
-- SCHEMA: USER_STATISTICS_SERVICE
-- ================================================================================

create or replace schema USER_STATISTICS_SERVICE;

create or replace TABLE USER_STATISTICS_SERVICE.LIFETIME_ACTION_STATS (
ORG_ID VARCHAR(16777216) NOT NULL,
USER_ID VARCHAR(16777216) NOT NULL,
ACTION_ID VARCHAR(16777216) NOT NULL,
POLICY_ID VARCHAR(16777216),
ITEM_SUBMISSION_IDS ARRAY NOT NULL,
COUNT NUMBER(38,0),
USER_TYPE_ID VARCHAR(16777216) NOT NULL,
ACTOR_ID VARCHAR(16777216)
);

create or replace TABLE USER_STATISTICS_SERVICE.SUBMISSION_STATS cluster by (org_id, user_type_id, user_id, TIME_SLICE(ts_start_inclusive, 1, 'day'), item_type_id)(
ORG_ID VARCHAR(16777216) NOT NULL,
USER_ID VARCHAR(16777216) NOT NULL,
ITEM_TYPE_ID VARCHAR(16777216) NOT NULL,
NUM_SUBMISSIONS NUMBER(38,0) NOT NULL,
TS_START_INCLUSIVE TIMESTAMP_NTZ(9) NOT NULL,
TS_END_EXCLUSIVE TIMESTAMP_NTZ(9) NOT NULL,
USER_TYPE_ID VARCHAR(16777216)
);

create or replace TABLE USER_STATISTICS_SERVICE.USER_SCORES (
ORG_ID VARCHAR(16777216) NOT NULL,
USER_ID VARCHAR(16777216) NOT NULL,
SCORE FLOAT NOT NULL,
SCORE_DATE TIMESTAMP_NTZ(9) NOT NULL,
USER_TYPE_ID VARCHAR(16777216) NOT NULL,
primary key (ORG_ID, USER_ID, USER_TYPE_ID, SCORE_DATE)
);

create or replace stream USER_STATISTICS_SERVICE.NEW_ACTION_EXECUTIONS on table ACTION_EXECUTIONS append_only = true;

create or replace stream USER_STATISTICS_SERVICE.NEW_CONTENT_SUBMISSIONS on table CONTENT_API_REQUESTS append_only = true;

create or replace stream USER_STATISTICS_SERVICE.NEW_ITEM_SUBMISSIONS on table CONTENT_API_REQUESTS append_only = true;

create or replace stream USER_STATISTICS_SERVICE."SUBMISSION_STATS_CONSUMER_user_scores_updater_STREAM" on table SUBMISSION_STATS;

create or replace task USER_STATISTICS_SERVICE.POPULATE_LIFETIME_ACTION_STATS
schedule='5 MINUTE'
when SYSTEM$STREAM_HAS_DATA('user_statistics_service.new_action_executions')
as MERGE INTO user_statistics_service.lifetime_action_stats as stats
USING (
-- NB: have to group here because MERGE inserts are processed
-- sorta in parallel, so a MERGE can't insert the same set of
-- of values multiple times.
SELECT
ae.org_id,
CASE
WHEN ae.item_type_kind = 'CONTENT' OR ae.item_type_kind = 'THREAD' THEN ae.item_creator_id
WHEN ae.item_type_kind = 'USER' THEN ae.item_id
END as user_id,
CASE
WHEN ae.item_type_kind = 'CONTENT' OR ae.item_type_kind = 'THREAD' THEN ae.item_creator_type_id
WHEN ae.item_type_kind = 'USER' THEN ae.item_type_id
END as user_type_id,
ae.action_id,
policies.value:id::string as policy_id,
COUNT(*) as execution_count,
ae.actor_id,
array_agg(ae.item_submission_id) as item_submission_ids
FROM user_statistics_service.new_action_executions ae,
-- NB: OUTER captures action executions that weren't associated with any policy.
LATERAL flatten(input => ae.policies, OUTER => TRUE) policies
WHERE METADATA$ACTION = 'INSERT' AND user_id IS NOT NULL AND user_type_id IS NOT NULL AND LENGTH(user_id) > 0 AND user_id != 'unknown'
GROUP BY org_id, user_id, user_type_id, action_id, policy_id, actor_id) as actions
ON actions.org_id = stats.org_id
AND actions.user_id = stats.user_id
AND actions.user_type_id = stats.user_type_id
AND actions.action_id = stats.action_id
AND actions.actor_id = stats.actor_id
AND actions.policy_id IS NOT DISTINCT FROM stats.policy_id
WHEN MATCHED THEN
UPDATE
-- NB: this does not dedupe if the same action is run against the same
-- submission multiple times, but that's rare enough that we don't care.
SET count = count + actions.execution_count,
item_submission_ids = array_cat(
-- Workaround for https://community.snowflake.com/s/question/0D50Z00008aTEc0SAG/how-to-work-around-arraycat-throwing-an-error-with-a-null-param-in-a-merge-statement
coalesce(stats.item_submission_ids, array_construct()),
actions.item_submission_ids
)
WHEN NOT MATCHED THEN
INSERT (org_id, user_id, user_type_id, action_id, policy_id, count, item_submission_ids, actor_id)
VALUES (
actions.org_id,
actions.user_id,
actions.user_type_id,
actions.action_id,
actions.policy_id,
actions.execution_count,
actions.item_submission_ids,
actions.actor_id);

create or replace task USER_STATISTICS_SERVICE.POPULATE_SUBMISSION_STATS
schedule='5 MINUTE'
when SYSTEM$STREAM_HAS_DATA('user_statistics_service.new_item_submissions')
as MERGE INTO USER_STATISTICS_SERVICE.submission_stats as stats
USING (
SELECT
org_id,
item_creator_id,
item_creator_type_id,
item_type_id,
COUNT(*) as "count",
TIME_SLICE(ts, 5, 'MINUTE', 'START') as ts_start_inclusive,
TIME_SLICE(ts, 5, 'MINUTE', 'END') as ts_end_exclusive
FROM user_statistics_service.new_item_submissions
WHERE "EVENT" = 'REQUEST_SUCCEEDED' AND METADATA$ACTION = 'INSERT' AND item_creator_id IS NOT NULL AND item_creator_type_id IS NOT NULL
GROUP BY org_id, item_creator_id, item_creator_type_id, item_type_id, ts_start_inclusive, ts_end_exclusive) as submissions
ON submissions.org_id = stats.org_id
AND submissions.item_creator_id = stats.user_id
AND submissions.item_creator_type_id = stats.user_type_id
AND submissions.item_type_id = stats.item_type_id
AND submissions.ts_start_inclusive = stats.ts_start_inclusive
WHEN MATCHED THEN
UPDATE SET num_submissions = num_submissions + "count"
WHEN NOT MATCHED THEN
INSERT (org_id, user_id, user_type_id, item_type_id, num_submissions, ts_start_inclusive, ts_end_exclusive)
VALUES (
submissions.org_id,
submissions.item_creator_id,
submissions.item_creator_type_id,
submissions.item_type_id,
submissions."count",
submissions.ts_start_inclusive,
submissions.ts_end_exclusive);

