CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mrt_decisions_org_created_id
    ON manual_review_tool.manual_review_decisions (org_id, created_at DESC, id DESC);
