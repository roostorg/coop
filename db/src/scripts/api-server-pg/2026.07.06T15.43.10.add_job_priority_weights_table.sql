-- Per-org weights for the WEIGHTED job sort mode. One row per (org,
-- property); properties are an allowlist maintained in application code
-- (server/services/manualReviewToolService/modules/JobPriority.ts).
--
-- No FK to public.orgs: tables in the manual_review_tool schema
-- intentionally carry unconstrained org_id columns (see
-- manual_review_queues, manual_review_decisions).
CREATE TABLE manual_review_tool.job_priority_weights (
    org_id     character varying(255) NOT NULL,
    property   character varying(64)  NOT NULL,
    weight     numeric NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, property),
    CONSTRAINT job_priority_weights_weight_check CHECK (weight >= 0)
);
