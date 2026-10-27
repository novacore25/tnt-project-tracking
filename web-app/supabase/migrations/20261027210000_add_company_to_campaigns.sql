-- Migration: 20261027210000_add_company_to_campaigns.sql
-- Purpose: Menambahkan kolom company di tabel campaigns untuk isolasi multi-company (TNT vs Company Lain)
--          dan menyertakan kolom company pada view agregasi vw_campaign_summary.

\echo '=== MIGRATION: 20261027210000_add_company_to_campaigns ==='

-- 1. Tambah kolom company di tabel campaigns (default 'TNT')
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS company VARCHAR(50) DEFAULT 'TNT' NOT NULL;

-- 2. Buat index untuk performa filter per company
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns(company);

-- 3. Perbarui view agregasi vw_campaign_summary agar menyertakan kolom company & campaign_group
DROP VIEW IF EXISTS vw_campaign_summary CASCADE;

CREATE VIEW vw_campaign_summary AS
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
    FROM sales
    WHERE campaign_id IS NOT NULL
    GROUP BY campaign_id
),
ads_per_ad AS (
    SELECT DISTINCT ON (campaign_id, ad_id)
           campaign_id,
           ad_id,
           gross_revenue_usd * kurs AS ads_gmv_idr,
           cost_usd * kurs          AS ads_cost_idr
    FROM ads_performance
    ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
),
ads_sales AS (
    SELECT campaign_id,
           SUM(ads_gmv_idr)  AS total_ads_gmv_idr,
           SUM(ads_cost_idr) AS total_ads_cost_idr
    FROM ads_per_ad
    GROUP BY campaign_id
),
videos_count AS (
    SELECT campaign_id, COUNT(id) as total_video_tayang
    FROM vw_video_klasifikasi
    WHERE punya_link IS TRUE
      AND is_livestream IS NOT TRUE
    GROUP BY campaign_id
),
creators_count AS (
    SELECT campaign_id, COUNT(id) as total_creator_approved
    FROM campaign_creators WHERE approval = 'approved'
    GROUP BY campaign_id
),
payment_stats AS (
    SELECT campaign_id, COALESCE(SUM(nominal_pelunasan), 0) AS total_pembayaran_kreator
    FROM campaign_creators GROUP BY campaign_id
),
daily_stats AS (
    SELECT campaign_id,
           COALESCE(SUM(organic_sales), 0) as total_daily_organic,
           COALESCE(SUM(vsa_sales), 0) as total_daily_vsa
    FROM daily_performance GROUP BY campaign_id
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

    COALESCE(ds.total_daily_organic, 0) AS total_daily_organic,
    COALESCE(ds.total_daily_vsa, 0) AS total_daily_vsa,
    (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)) AS official_daily_gmv,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS total_gmv,
    COALESCE(ps.total_pembayaran_kreator, 0) AS total_pembayaran_kreator,
    COALESCE(a.total_ads_cost_idr, 0) AS total_ads_spend,

    COALESCE(o.total_gmv_video, 0) AS total_gmv_video,
    COALESCE(o.total_gmv_live, 0)  AS total_gmv_live,

    COALESCE(a.total_ads_gmv_idr, 0) AS total_ads_gmv
FROM campaigns c
LEFT JOIN organic_sales o ON c.id = o.campaign_id
LEFT JOIN ads_sales a ON c.id = a.campaign_id
LEFT JOIN videos_count vc ON c.id = vc.campaign_id
LEFT JOIN creators_count cr ON c.id = cr.campaign_id
LEFT JOIN payment_stats ps ON c.id = ps.campaign_id
LEFT JOIN daily_stats ds ON c.id = ds.campaign_id;

\echo '=== MIGRATION 20261027210000_add_company_to_campaigns COMPLETED ==='
