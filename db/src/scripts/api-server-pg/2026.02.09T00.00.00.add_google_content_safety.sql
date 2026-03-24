-- Add Google Content Safety API signal type and config table
ALTER TYPE public.enum_signals_type ADD VALUE IF NOT EXISTS 'GOOGLE_CONTENT_SAFETY_API';

CREATE TABLE signal_auth_service.google_content_safety_configs (
    org_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    api_key character varying(255) NOT NULL
);

ALTER TABLE signal_auth_service.google_content_safety_configs OWNER TO postgres;

ALTER TABLE ONLY signal_auth_service.google_content_safety_configs
    ADD CONSTRAINT google_content_safety_configs_pkey PRIMARY KEY (org_id);
