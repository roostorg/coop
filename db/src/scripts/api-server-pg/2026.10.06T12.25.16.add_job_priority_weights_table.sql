-- Per-org weights for the WEIGHTED job sort mode. One row per (org,
-- property); properties are an allowlist maintained in application code
-- (server/services/manualReviewToolService/modules/JobPriority.ts).
--
-- org_id is a real FK with ON DELETE CASCADE, matching how public tables
-- reference orgs (actions_org_id_fkey, api_keys_org_id_fkey, hash_banks).
-- Deleting an org drops its weights; without the constraint they would be
-- orphaned rows that still match a recycled org id.
CREATE TABLE manual_review_tool.job_priority_weights (
    org_id     character varying(255) NOT NULL
                 REFERENCES public.orgs (id) ON DELETE CASCADE,
    property   character varying(64)  NOT NULL,
    weight     numeric NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, property),
    CONSTRAINT job_priority_weights_weight_check CHECK (weight >= 0)
);
