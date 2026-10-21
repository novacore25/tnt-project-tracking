-- Migration: Add email column to creator_staging and creators
-- Timestamp: 20261021141500

ALTER TABLE creator_staging ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS email text;
