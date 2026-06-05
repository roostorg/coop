-- Lets orgs control how much media a reviewer must classify before an NCMEC
-- report can be sent. 'ALL' (default) keeps the existing behaviour where every
-- piece of media on the account must be reviewed; 'MINIMUM' only requires
-- `min_media_to_review` items to be reviewed, so reviewers no longer have to
-- classify hundreds of items to submit a report.
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS media_review_requirement character varying(16) NOT NULL DEFAULT 'ALL';

ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD CONSTRAINT ncmec_org_settings_media_review_requirement_check
  CHECK (media_review_requirement IN ('ALL', 'MINIMUM'));

ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS min_media_to_review integer NULL;

-- Guard against non-positive thresholds; NULL is allowed (only meaningful when
-- media_review_requirement = 'MINIMUM', where the app falls back to 1).
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD CONSTRAINT ncmec_org_settings_min_media_to_review_check
  CHECK (min_media_to_review IS NULL OR min_media_to_review >= 1);

COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.media_review_requirement IS
  'How much media must be reviewed before an NCMEC report can be sent: ALL (every item) or MINIMUM (at least min_media_to_review items).';

COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.min_media_to_review IS
  'Minimum number of media items a reviewer must classify before sending a report when media_review_requirement = MINIMUM. NULL falls back to 1.';
