-- Migration: 20261022120000_contract_lifecycle_and_sequence.sql
-- Menambahkan status lifecycle (draft / released), release tracking, audit PIC, dan sequence nomor kontrak

ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS campaign_creator_id INT REFERENCES campaign_creators(id) ON DELETE SET NULL;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'; -- 'draft' | 'released'
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS seq_number INT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS created_by_id TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS released_by_id TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS released_by_name TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_creator_contracts_campaign_creator ON creator_contracts(campaign_creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_contracts_status ON creator_contracts(status);
CREATE INDEX IF NOT EXISTS idx_creator_contracts_seq ON creator_contracts(seq_number);
