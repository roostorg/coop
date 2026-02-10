-- Add Zentropi signal type and config table
CREATE TABLE IF NOT EXISTS signal_auth_service.zentropi_configs (
    org_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    api_key character varying(255) NOT NULL
);

ALTER TABLE signal_auth_service.zentropi_configs OWNER TO postgres;

ALTER TABLE ONLY signal_auth_service.zentropi_configs
    ADD CONSTRAINT zentropi_configs_pkey PRIMARY KEY (org_id);
