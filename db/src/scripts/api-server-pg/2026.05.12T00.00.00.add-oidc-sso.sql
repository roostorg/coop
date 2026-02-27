 -- Add OIDC columns
ALTER TABLE public.org_settings
ADD COLUMN IF NOT EXISTS oidc_enabled boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS issuer_url character varying(255),
ADD COLUMN IF NOT EXISTS client_id character varying(255),
ADD COLUMN IF NOT EXISTS client_secret character varying(255);

-- Add OIDC settings constraint
ALTER TABLE public.org_settings
ADD CONSTRAINT oidc_settings_constraint CHECK (
    (oidc_enabled = false) OR
    ((oidc_enabled = true) AND (client_id IS NOT NULL) AND (client_secret IS NOT NULL) AND (issuer_url IS NOT NULL))
);

-- Add mutual exclusivity: SAML and OIDC cannot both be enabled
ALTER TABLE public.org_settings
ADD CONSTRAINT sso_saml_oidc_constraint CHECK (
    ((saml_enabled = false) AND (oidc_enabled = true)) OR
    ((saml_enabled = true) AND (oidc_enabled = false)) OR
    ((saml_enabled = false) AND (oidc_enabled = false))
);

ALTER TYPE public.login_method_enum ADD VALUE IF NOT EXISTS 'oidc';