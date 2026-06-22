import { type ColumnType } from 'kysely';

/** JSONB config blob; shape defined per integration (see @roostorg/coop-types StoredIntegrationConfigPayload). */
export type IntegrationConfigRow = {
  org_id: string;
  integration_id: string;
  config: ColumnType<
    Record<string, unknown>,
    Record<string, unknown> | string,
    Record<string, unknown> | string
  >;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
};

export type SignalAuthServicePg = {
  'signal_auth_service.integration_configs': IntegrationConfigRow;
  'signal_auth_service.google_content_safety_configs': {
    org_id: string;
    api_key: string;
    created_at: ColumnType<Date, never, never>;
    updated_at: ColumnType<Date, never, never>;
  };
  'signal_auth_service.open_ai_configs': {
    org_id: string;
    api_key: string;
    created_at: ColumnType<Date, never, never>;
    updated_at: ColumnType<Date, never, never>;
  };
  'signal_auth_service.zentropi_configs': {
    org_id: string;
    api_key: string | null;
    labeler_versions: ColumnType<
      string,
      string | undefined,
      string | undefined
    >;
    self_hosted_base_url: string | null;
    self_hosted_model: string | null;
    self_hosted_api_key: string | null;
    self_hosted_format: string | null;
    self_hosted_system_prompt_template: string | null;
    self_hosted_user_message_template: string | null;
    created_at: ColumnType<Date, never, never>;
    updated_at: ColumnType<Date, never, never>;
  };
};
