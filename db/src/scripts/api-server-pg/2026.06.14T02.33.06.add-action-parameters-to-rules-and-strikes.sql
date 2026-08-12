-- Parameterized actions (see #377) let an action declare typed parameters that
-- are filled in at execution time. On the MRT a moderator supplies the values
-- interactively; proactive rules and user-strike thresholds run automatically
-- with no moderator, so the values have to be configured up front, alongside
-- the action attachment.
--
-- This migration adds a place to persist those configured values:
--
--   public.rules_and_actions.action_parameters
--     The `name -> value` map sent when this rule fires this action. Scoped to
--     the (rule_id, action_id) attachment so the same action can carry
--     different values on different rules. Empty `'{}'` when the action takes
--     no parameters.
--
--   public.user_strike_thresholds.action_parameters
--     A threshold fans out to several actions (the `actions` array), so this is
--     a map of `action_id -> { name -> value }`. Empty `'{}'` when none of the
--     threshold's actions take parameters.
--
-- Both default to `'{}'` so existing rows stay valid without a backfill and
-- older code paths that don't send the column keep working unchanged.
--
-- `rules_and_actions` is a temporal table: the `versioning()` trigger copies
-- each old row into `rules_and_actions_history`. The history table must carry
-- the same column or the trigger's column list drifts, so we add it there too
-- (nullable — history rows predating this column legitimately have no value).

ALTER TABLE public.rules_and_actions
  ADD COLUMN IF NOT EXISTS action_parameters jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.rules_and_actions_history
  ADD COLUMN IF NOT EXISTS action_parameters jsonb;

ALTER TABLE public.user_strike_thresholds
  ADD COLUMN IF NOT EXISTS action_parameters jsonb NOT NULL DEFAULT '{}'::jsonb;
