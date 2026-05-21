-- Adds two columns to `analytics.ACTION_EXECUTIONS` to capture the moderator-
-- supplied runtime context for each action execution:
--
--   parameters    JSON blob of validated parameter values that were passed to
--                 the action's webhook (matches the `name -> value` map on
--                 `actions.custom_mrt_api_params`). Empty `'{}'` when the
--                 action takes no parameters or none were supplied. Stored as
--                 `String` (canonical JSON) to match the existing pattern used
--                 by `rules`, `policies`, etc. on this table.
--
--   actor_note    Optional free-text note authored by the moderator
--                 explaining why the action was taken. Capped at 5000 chars
--                 by the API layer; nullable in the column for back-compat
--                 with existing rows.
--
-- Both default to safe values so existing rows remain queryable without a
-- backfill. The default-on-insert behavior also means callers that don't yet
-- send these fields (older code paths) keep working unchanged.

ALTER TABLE analytics.ACTION_EXECUTIONS
  ADD COLUMN IF NOT EXISTS parameters String DEFAULT '{}';

ALTER TABLE analytics.ACTION_EXECUTIONS
  ADD COLUMN IF NOT EXISTS actor_note Nullable(String);
