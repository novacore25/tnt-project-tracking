-- Migration: 20261022130000_add_tipe_dokumen_to_contracts.sql
-- Menambahkan kolom tipe_dokumen untuk scale-up tipe dokumen di masa mendatang
-- Default: 'perjanjian_kerjasama' (Surat Perjanjian Kerja Sama Join Campaign)

ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS tipe_dokumen TEXT DEFAULT 'perjanjian_kerjasama';
CREATE INDEX IF NOT EXISTS idx_creator_contracts_tipe_dokumen ON creator_contracts(tipe_dokumen);
