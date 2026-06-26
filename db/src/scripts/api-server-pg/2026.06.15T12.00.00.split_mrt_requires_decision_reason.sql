-- Splits the single "require decision reason" org setting into two independent
-- settings so that ignoring a job (which means "no violation / no action") can
-- be governed separately from acting on a violating job. See issue #757.
--
-- The existing column is renamed to make its new, narrower meaning explicit
-- (it now applies only to non-ignore "violating" decisions), and a new column
-- governs ignores. We backfill the ignore column from the existing value so
-- upgrading Coop does not change behaviour for any org: an org that previously
-- required a reason for every decision keeps requiring one for ignores too.
ALTER TABLE manual_review_tool.manual_review_tool_settings
  RENAME COLUMN mrt_requires_decision_reason TO mrt_requires_decision_reason_on_action;

ALTER TABLE manual_review_tool.manual_review_tool_settings
  ADD COLUMN IF NOT EXISTS mrt_requires_decision_reason_on_ignore boolean NOT NULL DEFAULT false;

UPDATE manual_review_tool.manual_review_tool_settings
  SET mrt_requires_decision_reason_on_ignore = mrt_requires_decision_reason_on_action;

COMMENT ON COLUMN manual_review_tool.manual_review_tool_settings.mrt_requires_decision_reason_on_action IS
  'Require a written decision reason for non-ignore (violating) job decisions, e.g. custom actions and appeals.';

COMMENT ON COLUMN manual_review_tool.manual_review_tool_settings.mrt_requires_decision_reason_on_ignore IS
  'Require a written decision reason when ignoring a job (a decision composed solely of IGNORE).';
