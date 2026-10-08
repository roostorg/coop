-- Adds report context columns to `REPORTING_SERVICE.REPORTS` so integrators
-- can record where in their app a report was made (`surface`) and which client
-- sent it (`client.name` / `client.version` / `client.platform`), plus a free-form
-- `attributes` bag stored as stringified JSON.
--
-- The well-known fields get their own columns so breakdowns by surface or
-- client version don't need to parse JSON at query time. Everything defaults
-- to '' so existing rows remain queryable without a backfill, and older code
-- paths that don't send report context keep working.

ALTER TABLE REPORTING_SERVICE.REPORTS
  ADD COLUMN IF NOT EXISTS report_surface String DEFAULT '',
  ADD COLUMN IF NOT EXISTS report_client_name String DEFAULT '',
  ADD COLUMN IF NOT EXISTS report_client_version String DEFAULT '',
  ADD COLUMN IF NOT EXISTS report_client_platform String DEFAULT '',
  ADD COLUMN IF NOT EXISTS report_context_attributes String DEFAULT '';
