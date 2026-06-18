-- Per-queue sort mode for MRT jobs. Both modes feed BullMQ's native job
-- priority at enqueue so the dequeue + lock path is unchanged: Default is FIFO
-- so existing queues keep behaving exactly like before. Admins opt in to
-- reports-based ordering per queue from the queue form.
ALTER TABLE manual_review_tool.manual_review_queues
    ADD COLUMN IF NOT EXISTS job_sort_type character varying(16) NOT NULL
DEFAULT 'FIFO';

ALTER TABLE manual_review_tool.manual_review_queues
    ADD CONSTRAINT manual_review_queues_job_sort_type_check
    CHECK (job_sort_type IN ('FIFO', 'NUM_REPORTS'));
