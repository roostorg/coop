-- Widen NCMEC report ID columns to text.
--
-- Context:
--   `ncmec_reports_errors` and `ncmec_reports` store synthetic composite
--   IDs (base64-encoded workflow/job identifiers that can exceed 500
--   characters) as well as user IDs that are caller-defined and not
--   length-bounded by us. The original varchar(255) columns silently
--   truncated values or threw 22001 errors at insert time, which masked
--   submission errors in the dashboard.


ALTER TABLE ncmec_reporting.ncmec_reports_errors
    ALTER COLUMN job_id       TYPE text,
    ALTER COLUMN user_id      TYPE text,
    ALTER COLUMN user_type_id TYPE text;

ALTER TABLE ncmec_reporting.ncmec_reports
    ALTER COLUMN user_id           TYPE text,
    ALTER COLUMN user_item_type_id TYPE text;
