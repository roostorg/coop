-- Allow the WEIGHTED sort mode: jobs are scored from org-configurable
-- weights (see job_priority_weights) instead of report count alone.
ALTER TABLE manual_review_tool.manual_review_queues
    DROP CONSTRAINT manual_review_queues_job_sort_type_check;

ALTER TABLE manual_review_tool.manual_review_queues
    ADD CONSTRAINT manual_review_queues_job_sort_type_check
    CHECK (job_sort_type IN ('FIFO', 'NUM_REPORTS', 'WEIGHTED'));
