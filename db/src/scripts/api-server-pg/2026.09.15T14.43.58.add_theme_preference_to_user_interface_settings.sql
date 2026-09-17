-- Per-user color scheme preference (issue #365). NULL means "follow the
-- system/browser color scheme", which is the default for all existing users.

ALTER TABLE user_management_service.user_interface_settings
  ADD COLUMN IF NOT EXISTS theme_preference character varying(16);

ALTER TABLE user_management_service.user_interface_settings
  ADD CONSTRAINT user_interface_settings_theme_preference_check
    CHECK (
      theme_preference IS NULL
      OR theme_preference IN ('SYSTEM', 'LIGHT', 'DARK')
    );
