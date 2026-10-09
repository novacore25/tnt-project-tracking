-- Migration: Add extended demographic and identity columns to creators & creator_identities
-- Timestamp: 20261009170000

-- 1. Tambah kolom tempat_lahir, tanggal_lahir ke creator_identities
ALTER TABLE creator_identities ADD COLUMN IF NOT EXISTS tempat_lahir TEXT;
ALTER TABLE creator_identities ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;

-- 2. Tambah kolom tiktok_uid, email, npwp, tempat_lahir, tanggal_lahir ke tabel creators
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_uid TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS npwp TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tempat_lahir TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;
