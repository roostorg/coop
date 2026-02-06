--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4 (Debian 15.4-2.pgdg120+1)
-- Dumped by pg_dump version 15.4 (Debian 15.4-2.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: jobs; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA jobs;


ALTER SCHEMA jobs OWNER TO postgres;

--
-- Name: manual_review_tool; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA manual_review_tool;


ALTER SCHEMA manual_review_tool OWNER TO postgres;

--
-- Name: models_service; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA models_service;


ALTER SCHEMA models_service OWNER TO postgres;

--
-- Name: ncmec_reporting; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA ncmec_reporting;


ALTER SCHEMA ncmec_reporting OWNER TO postgres;

--
-- Name: reporting_rules; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA reporting_rules;


ALTER SCHEMA reporting_rules OWNER TO postgres;

--
-- Name: signal_auth_service; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA signal_auth_service;


ALTER SCHEMA signal_auth_service OWNER TO postgres;

--
-- Name: signals_service; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA signals_service;


ALTER SCHEMA signals_service OWNER TO postgres;

--
-- Name: user_management_service; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA user_management_service;


ALTER SCHEMA user_management_service OWNER TO postgres;

--
-- Name: user_statistics_service; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA user_statistics_service;


ALTER SCHEMA user_statistics_service OWNER TO postgres;

--
-- Name: appeals_routing_rule_status; Type: TYPE; Schema: manual_review_tool; Owner: postgres
--

CREATE TYPE manual_review_tool.appeals_routing_rule_status AS ENUM (
    'LIVE'
);


ALTER TYPE manual_review_tool.appeals_routing_rule_status OWNER TO postgres;

--
-- Name: routing_rule_status; Type: TYPE; Schema: manual_review_tool; Owner: postgres
--

CREATE TYPE manual_review_tool.routing_rule_status AS ENUM (
    'LIVE'
);


ALTER TYPE manual_review_tool.routing_rule_status OWNER TO postgres;

--
-- Name: action_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.action_type AS ENUM (
    'CUSTOM_ACTION',
    'ENQUEUE_TO_MRT',
    'ENQUEUE_TO_NCMEC',
    'ENQUEUE_AUTHOR_TO_MRT',
    'REJECT_APPEAL',
    'ACCEPT_APPEAL'
);


ALTER TYPE public.action_type OWNER TO postgres;

--
-- Name: backtest_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.backtest_status AS ENUM (
    'RUNNING',
    'COMPLETE',
    'CANCELED'
);


ALTER TYPE public.backtest_status OWNER TO postgres;

--
-- Name: enum_conditions_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_conditions_type AS ENUM (
    'BASIC',
    'CUSTOM'
);


ALTER TYPE public.enum_conditions_type OWNER TO postgres;

--
-- Name: enum_jobs_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_jobs_status AS ENUM (
    'open',
    'closed'
);


ALTER TYPE public.enum_jobs_status OWNER TO postgres;

--
-- Name: enum_rule_alarm_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_rule_alarm_status AS ENUM (
    'ALARM',
    'OK',
    'INSUFFICIENT_DATA'
);


ALTER TYPE public.enum_rule_alarm_status OWNER TO postgres;

--
-- Name: enum_rules_condition_set_conjunction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_rules_condition_set_conjunction AS ENUM (
    'AND',
    'NONE',
    'OR',
    'XOR'
);


ALTER TYPE public.enum_rules_condition_set_conjunction OWNER TO postgres;

--
-- Name: enum_rules_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_rules_status AS ENUM (
    'BACKGROUND',
    'DEPRECATED',
    'DRAFT',
    'LIVE',
    'ARCHIVED'
);


ALTER TYPE public.enum_rules_status OWNER TO postgres;

--
-- Name: enum_signals_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_signals_type AS ENUM (
    'CUSTOM',
    'TEXT_MATCHING_CONTAINS_TEXT',
    'TEXT_MATCHING_NOT_CONTAINS_TEXT',
    'TEXT_MATCHING_CONTAINS_REGEX',
    'TEXT_MATCHING_NOT_CONTAINS_REGEX',
    'TEXT_SIMILARITY_SCORE',
    'IMAGE_EXACT_MATCH',
    'IMAGE_SIMILARITY_SCORE'
);


ALTER TYPE public.enum_signals_type OWNER TO postgres;

--
-- Name: item_type_kind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_type_kind AS ENUM (
    'CONTENT',
    'USER',
    'THREAD'
);


ALTER TYPE public.item_type_kind OWNER TO postgres;

--
-- Name: login_method_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.login_method_enum AS ENUM (
    'password',
    'saml'
);


ALTER TYPE public.login_method_enum OWNER TO postgres;

--
-- Name: model_family; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.model_family AS ENUM (
    'embedded-text-kernelized-svm-001',
    'EMBEDDED_IMAGE_KERNELIZED_SVM_001',
    'EMBEDDED_TEXT_AND_IMAGE_ENSEMBLE_KERNELIZED_SVMS_001',
    'GPT_4O_MINI_001'
);


ALTER TYPE public.model_family OWNER TO postgres;

--
-- Name: model_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.model_status AS ENUM (
    'READY_TO_TRAIN',
    'TRAINING',
    'FROZEN'
);


ALTER TYPE public.model_status OWNER TO postgres;

--
-- Name: ncmec_report_error_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ncmec_report_error_status AS ENUM (
    'RETRYABLE_ERROR',
    'PERMANENT_ERROR'
);


ALTER TYPE public.ncmec_report_error_status OWNER TO postgres;

--
-- Name: policy_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.policy_type AS ENUM (
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
    'FRAUD_AND_DECEPTION'
);


ALTER TYPE public.policy_type OWNER TO postgres;

--
-- Name: rule_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.rule_type AS ENUM (
    'CONTENT',
    'USER'
);


ALTER TYPE public.rule_type OWNER TO postgres;

--
-- Name: text_bank_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.text_bank_type AS ENUM (
    'STRING',
    'REGEX'
);


ALTER TYPE public.text_bank_type OWNER TO postgres;

--
-- Name: unknown_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.unknown_type AS ENUM (
    'EDGE_CASE',
    'NEEDS_CONTEXT'
);


ALTER TYPE public.unknown_type OWNER TO postgres;

--
-- Name: user_penalty_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_penalty_severity AS ENUM (
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH',
    'SEVERE'
);


ALTER TYPE public.user_penalty_severity OWNER TO postgres;

--
-- Name: reporting_rule_status; Type: TYPE; Schema: reporting_rules; Owner: postgres
--

CREATE TYPE reporting_rules.reporting_rule_status AS ENUM (
    'DRAFT',
    'BACKGROUND',
    'LIVE',
    'ARCHIVED'
);


ALTER TYPE reporting_rules.reporting_rule_status OWNER TO postgres;

--
-- Name: check_org_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_org_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.org_id <> (NEW.job_payload->>'orgId') THEN
        RAISE EXCEPTION 'org_id column must match org_id inside job_payload';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_org_id() OWNER TO postgres;

--
-- Name: inherit_user_strike_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.inherit_user_strike_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    parent_policy RECORD;
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        -- Fetch the parent policy
        SELECT *
        INTO parent_policy
        FROM policies
        WHERE id = NEW.parent_id;

        -- Check if the parent policy has appl set to true
        IF parent_policy.apply_user_strike_count_config_to_children = true THEN
            -- Set the child policy's user_strike_count to the parent's user_strike_count
            NEW.user_strike_count = parent_policy.user_strike_count;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.inherit_user_strike_count() OWNER TO postgres;

--
-- Name: update_action_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_action_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW action_versions;
  END;
$$;


ALTER FUNCTION public.update_action_versions_view() OWNER TO postgres;

--
-- Name: update_action_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_action_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_action_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_action_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_api_keys_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_api_keys_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_api_keys_updated_at() OWNER TO postgres;

--
-- Name: update_appeals_routing_rule_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_appeals_routing_rule_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW manual_review_tool.appeals_routing_rule_versions;
  END;
$$;


ALTER FUNCTION public.update_appeals_routing_rule_versions_view() OWNER TO postgres;

--
-- Name: update_appeals_routing_rule_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_appeals_routing_rule_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_appeals_routing_rule_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_appeals_routing_rule_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_content_type_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_content_type_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW content_type_versions;
  END;
$$;


ALTER FUNCTION public.update_content_type_versions_view() OWNER TO postgres;

--
-- Name: update_content_type_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_content_type_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_content_type_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_content_type_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_descendants_user_strike_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_descendants_user_strike_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    descendant RECORD;
BEGIN
    IF NEW.apply_user_strike_count_config_to_children = true THEN
        -- Recursively update all descendants
        FOR descendant IN
            WITH RECURSIVE descendants AS (
                SELECT id
                FROM policies
                WHERE parent_id = NEW.id
                UNION ALL
                SELECT p.id
                FROM policies p
                JOIN descendants d ON p.parent_id = d.id
            )
            SELECT id FROM descendants
        LOOP
            UPDATE policies
            SET user_strike_count = NEW.user_strike_count
            WHERE id = descendant.id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_descendants_user_strike_count() OWNER TO postgres;

--
-- Name: update_item_type_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_item_type_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW item_type_versions;
  END;
$$;


ALTER FUNCTION public.update_item_type_versions_view() OWNER TO postgres;

--
-- Name: update_item_type_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_item_type_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_item_type_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_item_type_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_policy_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_policy_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW policy_versions;
  END;
$$;


ALTER FUNCTION public.update_policy_versions_view() OWNER TO postgres;

--
-- Name: update_policy_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_policy_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_policy_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_policy_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_reporting_rule_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_reporting_rule_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW reporting_rules.reporting_rule_versions;
  END;
$$;


ALTER FUNCTION public.update_reporting_rule_versions_view() OWNER TO postgres;

--
-- Name: update_reporting_rule_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_reporting_rule_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_reporting_rule_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_reporting_rule_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_routing_rule_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_routing_rule_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW manual_review_tool.routing_rule_versions;
  END;
$$;


ALTER FUNCTION public.update_routing_rule_versions_view() OWNER TO postgres;

--
-- Name: update_routing_rule_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_routing_rule_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_routing_rule_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_routing_rule_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_rule_versions_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_rule_versions_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
  DECLARE
    value_of_has_run_setting text := current_setting('coop.rule_versions_view_refreshed_on_this_transaction', true);
  BEGIN
    -- NB: this refresh must _not_ be done `CONCURRENTLY`, as we want the view to
    -- be immediately consistent with the persisted rule definition, so that we
    -- don't end up with rows in snowflake that specify an old rule version but
    -- ran with a newer rule definition. The view changes so rarely that the
    -- overhead here should be fine.
    --
    -- NB: the current_setting call first returns null if the setting has never
    -- been accessed before. But, on subsequent calls -- even in different
    -- transactions, where it's the first call of that transaction -- it seems
    -- like the value returned is an empty string (not null).
    IF value_of_has_run_setting IS NULL OR value_of_has_run_setting <> 'true' THEN
      -- as a local, this variable will only last the length of the transaction.
      SET LOCAL coop.rule_versions_view_refreshed_on_this_transaction = 'true';
      REFRESH MATERIALIZED VIEW rule_versions;
    END IF;
  END;
$$;


ALTER FUNCTION public.update_rule_versions_view() OWNER TO postgres;

--
-- Name: update_rule_versions_view_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_rule_versions_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    PERFORM update_rule_versions_view();
    RETURN NULL;
  END;
$$;


ALTER FUNCTION public.update_rule_versions_view_trigger() OWNER TO postgres;

--
-- Name: update_signing_keys_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_signing_keys_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_signing_keys_updated_at() OWNER TO postgres;

--
-- Name: versioning(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.versioning() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  sys_period text;
  history_table text;
  manipulate jsonb;
  ignore_unchanged_values bool;
  commonColumns text[];
  time_stamp_to_use timestamptz := current_timestamp;
  range_lower timestamptz;
  transaction_info txid_snapshot;
  existing_range tstzrange;
  holder record;
  holder2 record;
  has_tracked_differences bool;
  has_tracked_differences_query text;
  name_col text;
BEGIN
  -- version 0.4.2

  IF TG_WHEN != 'BEFORE' OR TG_LEVEL != 'ROW' THEN
    RAISE TRIGGER_PROTOCOL_VIOLATED USING
    MESSAGE = 'function "versioning" must be fired BEFORE ROW';
  END IF;

  IF TG_OP != 'INSERT' AND TG_OP != 'UPDATE' AND TG_OP != 'DELETE' THEN
    RAISE TRIGGER_PROTOCOL_VIOLATED USING
    MESSAGE = 'function "versioning" must be fired for INSERT or UPDATE or DELETE';
  END IF;

  IF TG_NARGS not in (3,4) THEN
    RAISE INVALID_PARAMETER_VALUE USING
    MESSAGE = 'wrong number of parameters for function "versioning"',
    HINT = 'expected 3 or 4 parameters but got ' || TG_NARGS;
  END IF;

  sys_period := TG_ARGV[0];
  history_table := TG_ARGV[1];
  ignore_unchanged_values := TG_ARGV[3];

  -- check if sys_period exists on original table
  SELECT atttypid, attndims INTO holder FROM pg_attribute WHERE attrelid = TG_RELID AND attname = sys_period AND NOT attisdropped;
  IF NOT FOUND THEN
    RAISE 'column "%" of relation "%" does not exist', sys_period, TG_TABLE_NAME USING
    ERRCODE = 'undefined_column';
  END IF;
  IF holder.atttypid != to_regtype('tstzrange') THEN
    IF holder.attndims > 0 THEN
      RAISE 'system period column "%" of relation "%" is not a range but an array', sys_period, TG_TABLE_NAME USING
      ERRCODE = 'datatype_mismatch';
    END IF;

    SELECT rngsubtype INTO holder2 FROM pg_range WHERE rngtypid = holder.atttypid;
    IF FOUND THEN
      RAISE 'system period column "%" of relation "%" is not a range of timestamp with timezone but of type %', sys_period, TG_TABLE_NAME, format_type(holder2.rngsubtype, null) USING
      ERRCODE = 'datatype_mismatch';
    END IF;

    RAISE 'system period column "%" of relation "%" is not a range but type %', sys_period, TG_TABLE_NAME, format_type(holder.atttypid, null) USING
    ERRCODE = 'datatype_mismatch';
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    -- Ignore rows already modified in this transaction
    transaction_info := txid_current_snapshot();
    IF OLD.xmin::text >= (txid_snapshot_xmin(transaction_info) % (2^32)::bigint)::text
    AND OLD.xmin::text <= (txid_snapshot_xmax(transaction_info) % (2^32)::bigint)::text THEN
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END IF;

    IF to_regclass(history_table) IS NULL THEN
      RAISE 'relation "%" does not exist', history_table;
    END IF;

    -- check if history table has sys_period
    IF NOT EXISTS(SELECT * FROM pg_attribute WHERE attrelid = history_table::regclass AND attname = sys_period AND NOT attisdropped) THEN
      RAISE 'history relation "%" does not contain system period column "%"', history_table, sys_period USING
      HINT = 'history relation must contain system period column with the same name and data type as the versioned one';
    END IF;

    EXECUTE format('SELECT $1.%I', sys_period) USING OLD INTO existing_range;

    IF existing_range IS NULL THEN
      RAISE 'system period column "%" of relation "%" must not be null', sys_period, TG_TABLE_NAME USING
      ERRCODE = 'null_value_not_allowed';
    END IF;

    IF isempty(existing_range) OR NOT upper_inf(existing_range) THEN
      RAISE 'system period column "%" of relation "%" contains invalid value', sys_period, TG_TABLE_NAME USING
      ERRCODE = 'data_exception',
      DETAIL = 'valid ranges must be non-empty and unbounded on the high side';
    END IF;

    IF TG_ARGV[2] = 'true' THEN
      -- mitigate update conflicts
      range_lower := lower(existing_range);
      IF range_lower >= time_stamp_to_use THEN
        time_stamp_to_use := range_lower + interval '1 microseconds';
      END IF;
    END IF;

    WITH history AS
      (SELECT attname, atttypid
      FROM   pg_attribute
      WHERE  attrelid = history_table::regclass
      AND    attnum > 0
      AND    NOT attisdropped),
      main AS
      (SELECT attname, atttypid
      FROM   pg_attribute
      WHERE  attrelid = TG_RELID
      AND    attnum > 0
      AND    NOT attisdropped)
    SELECT
      history.attname AS history_name,
      main.attname AS main_name,
      history.atttypid AS history_type,
      main.atttypid AS main_type
    INTO holder
      FROM history
      INNER JOIN main
      ON history.attname = main.attname
    WHERE
      history.atttypid != main.atttypid;

    IF FOUND THEN
      RAISE 'column "%" of relation "%" is of type % but column "%" of history relation "%" is of type %',
        holder.main_name, TG_TABLE_NAME, format_type(holder.main_type, null), holder.history_name, history_table, format_type(holder.history_type, null)
      USING ERRCODE = 'datatype_mismatch';
    END IF;

    WITH history AS
      (SELECT attname
      FROM   pg_attribute
      WHERE  attrelid = history_table::regclass
      AND    attnum > 0
      AND    NOT attisdropped),
      main AS
      (SELECT attname
      FROM   pg_attribute
      WHERE  attrelid = TG_RELID
      AND    attnum > 0
      AND    NOT attisdropped)
    SELECT array_agg(quote_ident(history.attname)) INTO commonColumns
      FROM history
      INNER JOIN main
      ON history.attname = main.attname
      AND history.attname != sys_period;

    -- If we're trying to ignore unchanged values, see if we can bail immediately
    -- if NEW IS NOT DISTINCT FROM OLD, which should be faster than building,
    -- parsing, and executing a dynamic query. But, if there is some difference
    -- between NEW and OLD, do the more thorough check to see if the difference
    -- is on a column we're actually tracking.
    IF ignore_unchanged_values AND TG_OP = 'UPDATE' THEN
      IF NEW IS NOT DISTINCT FROM OLD OR array_length(commonColumns, 1) = 0 THEN
        RETURN OLD;
      ELSE
        has_tracked_differences_query := 'SELECT ';
        FOREACH name_col IN ARRAY commonColumns LOOP
          has_tracked_differences_query =
            has_tracked_differences_query ||
              '($1).' || name_col || ' IS DISTINCT FROM ($2).' || name_col ||
              ' OR ';
        END LOOP;
        -- Above loop is gonna leave a trailing OR, so remove make it
        -- syntactically valid by adding a trivially failing condition.
        has_tracked_differences_query = has_tracked_differences_query || '(1 = 0);';

        EXECUTE has_tracked_differences_query
          USING NEW, OLD
          INTO has_tracked_differences;

        IF NOT has_tracked_differences THEN
          -- Return NEW because there still are some changes that must be saved
          -- to the source table; they just don't need to go to the history table.
          RETURN NEW;
        END IF;
      END IF;
    END IF;

    EXECUTE ('INSERT INTO ' ||
      history_table ||
      '(' ||
      array_to_string(commonColumns , ',') ||
      ',' ||
      quote_ident(sys_period) ||
      ') VALUES ($1.' ||
      array_to_string(commonColumns, ',$1.') ||
      ',tstzrange($2, $3, ''[)''))')
       USING OLD, range_lower, time_stamp_to_use;
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
    manipulate := jsonb_set('{}'::jsonb, ('{' || sys_period || '}')::text[], to_jsonb(tstzrange(time_stamp_to_use, null, '[)')));

    RETURN jsonb_populate_record(NEW, manipulate);
  END IF;

  RETURN OLD;
END;
$_$;


ALTER FUNCTION public.versioning() OWNER TO postgres;

--
-- Name: jsonb_object_union(jsonb); Type: AGGREGATE; Schema: public; Owner: postgres
--

CREATE AGGREGATE public.jsonb_object_union(jsonb) (
    SFUNC = jsonb_concat,
    STYPE = jsonb,
    INITCOND = '{}'
);


ALTER AGGREGATE public.jsonb_object_union(jsonb) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: scheduled_jobs_info; Type: TABLE; Schema: jobs; Owner: postgres
--

CREATE TABLE jobs.scheduled_jobs_info (
    job_name character varying(255) NOT NULL,
    last_run timestamp with time zone NOT NULL
);


ALTER TABLE jobs.scheduled_jobs_info OWNER TO postgres;

--
-- Name: appeals_routing_rule_history; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.appeals_routing_rule_history (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status manual_review_tool.appeals_routing_rule_status NOT NULL,
    creator_id character varying(255) NOT NULL,
    condition_set jsonb NOT NULL,
    sequence_number integer NOT NULL,
    destination_queue_id character varying(255) NOT NULL,
    sys_period tstzrange NOT NULL
);


ALTER TABLE manual_review_tool.appeals_routing_rule_history OWNER TO postgres;

--
-- Name: appeals_routing_rules; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.appeals_routing_rules (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status manual_review_tool.appeals_routing_rule_status DEFAULT 'LIVE'::manual_review_tool.appeals_routing_rule_status NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    creator_id character varying(255) NOT NULL,
    condition_set jsonb NOT NULL,
    sequence_number integer NOT NULL,
    destination_queue_id character varying(255) NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL
);


ALTER TABLE manual_review_tool.appeals_routing_rules OWNER TO postgres;

--
-- Name: appeals_routing_rule_versions; Type: MATERIALIZED VIEW; Schema: manual_review_tool; Owner: postgres
--

CREATE MATERIALIZED VIEW manual_review_tool.appeals_routing_rule_versions AS
 WITH appeals_routing_rule_versions AS (
         SELECT appeals_routing_rules_1.id,
            appeals_routing_rules_1.name,
            appeals_routing_rules_1.org_id,
            appeals_routing_rules_1.description,
            appeals_routing_rules_1.status,
            appeals_routing_rules_1.creator_id,
            appeals_routing_rules_1.condition_set,
            appeals_routing_rules_1.sequence_number,
            appeals_routing_rules_1.destination_queue_id,
            appeals_routing_rules_1.sys_period
           FROM manual_review_tool.appeals_routing_rules appeals_routing_rules_1
        UNION ALL
         SELECT appeals_routing_rule_history.id,
            appeals_routing_rule_history.name,
            appeals_routing_rule_history.org_id,
            appeals_routing_rule_history.description,
            appeals_routing_rule_history.status,
            appeals_routing_rule_history.creator_id,
            appeals_routing_rule_history.condition_set,
            appeals_routing_rule_history.sequence_number,
            appeals_routing_rule_history.destination_queue_id,
            appeals_routing_rule_history.sys_period
           FROM manual_review_tool.appeals_routing_rule_history
        ), appeals_routing_rules AS (
         SELECT appeals_routing_rule_versions_1.id,
            max(lower(appeals_routing_rule_versions_1.sys_period)) AS max_period_start
           FROM appeals_routing_rule_versions appeals_routing_rule_versions_1
          GROUP BY appeals_routing_rule_versions_1.id
        )
 SELECT appeals_routing_rule_versions.id,
    appeals_routing_rule_versions.name,
    appeals_routing_rule_versions.org_id,
    appeals_routing_rule_versions.description,
    appeals_routing_rule_versions.status,
    appeals_routing_rule_versions.creator_id,
    appeals_routing_rule_versions.condition_set,
    appeals_routing_rule_versions.sequence_number,
    appeals_routing_rule_versions.destination_queue_id,
    lower(appeals_routing_rule_versions.sys_period) AS version,
    ((appeals_routing_rules.max_period_start = lower(appeals_routing_rule_versions.sys_period)) AND upper_inf(appeals_routing_rule_versions.sys_period)) AS is_current
   FROM (appeals_routing_rule_versions
     JOIN appeals_routing_rules ON (((appeals_routing_rules.id)::text = (appeals_routing_rule_versions.id)::text)))
  WITH DATA;


ALTER TABLE manual_review_tool.appeals_routing_rule_versions OWNER TO postgres;

--
-- Name: appeals_routing_rule_latest_versions; Type: VIEW; Schema: manual_review_tool; Owner: postgres
--

CREATE VIEW manual_review_tool.appeals_routing_rule_latest_versions AS
 SELECT appeals_routing_rule_versions.id AS appeals_routing_rule_id,
    to_char((appeals_routing_rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
   FROM manual_review_tool.appeals_routing_rule_versions
  WHERE (appeals_routing_rule_versions.is_current = true);


ALTER TABLE manual_review_tool.appeals_routing_rule_latest_versions OWNER TO postgres;

--
-- Name: appeals_routing_rules_to_item_types; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.appeals_routing_rules_to_item_types (
    item_type_id character varying(255) NOT NULL,
    appeals_routing_rule_id character varying(255) NOT NULL
);


ALTER TABLE manual_review_tool.appeals_routing_rules_to_item_types OWNER TO postgres;

--
-- Name: manual_review_decisions; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.manual_review_decisions (
    id uuid NOT NULL,
    job_payload jsonb NOT NULL,
    queue_id character varying(255) NOT NULL,
    reviewer_id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decision_components jsonb[] NOT NULL,
    related_actions jsonb[] DEFAULT ARRAY[]::jsonb[] NOT NULL,
    enqueue_source_info jsonb,
    item_created_at timestamp with time zone,
    decision_reason text
);
ALTER TABLE ONLY manual_review_tool.manual_review_decisions ALTER COLUMN created_at SET STATISTICS 1500;


ALTER TABLE manual_review_tool.manual_review_decisions OWNER TO postgres;

--
-- Name: dim_mrt_decisions; Type: VIEW; Schema: manual_review_tool; Owner: postgres
--

CREATE VIEW manual_review_tool.dim_mrt_decisions AS
 WITH decisions AS (
         SELECT manual_review_decisions.org_id,
            (dc.dc ->> 'type'::text) AS type,
            (action.value ->> 'id'::text) AS action_id,
            (policy.value ->> 'id'::text) AS policy_id,
            (((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) ->> 'itemId'::text) AS item_id,
            ((((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text) AS item_type_id,
            manual_review_decisions.queue_id,
            manual_review_decisions.reviewer_id,
            manual_review_decisions.created_at,
            (manual_review_decisions.job_payload ->> 'id'::text) AS job_id
           FROM manual_review_tool.manual_review_decisions,
            (LATERAL unnest(manual_review_decisions.decision_components) dc(dc)
             CROSS JOIN LATERAL jsonb_array_elements((dc.dc -> 'actions'::text)) action(value)),
            LATERAL jsonb_array_elements((dc.dc -> 'policies'::text)) policy(value)
          WHERE ((dc.dc ->> 'type'::text) = 'CUSTOM_ACTION'::text)
        UNION ALL
         SELECT manual_review_decisions.org_id,
            (dc.dc ->> 'type'::text) AS type,
            NULL::text AS action_id,
            NULL::text AS policy_id,
            (((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) ->> 'itemId'::text) AS item_id,
            ((((manual_review_decisions.job_payload -> 'payload'::text) -> 'item'::text) -> 'itemTypeIdentifier'::text) ->> 'id'::text) AS item_type_id,
            manual_review_decisions.queue_id,
            manual_review_decisions.reviewer_id,
            manual_review_decisions.created_at,
            (manual_review_decisions.job_payload ->> 'id'::text) AS job_id
           FROM manual_review_tool.manual_review_decisions,
            LATERAL unnest(manual_review_decisions.decision_components) dc(dc)
          WHERE ((dc.dc ->> 'type'::text) <> 'CUSTOM_ACTION'::text)
        UNION ALL
         SELECT DISTINCT manual_review_decisions.org_id,
            'RELATED_ACTION'::text AS type,
            action.value AS action_id,
            policy.value AS policy_id,
            item_id.value AS item_id,
            (unnested_data.unnested_data ->> 'itemTypeId'::text) AS item_type_id,
            manual_review_decisions.queue_id,
            manual_review_decisions.reviewer_id,
            manual_review_decisions.created_at,
            (manual_review_decisions.job_payload ->> 'id'::text) AS job_id
           FROM manual_review_tool.manual_review_decisions,
            LATERAL unnest(manual_review_decisions.related_actions) unnested_data(unnested_data),
            LATERAL jsonb_array_elements_text((unnested_data.unnested_data -> 'itemIds'::text)) item_id(value),
            LATERAL jsonb_array_elements_text((unnested_data.unnested_data -> 'actionIds'::text)) action(value),
            LATERAL jsonb_array_elements_text((unnested_data.unnested_data -> 'policyIds'::text)) policy(value)
        )
 SELECT DISTINCT decisions.org_id,
    decisions.item_id,
    decisions.action_id,
    decisions.policy_id,
    decisions.type,
    decisions.item_type_id,
    decisions.queue_id,
    decisions.reviewer_id,
    date(decisions.created_at) AS ds,
    decisions.job_id,
    decisions.created_at AS decided_at
   FROM decisions
  WHERE ((decisions.item_id IS NOT NULL) AND (decisions.item_type_id IS NOT NULL));


ALTER TABLE manual_review_tool.dim_mrt_decisions OWNER TO postgres;

--
-- Name: dim_mrt_decisions_materialized; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.dim_mrt_decisions_materialized (
    org_id character varying(255),
    item_id text,
    action_id text,
    policy_id text,
    type text,
    item_type_id text,
    queue_id character varying(255),
    reviewer_id character varying(255),
    ds date,
    job_id text,
    decided_at timestamp with time zone
);


ALTER TABLE manual_review_tool.dim_mrt_decisions_materialized OWNER TO postgres;

--
-- Name: job_creations; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.job_creations (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    queue_id character varying(255) NOT NULL,
    item_id character varying(255) NOT NULL,
    item_type_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    enqueue_source_info jsonb NOT NULL,
    policy_ids text[] DEFAULT ARRAY[]::text[] NOT NULL
);
ALTER TABLE ONLY manual_review_tool.job_creations ALTER COLUMN created_at SET STATISTICS 1500;


ALTER TABLE manual_review_tool.job_creations OWNER TO postgres;

--
-- Name: flattened_job_creations; Type: VIEW; Schema: manual_review_tool; Owner: postgres
--

CREATE VIEW manual_review_tool.flattened_job_creations AS
 SELECT job_creations.id,
    job_creations.org_id,
    job_creations.queue_id,
    job_creations.item_id,
    job_creations.item_type_id,
    job_creations.created_at,
    (job_creations.enqueue_source_info ->> 'kind'::text) AS source_kind,
    rule_id.value AS rule_id,
    policy_id.policy_id
   FROM ((manual_review_tool.job_creations
     LEFT JOIN LATERAL jsonb_array_elements_text((job_creations.enqueue_source_info -> 'rules'::text)) rule_id(value) ON (true))
     LEFT JOIN LATERAL unnest(job_creations.policy_ids) policy_id(policy_id) ON (true));


ALTER TABLE manual_review_tool.flattened_job_creations OWNER TO postgres;

--
-- Name: job_comments; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.job_comments (
    id character varying(255) NOT NULL,
    job_id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    author_id character varying(255) NOT NULL,
    comment_text text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE manual_review_tool.job_comments OWNER TO postgres;

--
-- Name: manual_review_hidden_item_fields; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.manual_review_hidden_item_fields (
    org_id character varying(255) NOT NULL,
    item_type_id character varying(255) NOT NULL,
    hidden_fields text[] DEFAULT ARRAY[]::text[] NOT NULL
);


ALTER TABLE manual_review_tool.manual_review_hidden_item_fields OWNER TO postgres;

--
-- Name: manual_review_queues; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.manual_review_queues (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id character varying(255) NOT NULL,
    is_default_queue boolean DEFAULT false NOT NULL,
    description character varying(255),
    is_appeals_queue boolean DEFAULT false NOT NULL,
    auto_close_jobs boolean DEFAULT false,
    CONSTRAINT manual_review_queues_description_check CHECK (((description)::text <> ''::text))
);


ALTER TABLE manual_review_tool.manual_review_queues OWNER TO postgres;

--
-- Name: manual_review_tool_settings; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.manual_review_tool_settings (
    org_id character varying(255) NOT NULL,
    requires_policy_for_decisions boolean DEFAULT false NOT NULL,
    mrt_requires_decision_reason boolean DEFAULT false NOT NULL,
    hide_skip_button_for_non_admins boolean DEFAULT false,
    ignore_callback_url character varying(255),
    preview_jobs_view_enabled boolean DEFAULT false NOT NULL
);


ALTER TABLE manual_review_tool.manual_review_tool_settings OWNER TO postgres;

--
-- Name: moderator_skips; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.moderator_skips (
    org_id character varying(255) NOT NULL,
    queue_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    job_id character varying(255) NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE manual_review_tool.moderator_skips OWNER TO postgres;

--
-- Name: queues_and_hidden_actions; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.queues_and_hidden_actions (
    queue_id character varying(255) NOT NULL,
    action_id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL
);


ALTER TABLE manual_review_tool.queues_and_hidden_actions OWNER TO postgres;

--
-- Name: routing_rule_history; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.routing_rule_history (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status manual_review_tool.routing_rule_status NOT NULL,
    creator_id character varying(255) NOT NULL,
    condition_set jsonb NOT NULL,
    sequence_number integer NOT NULL,
    destination_queue_id character varying(255) NOT NULL,
    sys_period tstzrange NOT NULL
);


ALTER TABLE manual_review_tool.routing_rule_history OWNER TO postgres;

--
-- Name: routing_rules; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.routing_rules (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status manual_review_tool.routing_rule_status DEFAULT 'LIVE'::manual_review_tool.routing_rule_status NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    creator_id character varying(255) NOT NULL,
    condition_set jsonb NOT NULL,
    sequence_number integer NOT NULL,
    destination_queue_id character varying(255) NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL
);


ALTER TABLE manual_review_tool.routing_rules OWNER TO postgres;

--
-- Name: routing_rule_versions; Type: MATERIALIZED VIEW; Schema: manual_review_tool; Owner: postgres
--

CREATE MATERIALIZED VIEW manual_review_tool.routing_rule_versions AS
 WITH routing_rule_versions AS (
         SELECT routing_rules.id,
            routing_rules.name,
            routing_rules.org_id,
            routing_rules.description,
            routing_rules.status,
            routing_rules.creator_id,
            routing_rules.condition_set,
            routing_rules.sequence_number,
            routing_rules.destination_queue_id,
            routing_rules.sys_period
           FROM manual_review_tool.routing_rules
        UNION ALL
         SELECT routing_rule_history.id,
            routing_rule_history.name,
            routing_rule_history.org_id,
            routing_rule_history.description,
            routing_rule_history.status,
            routing_rule_history.creator_id,
            routing_rule_history.condition_set,
            routing_rule_history.sequence_number,
            routing_rule_history.destination_queue_id,
            routing_rule_history.sys_period
           FROM manual_review_tool.routing_rule_history
        ), routing_rules_max_period_starts AS (
         SELECT routing_rule_versions_1.id,
            max(lower(routing_rule_versions_1.sys_period)) AS max_period_start
           FROM routing_rule_versions routing_rule_versions_1
          GROUP BY routing_rule_versions_1.id
        )
 SELECT routing_rule_versions.id,
    routing_rule_versions.name,
    routing_rule_versions.org_id,
    routing_rule_versions.description,
    routing_rule_versions.status,
    routing_rule_versions.creator_id,
    routing_rule_versions.condition_set,
    routing_rule_versions.sequence_number,
    routing_rule_versions.destination_queue_id,
    lower(routing_rule_versions.sys_period) AS version,
    ((routing_rules_max_period_starts.max_period_start = lower(routing_rule_versions.sys_period)) AND upper_inf(routing_rule_versions.sys_period)) AS is_current
   FROM (routing_rule_versions
     JOIN routing_rules_max_period_starts ON (((routing_rules_max_period_starts.id)::text = (routing_rule_versions.id)::text)))
  WITH DATA;


ALTER TABLE manual_review_tool.routing_rule_versions OWNER TO postgres;

--
-- Name: routing_rule_latest_versions; Type: VIEW; Schema: manual_review_tool; Owner: postgres
--

CREATE VIEW manual_review_tool.routing_rule_latest_versions AS
 SELECT routing_rule_versions.id AS routing_rule_id,
    to_char((routing_rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
   FROM manual_review_tool.routing_rule_versions
  WHERE (routing_rule_versions.is_current = true);


ALTER TABLE manual_review_tool.routing_rule_latest_versions OWNER TO postgres;

--
-- Name: routing_rules_to_item_types; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.routing_rules_to_item_types (
    item_type_id character varying(255) NOT NULL,
    routing_rule_id character varying(255) NOT NULL
);


ALTER TABLE manual_review_tool.routing_rules_to_item_types OWNER TO postgres;

--
-- Name: users_and_accessible_queues; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.users_and_accessible_queues (
    user_id character varying(255) NOT NULL,
    queue_id character varying(255) NOT NULL
);


ALTER TABLE manual_review_tool.users_and_accessible_queues OWNER TO postgres;

--
-- Name: users_and_favorite_mrt_queues; Type: TABLE; Schema: manual_review_tool; Owner: postgres
--

CREATE TABLE manual_review_tool.users_and_favorite_mrt_queues (
    user_id character varying(255) NOT NULL,
    queue_id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL
);


ALTER TABLE manual_review_tool.users_and_favorite_mrt_queues OWNER TO postgres;

--
-- Name: models; Type: TABLE; Schema: models_service; Owner: postgres
--

CREATE TABLE models_service.models (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    policy_id character varying NOT NULL,
    policy_semantic_version integer NOT NULL,
    status public.model_status NOT NULL,
    family public.model_family NOT NULL,
    version integer NOT NULL,
    item_requirement text,
    name character varying(100) NOT NULL
);


ALTER TABLE models_service.models OWNER TO postgres;

--
-- Name: org_to_partially_labeled_dataset; Type: TABLE; Schema: models_service; Owner: postgres
--

CREATE TABLE models_service.org_to_partially_labeled_dataset (
    org_id text NOT NULL,
    partially_labeled_dataset_id text NOT NULL
);


ALTER TABLE models_service.org_to_partially_labeled_dataset OWNER TO postgres;

--
-- Name: unknown_labeled_items; Type: TABLE; Schema: models_service; Owner: postgres
--

CREATE TABLE models_service.unknown_labeled_items (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    item_id character varying(255) NOT NULL,
    item_type_id character varying(255) NOT NULL,
    policy_id character varying(255) NOT NULL,
    policy_semantic_version integer NOT NULL,
    unknown_type public.unknown_type NOT NULL,
    sampling_strategy character varying(255) NOT NULL
);


ALTER TABLE models_service.unknown_labeled_items OWNER TO postgres;

--
-- Name: ncmec_org_settings; Type: TABLE; Schema: ncmec_reporting; Owner: postgres
--

CREATE TABLE ncmec_reporting.ncmec_org_settings (
    org_id character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    contact_email character varying(255),
    more_info_url character varying(255),
    company_template character varying(255),
    legal_url character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ncmec_preservation_endpoint character varying(255),
    ncmec_additional_info_endpoint character varying(255),
    policies_applied_to_actions_run_on_report_creation character varying(255)[],
    actions_to_run_upon_report_creation character varying(255)[],
    CONSTRAINT ncmec_org_settings_must_have_both_policy_and_actions_on_submiss CHECK ((((policies_applied_to_actions_run_on_report_creation IS NULL) AND (actions_to_run_upon_report_creation IS NULL)) OR ((policies_applied_to_actions_run_on_report_creation IS NOT NULL) AND (actions_to_run_upon_report_creation IS NOT NULL) AND (array_length(actions_to_run_upon_report_creation, 1) > 0) AND (array_length(policies_applied_to_actions_run_on_report_creation, 1) > 0))))
);


ALTER TABLE ncmec_reporting.ncmec_org_settings OWNER TO postgres;

--
-- Name: ncmec_reports; Type: TABLE; Schema: ncmec_reporting; Owner: postgres
--

CREATE TABLE ncmec_reporting.ncmec_reports (
    org_id character varying(255) NOT NULL,
    report_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_item_type_id character varying(255) NOT NULL,
    reported_media jsonb[] NOT NULL,
    report_xml xml NOT NULL,
    additional_files jsonb[],
    reviewer_id character varying(255),
    is_test boolean,
    reported_messages jsonb[],
    incident_type text,
    CONSTRAINT reported_media_check_non_empty CHECK ((array_length(reported_media, 1) > 0))
);


ALTER TABLE ncmec_reporting.ncmec_reports OWNER TO postgres;

--
-- Name: ncmec_reports_errors; Type: TABLE; Schema: ncmec_reporting; Owner: postgres
--

CREATE TABLE ncmec_reporting.ncmec_reports_errors (
    job_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    user_type_id character varying(255) NOT NULL,
    status public.ncmec_report_error_status NOT NULL,
    retry_count integer NOT NULL,
    last_error character varying NOT NULL
);


ALTER TABLE ncmec_reporting.ncmec_reports_errors OWNER TO postgres;

--
-- Name: actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actions (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    callback_url character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    org_id character varying(255) NOT NULL,
    callback_url_headers jsonb,
    callback_url_body jsonb,
    penalty public.user_penalty_severity DEFAULT 'NONE'::public.user_penalty_severity NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL,
    action_type public.action_type DEFAULT 'CUSTOM_ACTION'::public.action_type NOT NULL,
    applies_to_all_items_of_kind public.item_type_kind[] DEFAULT ARRAY[]::public.item_type_kind[] NOT NULL,
    apply_user_strikes boolean DEFAULT false NOT NULL,
    custom_mrt_api_params jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
    CONSTRAINT callback_url_check CHECK ((((action_type = 'CUSTOM_ACTION'::public.action_type) AND (callback_url IS NOT NULL)) OR ((action_type <> 'CUSTOM_ACTION'::public.action_type) AND (callback_url IS NULL)))),
    CONSTRAINT valid_callback_args CHECK ((((callback_url_body IS NULL) OR (jsonb_typeof(callback_url_body) = 'object'::text)) AND ((callback_url_headers IS NULL) OR (jsonb_typeof(callback_url_headers) = 'object'::text))))
);


ALTER TABLE public.actions OWNER TO postgres;

--
-- Name: actions_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actions_history (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    callback_url character varying(255),
    org_id character varying(255) NOT NULL,
    callback_url_headers jsonb,
    callback_url_body jsonb,
    penalty public.user_penalty_severity NOT NULL,
    sys_period tstzrange NOT NULL,
    action_type public.action_type DEFAULT 'CUSTOM_ACTION'::public.action_type NOT NULL,
    applies_to_all_items_of_kind public.item_type_kind[] DEFAULT ARRAY[]::public.item_type_kind[] NOT NULL
);


ALTER TABLE public.actions_history OWNER TO postgres;

--
-- Name: action_versions; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.action_versions AS
 WITH action_versions AS (
         SELECT actions.id,
            actions.name,
            actions.description,
            actions.callback_url,
            actions.org_id,
            actions.callback_url_headers,
            actions.callback_url_body,
            actions.penalty,
            actions.sys_period,
            actions.applies_to_all_items_of_kind
           FROM public.actions
        UNION ALL
         SELECT actions_history.id,
            actions_history.name,
            actions_history.description,
            actions_history.callback_url,
            actions_history.org_id,
            actions_history.callback_url_headers,
            actions_history.callback_url_body,
            actions_history.penalty,
            actions_history.sys_period,
            actions_history.applies_to_all_items_of_kind
           FROM public.actions_history
        ), action_max_period_starts AS (
         SELECT action_versions_1.id,
            max(lower(action_versions_1.sys_period)) AS max_period_start
           FROM action_versions action_versions_1
          GROUP BY action_versions_1.id
        )
 SELECT action_versions.id,
    action_versions.name,
    action_versions.description,
    action_versions.callback_url,
    action_versions.org_id,
    action_versions.callback_url_headers,
    action_versions.callback_url_body,
    action_versions.penalty,
    action_versions.applies_to_all_items_of_kind,
    lower(action_versions.sys_period) AS version,
    ((action_max_period_starts.max_period_start = lower(action_versions.sys_period)) AND upper_inf(action_versions.sys_period)) AS is_current
   FROM (action_versions
     JOIN action_max_period_starts ON (((action_max_period_starts.id)::text = (action_versions.id)::text)))
  WITH DATA;


ALTER TABLE public.action_versions OWNER TO postgres;

--
-- Name: action_latest_versions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.action_latest_versions AS
 SELECT action_versions.id AS action_id,
    to_char((action_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
   FROM public.action_versions
  WHERE (action_versions.is_current = true);


ALTER TABLE public.action_latest_versions OWNER TO postgres;

--
-- Name: actions_and_item_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actions_and_item_types (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    action_id character varying(255) NOT NULL,
    item_type_id character varying(255) NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL
);


ALTER TABLE public.actions_and_item_types OWNER TO postgres;

--
-- Name: actions_and_item_types_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actions_and_item_types_history (
    action_id character varying(255) NOT NULL,
    item_type_id character varying(255) NOT NULL,
    sys_period tstzrange NOT NULL
);


ALTER TABLE public.actions_and_item_types_history OWNER TO postgres;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id character varying(255) NOT NULL,
    key_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    created_by character varying(255)
);


ALTER TABLE public.api_keys OWNER TO postgres;

--
-- Name: backtests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backtests (
    id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    creator_id character varying(255) NOT NULL,
    sample_desired_size integer NOT NULL,
    sample_actual_size integer DEFAULT 0 NOT NULL,
    sample_start_at timestamp with time zone NOT NULL,
    sample_end_at timestamp with time zone NOT NULL,
    sampling_complete boolean DEFAULT false NOT NULL,
    content_items_processed integer DEFAULT 0 NOT NULL,
    content_items_matched integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    cancelation_date timestamp with time zone,
    status public.backtest_status GENERATED ALWAYS AS (
CASE
    WHEN (cancelation_date IS NOT NULL) THEN 'CANCELED'::public.backtest_status
    WHEN ((sampling_complete = false) OR (content_items_processed < sample_actual_size)) THEN 'RUNNING'::public.backtest_status
    ELSE 'COMPLETE'::public.backtest_status
END) STORED NOT NULL
);


ALTER TABLE public.backtests OWNER TO postgres;

--
-- Name: gdpr_delete_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gdpr_delete_requests (
    request_id uuid NOT NULL,
    org_id character varying(255) NOT NULL,
    item_id text NOT NULL,
    item_type_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fulfilled boolean DEFAULT false NOT NULL
);


ALTER TABLE public.gdpr_delete_requests OWNER TO postgres;

--
-- Name: invite_user_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invite_user_tokens (
    id integer NOT NULL,
    token character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id character varying(255)
);


ALTER TABLE public.invite_user_tokens OWNER TO postgres;

--
-- Name: invite_user_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invite_user_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invite_user_tokens_id_seq OWNER TO postgres;

--
-- Name: invite_user_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invite_user_tokens_id_seq OWNED BY public.invite_user_tokens.id;


--
-- Name: item_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_types (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    kind public.item_type_kind NOT NULL,
    fields jsonb[] NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    display_name_field character varying(255),
    creator_id_field character varying(255),
    thread_id_field character varying(255),
    parent_id_field character varying(255),
    created_at_field character varying(255),
    profile_icon_field character varying(255),
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL,
    is_default_user boolean DEFAULT false NOT NULL,
    background_image_field character varying(255),
    is_deleted_field character varying(255),
    CONSTRAINT item_type_field_roles CHECK ((((kind = 'CONTENT'::public.item_type_kind) AND (profile_icon_field IS NULL) AND (background_image_field IS NULL)) OR ((kind = 'THREAD'::public.item_type_kind) AND (thread_id_field IS NULL) AND (parent_id_field IS NULL) AND (profile_icon_field IS NULL) AND (background_image_field IS NULL)) OR ((kind = 'USER'::public.item_type_kind) AND (thread_id_field IS NULL) AND (parent_id_field IS NULL) AND (creator_id_field IS NULL)))),
    CONSTRAINT valid_default_user CHECK (((is_default_user = false) OR (kind = 'USER'::public.item_type_kind))),
    CONSTRAINT valid_field_role_field_type CHECK ((((profile_icon_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "IMAGE")'::jsonpath, jsonb_build_object('name', profile_icon_field))) AND ((background_image_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "IMAGE")'::jsonpath, jsonb_build_object('name', background_image_field))) AND ((parent_id_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "RELATED_ITEM")'::jsonpath, jsonb_build_object('name', parent_id_field))) AND ((thread_id_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "RELATED_ITEM")'::jsonpath, jsonb_build_object('name', thread_id_field))) AND ((creator_id_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "RELATED_ITEM")'::jsonpath, jsonb_build_object('name', creator_id_field))) AND ((display_name_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "STRING")'::jsonpath, jsonb_build_object('name', display_name_field))) AND ((is_deleted_field IS NULL) OR jsonb_path_exists((array_to_json(fields))::jsonb, '$[*]?(@."name" == $"name" && @."type" == "BOOLEAN")'::jsonpath, jsonb_build_object('name', is_deleted_field))))),
    CONSTRAINT validate_content_parent_field_dependencies CHECK (((parent_id_field IS NULL) OR ((created_at_field IS NOT NULL) AND (thread_id_field IS NOT NULL)))),
    CONSTRAINT validate_content_thread_field_dependencies CHECK (((thread_id_field IS NULL) OR (created_at_field IS NOT NULL))),
    CONSTRAINT validate_thread_field_roles CHECK ((((parent_id_field IS NULL) OR (thread_id_field IS NOT NULL)) AND ((thread_id_field IS NULL) OR (created_at_field IS NOT NULL))))
);


ALTER TABLE public.item_types OWNER TO postgres;

--
-- Name: item_types_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_types_history (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    kind public.item_type_kind NOT NULL,
    fields jsonb[] NOT NULL,
    display_name_field character varying(255),
    creator_id_field character varying(255),
    thread_id_field character varying(255),
    parent_id_field character varying(255),
    created_at_field character varying(255),
    profile_icon_field character varying(255),
    sys_period tstzrange NOT NULL,
    is_default_user boolean DEFAULT false NOT NULL,
    background_image_field character varying(255),
    is_deleted_field character varying(255)
);


ALTER TABLE public.item_types_history OWNER TO postgres;

--
-- Name: item_type_versions; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.item_type_versions AS
 WITH item_type_versions AS (
         SELECT item_types.id,
            item_types.name,
            item_types.description,
            item_types.fields,
            item_types.org_id,
            item_types.sys_period,
            item_types.kind,
            item_types.display_name_field,
            item_types.creator_id_field,
            item_types.thread_id_field,
            item_types.parent_id_field,
            item_types.created_at_field,
            item_types.is_deleted_field,
            item_types.profile_icon_field,
            item_types.background_image_field,
            item_types.is_default_user
           FROM public.item_types
        UNION ALL
         SELECT item_types_history.id,
            item_types_history.name,
            item_types_history.description,
            item_types_history.fields,
            item_types_history.org_id,
            item_types_history.sys_period,
            item_types_history.kind,
            item_types_history.display_name_field,
            item_types_history.creator_id_field,
            item_types_history.thread_id_field,
            item_types_history.parent_id_field,
            item_types_history.created_at_field,
            item_types_history.is_deleted_field,
            item_types_history.profile_icon_field,
            item_types_history.background_image_field,
            item_types_history.is_default_user
           FROM public.item_types_history
        ), item_type_max_period_starts AS (
         SELECT item_type_versions_1.id,
            max(lower(item_type_versions_1.sys_period)) AS max_period_start
           FROM item_type_versions item_type_versions_1
          GROUP BY item_type_versions_1.id
        )
 SELECT item_type_versions.id,
    item_type_versions.name,
    item_type_versions.description,
    item_type_versions.fields,
    item_type_versions.org_id,
    item_type_versions.kind,
    item_type_versions.display_name_field,
    item_type_versions.creator_id_field,
    item_type_versions.thread_id_field,
    item_type_versions.parent_id_field,
    item_type_versions.created_at_field,
    item_type_versions.is_deleted_field,
    item_type_versions.profile_icon_field,
    item_type_versions.background_image_field,
    item_type_versions.is_default_user,
    lower(item_type_versions.sys_period) AS version,
    ((item_type_max_period_starts.max_period_start = lower(item_type_versions.sys_period)) AND upper_inf(item_type_versions.sys_period)) AS is_current
   FROM (item_type_versions
     JOIN item_type_max_period_starts ON (((item_type_max_period_starts.id)::text = (item_type_versions.id)::text)))
  WITH DATA;


ALTER TABLE public.item_type_versions OWNER TO postgres;

--
-- Name: item_type_latest_versions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.item_type_latest_versions AS
 SELECT item_type_versions.id AS item_type_id,
    to_char((item_type_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
   FROM public.item_type_versions
  WHERE (item_type_versions.is_current = true);


ALTER TABLE public.item_type_latest_versions OWNER TO postgres;

--
-- Name: location_bank_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_bank_locations (
    id character varying(255) NOT NULL,
    bank_id character varying(255) NOT NULL,
    geometry jsonb NOT NULL,
    bounds jsonb,
    name character varying(255),
    google_place_info jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.location_bank_locations OWNER TO postgres;

--
-- Name: location_banks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_banks (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    org_id character varying(255) NOT NULL,
    owner_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    full_places_api_responses jsonb[] DEFAULT ARRAY[]::jsonb[] NOT NULL
);


ALTER TABLE public.location_banks OWNER TO postgres;

--
-- Name: media_banks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_banks (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    org_id character varying(255) NOT NULL,
    owner_id character varying(255) NOT NULL
);


ALTER TABLE public.media_banks OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id character varying(255) NOT NULL,
    "userId" character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    data jsonb NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "readAt" timestamp with time zone
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: org_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_settings (
    org_id character varying(255) NOT NULL,
    partial_items_endpoint character varying(255),
    has_reporting_rules_enabled boolean DEFAULT false,
    has_appeals_enabled boolean DEFAULT false,
    appeal_callback_url text,
    appeal_callback_headers jsonb,
    appeal_callback_body jsonb,
    allow_multiple_policies_per_action boolean DEFAULT false,
    user_strike_ttl_days integer DEFAULT 90,
    saml_enabled boolean DEFAULT false NOT NULL,
    sso_url character varying(255),
    cert text,
    is_demo_org boolean DEFAULT false NOT NULL,
    show_usage_statistics boolean DEFAULT false NOT NULL,
    partial_items_request_headers jsonb,
    CONSTRAINT saml_settings_constraint CHECK (((saml_enabled = false) OR ((saml_enabled = true) AND (sso_url IS NOT NULL) AND (cert IS NOT NULL))))
);


ALTER TABLE public.org_settings OWNER TO postgres;

--
-- Name: orgs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orgs (
    id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    website_url character varying(255) NOT NULL,
    api_key_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    on_call_alert_email character varying(255)
);


ALTER TABLE public.orgs OWNER TO postgres;

--
-- Name: policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policies (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    parent_id character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    penalty public.user_penalty_severity DEFAULT 'NONE'::public.user_penalty_severity NOT NULL,
    policy_text character varying,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL,
    policy_type public.policy_type,
    semantic_version integer DEFAULT 1 NOT NULL,
    enforcement_guidelines character varying,
    user_strike_count integer DEFAULT 1 NOT NULL,
    apply_user_strike_count_config_to_children boolean DEFAULT false NOT NULL
);


ALTER TABLE public.policies OWNER TO postgres;

--
-- Name: policy_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_history (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    parent_id character varying(255),
    penalty public.user_penalty_severity NOT NULL,
    policy_text character varying,
    sys_period tstzrange NOT NULL
);


ALTER TABLE public.policy_history OWNER TO postgres;

--
-- Name: policy_versions; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.policy_versions AS
 WITH policy_versions AS (
         SELECT policies.id,
            policies.name,
            policies.org_id,
            policies.parent_id,
            policies.penalty,
            policies.sys_period
           FROM public.policies
        UNION ALL
         SELECT policy_history.id,
            policy_history.name,
            policy_history.org_id,
            policy_history.parent_id,
            policy_history.penalty,
            policy_history.sys_period
           FROM public.policy_history
        ), policies_max_period_starts AS (
         SELECT policy_versions_1.id,
            max(lower(policy_versions_1.sys_period)) AS max_period_start
           FROM policy_versions policy_versions_1
          GROUP BY policy_versions_1.id
        )
 SELECT policy_versions.id,
    policy_versions.name,
    policy_versions.org_id,
    policy_versions.parent_id,
    policy_versions.penalty,
    lower(policy_versions.sys_period) AS version,
    ((policies_max_period_starts.max_period_start = lower(policy_versions.sys_period)) AND upper_inf(policy_versions.sys_period)) AS is_current
   FROM (policy_versions
     JOIN policies_max_period_starts ON (((policies_max_period_starts.id)::text = (policy_versions.id)::text)))
  WITH DATA;


ALTER TABLE public.policy_versions OWNER TO postgres;

--
-- Name: policy_latest_versions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.policy_latest_versions AS
 SELECT policy_versions.id AS policy_id,
    to_char((policy_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
   FROM public.policy_versions
  WHERE (policy_versions.is_current = true);


ALTER TABLE public.policy_latest_versions OWNER TO postgres;

--
-- Name: rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status_if_unexpired character varying(255) DEFAULT 'DRAFT'::character varying NOT NULL,
    tags character varying(255)[] DEFAULT (ARRAY[]::character varying[])::character varying(255)[] NOT NULL,
    max_daily_actions integer,
    daily_actions_run integer DEFAULT 0,
    last_action_date date,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    org_id character varying(255) NOT NULL,
    creator_id character varying(255) NOT NULL,
    expiration_time timestamp with time zone,
    condition_set jsonb NOT NULL,
    alarm_status public.enum_rule_alarm_status DEFAULT 'INSUFFICIENT_DATA'::public.enum_rule_alarm_status NOT NULL,
    alarm_status_set_at timestamp with time zone DEFAULT now() NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL,
    rule_type public.rule_type DEFAULT 'CONTENT'::public.rule_type NOT NULL,
    parent_id character varying(255),
    rate_limit_config jsonb
);


ALTER TABLE public.rules OWNER TO postgres;

--
-- Name: rules_and_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules_and_actions (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    action_id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL
);


ALTER TABLE public.rules_and_actions OWNER TO postgres;

--
-- Name: rules_and_actions_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules_and_actions_history (
    action_id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    sys_period tstzrange NOT NULL
);


ALTER TABLE public.rules_and_actions_history OWNER TO postgres;

--
-- Name: rules_and_item_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules_and_item_types (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    item_type_id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL
);


ALTER TABLE public.rules_and_item_types OWNER TO postgres;

--
-- Name: rules_and_item_types_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules_and_item_types_history (
    item_type_id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    sys_period tstzrange NOT NULL
);


ALTER TABLE public.rules_and_item_types_history OWNER TO postgres;

--
-- Name: rules_and_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules_and_policies (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    policy_id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL
);


ALTER TABLE public.rules_and_policies OWNER TO postgres;

--
-- Name: rules_and_policies_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules_and_policies_history (
    policy_id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    sys_period tstzrange NOT NULL
);


ALTER TABLE public.rules_and_policies_history OWNER TO postgres;

--
-- Name: rules_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rules_history (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    status_if_unexpired character varying(255) NOT NULL,
    tags character varying(255)[] NOT NULL,
    max_daily_actions integer,
    org_id character varying(255) NOT NULL,
    creator_id character varying(255) NOT NULL,
    expiration_time timestamp with time zone,
    condition_set jsonb NOT NULL,
    sys_period tstzrange NOT NULL,
    description character varying(255),
    rule_type public.rule_type DEFAULT 'CONTENT'::public.rule_type NOT NULL,
    parent_id character varying(255),
    rate_limit_config jsonb
);


ALTER TABLE public.rules_history OWNER TO postgres;

--
-- Name: rule_versions; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.rule_versions AS
 WITH action_association_versions AS (
         SELECT rules_and_actions.action_id,
            rules_and_actions.rule_id,
            rules_and_actions.sys_period
           FROM public.rules_and_actions
        UNION ALL
         SELECT rules_and_actions_history.action_id,
            rules_and_actions_history.rule_id,
            rules_and_actions_history.sys_period
           FROM public.rules_and_actions_history
        ), item_type_association_versions AS (
         SELECT rules_and_item_types.item_type_id,
            rules_and_item_types.rule_id,
            rules_and_item_types.sys_period
           FROM public.rules_and_item_types
        UNION ALL
         SELECT rules_and_item_types_history.item_type_id,
            rules_and_item_types_history.rule_id,
            rules_and_item_types_history.sys_period
           FROM public.rules_and_item_types_history
        ), policy_association_versions AS (
         SELECT rules_and_policies.policy_id,
            rules_and_policies.rule_id,
            rules_and_policies.sys_period
           FROM public.rules_and_policies
        UNION ALL
         SELECT rules_and_policies_history.policy_id,
            rules_and_policies_history.rule_id,
            rules_and_policies_history.sys_period
           FROM public.rules_and_policies_history
        ), rule_versions AS (
         SELECT rules.id,
            rules.name,
            rules.description,
            rules.status_if_unexpired,
            rules.tags,
            rules.max_daily_actions,
            rules.org_id,
            rules.creator_id,
            rules.expiration_time,
            rules.condition_set,
            rules.rule_type,
            rules.sys_period
           FROM public.rules
        UNION ALL
         SELECT rules_history.id,
            rules_history.name,
            rules_history.description,
            rules_history.status_if_unexpired,
            rules_history.tags,
            rules_history.max_daily_actions,
            rules_history.org_id,
            rules_history.creator_id,
            rules_history.expiration_time,
            rules_history.condition_set,
            rules_history.rule_type,
            rules_history.sys_period
           FROM public.rules_history
        ), rule_change_times AS (
         SELECT t.rule_id,
            unnest(t.change_times_with_duplicates) AS change_time
           FROM ( SELECT rule_versions_1.id AS rule_id,
                    array_remove(((((((array_agg(DISTINCT lower(rule_versions_1.sys_period)) || array_agg(DISTINCT lower(action_association_versions.sys_period))) || array_agg(DISTINCT upper(action_association_versions.sys_period))) || array_agg(DISTINCT lower(item_type_association_versions.sys_period))) || array_agg(DISTINCT upper(item_type_association_versions.sys_period))) || array_agg(DISTINCT lower(policy_association_versions.sys_period))) || array_agg(DISTINCT upper(policy_association_versions.sys_period))), NULL::timestamp with time zone) AS change_times_with_duplicates
                   FROM (((rule_versions rule_versions_1
                     LEFT JOIN action_association_versions ON (((rule_versions_1.id)::text = (action_association_versions.rule_id)::text)))
                     LEFT JOIN item_type_association_versions ON (((rule_versions_1.id)::text = (item_type_association_versions.rule_id)::text)))
                     LEFT JOIN policy_association_versions ON (((rule_versions_1.id)::text = (policy_association_versions.rule_id)::text)))
                  GROUP BY rule_versions_1.id) t
          GROUP BY t.rule_id, (unnest(t.change_times_with_duplicates))
        ), rule_max_change_times AS (
         SELECT rule_change_times_1.rule_id,
            max(rule_change_times_1.change_time) AS max_change_time
           FROM rule_change_times rule_change_times_1
          GROUP BY rule_change_times_1.rule_id
        )
 SELECT rule_versions.id,
    rule_versions.name,
    rule_versions.description,
    rule_versions.status_if_unexpired,
    rule_versions.tags,
    rule_versions.max_daily_actions,
    rule_versions.org_id,
    rule_versions.creator_id,
    rule_versions.expiration_time,
    rule_versions.rule_type,
    rule_versions.condition_set,
    ((rule_max_change_times.max_change_time = rule_change_times.change_time) AND upper_inf(rule_versions.sys_period)) AS is_current,
    ( SELECT COALESCE(array_agg(action_association_versions.action_id), '{}'::character varying[]) AS "coalesce"
           FROM action_association_versions
          WHERE (((action_association_versions.rule_id)::text = (rule_versions.id)::text) AND (action_association_versions.sys_period @> rule_change_times.change_time))) AS action_ids,
    ( SELECT COALESCE(array_agg(item_type_association_versions.item_type_id), '{}'::character varying[]) AS "coalesce"
           FROM item_type_association_versions
          WHERE (((item_type_association_versions.rule_id)::text = (rule_versions.id)::text) AND (item_type_association_versions.sys_period @> rule_change_times.change_time))) AS item_type_ids,
    ( SELECT COALESCE(array_agg(policy_association_versions.policy_id), '{}'::character varying[]) AS "coalesce"
           FROM policy_association_versions
          WHERE (((policy_association_versions.rule_id)::text = (rule_versions.id)::text) AND (policy_association_versions.sys_period @> rule_change_times.change_time))) AS policy_ids,
    rule_change_times.change_time AS version
   FROM ((rule_change_times
     JOIN rule_versions ON ((((rule_change_times.rule_id)::text = (rule_versions.id)::text) AND (rule_versions.sys_period @> rule_change_times.change_time))))
     JOIN rule_max_change_times ON (((rule_max_change_times.rule_id)::text = (rule_versions.id)::text)))
  ORDER BY rule_versions.id, rule_change_times.change_time
  WITH DATA;


ALTER TABLE public.rule_versions OWNER TO postgres;

--
-- Name: rules_latest_versions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.rules_latest_versions AS
 SELECT rule_versions.id AS rule_id,
    to_char((rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
   FROM public.rule_versions
  WHERE (rule_versions.is_current = true);


ALTER TABLE public.rules_latest_versions OWNER TO postgres;

--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: signing_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.signing_keys (
    org_id character varying(255) NOT NULL,
    key_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.signing_keys OWNER TO postgres;

--
-- Name: snowflake_outbox; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.snowflake_outbox (
    data text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.snowflake_outbox OWNER TO postgres;

--
-- Name: text_banks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.text_banks (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    org_id character varying(255) NOT NULL,
    owner_id character varying(255),
    type public.text_bank_type DEFAULT 'STRING'::public.text_bank_type NOT NULL,
    strings character varying(2000)[] DEFAULT (ARRAY[]::character varying[])::character varying(2000)[] NOT NULL
);


ALTER TABLE public.text_banks OWNER TO postgres;

--
-- Name: user_strike_thresholds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_strike_thresholds (
    id integer NOT NULL,
    org_id character varying(255) NOT NULL,
    threshold integer NOT NULL,
    actions character varying(255)[] DEFAULT (ARRAY[]::character varying[])::character varying(255)[] NOT NULL,
    CONSTRAINT user_strike_thresholds_threshold_check CHECK ((threshold > 0))
);


ALTER TABLE public.user_strike_thresholds OWNER TO postgres;

--
-- Name: user_strike_thresholds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.user_strike_thresholds ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_strike_thresholds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255),
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'ADMIN'::character varying NOT NULL,
    approved_by_admin boolean DEFAULT false,
    rejected_by_admin boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    org_id character varying(255) NOT NULL,
    login_methods public.login_method_enum[] DEFAULT ARRAY['password'::public.login_method_enum] NOT NULL,
    CONSTRAINT password_null_when_not_present CHECK ((((password IS NOT NULL) AND ('password'::public.login_method_enum = ANY (login_methods))) OR ((password IS NULL) AND (NOT ('password'::public.login_method_enum = ANY (login_methods))))))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_and_favorite_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users_and_favorite_rules (
    user_id character varying(255) NOT NULL,
    rule_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.users_and_favorite_rules OWNER TO postgres;

--
-- Name: view_maintenance_metadata; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.view_maintenance_metadata (
    table_name text NOT NULL,
    last_insert timestamp without time zone DEFAULT '-infinity'::timestamp without time zone NOT NULL
);


ALTER TABLE public.view_maintenance_metadata OWNER TO postgres;

--
-- Name: reporting_rule_history; Type: TABLE; Schema: reporting_rules; Owner: postgres
--

CREATE TABLE reporting_rules.reporting_rule_history (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status reporting_rules.reporting_rule_status NOT NULL,
    creator_id character varying(255) NOT NULL,
    condition_set jsonb NOT NULL,
    sys_period tstzrange NOT NULL
);


ALTER TABLE reporting_rules.reporting_rule_history OWNER TO postgres;

--
-- Name: reporting_rules; Type: TABLE; Schema: reporting_rules; Owner: postgres
--

CREATE TABLE reporting_rules.reporting_rules (
    id character varying(255) NOT NULL,
    org_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status reporting_rules.reporting_rule_status DEFAULT 'DRAFT'::reporting_rules.reporting_rule_status NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    creator_id character varying(255) NOT NULL,
    condition_set jsonb NOT NULL,
    sys_period tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL::timestamp with time zone) NOT NULL
);


ALTER TABLE reporting_rules.reporting_rules OWNER TO postgres;

--
-- Name: reporting_rule_versions; Type: MATERIALIZED VIEW; Schema: reporting_rules; Owner: postgres
--

CREATE MATERIALIZED VIEW reporting_rules.reporting_rule_versions AS
 WITH reporting_rule_versions AS (
         SELECT reporting_rules.id,
            reporting_rules.name,
            reporting_rules.org_id,
            reporting_rules.description,
            reporting_rules.status,
            reporting_rules.creator_id,
            reporting_rules.condition_set,
            reporting_rules.sys_period
           FROM reporting_rules.reporting_rules
        UNION ALL
         SELECT reporting_rule_history.id,
            reporting_rule_history.name,
            reporting_rule_history.org_id,
            reporting_rule_history.description,
            reporting_rule_history.status,
            reporting_rule_history.creator_id,
            reporting_rule_history.condition_set,
            reporting_rule_history.sys_period
           FROM reporting_rules.reporting_rule_history
        ), reporting_rules_max_period_starts AS (
         SELECT reporting_rule_versions_1.id,
            max(lower(reporting_rule_versions_1.sys_period)) AS max_period_start
           FROM reporting_rule_versions reporting_rule_versions_1
          GROUP BY reporting_rule_versions_1.id
        )
 SELECT reporting_rule_versions.id,
    reporting_rule_versions.name,
    reporting_rule_versions.org_id,
    reporting_rule_versions.description,
    reporting_rule_versions.status,
    reporting_rule_versions.creator_id,
    reporting_rule_versions.condition_set,
    lower(reporting_rule_versions.sys_period) AS version,
    ((reporting_rules_max_period_starts.max_period_start = lower(reporting_rule_versions.sys_period)) AND upper_inf(reporting_rule_versions.sys_period)) AS is_current
   FROM (reporting_rule_versions
     JOIN reporting_rules_max_period_starts ON (((reporting_rules_max_period_starts.id)::text = (reporting_rule_versions.id)::text)))
  WITH DATA;


ALTER TABLE reporting_rules.reporting_rule_versions OWNER TO postgres;

--
-- Name: reporting_rule_latest_versions; Type: VIEW; Schema: reporting_rules; Owner: postgres
--

CREATE VIEW reporting_rules.reporting_rule_latest_versions AS
 SELECT reporting_rule_versions.id AS reporting_rule_id,
    to_char((reporting_rule_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
   FROM reporting_rules.reporting_rule_versions
  WHERE (reporting_rule_versions.is_current = true);


ALTER TABLE reporting_rules.reporting_rule_latest_versions OWNER TO postgres;

--
-- Name: reporting_rules_to_actions; Type: TABLE; Schema: reporting_rules; Owner: postgres
--

CREATE TABLE reporting_rules.reporting_rules_to_actions (
    action_id character varying(255) NOT NULL,
    reporting_rule_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE reporting_rules.reporting_rules_to_actions OWNER TO postgres;

--
-- Name: reporting_rules_to_item_types; Type: TABLE; Schema: reporting_rules; Owner: postgres
--

CREATE TABLE reporting_rules.reporting_rules_to_item_types (
    item_type_id character varying(255) NOT NULL,
    reporting_rule_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE reporting_rules.reporting_rules_to_item_types OWNER TO postgres;

--
-- Name: reporting_rules_to_policies; Type: TABLE; Schema: reporting_rules; Owner: postgres
--

CREATE TABLE reporting_rules.reporting_rules_to_policies (
    policy_id character varying(255) NOT NULL,
    reporting_rule_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE reporting_rules.reporting_rules_to_policies OWNER TO postgres;


--
-- Name: open_ai_configs; Type: TABLE; Schema: signal_auth_service; Owner: postgres
--

CREATE TABLE signal_auth_service.open_ai_configs (
    org_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    api_key character varying(255) NOT NULL
);


ALTER TABLE signal_auth_service.open_ai_configs OWNER TO postgres;


--
-- Name: models_eligible_as_signals; Type: TABLE; Schema: signals_service; Owner: postgres
--

CREATE TABLE signals_service.models_eligible_as_signals (
    org_id character varying(255) NOT NULL,
    model_id character varying(255) NOT NULL,
    version integer NOT NULL
);


ALTER TABLE signals_service.models_eligible_as_signals OWNER TO postgres;

--
-- Name: org_default_user_interface_settings; Type: TABLE; Schema: user_management_service; Owner: postgres
--

CREATE TABLE user_management_service.org_default_user_interface_settings (
    org_id character varying(255) NOT NULL,
    moderator_safety_mute_video boolean DEFAULT true NOT NULL,
    moderator_safety_grayscale boolean DEFAULT true NOT NULL,
    moderator_safety_blur_level integer DEFAULT 2 NOT NULL
);


ALTER TABLE user_management_service.org_default_user_interface_settings OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: user_management_service; Owner: postgres
--

CREATE TABLE user_management_service.password_reset_tokens (
    hashed_token character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    org_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL
);


ALTER TABLE user_management_service.password_reset_tokens OWNER TO postgres;

--
-- Name: user_interface_settings; Type: TABLE; Schema: user_management_service; Owner: postgres
--

CREATE TABLE user_management_service.user_interface_settings (
    user_id character varying(255) NOT NULL,
    moderator_safety_mute_video boolean,
    moderator_safety_grayscale boolean,
    moderator_safety_blur_level integer,
    mrt_chart_configurations jsonb[]
);


ALTER TABLE user_management_service.user_interface_settings OWNER TO postgres;

--
-- Name: user_scores; Type: TABLE; Schema: user_statistics_service; Owner: postgres
--

CREATE TABLE user_statistics_service.user_scores (
    org_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    score double precision NOT NULL,
    user_type_id character varying(255) NOT NULL
);


ALTER TABLE user_statistics_service.user_scores OWNER TO postgres;

--
-- Name: invite_user_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_user_tokens ALTER COLUMN id SET DEFAULT nextval('public.invite_user_tokens_id_seq'::regclass);

--
-- Name: scheduled_jobs_info scheduled_jobs_info_pkey; Type: CONSTRAINT; Schema: jobs; Owner: postgres
--

ALTER TABLE ONLY jobs.scheduled_jobs_info
    ADD CONSTRAINT scheduled_jobs_info_pkey PRIMARY KEY (job_name);


--
-- Name: appeals_routing_rules appeals_routing_rules_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.appeals_routing_rules
    ADD CONSTRAINT appeals_routing_rules_pkey PRIMARY KEY (id);


--
-- Name: appeals_routing_rules_to_item_types appeals_routing_rules_to_item_types_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.appeals_routing_rules_to_item_types
    ADD CONSTRAINT appeals_routing_rules_to_item_types_pkey PRIMARY KEY (item_type_id, appeals_routing_rule_id);


--
-- Name: job_comments job_comments_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.job_comments
    ADD CONSTRAINT job_comments_pkey PRIMARY KEY (id);


--
-- Name: job_creations job_creations_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.job_creations
    ADD CONSTRAINT job_creations_pkey PRIMARY KEY (id);


--
-- Name: manual_review_decisions manual_review_decisions_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.manual_review_decisions
    ADD CONSTRAINT manual_review_decisions_pkey PRIMARY KEY (id);


--
-- Name: manual_review_hidden_item_fields manual_review_hidden_item_fields_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.manual_review_hidden_item_fields
    ADD CONSTRAINT manual_review_hidden_item_fields_pkey PRIMARY KEY (org_id, item_type_id);


--
-- Name: manual_review_queues manual_review_queues_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.manual_review_queues
    ADD CONSTRAINT manual_review_queues_pkey PRIMARY KEY (id);


--
-- Name: manual_review_tool_settings manual_review_tool_settings_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.manual_review_tool_settings
    ADD CONSTRAINT manual_review_tool_settings_pkey PRIMARY KEY (org_id);


--
-- Name: queues_and_hidden_actions queues_and_actions_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.queues_and_hidden_actions
    ADD CONSTRAINT queues_and_actions_pkey PRIMARY KEY (queue_id, action_id);


--
-- Name: routing_rules routing_rules_org_id_name_key; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.routing_rules
    ADD CONSTRAINT routing_rules_org_id_name_key UNIQUE (org_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: routing_rules routing_rules_org_id_sequence_number_key; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.routing_rules
    ADD CONSTRAINT routing_rules_org_id_sequence_number_key UNIQUE (org_id, sequence_number) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: routing_rules routing_rules_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.routing_rules
    ADD CONSTRAINT routing_rules_pkey PRIMARY KEY (id);


--
-- Name: routing_rules_to_item_types routing_rules_to_item_types_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.routing_rules_to_item_types
    ADD CONSTRAINT routing_rules_to_item_types_pkey PRIMARY KEY (item_type_id, routing_rule_id);


--
-- Name: users_and_accessible_queues user_to_accessible_queues_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.users_and_accessible_queues
    ADD CONSTRAINT user_to_accessible_queues_pkey PRIMARY KEY (user_id, queue_id);


--
-- Name: users_and_favorite_mrt_queues users_and_favorite_mrt_queues_pkey; Type: CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.users_and_favorite_mrt_queues
    ADD CONSTRAINT users_and_favorite_mrt_queues_pkey PRIMARY KEY (user_id, queue_id);


--
-- Name: models models_pkey; Type: CONSTRAINT; Schema: models_service; Owner: postgres
--

ALTER TABLE ONLY models_service.models
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);


--
-- Name: org_to_partially_labeled_dataset org_to_partially_labeled_dataset_pkey; Type: CONSTRAINT; Schema: models_service; Owner: postgres
--

ALTER TABLE ONLY models_service.org_to_partially_labeled_dataset
    ADD CONSTRAINT org_to_partially_labeled_dataset_pkey PRIMARY KEY (org_id, partially_labeled_dataset_id);


--
-- Name: models unique_org_name; Type: CONSTRAINT; Schema: models_service; Owner: postgres
--

ALTER TABLE ONLY models_service.models
    ADD CONSTRAINT unique_org_name UNIQUE (org_id, name);


--
-- Name: unknown_labeled_items unknown_labeled_items_pkey; Type: CONSTRAINT; Schema: models_service; Owner: postgres
--

ALTER TABLE ONLY models_service.unknown_labeled_items
    ADD CONSTRAINT unknown_labeled_items_pkey PRIMARY KEY (id);


--
-- Name: ncmec_org_settings ncmec_org_settings_pkey; Type: CONSTRAINT; Schema: ncmec_reporting; Owner: postgres
--

ALTER TABLE ONLY ncmec_reporting.ncmec_org_settings
    ADD CONSTRAINT ncmec_org_settings_pkey PRIMARY KEY (org_id);


--
-- Name: ncmec_reports_errors ncmec_reports_errors_pkey; Type: CONSTRAINT; Schema: ncmec_reporting; Owner: postgres
--

ALTER TABLE ONLY ncmec_reporting.ncmec_reports_errors
    ADD CONSTRAINT ncmec_reports_errors_pkey PRIMARY KEY (job_id);


--
-- Name: ncmec_reports ncmec_reports_pkey; Type: CONSTRAINT; Schema: ncmec_reporting; Owner: postgres
--

ALTER TABLE ONLY ncmec_reporting.ncmec_reports
    ADD CONSTRAINT ncmec_reports_pkey PRIMARY KEY (report_id);


--
-- Name: actions_and_item_types actions_and_item_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions_and_item_types
    ADD CONSTRAINT actions_and_item_types_pkey PRIMARY KEY (action_id, item_type_id);


--
-- Name: actions actions_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_org_id_name_key UNIQUE (org_id, name);


--
-- Name: actions actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: backtests backtests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtests
    ADD CONSTRAINT backtests_pkey PRIMARY KEY (id);


--
-- Name: invite_user_tokens invite_user_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_user_tokens
    ADD CONSTRAINT invite_user_tokens_pkey PRIMARY KEY (id);


--
-- Name: item_types item_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_types
    ADD CONSTRAINT item_types_pkey PRIMARY KEY (id);


--
-- Name: location_bank_locations location_bank_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_bank_locations
    ADD CONSTRAINT location_bank_locations_pkey PRIMARY KEY (id);


--
-- Name: location_banks location_banks_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_banks
    ADD CONSTRAINT location_banks_org_id_name_key UNIQUE (org_id, name);


--
-- Name: location_banks location_banks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_banks
    ADD CONSTRAINT location_banks_pkey PRIMARY KEY (id);


--
-- Name: media_banks media_banks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_banks
    ADD CONSTRAINT media_banks_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: item_types org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_types
    ADD CONSTRAINT org_id_name_key UNIQUE (org_id, name);


--
-- Name: org_settings org_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_pkey PRIMARY KEY (org_id);


--
-- Name: orgs orgs_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_email_key UNIQUE (email);


--
-- Name: orgs orgs_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_name_key UNIQUE (name);


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: orgs orgs_website_url_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_website_url_key UNIQUE (website_url);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


--
-- Name: rules_and_actions rules_and_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_actions
    ADD CONSTRAINT rules_and_actions_pkey PRIMARY KEY (action_id, rule_id);


--
-- Name: rules_and_item_types rules_and_item_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_item_types
    ADD CONSTRAINT rules_and_item_types_pkey PRIMARY KEY (rule_id, item_type_id);


--
-- Name: rules_and_policies rules_and_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_policies
    ADD CONSTRAINT rules_and_policies_pkey PRIMARY KEY (policy_id, rule_id);


--
-- Name: rules rules_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_org_id_name_key UNIQUE (org_id, name);


--
-- Name: rules rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: signing_keys signing_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_keys
    ADD CONSTRAINT signing_keys_pkey PRIMARY KEY (org_id);


--
-- Name: text_banks text_banks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.text_banks
    ADD CONSTRAINT text_banks_pkey PRIMARY KEY (id);


--
-- Name: user_strike_thresholds unique_org_threshold_pair; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_strike_thresholds
    ADD CONSTRAINT unique_org_threshold_pair UNIQUE (org_id, threshold);


--
-- Name: user_strike_thresholds user_strike_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_strike_thresholds
    ADD CONSTRAINT user_strike_thresholds_pkey PRIMARY KEY (id);


--
-- Name: users_and_favorite_rules users_and_favorite_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_and_favorite_rules
    ADD CONSTRAINT users_and_favorite_rules_pkey PRIMARY KEY (user_id, rule_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: view_maintenance_metadata view_maintenance_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.view_maintenance_metadata
    ADD CONSTRAINT view_maintenance_metadata_pkey PRIMARY KEY (table_name);


--
-- Name: reporting_rules reporting_rules_org_id_name_key; Type: CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules
    ADD CONSTRAINT reporting_rules_org_id_name_key UNIQUE (org_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: reporting_rules reporting_rules_pkey; Type: CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules
    ADD CONSTRAINT reporting_rules_pkey PRIMARY KEY (id);


--
-- Name: reporting_rules_to_actions reporting_rules_to_actions_pkey; Type: CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_actions
    ADD CONSTRAINT reporting_rules_to_actions_pkey PRIMARY KEY (action_id, reporting_rule_id);


--
-- Name: reporting_rules_to_item_types reporting_rules_to_item_types_pkey; Type: CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_item_types
    ADD CONSTRAINT reporting_rules_to_item_types_pkey PRIMARY KEY (item_type_id, reporting_rule_id);


--
-- Name: reporting_rules_to_policies reporting_rules_to_policies_pkey; Type: CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_policies
    ADD CONSTRAINT reporting_rules_to_policies_pkey PRIMARY KEY (policy_id, reporting_rule_id);



--
-- Name: open_ai_configs open_ai_configs_pkey; Type: CONSTRAINT; Schema: signal_auth_service; Owner: postgres
--

ALTER TABLE ONLY signal_auth_service.open_ai_configs
    ADD CONSTRAINT open_ai_configs_pkey PRIMARY KEY (org_id);


--
-- Name: models_eligible_as_signals models_eligible_as_signals_pkey; Type: CONSTRAINT; Schema: signals_service; Owner: postgres
--

ALTER TABLE ONLY signals_service.models_eligible_as_signals
    ADD CONSTRAINT models_eligible_as_signals_pkey PRIMARY KEY (model_id, version);


--
-- Name: org_default_user_interface_settings org_default_user_interface_settings_pkey; Type: CONSTRAINT; Schema: user_management_service; Owner: postgres
--

ALTER TABLE ONLY user_management_service.org_default_user_interface_settings
    ADD CONSTRAINT org_default_user_interface_settings_pkey PRIMARY KEY (org_id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: user_management_service; Owner: postgres
--

ALTER TABLE ONLY user_management_service.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (hashed_token);


--
-- Name: user_interface_settings user_interface_settings_pkey; Type: CONSTRAINT; Schema: user_management_service; Owner: postgres
--

ALTER TABLE ONLY user_management_service.user_interface_settings
    ADD CONSTRAINT user_interface_settings_pkey PRIMARY KEY (user_id);


--
-- Name: user_scores user_scores_pkey; Type: CONSTRAINT; Schema: user_statistics_service; Owner: postgres
--

ALTER TABLE ONLY user_statistics_service.user_scores
    ADD CONSTRAINT user_scores_pkey PRIMARY KEY (org_id, user_id, user_type_id);

--
-- Name: appeals_routing_rules_org_id_name_key; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE UNIQUE INDEX appeals_routing_rules_org_id_name_key ON manual_review_tool.appeals_routing_rules USING btree (org_id, name);


--
-- Name: appeals_routing_rules_org_id_sequence_number_key; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE UNIQUE INDEX appeals_routing_rules_org_id_sequence_number_key ON manual_review_tool.appeals_routing_rules USING btree (org_id, sequence_number);


--
-- Name: idx_decisions_job_payload_id; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX idx_decisions_job_payload_id ON manual_review_tool.manual_review_decisions USING btree (((job_payload ->> 'id'::text)));


--
-- Name: idx_job_item_id; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX idx_job_item_id ON manual_review_tool.manual_review_decisions USING btree (((((job_payload -> 'payload'::text) -> 'item'::text) ->> 'itemId'::text)));


--
-- Name: jobs_created_at_brin_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX jobs_created_at_brin_idx ON manual_review_tool.job_creations USING brin (created_at);


--
-- Name: manual_decisions_view_dec_at_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX manual_decisions_view_dec_at_idx ON manual_review_tool.dim_mrt_decisions_materialized USING btree (decided_at);


--
-- Name: manual_review_decisions_created_at_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX manual_review_decisions_created_at_idx ON manual_review_tool.manual_review_decisions USING btree (created_at);


--
-- Name: manual_review_decisions_org_id; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX manual_review_decisions_org_id ON manual_review_tool.manual_review_queues USING btree (org_id);


--
-- Name: manual_review_queue_is_default; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE UNIQUE INDEX manual_review_queue_is_default ON manual_review_tool.manual_review_queues USING btree (org_id, is_default_queue, is_appeals_queue) WHERE (is_default_queue = true);


--
-- Name: manual_review_queue_org_id; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX manual_review_queue_org_id ON manual_review_tool.manual_review_queues USING btree (org_id);


--
-- Name: manual_review_queue_unique_name; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE UNIQUE INDEX manual_review_queue_unique_name ON manual_review_tool.manual_review_queues USING btree (org_id, name, is_appeals_queue);


--
-- Name: manual_review_tool.appeals_routing_rule_versions_id_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX "manual_review_tool.appeals_routing_rule_versions_id_idx" ON manual_review_tool.appeals_routing_rule_versions USING btree (id);


--
-- Name: manual_review_tool.appeals_routing_rule_versions_id_is_current_; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE UNIQUE INDEX "manual_review_tool.appeals_routing_rule_versions_id_is_current_" ON manual_review_tool.appeals_routing_rule_versions USING btree (id, is_current) WHERE (is_current = true);


--
-- Name: manual_review_tool.appeals_routing_rule_versions_is_current_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX "manual_review_tool.appeals_routing_rule_versions_is_current_idx" ON manual_review_tool.appeals_routing_rule_versions USING btree (is_current);


--
-- Name: manual_review_tool.appeals_routing_rule_versions_version_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX "manual_review_tool.appeals_routing_rule_versions_version_idx" ON manual_review_tool.appeals_routing_rule_versions USING btree (version);


--
-- Name: manual_review_tool.routing_rule_versions_id_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX "manual_review_tool.routing_rule_versions_id_idx" ON manual_review_tool.routing_rule_versions USING btree (id);


--
-- Name: manual_review_tool.routing_rule_versions_id_is_current_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE UNIQUE INDEX "manual_review_tool.routing_rule_versions_id_is_current_idx" ON manual_review_tool.routing_rule_versions USING btree (id, is_current) WHERE (is_current = true);


--
-- Name: manual_review_tool.routing_rule_versions_is_current_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX "manual_review_tool.routing_rule_versions_is_current_idx" ON manual_review_tool.routing_rule_versions USING btree (is_current);


--
-- Name: manual_review_tool.routing_rule_versions_version_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX "manual_review_tool.routing_rule_versions_version_idx" ON manual_review_tool.routing_rule_versions USING btree (version);


--
-- Name: mrt_decisions_created_at_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX mrt_decisions_created_at_idx ON manual_review_tool.manual_review_decisions USING btree (created_at);


--
-- Name: mrt_decisions_org_id_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX mrt_decisions_org_id_idx ON manual_review_tool.manual_review_decisions USING btree (org_id);


--
-- Name: mrt_materialized_decisions_unique_row_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE UNIQUE INDEX mrt_materialized_decisions_unique_row_idx ON manual_review_tool.dim_mrt_decisions_materialized USING btree (COALESCE(job_id, ''::text), COALESCE(action_id, ''::text), COALESCE(policy_id, ''::text), COALESCE(type, ''::text), COALESCE(item_id, ''::text), COALESCE(item_type_id, ''::text));


--
-- Name: user_favorite_mrt_queues_idx; Type: INDEX; Schema: manual_review_tool; Owner: postgres
--

CREATE INDEX user_favorite_mrt_queues_idx ON manual_review_tool.users_and_favorite_mrt_queues USING btree (user_id);


--
-- Name: idx_user_type_org_test; Type: INDEX; Schema: ncmec_reporting; Owner: postgres
--

CREATE INDEX idx_user_type_org_test ON ncmec_reporting.ncmec_reports USING btree (user_id, user_item_type_id, org_id) WHERE (is_test = false);


--
-- Name: actions_unique_enqueue_to_mrt_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX actions_unique_enqueue_to_mrt_action_type ON public.actions USING btree (org_id, action_type) WHERE (action_type = 'ENQUEUE_TO_MRT'::public.action_type);


--
-- Name: idx_api_keys_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_active ON public.api_keys USING btree (org_id, is_active) WHERE (is_active = true);


--
-- Name: idx_api_keys_key_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_key_hash ON public.api_keys USING btree (key_hash);


--
-- Name: idx_api_keys_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_org_id ON public.api_keys USING btree (org_id);


--
-- Name: idx_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_expire ON public.session USING btree (expire);


--
-- Name: idx_signing_keys_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_signing_keys_org_id ON public.signing_keys USING btree (org_id);


--
-- Name: idx_unique_orgid_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_unique_orgid_name ON public.policies USING btree (org_id, name);


--
-- Name: item_type_versions_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX item_type_versions_id_idx ON public.item_type_versions USING btree (id);


--
-- Name: item_type_versions_id_is_current_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX item_type_versions_id_is_current_idx ON public.item_type_versions USING btree (id, is_current) WHERE (is_current = true);


--
-- Name: item_type_versions_is_current_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX item_type_versions_is_current_idx ON public.item_type_versions USING btree (is_current);


--
-- Name: item_type_versions_version_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX item_type_versions_version_idx ON public.item_type_versions USING btree (version);


--
-- Name: item_types_is_default_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX item_types_is_default_user ON public.item_types USING btree (org_id, is_default_user) WHERE (is_default_user = true);


--
-- Name: location_bank_locations_bank_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX location_bank_locations_bank_id_idx ON public.location_bank_locations USING btree (bank_id);


--
-- Name: policy_versions_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX policy_versions_id_idx ON public.policy_versions USING btree (id);


--
-- Name: policy_versions_id_is_current_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX policy_versions_id_is_current_idx ON public.policy_versions USING btree (id, is_current) WHERE (is_current = true);


--
-- Name: policy_versions_is_current_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX policy_versions_is_current_idx ON public.policy_versions USING btree (is_current);


--
-- Name: policy_versions_version_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX policy_versions_version_idx ON public.policy_versions USING btree (version);


--
-- Name: rule_versions_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rule_versions_id_idx ON public.rule_versions USING btree (id);


--
-- Name: rule_versions_id_is_current_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX rule_versions_id_is_current_idx ON public.rule_versions USING btree (id, is_current) WHERE (is_current = true);


--
-- Name: rule_versions_is_current_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rule_versions_is_current_idx ON public.rule_versions USING btree (is_current);


--
-- Name: rule_versions_version_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rule_versions_version_idx ON public.rule_versions USING btree (version);


--
-- Name: rules_and_actions_rule_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rules_and_actions_rule_id_idx ON public.rules_and_actions USING btree (rule_id);


--
-- Name: snowflake_outbox_content_api_requests_recorded_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX snowflake_outbox_content_api_requests_recorded_at_idx ON public.snowflake_outbox USING btree (recorded_at);


--
-- Name: user_favorite_rules_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_favorite_rules_idx ON public.users_and_favorite_rules USING btree (user_id);


--
-- Name: reporting_rules.reporting_rule_versions_id_idx; Type: INDEX; Schema: reporting_rules; Owner: postgres
--

CREATE INDEX "reporting_rules.reporting_rule_versions_id_idx" ON reporting_rules.reporting_rule_versions USING btree (id);


--
-- Name: reporting_rules.reporting_rule_versions_id_is_current_idx; Type: INDEX; Schema: reporting_rules; Owner: postgres
--

CREATE UNIQUE INDEX "reporting_rules.reporting_rule_versions_id_is_current_idx" ON reporting_rules.reporting_rule_versions USING btree (id, is_current) WHERE (is_current = true);


--
-- Name: reporting_rules.reporting_rule_versions_is_current_idx; Type: INDEX; Schema: reporting_rules; Owner: postgres
--

CREATE INDEX "reporting_rules.reporting_rule_versions_is_current_idx" ON reporting_rules.reporting_rule_versions USING btree (is_current);


--
-- Name: reporting_rules.reporting_rule_versions_version_idx; Type: INDEX; Schema: reporting_rules; Owner: postgres
--

CREATE INDEX "reporting_rules.reporting_rule_versions_version_idx" ON reporting_rules.reporting_rule_versions USING btree (version);


--
-- Name: manual_review_decisions tr_check_org_id; Type: TRIGGER; Schema: manual_review_tool; Owner: postgres
--

CREATE TRIGGER tr_check_org_id BEFORE INSERT OR UPDATE ON manual_review_tool.manual_review_decisions FOR EACH ROW EXECUTE FUNCTION public.check_org_id();


--
-- Name: appeals_routing_rules update_appeals_routing_rule_versions_view; Type: TRIGGER; Schema: manual_review_tool; Owner: postgres
--

CREATE TRIGGER update_appeals_routing_rule_versions_view AFTER INSERT OR DELETE OR UPDATE ON manual_review_tool.appeals_routing_rules FOR EACH STATEMENT EXECUTE FUNCTION public.update_appeals_routing_rule_versions_view_trigger();


--
-- Name: routing_rules update_appelas_routing_rule_versions_view; Type: TRIGGER; Schema: manual_review_tool; Owner: postgres
--

CREATE TRIGGER update_appelas_routing_rule_versions_view AFTER INSERT OR DELETE OR UPDATE ON manual_review_tool.routing_rules FOR EACH STATEMENT EXECUTE FUNCTION public.update_appeals_routing_rule_versions_view_trigger();


--
-- Name: routing_rules update_routing_rule_versions_view; Type: TRIGGER; Schema: manual_review_tool; Owner: postgres
--

CREATE TRIGGER update_routing_rule_versions_view AFTER INSERT OR DELETE OR UPDATE ON manual_review_tool.routing_rules FOR EACH STATEMENT EXECUTE FUNCTION public.update_routing_rule_versions_view_trigger();


--
-- Name: appeals_routing_rules versioning_trigger; Type: TRIGGER; Schema: manual_review_tool; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON manual_review_tool.appeals_routing_rules FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', '"manual_review_tool"."appeals_routing_rule_history"', 'true', 'true');


--
-- Name: routing_rules versioning_trigger; Type: TRIGGER; Schema: manual_review_tool; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON manual_review_tool.routing_rules FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', '"manual_review_tool"."routing_rule_history"', 'true', 'true');


--
-- Name: policies trg_inherit_user_strike_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inherit_user_strike_count BEFORE INSERT ON public.policies FOR EACH ROW EXECUTE FUNCTION public.inherit_user_strike_count();


--
-- Name: policies trg_update_user_strike_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_user_strike_count AFTER UPDATE OF apply_user_strike_count_config_to_children, user_strike_count ON public.policies FOR EACH ROW WHEN ((new.apply_user_strike_count_config_to_children = true)) EXECUTE FUNCTION public.update_descendants_user_strike_count();


--
-- Name: api_keys trigger_update_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_api_keys_updated_at();


--
-- Name: signing_keys trigger_update_signing_keys_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_signing_keys_updated_at BEFORE UPDATE ON public.signing_keys FOR EACH ROW EXECUTE FUNCTION public.update_signing_keys_updated_at();


--
-- Name: actions update_action_versions_view; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_action_versions_view AFTER INSERT OR DELETE OR UPDATE ON public.actions FOR EACH STATEMENT EXECUTE FUNCTION public.update_action_versions_view_trigger();


--
-- Name: item_types update_item_type_versions_view; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_item_type_versions_view AFTER INSERT OR DELETE OR UPDATE ON public.item_types FOR EACH STATEMENT EXECUTE FUNCTION public.update_item_type_versions_view_trigger();


--
-- Name: policies update_policy_versions_view; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_policy_versions_view AFTER INSERT OR DELETE OR UPDATE ON public.policies FOR EACH STATEMENT EXECUTE FUNCTION public.update_policy_versions_view_trigger();


--
-- Name: rules update_rule_versions_view; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rule_versions_view AFTER INSERT OR DELETE OR UPDATE OF id, name, status_if_unexpired, tags, max_daily_actions, org_id, creator_id, expiration_time, condition_set, sys_period ON public.rules FOR EACH STATEMENT EXECUTE FUNCTION public.update_rule_versions_view_trigger();


--
-- Name: rules_and_actions update_rule_versions_view; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rule_versions_view AFTER INSERT OR DELETE OR UPDATE ON public.rules_and_actions FOR EACH STATEMENT EXECUTE FUNCTION public.update_rule_versions_view_trigger();


--
-- Name: rules_and_policies update_rule_versions_view; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rule_versions_view AFTER INSERT OR DELETE OR UPDATE ON public.rules_and_policies FOR EACH STATEMENT EXECUTE FUNCTION public.update_rule_versions_view_trigger();


--
-- Name: actions versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'actions_history', 'true', 'true');


--
-- Name: actions_and_item_types versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.actions_and_item_types FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'actions_and_item_types_history', 'true');


--
-- Name: item_types versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.item_types FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'item_types_history', 'true', 'true');


--
-- Name: policies versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'policy_history', 'true', 'true');


--
-- Name: rules versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'rules_history', 'true', 'true');


--
-- Name: rules_and_actions versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.rules_and_actions FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'rules_and_actions_history', 'true', 'true');


--
-- Name: rules_and_item_types versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.rules_and_item_types FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'rules_and_item_types_history', 'true');


--
-- Name: rules_and_policies versioning_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.rules_and_policies FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', 'rules_and_policies_history', 'true', 'true');


--
-- Name: reporting_rules reporting_rules_versioning_trigger; Type: TRIGGER; Schema: reporting_rules; Owner: postgres
--

CREATE TRIGGER reporting_rules_versioning_trigger BEFORE INSERT OR DELETE OR UPDATE ON reporting_rules.reporting_rules FOR EACH ROW EXECUTE FUNCTION public.versioning('sys_period', '"reporting_rules"."reporting_rule_history"', 'true', 'true');


--
-- Name: reporting_rules update_reporting_rule_versions_view; Type: TRIGGER; Schema: reporting_rules; Owner: postgres
--

CREATE TRIGGER update_reporting_rule_versions_view AFTER INSERT OR DELETE OR UPDATE ON reporting_rules.reporting_rules FOR EACH STATEMENT EXECUTE FUNCTION public.update_reporting_rule_versions_view_trigger();


--
-- Name: appeals_routing_rules appeals_routing_rules_destination_queue_id_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.appeals_routing_rules
    ADD CONSTRAINT appeals_routing_rules_destination_queue_id_fkey FOREIGN KEY (destination_queue_id) REFERENCES manual_review_tool.manual_review_queues(id) ON DELETE CASCADE;


--
-- Name: appeals_routing_rules_to_item_types appeals_routing_rules_to_item_type_appeals_routing_rule_id_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.appeals_routing_rules_to_item_types
    ADD CONSTRAINT appeals_routing_rules_to_item_type_appeals_routing_rule_id_fkey FOREIGN KEY (appeals_routing_rule_id) REFERENCES manual_review_tool.appeals_routing_rules(id) ON DELETE CASCADE;


--
-- Name: moderator_skips moderator_skips_queue_id_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.moderator_skips
    ADD CONSTRAINT moderator_skips_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES manual_review_tool.manual_review_queues(id) ON DELETE CASCADE;


--
-- Name: queues_and_hidden_actions queue_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.queues_and_hidden_actions
    ADD CONSTRAINT queue_fkey FOREIGN KEY (queue_id) REFERENCES manual_review_tool.manual_review_queues(id) ON DELETE CASCADE;


--
-- Name: routing_rules routing_rules_destination_queue_id_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.routing_rules
    ADD CONSTRAINT routing_rules_destination_queue_id_fkey FOREIGN KEY (destination_queue_id) REFERENCES manual_review_tool.manual_review_queues(id) ON DELETE CASCADE;


--
-- Name: routing_rules_to_item_types routing_rules_to_item_types_routing_rule_id_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.routing_rules_to_item_types
    ADD CONSTRAINT routing_rules_to_item_types_routing_rule_id_fkey FOREIGN KEY (routing_rule_id) REFERENCES manual_review_tool.routing_rules(id) ON DELETE CASCADE;


--
-- Name: users_and_accessible_queues users_and_accessible_queues_queue_id_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.users_and_accessible_queues
    ADD CONSTRAINT users_and_accessible_queues_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES manual_review_tool.manual_review_queues(id) ON DELETE CASCADE;


--
-- Name: users_and_favorite_mrt_queues users_and_favorite_mrt_queues_queue_id_fkey; Type: FK CONSTRAINT; Schema: manual_review_tool; Owner: postgres
--

ALTER TABLE ONLY manual_review_tool.users_and_favorite_mrt_queues
    ADD CONSTRAINT users_and_favorite_mrt_queues_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES manual_review_tool.manual_review_queues(id) ON DELETE CASCADE;


--
-- Name: actions_and_item_types actions_and_item_types_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions_and_item_types
    ADD CONSTRAINT actions_and_item_types_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.actions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: actions_and_item_types actions_and_item_types_item_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions_and_item_types
    ADD CONSTRAINT actions_and_item_types_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES public.item_types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: actions actions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: api_keys api_keys_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: backtests backtests_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtests
    ADD CONSTRAINT backtests_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);


--
-- Name: backtests backtests_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtests
    ADD CONSTRAINT backtests_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rules(id);


--
-- Name: invite_user_tokens invite_user_tokens_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_user_tokens
    ADD CONSTRAINT invite_user_tokens_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: item_types item_types_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_types
    ADD CONSTRAINT item_types_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: location_bank_locations location_bank_locations_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_bank_locations
    ADD CONSTRAINT location_bank_locations_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.location_banks(id) ON DELETE CASCADE;


--
-- Name: location_banks location_banks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_banks
    ADD CONSTRAINT location_banks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id);


--
-- Name: location_banks location_banks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_banks
    ADD CONSTRAINT location_banks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: media_banks media_banks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_banks
    ADD CONSTRAINT media_banks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: media_banks media_banks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_banks
    ADD CONSTRAINT media_banks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: policies policies_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: policies policies_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.policies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rules_and_actions rules_and_actions_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_actions
    ADD CONSTRAINT rules_and_actions_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.actions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rules_and_actions rules_and_actions_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_actions
    ADD CONSTRAINT rules_and_actions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rules_and_item_types rules_and_item_types_item_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_item_types
    ADD CONSTRAINT rules_and_item_types_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES public.item_types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rules_and_item_types rules_and_item_types_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_item_types
    ADD CONSTRAINT rules_and_item_types_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rules_and_policies rules_and_policies_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_policies
    ADD CONSTRAINT rules_and_policies_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rules_and_policies rules_and_policies_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules_and_policies
    ADD CONSTRAINT rules_and_policies_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rules rules_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: rules rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: signing_keys signing_keys_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_keys
    ADD CONSTRAINT signing_keys_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: text_banks text_banks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.text_banks
    ADD CONSTRAINT text_banks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: text_banks text_banks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.text_banks
    ADD CONSTRAINT text_banks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_strike_thresholds user_strike_thresholds_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_strike_thresholds
    ADD CONSTRAINT user_strike_thresholds_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: users_and_favorite_rules users_and_favorite_rules_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_and_favorite_rules
    ADD CONSTRAINT users_and_favorite_rules_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rules(id);


--
-- Name: users_and_favorite_rules users_and_favorite_rules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_and_favorite_rules
    ADD CONSTRAINT users_and_favorite_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: reporting_rules_to_actions reporting_rules_to_actions_fkey; Type: FK CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_actions
    ADD CONSTRAINT reporting_rules_to_actions_fkey FOREIGN KEY (reporting_rule_id) REFERENCES reporting_rules.reporting_rules(id) ON DELETE CASCADE;


--
-- Name: reporting_rules_to_actions reporting_rules_to_actions_reporting_rule_id_fkey; Type: FK CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_actions
    ADD CONSTRAINT reporting_rules_to_actions_reporting_rule_id_fkey FOREIGN KEY (reporting_rule_id) REFERENCES reporting_rules.reporting_rules(id);


--
-- Name: reporting_rules_to_item_types reporting_rules_to_item_types_fkey; Type: FK CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_item_types
    ADD CONSTRAINT reporting_rules_to_item_types_fkey FOREIGN KEY (reporting_rule_id) REFERENCES reporting_rules.reporting_rules(id) ON DELETE CASCADE;


--
-- Name: reporting_rules_to_item_types reporting_rules_to_item_types_reporting_rule_id_fkey; Type: FK CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_item_types
    ADD CONSTRAINT reporting_rules_to_item_types_reporting_rule_id_fkey FOREIGN KEY (reporting_rule_id) REFERENCES reporting_rules.reporting_rules(id);


--
-- Name: reporting_rules_to_policies reporting_rules_to_policies_fkey; Type: FK CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_policies
    ADD CONSTRAINT reporting_rules_to_policies_fkey FOREIGN KEY (reporting_rule_id) REFERENCES reporting_rules.reporting_rules(id) ON DELETE CASCADE;


--
-- Name: reporting_rules_to_policies reporting_rules_to_policies_reporting_rule_id_fkey; Type: FK CONSTRAINT; Schema: reporting_rules; Owner: postgres
--

ALTER TABLE ONLY reporting_rules.reporting_rules_to_policies
    ADD CONSTRAINT reporting_rules_to_policies_reporting_rule_id_fkey FOREIGN KEY (reporting_rule_id) REFERENCES reporting_rules.reporting_rules(id);


--
-- Name: open_ai_configs open_ai_configs_org_id_fkey; Type: FK CONSTRAINT; Schema: signal_auth_service; Owner: postgres
--

ALTER TABLE ONLY signal_auth_service.open_ai_configs
    ADD CONSTRAINT open_ai_configs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;



--
-- PostgreSQL database dump complete
--

