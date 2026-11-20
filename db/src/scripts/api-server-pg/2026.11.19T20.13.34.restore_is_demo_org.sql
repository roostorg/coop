-- Released app versions (1.2.3 and earlier) read and write this column, so it
-- stays in the schema to let deployments migrate before upgrading or roll the
-- app back. Current app code does not use it. Drop it only once no supported
-- release reads it (see #1627).
BEGIN;

-- With a constant default this is a metadata-only change on Postgres 11+,
-- but it still needs a brief ACCESS EXCLUSIVE lock; fail fast rather than
-- queue behind long-running transactions and block reads of org_settings.
-- If it times out, rerun the migration.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.org_settings
    ADD COLUMN IF NOT EXISTS is_demo_org boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.org_settings.is_demo_org IS
    'Unused by current app code. Kept for compatibility with app versions 1.2.3 and earlier; drop only once no supported release reads it (#1627).';

COMMIT;
