-- Migration: 20261022110000_add_contract_fields_and_status_binding.sql
-- Menambahkan status_binding ke creators, serta kolom pendukung kontrak di creator_contracts

-- 1. Status Binding di tabel creators (Binding / Non-Binding)
ALTER TABLE creators ADD COLUMN IF NOT EXISTS status_binding TEXT DEFAULT 'Non-Binding';

-- 2. Kolom pendukung di tabel creator_contracts untuk menyimpan riwayat kontrak ter-generate
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS nomor_kontrak TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS status_binding TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS signer_role TEXT;
ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS contract_data JSONB;

-- 3. Index nomor kontrak untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_creator_contracts_nomor ON creator_contracts(nomor_kontrak);
