-- Record when a moderator claims (dequeues) an MRT job so we can measure
-- handle time: claimed_at → decided_at (issue #380).
--
-- Coop is pull-based: "assigned" means last successful dequeue/claim. Skips
-- and BullMQ lock expiry can produce multiple claims; analytics use the
-- latest claim by the deciding reviewer. `manual_review_decisions.assigned_at`
-- denormalizes that claim at decision time for cheap handle-time queries.
-- AUTOMATIC_CLOSE and other decisions without a matching human claim leave
-- assigned_at NULL so they are excluded from handle-time averages.

CREATE TABLE IF NOT EXISTS manual_review_tool.job_claims (
    org_id character varying(255) NOT NULL,
    queue_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    job_id text NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE manual_review_tool.job_claims OWNER TO CURRENT_USER;

DO $$
BEGIN
    ALTER TABLE ONLY manual_review_tool.job_claims
        ADD CONSTRAINT job_claims_queue_id_fkey
        FOREIGN KEY (queue_id)
        REFERENCES manual_review_tool.manual_review_queues(id)
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_claims_org_job_claimed_at
    ON manual_review_tool.job_claims (org_id, job_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_claims_org_job_user_claimed_at
    ON manual_review_tool.job_claims (org_id, job_id, user_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_claims_org_claimed_at
    ON manual_review_tool.job_claims (org_id, claimed_at);

ALTER TABLE manual_review_tool.manual_review_decisions
    ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_manual_review_decisions_org_created_assigned
    ON manual_review_tool.manual_review_decisions (org_id, created_at)
    WHERE assigned_at IS NOT NULL;
