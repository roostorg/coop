CREATE TABLE IF NOT EXISTS manual_review_tool.job_priority_weights (
    org_id     character varying(255) NOT NULL,
    property   character varying(64)  NOT NULL,
    weight     numeric NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, property),
    CONSTRAINT job_priority_weights_weight_check CHECK (weight >= 0)
);