-- Migration: 20261027220000_create_archive_tables_and_isolate_tnt.sql
-- Purpose: Memisahkan secara fisik tabel-tabel arsip Company Lain (archive_*)
--          dari tabel operasional TNT (campaigns, campaign_creators, videos, sales, ads_performance).
--          Menghapus seluruh baris Company Lain dari tabel utama TNT sehingga tabel TNT 100% murni.

\echo '=== MIGRATION 20261027220000: CREATE DEDICATED ARCHIVE TABLES ==='

BEGIN;

-- 1. Tabel archive_campaigns
CREATE TABLE IF NOT EXISTS archive_campaigns (
    id SERIAL PRIMARY KEY,
    nama TEXT NOT NULL,
    brand_id INTEGER,
    tipe_campaign VARCHAR(50) DEFAULT 'sales',
    status VARCHAR(50) DEFAULT 'selesai',
    start_date DATE,
    end_date DATE,
    target_gmv NUMERIC(18,2),
    target_video INTEGER,
    target_creator INTEGER,
    budget_creator_plafon NUMERIC(18,2) DEFAULT 0,
    budget_ads_plafon NUMERIC(18,2) DEFAULT 0,
    campaign_group VARCHAR(100) DEFAULT 'Tim Campaign',
    company VARCHAR(50) DEFAULT 'OTHER',
    pin VARCHAR(20) DEFAULT '1234',
    require_client_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel archive_campaign_creators
CREATE TABLE IF NOT EXISTS archive_campaign_creators (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES archive_campaigns(id) ON DELETE CASCADE,
    creator_id INTEGER,
    username TEXT NOT NULL,
    nama_asli TEXT,
    link_account TEXT,
    approval VARCHAR(50) DEFAULT 'approved',
    content_type VARCHAR(50),
    tier VARCHAR(50),
    qty_vt INTEGER DEFAULT 1,
    qty_live INTEGER DEFAULT 0,
    price NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archive_cc_campaign ON archive_campaign_creators(campaign_id);
CREATE INDEX IF NOT EXISTS idx_archive_cc_username ON archive_campaign_creators(username);

-- 3. Tabel archive_videos
CREATE TABLE IF NOT EXISTS archive_videos (
    id SERIAL PRIMARY KEY,
    campaign_creator_id INTEGER NOT NULL REFERENCES archive_campaign_creators(id) ON DELETE CASCADE,
    urutan INTEGER DEFAULT 1,
    link_video TEXT,
    link_draft TEXT,
    concept TEXT,
    vt_approval VARCHAR(50) DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archive_videos_cc ON archive_videos(campaign_creator_id);

-- 4. Tabel archive_sales
CREATE TABLE IF NOT EXISTS archive_sales (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES archive_campaigns(id) ON DELETE CASCADE,
    creator_username TEXT NOT NULL,
    content_uid TEXT,
    content_type VARCHAR(50) DEFAULT 'video',
    gmv NUMERIC(18,2) NOT NULL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    price NUMERIC(18,2) DEFAULT 0,
    tanggal DATE DEFAULT '2024-01-01',
    order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archive_sales_campaign ON archive_sales(campaign_id);
CREATE INDEX IF NOT EXISTS idx_archive_sales_creator ON archive_sales(creator_username);

-- 5. Tabel archive_ads_performance
CREATE TABLE IF NOT EXISTS archive_ads_performance (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES archive_campaigns(id) ON DELETE CASCADE,
    creator_id INTEGER,
    creator_username TEXT,
    campaign_ads_name TEXT,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    cost_usd NUMERIC(18,4) DEFAULT 0,
    gross_revenue_usd NUMERIC(18,4) DEFAULT 0,
    kurs NUMERIC(18,2) DEFAULT 16000,
    tanggal DATE DEFAULT '2024-01-01',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archive_ads_campaign ON archive_ads_performance(campaign_id);

-- 6. Pindahkan data Company Lain dari tabel utama ke tabel archive
INSERT INTO archive_campaigns (id, nama, brand_id, tipe_campaign, status, start_date, end_date, target_gmv, target_video, target_creator, budget_creator_plafon, budget_ads_plafon, campaign_group, company, pin, require_client_approval, created_at)
SELECT id, nama, brand_id, tipe_campaign, status, start_date, end_date, target_gmv, target_video, target_creator, budget_creator_plafon, budget_ads_plafon, campaign_group, company, pin, require_client_approval, created_at
FROM campaigns WHERE company = 'OTHER'
ON CONFLICT (id) DO NOTHING;

INSERT INTO archive_campaign_creators (id, campaign_id, creator_id, username, nama_asli, link_account, approval, content_type, tier, qty_vt, qty_live, price, created_at)
SELECT cc.id, cc.campaign_id, cc.creator_id, COALESCE(c.username, 'unknown'), c.nama_asli, c.link_account, cc.approval, cc.content_type, cc.tier, cc.qty_vt, cc.qty_live, cc.price, cc.created_at
FROM campaign_creators cc
LEFT JOIN creators c ON cc.creator_id = c.id
WHERE cc.campaign_id IN (SELECT id FROM archive_campaigns)
ON CONFLICT (id) DO NOTHING;

INSERT INTO archive_videos (id, campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
SELECT v.id, v.campaign_creator_id, v.urutan, v.link_video, v.link_draft, v.concept, v.vt_approval, v.created_at
FROM videos v
WHERE v.campaign_creator_id IN (SELECT id FROM archive_campaign_creators)
ON CONFLICT (id) DO NOTHING;

INSERT INTO archive_sales (id, campaign_id, creator_username, content_uid, content_type, gmv, quantity, price, tanggal, order_id, created_at)
SELECT s.id, s.campaign_id, s.creator_username, s.content_uid, s.content_type, s.gmv, s.quantity, s.price, s.tanggal, s.order_id, s.created_at
FROM sales s
WHERE s.campaign_id IN (SELECT id FROM archive_campaigns)
ON CONFLICT (id) DO NOTHING;

INSERT INTO archive_ads_performance (id, campaign_id, creator_id, creator_username, campaign_ads_name, ad_id, ad_name, cost_usd, gross_revenue_usd, kurs, tanggal, created_at)
SELECT ap.id, ap.campaign_id, ap.creator_id, c.username, ap.campaign_ads_name, ap.ad_id, ap.ad_name, ap.cost_usd, ap.gross_revenue_usd, ap.kurs, ap.tanggal, ap.created_at
FROM ads_performance ap
LEFT JOIN creators c ON ap.creator_id = c.id
WHERE ap.campaign_id IN (SELECT id FROM archive_campaigns)
ON CONFLICT (id) DO NOTHING;

-- Sinkronkan sequence ID tabel archive
SELECT setval('archive_campaigns_id_seq', COALESCE((SELECT MAX(id) FROM archive_campaigns), 1));
SELECT setval('archive_campaign_creators_id_seq', COALESCE((SELECT MAX(id) FROM archive_campaign_creators), 1));
SELECT setval('archive_videos_id_seq', COALESCE((SELECT MAX(id) FROM archive_videos), 1));
SELECT setval('archive_sales_id_seq', COALESCE((SELECT MAX(id) FROM archive_sales), 1));
SELECT setval('archive_ads_performance_id_seq', COALESCE((SELECT MAX(id) FROM archive_ads_performance), 1));

-- 7. View Ringkasan Agregasi untuk Company Lain
CREATE OR REPLACE VIEW vw_archive_campaign_summary AS
WITH organic_sales AS (
    SELECT
        campaign_id,
        SUM(gmv) AS total_organic_gmv,
        SUM(gmv) FILTER (
            WHERE content_type ILIKE '%live%' OR content_type ILIKE '%livestream%'
        ) AS total_gmv_live,
        SUM(gmv) FILTER (
            WHERE content_type IS NULL
               OR NOT (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
        ) AS total_gmv_video
    FROM archive_sales
    GROUP BY campaign_id
),
ads_sales AS (
    SELECT campaign_id,
           SUM(gross_revenue_usd * kurs) AS total_ads_gmv_idr,
           SUM(cost_usd * kurs)          AS total_ads_cost_idr
    FROM (
        SELECT DISTINCT ON (campaign_id, ad_id)
               campaign_id, ad_id, gross_revenue_usd, cost_usd, kurs
        FROM archive_ads_performance
        ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
    ) latest_ads
    GROUP BY campaign_id
),
videos_count AS (
    SELECT cc.campaign_id, COUNT(v.id) as total_video_tayang
    FROM archive_videos v
    JOIN archive_campaign_creators cc ON v.campaign_creator_id = cc.id
    WHERE v.link_video IS NOT NULL
    GROUP BY cc.campaign_id
),
creators_count AS (
    SELECT campaign_id, COUNT(id) as total_creator_approved
    FROM archive_campaign_creators
    WHERE approval = 'approved'
    GROUP BY campaign_id
)
SELECT
    c.id as campaign_id,
    c.nama,
    c.tipe_campaign,
    c.status,
    c.start_date,
    c.end_date,
    c.target_gmv,
    c.target_video,
    c.target_creator,
    c.budget_creator_plafon,
    c.budget_ads_plafon,
    c.campaign_group,
    c.company,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS total_gmv_achievement,
    COALESCE(vc.total_video_tayang, 0) as achievement_video,
    COALESCE(cr.total_creator_approved, 0) as achievement_creator,
    COALESCE(a.total_ads_cost_idr, 0) as budget_ads_terpakai,
    c.budget_ads_plafon - COALESCE(a.total_ads_cost_idr, 0) as sisa_budget_ads,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS tracked_creator_gmv,

    0::numeric AS total_daily_organic,
    0::numeric AS total_daily_vsa,
    0::numeric AS official_daily_gmv,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS total_gmv,
    0::numeric AS total_pembayaran_kreator,
    COALESCE(a.total_ads_cost_idr, 0) AS total_ads_spend,

    COALESCE(o.total_gmv_video, 0) AS total_gmv_video,
    COALESCE(o.total_gmv_live, 0)  AS total_gmv_live,

    COALESCE(a.total_ads_gmv_idr, 0) AS total_ads_gmv
FROM archive_campaigns c
LEFT JOIN organic_sales o ON c.id = o.campaign_id
LEFT JOIN ads_sales a ON c.id = a.campaign_id
LEFT JOIN videos_count vc ON c.id = vc.campaign_id
LEFT JOIN creators_count cr ON c.id = cr.campaign_id;

-- 8. BERSIHKAN TABEL UTAMA TNT DARI SELURUH BARIS COMPANY LAIN
-- CASCADE akan otomatis membersihkan sales, videos, campaign_creators, dan ads_performance yang merujuk campaign ini.
DELETE FROM campaigns WHERE company = 'OTHER';

COMMIT;

\echo '=== MIGRATION 20261027220000 COMPLETED SUCCESSFULLY ==='
