-- Migration: Add extended demographic and identity columns to creators & creator_identities
-- Timestamp: 20261009170000

-- 1. Tambah kolom tempat_lahir, tanggal_lahir, npwp ke creator_identities
ALTER TABLE creator_identities ADD COLUMN IF NOT EXISTS tempat_lahir TEXT;
ALTER TABLE creator_identities ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;
ALTER TABLE creator_identities ADD COLUMN IF NOT EXISTS npwp TEXT;

-- 2. Tambah kolom penunjang ke tabel creators
ALTER TABLE creators ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS no_whatsapp TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_uid TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS npwp TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tempat_lahir TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;
