-- =====================================================================
-- 19 - Urai asal angka total_gmv di vw_campaign_summary
-- Tanggal : 2026-10-01
-- Alasan  : vw_campaign_summary melaporkan total GMV Rp 12,5 miliar,
--           sedangkan tabel `sales` (non-refund) cuma Rp 1,1 miliar.
--           View itu menjumlahkan 3 sumber, bukan cuma sales:
--             total_gmv = GREATEST(
--                 daily_performance.organic + daily_performance.vsa,   <- 0, tabel kosong
--                 sales + ads_performance + campaign_creators.legacy   <- yang dipakai
--             )
--           File ini mengurai masing-masing sumber per campaign.
--
-- READ-ONLY. Hanya SELECT.
--
-- Jalankan:
-- curl -s https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/19-urai-asal-total-gmv.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== A. Apakah daily_performance benar-benar kosong? ==='
SELECT count(*) AS baris,
       count(DISTINCT campaign_id) AS campaign_terisi,
       COALESCE(sum(organic_sales),0) AS organic,
       COALESCE(sum(vsa_sales),0) AS vsa
FROM daily_performance;

\echo ''
\echo '=== B. TIGA SUMBER, tiap sumber total sendiri ==='
SELECT
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund) AS a_sales,
  (SELECT COALESCE(sum(gross_revenue_usd*kurs),0) FROM ads_performance) AS b_ads,
  (SELECT COALESCE(sum(COALESCE(gmv_organic_legacy,0)+COALESCE(gmv_ads_legacy,0)),0) FROM campaign_creators) AS c_legacy,
  (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary) AS d_total_view;

\echo ''
\echo '=== C. KOLOM legacy benar-benar ada? ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaign_creators'
  AND column_name IN ('gmv_organic_legacy','gmv_ads_legacy','gmv_organic','gmv_ads')
ORDER BY column_name;

\echo ''
\echo '=== D. URAI PER CAMPAIGN: sales vs ads vs legacy ==='
SELECT
  c.id, c.nama,
  COALESCE(os.total_organic_gmv,0)  AS sales,
  COALESCE(ad.total_ads_gmv_idr,0)   AS ads,
  COALESCE(lg.total_legacy_gmv,0)   AS legacy,
  COALESCE(os.total_organic_gmv,0) + COALESCE(ad.total_ads_gmv_idr,0) + COALESCE(lg.total_legacy_gmv,0) AS jumlah_view,
  COALESCE(v.total_gmv,0) AS total_gmv_view
FROM campaigns c
LEFT JOIN (SELECT campaign_id, SUM(gmv) AS total_organic_gmv
           FROM sales WHERE is_refund = false GROUP BY campaign_id) os ON os.campaign_id = c.id
LEFT JOIN (SELECT campaign_id, SUM(gross_revenue_usd*kurs) AS total_ads_gmv_idr
           FROM ads_performance GROUP BY campaign_id) ad ON ad.campaign_id = c.id
LEFT JOIN (SELECT campaign_id,
                  SUM(COALESCE(gmv_organic_legacy,0)+COALESCE(gmv_ads_legacy,0)) AS total_legacy_gmv
           FROM campaign_creators GROUP BY campaign_id) lg ON lg.campaign_id = c.id
LEFT JOIN vw_campaign_summary v ON v.campaign_id = c.id
ORDER BY jumlah_view DESC NULLS LAST
LIMIT 25;

\echo ''
\echo '=== E. 15 campaign TERBESAR dari LEGACY (sumber mencurigakan) ==='
SELECT c.id, c.nama,
       count(*) AS jml_baris_cc,
       COALESCE(sum(COALESCE(cc.gmv_organic_legacy,0)),0) AS legacy_organic,
       COALESCE(sum(COALESCE(cc.gmv_ads_legacy,0)),0)     AS legacy_ads
FROM campaign_creators cc
JOIN campaigns c ON c.id = cc.campaign_id
GROUP BY c.id, c.nama
HAVING sum(COALESCE(cc.gmv_organic_legacy,0)+COALESCE(cc.gmv_ads_legacy,0)) > 0
ORDER BY (sum(COALESCE(cc.gmv_organic_legacy,0)+COALESCE(cc.gmv_ads_legacy,0))) DESC
LIMIT 15;

\echo ''
\echo '=== F. 15 campaign TERBESAR dari ADS ==='
SELECT c.id, c.nama,
       count(*) AS jml_ad,
       COALESCE(sum(ap.gross_revenue_usd*ap.kurs),0) AS ads_gmv,
       COALESCE(sum(ap.cost_usd*ap.kurs),0) AS ads_cost
FROM ads_performance ap
JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY c.id, c.nama
ORDER BY ads_gmv DESC
LIMIT 15;

\echo ''
\echo '=== G. Berapa campaign yang angka LEGACY-nya melebihi SALES-nya? ==='
-- Kalau banyak, berarti dashboard menampilkan angka yang tidak terkait TikTok.
WITH per AS (
  SELECT cc.campaign_id,
         COALESCE(sum(COALESCE(cc.gmv_organic_legacy,0)+COALESCE(cc.gmv_ads_legacy,0)),0) AS legacy
  FROM campaign_creators cc GROUP BY cc.campaign_id
), sl AS (
  SELECT campaign_id, SUM(gmv) AS sales
  FROM sales WHERE is_refund = false GROUP BY campaign_id
)
SELECT count(*) FILTER (WHERE per.legacy > COALESCE(sl.sales,0) AND per.legacy > 0) AS legacy_lebih_besar,
       count(*) FILTER (WHERE per.legacy > 0) AS punya_legacy,
       count(*) AS total_campaign_dengan_sales
FROM per LEFT JOIN sl ON sl.campaign_id = per.campaign_id;

\echo ''
\echo '=== H. Dashboard menampilkan apa untuk campaign 36 (SALSA Mom & Baby)? ==='
SELECT campaign_id, nama,
       total_gmv, total_gmv_achievement, tracked_creator_gmv,
       official_daily_gmv, total_daily_organic
FROM vw_campaign_summary
WHERE campaign_id = 36;