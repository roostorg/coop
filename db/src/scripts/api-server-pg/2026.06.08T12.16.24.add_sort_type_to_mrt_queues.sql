-- Controls how jobs in a review queue are ordered.
--
-- FIFO (default): first in, first out. Today's behaviour and BullMQ's default.
-- NUM_REPORTS: items with more reports get reviewed first.
--
-- Defaults to FIFO so nothing changes for existing queues.

ALTER TABLE manual_review_tool.manual_review_queues
    ADD COLUMN IF NOT EXISTS job_sort_type character varying(16) NOT NULL DEFAULT 'FIFO';

ALTER TABLE manual_review_tool.manual_review_queues
    ADD CONSTRAINT manual_review_queues_job_sort_type_check
    CHECK (job_sort_type IN ('FIFO', 'NUM_REPORTS'));