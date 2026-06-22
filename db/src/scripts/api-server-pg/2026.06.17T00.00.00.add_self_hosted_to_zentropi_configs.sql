-- Allow orgs that only use self-hosted CoPE to omit the hosted API key.
ALTER TABLE signal_auth_service.zentropi_configs
  ALTER COLUMN api_key DROP NOT NULL;

-- Self-hosted model configuration columns. All nullable; presence of
-- self_hosted_base_url indicates self-hosted mode is configured.
ALTER TABLE signal_auth_service.zentropi_configs
  ADD COLUMN IF NOT EXISTS self_hosted_base_url TEXT,
  ADD COLUMN IF NOT EXISTS self_hosted_model TEXT,
  ADD COLUMN IF NOT EXISTS self_hosted_api_key TEXT,
  ADD COLUMN IF NOT EXISTS self_hosted_format TEXT,
  ADD COLUMN IF NOT EXISTS self_hosted_system_prompt_template TEXT,
  ADD COLUMN IF NOT EXISTS self_hosted_user_message_template TEXT;
