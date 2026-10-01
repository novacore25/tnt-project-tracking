-- =====================================================================
-- 33 - APAKAH ADA SUMBER GMV LAIN YANG TERLEWAT?
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Pertanyaan: "total_gmv itu summary semua GMV di campaign kan?"
-- Jawaban: TIDAK. View itu hanya sales + ads + legacy. Live GMV tidak pernah
-- masuk. File ini mengukurGMV live supaya definisi totalnya bisa benar.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. KOLOM live_sessions & live_session_products (cek dulu) ==='
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('live_sessions','live_session_products')
ORDER BY table_name, ordinal_position;

\echo ''
\echo '=== 2. ADA TABEL LAIN YANG PUNYA KOLOM gmv? ==='
-- Daftar lengkap sumber GMV yang ada di database.
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name ILIKE '%gmv%' OR column_name ILIKE '%revenue%' OR column_name ILIKE '%sales%'
ORDER BY table_name, column_name;

\echo ''
\echo '=== 3. TOTAL GMV PER SUMBER (tabel sales-like) ==='
SELECT 'sales (affiliate order)'            AS sumber, count(*) AS baris,
       COALESCE(sum(gmv),0) AS total_gmv, 'order_id UNIQUE' AS credibility
FROM sales WHERE NOT is_refund
UNION ALL
SELECT 'ads_performance (SUM, cara lama)', count(*),
       COALESCE(sum(gross_revenue_usd*kurs),0), 'KUMULATIF, jangan pakai SUM'
FROM ads_performance
UNION ALL
SELECT 'ads_performance (per-ad terakhir)', count(*),
       COALESCE(sum(x.rev),0), 'estimasi revenue yang sama dgn sales'
FROM (SELECT DISTINCT ON (campaign_id, ad_id) gross_revenue_usd*kurs AS rev
      FROM ads_performance ORDER BY campaign_id, ad_id, tanggal DESC) x
UNION ALL
SELECT 'daily_performance', count(*), COALESCE(sum(organic_sales),0), 'KOSONG'
FROM daily_performance;

\echo ''
\echo '=== 4. GMV LIVE: berapa? ==='
SELECT count(*) AS baris_live,
       COALESCE(sum(gmv),0) AS total_gmv_live,
       COALESCE(sum(unit_sold),0) AS total_unit
FROM live_sessions;

\echo ''
\echo '=== 5. live_session_products (apakah ini breakdown atau tambahan?) ==='
SELECT count(*) AS baris,
       COALESCE(sum(gmv),0) AS total_gmv,
       COALESCE(sum(qty_sold),0) AS total_qty
FROM live_session_products;

\echo ''
\echo '=== 6. GMV LIVE PER CAMPAIGN (lewat campaign_creators) ==='
-- Kalau live_sessions punya campaign_creator_id, bisa diihiung per campaign.
SELECT c.id, c.nama, count(*) AS sesi_live,
       COALESCE(sum(ls.gmv),0) AS gmv_live
FROM live_sessions ls
JOIN campaign_creators cc ON cc.id = ls.campaign_creator_id
JOIN campaigns c ON c.id = cc.campaign_id
GROUP BY 1,2 ORDER BY gmv_live DESC LIMIT 25;

\echo ''
\echo '=== 7. APAKAH live_sessions BISA DIHUBUNGKAN KE CAMPAIGN? ==='
-- Kalau tidak ada kolom campaign_creator_id, maka GMV live tidak bisa
-- diatribusikan ke campaign dan tidak bisa masuk total_gmv.
SELECT
  (SELECT count(*) FROM live_sessions) AS total_sesi,
  (SELECT count(*) FROM live_sessions ls
     WHERE EXISTS (SELECT 1 FROM campaign_creators cc WHERE cc.id = ls.campaign_creator_id)) AS sesi_yang_bisa_ke_campaign,
  (SELECT count(*) FROM live_sessions ls WHERE ls.gmv > 0) AS sesi_dengan_gmv;

\echo ''
\echo '=== 8. creator_snapshots: gmv_30d (perkiraan per kreator) ==='
SELECT count(*) AS baris,
       count(*) FILTER (WHERE gmv_30d > 0) AS ada_gmv,
       COALESCE(sum(gmv_30d),0) AS total_gmv_30d,
       COALESCE(sum(gmv_30d_video),0) AS gmv_30d_video,
       COALESCE(sum(gmv_30d_live),0) AS gmv_30d_live,
       COALESCE(sum(gmv_30d_organic),0) AS gmv_30d_organic
FROM creator_snapshots;

\echo ''
\echo '=== 9. DEFINISI "TOTAL GMV CAMPAIGN" YANG JUJUR ==='
-- Tampilkan semua kombinasi supaya kelihatan mana yang masuk akal.
SELECT
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL) AS a_sales,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund AND campaign_id IS NULL)       AS b_sales_belum_terpetakan,
  (SELECT COALESCE(sum(gmv),0) FROM live_sessions)                                          AS c_live,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL)
    + (SELECT COALESCE(sum(gmv),0) FROM live_sessions)                                      AS d_sales_plus_live;

\echo ''
\echo '=== 10. GMV LIVE PER KREATOR: adakah yang berduplikasi dengan sales? ==='
-- Kalau live_session_products memakai SKU yang sama dengan order sales, itu
-- berpotensi dobel. Cek overlap lewat SKU.
SELECT count(DISTINCT lsp.sku_id) AS sku_dari_live,
       count(DISTINCT sl.sku_id)  AS sku_dari_sales,
       (SELECT count(*) FROM live_session_products lsp
         WHERE lsp.sku_id IN (SELECT sku_id FROM sales WHERE sku_id IS NOT NULL)) AS baris_live_yang_sku-nya_ada_di_sales
FROM live_session_products lsp, sales sl
WHERE lsp.sku_id IS NOT NULL;
