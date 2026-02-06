import { type Generated, type GeneratedAlways } from 'kysely';

export type HmaServicePg = {
  'public.hash_banks': {
    id: Generated<number>;
    name: string;
    hma_name: string;
    description: string | null;
    enabled_ratio: number;
    org_id: string;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
  };
};

// Type for data returned from database (Generated types are resolved to actual types)
export interface HashBank {
  id: number;
  name: string;
  hma_name: string;
  description: string | null;
  enabled_ratio: number;
  org_id: string;
  created_at: Date;
  updated_at: Date;
}

// Interface for creating a new hash bank (excludes generated fields)
export interface CreateHashBankInput {
  name: string;
  hma_name: string;
  description?: string | null;
  enabled_ratio: number;
  org_id: string;
}

// Interface for updating a hash bank (all fields optional except id)
export interface UpdateHashBankInput {
  name?: string;
  hma_name?: string;
  description?: string | null;
  enabled_ratio?: number;
}

// Interface that matches the original HashBankAttributes for compatibility
export interface HashBankAttributes {
  id?: number;
  name: string;
  hma_name: string;
  description: string;
  enabled_ratio: number;
  org_id: string;
  created_at: Date;
  updated_at: Date;
}
