-- Durable state for MRT Redis backfill / recovery.
--
-- `job_creations` remains the source of truth for what was ever enqueued.
-- This table tracks recovery retries separately so a periodic backfill can
-- survive across runs, mark items as failed after exhausting retries, and be
-- manually reset back to `PENDING` without mutating enqueue history.

CREATE TABLE manual_review_tool.mrt_queue_recovery_state (
  job_id text PRIMARY KEY,
  org_id text NOT NULL,
  queue_id text NOT NULL,
  item_id text NOT NULL,
  item_type_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'FAILED')),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE manual_review_tool.mrt_queue_recovery_state OWNER TO CURRENT_USER;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE manual_review_tool.mrt_queue_recovery_state TO CURRENT_USER;

ALTER TABLE manual_review_tool.mrt_queue_recovery_state
  ADD CONSTRAINT mrt_queue_recovery_state_job_fkey
  FOREIGN KEY (job_id)
  REFERENCES manual_review_tool.job_creations(id)
  ON DELETE CASCADE;

CREATE INDEX mrt_queue_recovery_state_status_idx
  ON manual_review_tool.mrt_queue_recovery_state (status);

CREATE FUNCTION manual_review_tool.update_mrt_queue_recovery_state_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION manual_review_tool.update_mrt_queue_recovery_state_updated_at() OWNER TO CURRENT_USER;

CREATE TRIGGER mrt_queue_recovery_state_updated_at_trigger
  BEFORE UPDATE ON manual_review_tool.mrt_queue_recovery_state
  FOR EACH ROW EXECUTE FUNCTION manual_review_tool.update_mrt_queue_recovery_state_updated_at();

COMMENT ON TABLE manual_review_tool.mrt_queue_recovery_state IS
  'Durable retry state for MRT Redis backfill. Rows represent job_creations entries that still need recovery or have permanently failed recovery.';

COMMENT ON COLUMN manual_review_tool.mrt_queue_recovery_state.status IS
  'PENDING while the row should be retried by the scheduled backfill; FAILED once the retry budget is exhausted.';
