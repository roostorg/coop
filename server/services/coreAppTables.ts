import { type Generated, type GeneratedAlways } from 'kysely';

import { type UserRole } from '../models/types/permissioning.js';

/** Postgres enum for backtests.status (generated column — read-only in app). */
export type BacktestStatusDb = 'RUNNING' | 'COMPLETE' | 'CANCELED';

/** Postgres enum for users.login_methods. */
export type LoginMethod = 'password' | 'saml';

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
  // `id`, `created_at`, `updated_at` are all NOT NULL with no server-side
  // default — the app supplies them on INSERT, just like the Sequelize model
  // did. The DB enforces a CHECK constraint (`password_null_when_not_present`)
  // tying `password IS NOT NULL` to `'password' ∈ login_methods`; that
  // invariant is enforced at the app layer too (see `userValidation.ts`).
  'public.users': {
    id: string;
    email: string;
    password: string | null;
    first_name: string;
    last_name: string;
    role: UserRole;
    approved_by_admin: boolean;
    rejected_by_admin: boolean;
    created_at: Date;
    updated_at: Date;
    org_id: string;
    login_methods: LoginMethod[];
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
