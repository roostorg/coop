import { type Generated, type GeneratedAlways } from 'kysely';

/** Postgres enum for backtests.status (generated column — read-only in app). */
export type BacktestStatusDb = 'RUNNING' | 'COMPLETE' | 'CANCELED';

export type CoreAppTablesPg = {
  'public.orgs': {
    id: string;
    email: string;
    name: string;
    website_url: string;
    api_key_id: string | null;
    created_at: Date;
    updated_at: Date;
    on_call_alert_email: string | null;
  };
  'public.location_banks': {
    id: string;
    name: string;
    description: string | null;
    org_id: string;
    owner_id: string;
    created_at: GeneratedAlways<Date>;
    updated_at: Date;
    full_places_api_responses: unknown[];
  };
  'public.location_bank_locations': {
    id: string;
    bank_id: string;
    geometry: unknown;
    bounds: unknown | null;
    name: string | null;
    google_place_info: unknown | null;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
  };
  'public.backtests': {
    id: string;
    rule_id: string;
    creator_id: string;
    sample_desired_size: number;
    sample_actual_size: Generated<number>;
    sample_start_at: Date;
    sample_end_at: Date;
    sampling_complete: Generated<boolean>;
    content_items_processed: Generated<number>;
    content_items_matched: Generated<number>;
    created_at: GeneratedAlways<Date>;
    updated_at: Date;
    cancelation_date: Date | null;
    status: GeneratedAlways<BacktestStatusDb>;
  };
  'public.users_and_favorite_rules': {
    user_id: string;
    rule_id: string;
    created_at: GeneratedAlways<Date>;
    updated_at: Date;
  };
};
