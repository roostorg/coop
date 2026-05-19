-- ncmec_reports_errors stores synthetic composite IDs (base64-encoded
-- workflow/job identifiers that can exceed 500 characters) as well as
-- user IDs that are caller-defined and not length-bounded by us. The
-- original varchar(255) columns silently truncated values or threw
-- 22001 errors at insert time, which masked submission errors in the
-- dashboard. Widen to TEXT (no length limit, same storage cost as
-- varchar in Postgres) so writes always succeed and lookups by full
-- key work.

ALTER TABLE ncmec_reporting.ncmec_reports_errors
    ALTER COLUMN job_id TYPE text,
    ALTER COLUMN user_id TYPE text,
    ALTER COLUMN user_type_id TYPE text;
