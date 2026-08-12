-- The existing `reported_media_check_non_empty` CHECK on ncmec_reporting.ncmec_reports
-- requires >= 1 media item, which blocks storing legitimate text-only reports
-- even after the application-side media gates were removed (#661).
--
-- We want to replace it with a constraint that matches the new logic. A
-- report must carry media OR messages (but there must be one). `array_length` of an
-- empty/NULL array is NULL, so coalesce to 0 before comparing. The column stays
-- `jsonb[] NOT NULL`, so rows still cannot be NULL.
--
-- Safe for existing data: every current row satisfied the old "media non-empty"
-- constraint, so it satisfies "media OR messages non-empty".
--
-- Rollback caveat: reverting to the media-only constraint will FAIL once any
-- text-only (empty reported_media) row exists. Reverting is only clean
-- before such rows are written; afterward it requires removing/backfilling
-- those rows, and deleting NCMEC report records has compliance implications.
-- Treat this as effectively forward-only.

BEGIN;

ALTER TABLE ncmec_reporting.ncmec_reports
  DROP CONSTRAINT IF EXISTS reported_media_check_non_empty;

ALTER TABLE ncmec_reporting.ncmec_reports
  ADD CONSTRAINT reported_media_or_messages_non_empty CHECK (
    coalesce(array_length(reported_media, 1), 0) > 0
    OR coalesce(array_length(reported_messages, 1), 0) > 0
  );

COMMIT;
