import { type ColumnType } from 'kysely';

export type SignalAuthServicePg = {
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
