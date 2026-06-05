ALTER TABLE manual_review_tool.manual_review_tool_settings
  ADD COLUMN default_job_sort_order VARCHAR(4) NOT NULL DEFAULT 'DESC';
