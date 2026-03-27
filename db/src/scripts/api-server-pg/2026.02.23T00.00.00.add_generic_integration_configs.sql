-- Generic integration configs table: one row per (org_id, integration_id).
-- Config is stored as JSONB so each integration can define its own credential/config
-- shape without new tables or migrations. The app serializes/deserializes using
-- the integration's manifest (e.g. credentialFields).

CREATE TABLE signal_auth_service.integration_configs (
    org_id character varying(255) NOT NULL,
    integration_id character varying(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE signal_auth_service.integration_configs OWNER TO postgres;

ALTER TABLE ONLY signal_auth_service.integration_configs
    ADD CONSTRAINT integration_configs_pkey PRIMARY KEY (org_id, integration_id);

ALTER TABLE ONLY signal_auth_service.integration_configs
    ADD CONSTRAINT integration_configs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;

COMMENT ON TABLE signal_auth_service.integration_configs IS 'Extensible per-org integration credentials/config. config is JSON; shape is defined by each integration (e.g. via CoopIntegrationPlugin manifest.credentialFields).';
