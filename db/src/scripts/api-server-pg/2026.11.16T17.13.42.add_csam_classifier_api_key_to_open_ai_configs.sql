-- Adds a second, separately-issued API key to the OpenAI integration config.
-- The CSAM Classifier key authenticates OpenAI's Novel CSAM Classifier API
-- and is granted through an approval process that happens outside Coop, so
-- the column is nullable: most orgs will only ever have the moderation key.

ALTER TABLE signal_auth_service.open_ai_configs
    ADD COLUMN csam_classifier_api_key character varying(255);
