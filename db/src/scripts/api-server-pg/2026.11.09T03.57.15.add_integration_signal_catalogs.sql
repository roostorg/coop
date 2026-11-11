-- Org-specific signal catalogs fetched from plugin integrations via
-- refreshCatalog(). Stored so every API instance serves the same catalog,
-- including right after a restart, without calling the provider.
--
-- entries: data-only signal entries (ids, names, input/output types,
--   subcategories such as provider policies). Plugins rebuild runnable
--   signals from them with createCatalogSignal().
-- removed_entries: entries dropped by a later refresh, kept so rules that
--   still reference them are reported and fail closed.

CREATE TABLE signal_auth_service.integration_signal_catalogs (
    org_id character varying(255) NOT NULL,
    integration_id character varying(255) NOT NULL,
    version text NOT NULL,
    entries JSONB NOT NULL DEFAULT '[]',
    removed_entries JSONB NOT NULL DEFAULT '[]',
    status character varying(32) NOT NULL DEFAULT 'OK',
    error_message text,
    fetched_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integration_signal_catalogs_status_check
        CHECK (status IN ('OK', 'ERROR'))
);

ALTER TABLE signal_auth_service.integration_signal_catalogs OWNER TO CURRENT_USER;

ALTER TABLE ONLY signal_auth_service.integration_signal_catalogs
    ADD CONSTRAINT integration_signal_catalogs_pkey PRIMARY KEY (org_id, integration_id);

ALTER TABLE ONLY signal_auth_service.integration_signal_catalogs
    ADD CONSTRAINT integration_signal_catalogs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;

COMMENT ON TABLE signal_auth_service.integration_signal_catalogs IS 'Per-org signal catalogs returned by plugin integrations (refreshCatalog). entries/removed_entries are data-only JSON validated by the API server.';
