-- Per-queue sort mode for MRT jobs. All modes feed BullMQ's native job
-- priority at enqueue so the dequeue + lock path is unchanged. Default is
-- FIFO so existing queues keep behaving exactly like before. Admins opt
-- in to NUM_REPORTS or WEIGHTED per queue from the queue form; WEIGHTED
-- uses the org's job_priority_weights to compute the priority score.
ALTER TABLE manual_review_tool.manual_review_queues
    ADD COLUMN IF NOT EXISTS job_sort_type character varying(16) NOT NULL
DEFAULT 'FIFO';

-- Drop-then-add makes the constraint application idempotent: if the
-- column was previously created with an older check (only FIFO/NUM_REPORTS),
-- re-applying this migration replaces it cleanly.
ALTER TABLE manual_review_tool.manual_review_queues
    DROP CONSTRAINT IF EXISTS manual_review_queues_job_sort_type_check;

ALTER TABLE manual_review_tool.manual_review_queues
    ADD CONSTRAINT manual_review_queues_job_sort_type_check
    CHECK (job_sort_type IN ('FIFO', 'NUM_REPORTS', 'WEIGHTED'));
