-- Migration: Menambahkan kolom campaign_tags ke creator_staging untuk mendukung multi-campaign tagging & filter per campaign di Staging Creator
ALTER TABLE creator_staging ADD COLUMN IF NOT EXISTS campaign_tags text[] DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_creator_staging_campaign_tags ON creator_staging USING gin(campaign_tags);
