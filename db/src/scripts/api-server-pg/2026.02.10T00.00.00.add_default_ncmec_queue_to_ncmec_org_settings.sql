-- Add default NCMEC queue to ncmec_org_settings so Enqueue to NCMEC can target a specific queue.
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS default_ncmec_queue_id character varying(255) NULL;

ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD CONSTRAINT ncmec_org_settings_default_ncmec_queue_fkey
  FOREIGN KEY (default_ncmec_queue_id)
  REFERENCES manual_review_tool.manual_review_queues(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.default_ncmec_queue_id IS
  'When set, Enqueue to NCMEC sends jobs to this queue instead of the org default.';
