-- Per-queue config for "clear all other reports for a user" (issue #650): when
-- a trigger action is taken on a job, dispose of the user's other pending
-- reports. The feature is off for a queue unless it has a non-null disposition
-- and at least one trigger action, so existing queues are unaffected.

ALTER TABLE manual_review_tool.manual_review_queues
  ADD COLUMN IF NOT EXISTS clear_reports_disposition character varying(64),
  ADD COLUMN IF NOT EXISTS clear_reports_scope character varying(64) NOT NULL DEFAULT 'CURRENT_QUEUE';

ALTER TABLE manual_review_tool.manual_review_queues
  ADD CONSTRAINT manual_review_queues_clear_reports_disposition_check
    CHECK (
      clear_reports_disposition IS NULL
      OR clear_reports_disposition IN ('AUTOMATIC_CLOSE', 'IGNORE', 'SAME_ACTION')
    );

ALTER TABLE manual_review_tool.manual_review_queues
  ADD CONSTRAINT manual_review_queues_clear_reports_scope_check
    CHECK (clear_reports_scope IN ('CURRENT_QUEUE', 'ALL_QUEUES'));

-- Action IDs that trigger the sweep for a queue (mirrors queues_and_hidden_actions).
CREATE TABLE IF NOT EXISTS manual_review_tool.queues_and_clear_reports_trigger_actions (
  queue_id character varying(255) NOT NULL,
  action_id character varying(255) NOT NULL,
  org_id character varying(255) NOT NULL,
  CONSTRAINT queues_and_clear_reports_trigger_actions_pkey PRIMARY KEY (queue_id, action_id),
  CONSTRAINT queues_and_clear_reports_trigger_actions_queue_fkey
    FOREIGN KEY (queue_id)
    REFERENCES manual_review_tool.manual_review_queues(id)
    ON DELETE CASCADE
);

ALTER TABLE manual_review_tool.queues_and_clear_reports_trigger_actions OWNER TO CURRENT_USER;

CREATE INDEX IF NOT EXISTS idx_queues_and_clear_reports_trigger_actions_org_id
  ON manual_review_tool.queues_and_clear_reports_trigger_actions(org_id);
