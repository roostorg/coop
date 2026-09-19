ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS reported_media_hash_bank_id integer NULL;

DO $$
BEGIN
  ALTER TABLE ncmec_reporting.ncmec_org_settings
    ADD CONSTRAINT ncmec_org_settings_reported_media_hash_bank_fkey
    FOREIGN KEY (reported_media_hash_bank_id)
    REFERENCES public.hash_banks(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.reported_media_hash_bank_id IS
  'When set, media from accepted production NCMEC reports is added to this hash bank.';
