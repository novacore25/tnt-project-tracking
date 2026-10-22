-- Migration: Tabel Antrean Target Scraping Kreator Terarah (Targeted Scrape Queue)
-- Dibuat: 2026-10-22 13:30:00

CREATE TABLE IF NOT EXISTS creator_scrape_targets (
    id serial PRIMARY KEY,
    username text NOT NULL,
    campaign_id integer REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_name text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    requested_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_scrape_targets_username ON creator_scrape_targets (LOWER(TRIM(username)));
CREATE INDEX IF NOT EXISTS idx_creator_scrape_targets_status ON creator_scrape_targets (status);
CREATE INDEX IF NOT EXISTS idx_creator_scrape_targets_campaign ON creator_scrape_targets (campaign_id);
