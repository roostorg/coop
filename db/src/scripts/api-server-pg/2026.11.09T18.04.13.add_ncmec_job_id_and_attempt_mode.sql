-- Link NCMEC reports to the decision that produced them, and record which
-- NCMEC environment (test or production) each failed attempt ran against.
--
-- ncmec_reports.job_id: the MRT job id of the decision. A decision's id is
-- derived from its job id, so this identifies the decision. NULL for reports
-- written before this migration.
--
-- ncmec_reports_errors.is_test: the mode of the decision's latest failed
-- attempt. NULL for rows written before this migration (mode unknown).
--
-- Both columns are nullable with no default, so adding them doesn't rewrite
-- either table. Existing rows are not backfilled: there is no reliable way to
-- recover either value for them.
--
-- The index is a hash index because job ids can be longer than a btree
-- index entry allows, and a failed index insert would lose the record of a
-- report NCMEC has already accepted.
--
-- Rollback: code from before this migration never reads or writes either
-- column, so it runs unchanged with them in place. To remove them, roll back
-- the application first, then run:
--   DROP INDEX ncmec_reporting.idx_ncmec_reports_job_id;
--   ALTER TABLE ncmec_reporting.ncmec_reports DROP COLUMN job_id;
--   ALTER TABLE ncmec_reporting.ncmec_reports_errors DROP COLUMN is_test;
-- This deletes no reports. It loses the decision link and attempt mode on
-- rows written since this migration.

BEGIN;

ALTER TABLE ncmec_reporting.ncmec_reports
  ADD COLUMN job_id text;

ALTER TABLE ncmec_reporting.ncmec_reports_errors
  ADD COLUMN is_test boolean;

CREATE INDEX idx_ncmec_reports_job_id
  ON ncmec_reporting.ncmec_reports USING hash (job_id);

COMMIT;
