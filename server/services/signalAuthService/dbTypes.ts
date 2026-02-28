import { type ColumnType } from 'kysely';

/** JSONB config blob; shape defined per integration (see @roostorg/types StoredIntegrationConfigPayload). */
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
    api_key: string;
    labeler_versions: ColumnType<string, string | undefined, string | undefined>;
    created_at: ColumnType<Date, never, never>;
    updated_at: ColumnType<Date, never, never>;
  };
};
