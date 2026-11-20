-- Drop schema objects that nothing uses.
BEGIN;

-- Fail fast rather than queue writes behind a blocked ACCESS EXCLUSIVE lock.
SET LOCAL lock_timeout = '5s';

-- Each join table also has a <table>_fkey on the same column with ON DELETE
-- CASCADE; these NO ACTION duplicates are redundant.
ALTER TABLE reporting_rules.reporting_rules_to_actions
  DROP CONSTRAINT IF EXISTS reporting_rules_to_actions_reporting_rule_id_fkey;
ALTER TABLE reporting_rules.reporting_rules_to_item_types
  DROP CONSTRAINT IF EXISTS reporting_rules_to_item_types_reporting_rule_id_fkey;
ALTER TABLE reporting_rules.reporting_rules_to_policies
  DROP CONSTRAINT IF EXISTS reporting_rules_to_policies_reporting_rule_id_fkey;

-- Refreshed the appeals routing rule matview on every routing_rules write,
-- though that matview doesn't read routing_rules. appeals_routing_rules has
-- its own trigger for it.
DROP TRIGGER IF EXISTS update_appelas_routing_rule_versions_view
  ON manual_review_tool.routing_rules;

-- No column, function or other type uses these. RESTRICT (the default) makes
-- this fail rather than cascade if anything does.
DROP TYPE IF EXISTS public.enum_conditions_type;
DROP TYPE IF EXISTS public.enum_jobs_status;
DROP TYPE IF EXISTS public.enum_rules_condition_set_conjunction;
DROP TYPE IF EXISTS public.enum_rules_status;
DROP TYPE IF EXISTS public.enum_signals_type;

COMMIT;
