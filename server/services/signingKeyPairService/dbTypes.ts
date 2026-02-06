import { type GeneratedAlways } from 'kysely';

export type SigningKeyPairServicePg = {
  'public.signing_keys': {
    org_id: string;
    key_data: string; // JSONB stored as string
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
  };
};
