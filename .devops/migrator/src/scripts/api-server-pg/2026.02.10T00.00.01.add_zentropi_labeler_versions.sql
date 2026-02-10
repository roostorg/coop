-- Add labeler_versions JSONB column to zentropi_configs
ALTER TABLE signal_auth_service.zentropi_configs
  ADD COLUMN labeler_versions JSONB DEFAULT '[]';
