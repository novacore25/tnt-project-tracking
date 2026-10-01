-- =====================================================================
-- 34 - INVENTARIS SEMUA SUMBER GMV (tanpa menebak nama kolom)
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan (pakai commit SHA, JANGAN "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/34-inventaris-gmv.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
--
-- TEMUAN SEBELUMNYA YANG SALAH
--   live_sessions TIDAK punya kolom gmv. Kolomnya: live_views, live_likes,
--   live_product_rpm. GMV live ada di live_session_products.gmv, dan tabel itu
--   tidak punya sku_id maupun campaign_creator_id, hanya livestream_room_id
--   dan product_id.
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. INVENTARIS: tabel mana yang benar-benar punya data ==='
SELECT c.relname AS nama,
       CASE c.relkind WHEN 'r' THEN 'tabel' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized' ELSE c.relkind::text END AS jenis,
       c.reltuples::bigint AS Estimasi_baris
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'sales','ads_performance','ads_performance_delta','ads_lifetime_snapshots',
    'live_sessions','live_session_products','daily_performance',
    'campaign_creators_performance','campaign_sales_summary','campaign_total_sales',
    'campaign_creators','creator_snapshots','skus',
    'sales_aman_backup_20260930','sales_bk_20260930b','sales_excel_backup_20260930',
    'vw_campaign_summary','vw_creator_latest_snapshot','vw_creators_with_computed'
  )
ORDER BY jenis, nama;

\echo ''
\echo '=== 2. JUMLAH BARIS PERSIS (estimasi bisa meleset) ==='
SELECT 'sales'                             AS nama, count(*) AS baris FROM sales
UNION ALL SELECT 'ads_performance',           count(*) FROM ads_performance
UNION ALL SELECT 'ads_performance_delta',    count(*) FROM ads_performance_delta
UNION ALL SELECT 'ads_lifetime_snapshots',   count(*) FROM ads_lifetime_snapshots
UNION ALL SELECT 'live_sessions',            count(*) FROM live_sessions
UNION ALL SELECT 'live_session_products',    count(*) FROM live_session_products
UNION ALL SELECT 'campaign_creators_performance', count(*) FROM campaign_creators_performance
UNION ALL SELECT 'campaign_sales_summary',   count(*) FROM campaign_sales_summary
UNION ALL SELECT 'campaign_total_sales',     count(*) FROM campaign_total_sales
UNION ALL SELECT 'sales_aman_backup_20260930', count(*) FROM sales_aman_backup_20260930
UNION ALL SELECT 'sales_bk_20260930b',       count(*) FROM sales_bk_20260930b
UNION ALL SELECT 'sales_excel_backup_20260930', count(*) FROM sales_excel_backup_20260930
ORDER BY 1;

\echo ''
\echo '=== 3. GMV LIVE dari live_session_products ==='
SELECT COALESCE(sum(gmv),0) AS gmv_live,
       COALESCE(sum(orders),0) AS orders_live,
       COALESCE(sum(items_sold),0) AS item_live,
       min(ls.start_time) AS dari, max(ls.start_time) AS sampai
FROM live_session_products lsp
LEFT JOIN live_sessions ls ON ls.livestream_room_id = lsp.livestream_room_id;

\echo ''
\echo '=== 4. GMV LIVE BISA DIHUBUNGKAN KE CAMPAIGN? ==='
-- jalur A: lewat creator_username -> creators -> campaign_creators
-- jalur B: lewat tt_campaign_id -> campaigns.tiktok_campaign_ids
SELECT
  count(*)                                                          AS total_baris_live,
  count(*) FILTER (WHERE c.id IS NOT NULL)                          AS bisa_lewat_kreator,
  count(*) FILTER (WHERE cp.id IS NOT NULL)                         AS bisa_lewat_tt_campaign,
  count(*) FILTER (WHERE c.id IS NULL AND cp.id IS NULL)            AS tidak_bisa_diapa_ini
FROM live_session_products lsp
LEFT JOIN live_sessions ls ON ls.livestream_room_id = lsp.livestream_room_id
LEFT JOIN creators c ON LOWER(c.username) = LOWER(ls.creator_username)
LEFT JOIN campaign_creators cc ON cc.creator_id = c.id
LEFT JOIN campaigns cp ON ls.tt_campaign_id = ANY(cp.tiktok_campaign_ids);

\echo ''
\echo '=== 5. GMV LIVE PER CAMPAIGN (lewat kreator) ==='
SELECT cc.campaign_id, c.nama, count(DISTINCT lsp.livestream_room_id) AS sesi,
       COALESCE(sum(lsp.gmv),0) AS gmv_live, count(DISTINCT cc.creator_id) AS kreator
FROM live_session_products lsp
JOIN live_sessions ls ON ls.livestream_room_id = lsp.livestream_room_id
JOIN creators cr ON LOWER(cr.username) = LOWER(ls.creator_username)
JOIN campaign_creators cc ON cc.creator_id = cr.id
JOIN campaigns c ON c.id = cc.campaign_id
GROUP BY 1,2 ORDER BY 5 DESC LIMIT 25;

\echo ''
\echo '=== 6. BACKUP SALES: adakah order yang hilang dari tabel sales? ==='
-- Kalau backup punya order_id yang tidak ada di sales, itu order hilang.
SELECT 'aman_backup' AS backup,
       (SELECT count(*) FROM sales_aman_backup_20260930) AS baris,
       (SELECT count(*) FROM sales_aman_backup_20260930 b
          WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)) AS tidak_ada_di_sales,
       (SELECT COALESCE(sum(b.gmv),0) FROM sales_aman_backup_20260930 b
          WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)) AS gmv_hilang
UNION ALL
SELECT 'bk_20260930b',
       (SELECT count(*) FROM sales_bk_20260930b),
       (SELECT count(*) FROM sales_bk_20260930b b
          WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)),
       (SELECT COALESCE(sum(b.gmv),0) FROM sales_bk_20260930b b
          WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id))
UNION ALL
SELECT 'excel_backup',
       (SELECT count(*) FROM sales_excel_backup_20260930),
       (SELECT count(*) FROM sales_excel_backup_20260930 b
          WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)),
       (SELECT COALESCE(sum(b.gmv),0) FROM sales_excel_backup_20260930 b
          WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id));

\echo ''
\echo '=== 7. ads_performance_delta: apakah sudah menyelesaikan masalah kumulatif? ==='
SELECT * FROM ads_performance_delta LIMIT 3;

\echo ''
\echo '=== 8. ads_lifetime_snapshots ==='
SELECT * FROM ads_lifetime_snapshots LIMIT 3;

\echo ''
\echo '=== 9. campaign_total_sales: cocok dengan sales? ==='
SELECT * FROM campaign_total_sales LIMIT 3;

\echo ''
\echo '=== 10. campaign_creators_performance ==='
SELECT * FROM campaign_creators_performance LIMIT 3;

\echo ''
\echo '=== 11. campaign_sales_summary ==='
SELECT * FROM campaign_sales_summary LIMIT 3;
