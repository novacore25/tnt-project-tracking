-- Migration: Create creator_staging table and extend creators & creator_snapshots for TikTok Partner Center Auto-Scraper
-- Timestamp: 20261021110000
-- Reference: docs/KEPUTUSAN-SCRAPING-CREATOR-STAGING.md

-- 1. Buat tabel creator_staging untuk menampung hasil scraping sebelum dipromosikan ke Creator Pool
CREATE TABLE IF NOT EXISTS creator_staging (
    id serial PRIMARY KEY,
    username text NOT NULL UNIQUE,
    display_name text,
    tiktok_cid text,
    link_account text,
    avatar_url text,
    mcn text,
    no_whatsapp text,
    level integer,
    followers bigint,
    primary_niche text,

    -- GMV & Sales Metrics (30 Hari Terakhir)
    gmv_30d bigint NOT NULL DEFAULT 0,
    gmv_status text NOT NULL DEFAULT 'RIIL' CHECK (gmv_status IN ('RIIL', 'ESTIMASI')),
    gmv_30d_live bigint NOT NULL DEFAULT 0,
    gmv_30d_video bigint NOT NULL DEFAULT 0,
    gmv_30d_showcase bigint NOT NULL DEFAULT 0,
    pct_live numeric(5,2) DEFAULT 0,
    pct_video numeric(5,2) DEFAULT 0,
    pct_showcase numeric(5,2) DEFAULT 0,

    items_sold_30d bigint DEFAULT 0,
    gpm_30d bigint DEFAULT 0,
    gmv_per_customer_min bigint,
    gmv_per_customer_max bigint,
    avg_commission_rate numeric(5,2),

    -- Collaboration Metrics
    products_promoted_count integer DEFAULT 0,
    brand_collaborations_count integer DEFAULT 0,
    product_price_min bigint,
    product_price_max bigint,

    -- Video Performance Metrics
    video_gpm bigint DEFAULT 0,
    videos_count_30d integer DEFAULT 0,
    avg_video_views bigint DEFAULT 0,
    avg_video_engagement_rate numeric(5,2),

    -- LIVE Performance Metrics
    live_gpm bigint DEFAULT 0,
    live_streams_count_30d integer DEFAULT 0,
    avg_live_views bigint DEFAULT 0,
    avg_live_engagement_rate numeric(5,2),

    -- Audience Demographics & Category Breakdown
    audience_male_pct numeric(5,2),
    audience_female_pct numeric(5,2),
    audience_age text,
    age_18_24_pct numeric(5,2),
    age_25_34_pct numeric(5,2),
    age_35_44_pct numeric(5,2),
    age_45_54_pct numeric(5,2),
    age_55_plus_pct numeric(5,2),
    top_locations jsonb DEFAULT '[]'::jsonb,
    gmv_by_category jsonb DEFAULT '[]'::jsonb,

    -- Metadata Staging & Promosi ke Creator Pool
    status_staging text NOT NULL DEFAULT 'staged' CHECK (status_staging IN ('staged', 'promoted', 'archived')),
    promoted_creator_id integer REFERENCES creators(id) ON DELETE SET NULL,
    scraped_by text,
    scraped_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_staging_username_lower ON creator_staging (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_creator_staging_status ON creator_staging (status_staging);
CREATE INDEX IF NOT EXISTS idx_creator_staging_gmv ON creator_staging (gmv_30d DESC);

-- 2. Tambahkan display_name & tiktok_cid pada tabel creators (dipisahkan dari nama_asli KTP)
ALTER TABLE creators ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_cid text;

-- 3. Tambahkan kolom metrik analitik lengkap pada creator_snapshots agar saat promosi dari Staging tidak ada data hilang
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_status text DEFAULT 'RIIL';
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_30d_showcase bigint DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS pct_live numeric(5,2) DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS pct_video numeric(5,2) DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS pct_showcase numeric(5,2) DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS items_sold_30d bigint DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gpm_30d bigint DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_per_customer_min bigint;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_per_customer_max bigint;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_commission_rate numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS products_promoted_count integer DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS brand_collaborations_count integer DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS product_price_min bigint;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS product_price_max bigint;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS video_gpm bigint DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS videos_count_30d integer DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_video_views bigint DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_video_engagement_rate numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS live_gpm bigint DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS live_streams_count_30d integer DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_live_views bigint DEFAULT 0;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_live_engagement_rate numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS audience_male_pct numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS audience_female_pct numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_18_24_pct numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_25_34_pct numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_35_44_pct numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_45_54_pct numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_55_plus_pct numeric(5,2);
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS top_locations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_by_category jsonb DEFAULT '[]'::jsonb;
