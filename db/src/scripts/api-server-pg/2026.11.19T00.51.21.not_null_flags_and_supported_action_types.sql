-- Make columns the code already treats as non-null NOT NULL, and stop
-- public.actions from holding action types the server can't handle.
BEGIN;

-- Fail fast rather than queue writes behind a blocked ACCESS EXCLUSIVE lock.
SET LOCAL lock_timeout = '5s';

-- NULL here means the column default was never applied; readers already
-- treat it as that default.
UPDATE public.org_settings SET has_reporting_rules_enabled = false
  WHERE has_reporting_rules_enabled IS NULL;
UPDATE public.org_settings SET has_appeals_enabled = false
  WHERE has_appeals_enabled IS NULL;
UPDATE public.org_settings SET allow_multiple_policies_per_action = false
  WHERE allow_multiple_policies_per_action IS NULL;
UPDATE public.org_settings SET user_strike_ttl_days = 90
  WHERE user_strike_ttl_days IS NULL;

ALTER TABLE public.org_settings
  ALTER COLUMN has_reporting_rules_enabled SET DEFAULT false,
  ALTER COLUMN has_reporting_rules_enabled SET NOT NULL,
  ALTER COLUMN has_appeals_enabled SET DEFAULT false,
  ALTER COLUMN has_appeals_enabled SET NOT NULL,
  ALTER COLUMN allow_multiple_policies_per_action SET DEFAULT false,
  ALTER COLUMN allow_multiple_policies_per_action SET NOT NULL,
  ALTER COLUMN user_strike_ttl_days SET DEFAULT 90,
  ALTER COLUMN user_strike_ttl_days SET NOT NULL;

UPDATE public.users SET approved_by_admin = false
  WHERE approved_by_admin IS NULL;
UPDATE public.users SET rejected_by_admin = false
  WHERE rejected_by_admin IS NULL;

ALTER TABLE public.users
  ALTER COLUMN approved_by_admin SET DEFAULT false,
  ALTER COLUMN approved_by_admin SET NOT NULL,
  ALTER COLUMN rejected_by_admin SET DEFAULT false,
  ALTER COLUMN rejected_by_admin SET NOT NULL;

-- REJECT_APPEAL and ACCEPT_APPEAL stay in the public.action_type enum
-- (removing enum labels means rebuilding the type and everything that
-- depends on it), but no action may use them. Refuse to migrate, rather
-- than delete anything, if one does.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.actions
    WHERE action_type IN ('REJECT_APPEAL', 'ACCEPT_APPEAL')
  ) THEN
    RAISE EXCEPTION 'public.actions has rows with action_type REJECT_APPEAL or ACCEPT_APPEAL, which the server cannot load; remove or change them before running this migration';
  END IF;
END
$$;

ALTER TABLE public.actions
  DROP CONSTRAINT IF EXISTS actions_action_type_supported,
  ADD CONSTRAINT actions_action_type_supported
    CHECK (action_type NOT IN ('REJECT_APPEAL', 'ACCEPT_APPEAL'));

COMMIT;
