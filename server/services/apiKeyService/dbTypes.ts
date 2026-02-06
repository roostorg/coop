import { type Generated, type GeneratedAlways } from 'kysely';

export type ApiKeyServicePg = {
  'public.api_keys': {
    id: Generated<string>;
    org_id: string;
    key_hash: string;
    name: string;
    description: string | null;
    is_active: Generated<boolean>;
    created_at: GeneratedAlways<Date>;
    updated_at: Generated<Date>;
    last_used_at: Date | null;
    created_by: string | null;
  };
};
