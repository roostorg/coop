-- Create hash_banks table
CREATE TABLE IF NOT EXISTS hash_banks (
  id SERIAL PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  hma_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  source VARCHAR(255),
  enabled_ratio FLOAT NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_org_bank_name UNIQUE (org_id, name)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_hash_banks_hma_name ON hash_banks(hma_name);
CREATE INDEX IF NOT EXISTS idx_hash_banks_org_id ON hash_banks(org_id);
