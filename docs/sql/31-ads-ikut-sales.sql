-- =====================================================================
-- 31 - APAKAH ads_performance BERISI ORDER YANG SAMA DENGAN sales?
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan (pakai commit SHA, JANGAN "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/31-ads-ikut-sales.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. ORDER ads_performance vs ORDER sales (apakah superset?) ==='
-- Kalau pembelian_ads jauh lebih besar dari order_sales, itu bukti kolom itu
-- berisi seluruh penjualan, bukan hanya penjualan yang disebabkan iklan.
SELECT c.id, c.nama,
       (SELECT COALESCE(sum(ap.purchases),0) FROM ads_performance ap WHERE ap.campaign_id = c.id)  AS pembelian_ads,
       (SELECT count(*) FROM sales sl WHERE sl.campaign_id = c.id AND NOT sl.is_refund)               AS order_sales,
       round((SELECT COALESCE(sum(ap.purchases),0) FROM ads_performance ap WHERE ap.campaign_id = c.id)::numeric
             / NULLIF((SELECT count(*) FROM sales sl WHERE sl.campaign_id = c.id AND NOT sl.is_refund),0), 1) AS kali_lebih_besar,
       (SELECT COALESCE(sum(ap.gross_revenue_usd*ap.kurs),0) FROM ads_performance ap WHERE ap.campaign_id = c.id) AS gmv_ads,
       (SELECT COALESCE(sum(sl.gmv),0) FROM sales sl WHERE sl.campaign_id = c.id AND NOT sl.is_refund)             AS gmv_sales
FROM campaigns c
WHERE EXISTS (SELECT 1 FROM ads_performance ap WHERE ap.campaign_id = c.id)
ORDER BY pembelian_ads DESC;

\echo ''
\echo '=== 2. ADA BARIS YANG PEMBELIANNYA LEBIH BANYAK DARI KLIKNYA? ==='
-- Secara fisik tidak mungkin. Kalau ada, "purchases" itu bukan dari iklan.
SELECT count(*) AS baris,
       count(*) FILTER (WHERE purchases > clicks) AS pembelian_lebih_dari_klik,
       count(*) FILTER (WHERE items_purchased > 0)  AS items_purchased_ada,
       count(*) FILTER (WHERE clicks = 0 AND purchases > 0) AS klik_nol_tapi_ada_pembelian
FROM ads_performance;

\echo ''
\echo '=== 3. TANGGAL: apakah periode ads sama dengan periode sales? ==='
SELECT c.nama,
       (SELECT min(tanggal) FROM ads_performance ap WHERE ap.campaign_id=c.id) AS ads_dari,
       (SELECT max(tanggal) FROM ads_performance ap WHERE ap.campaign_id=c.id) AS ads_sampai,
       (SELECT min(tanggal) FROM sales sl WHERE sl.campaign_id=c.id)           AS sales_dari,
       (SELECT max(tanggal) FROM sales sl WHERE sl.campaign_id=c.id)           AS sales_sampai,
       (SELECT count(DISTINCT tanggal) FROM ads_performance ap WHERE ap.campaign_id=c.id) AS hari_ads
FROM campaigns c WHERE EXISTS (SELECT 1 FROM ads_performance ap WHERE ap.campaign_id=c.id)
ORDER BY c.nama;

\echo ''
\echo '=== 4. SATU HARI, SATU PRODUK: apa yang sebenarnya dihitung ads? ==='
-- Kalau satu baris ads untuk satu hari punya purchases jauh melebihi seluruh
-- order sales di hari itu untuk campaign yang sama, itu bukan atribusi iklan.
WITH per AS (
  SELECT ap.campaign_id, ap.tanggal, sum(ap.purchases) AS beli_ads, sum(ap.gross_revenue_usd*ap.kurs) AS gmv_ads
  FROM ads_performance ap GROUP BY 1,2
), sl AS (
  SELECT campaign_id, tanggal::date AS tanggal, count(*) AS order_sales, sum(gmv) AS gmv_sales
  FROM sales WHERE NOT is_refund GROUP BY 1,2
)
SELECT p.campaign_id, c.nama, p.tanggal, p.beli_ads, s.order_sales, round(p.gmv_ads) AS gmv_ads, round(s.gmv_sales) AS gmv_sales
FROM per p
LEFT JOIN sl s ON s.campaign_id = p.campaign_id AND s.tanggal = p.tanggal
JOIN campaigns c ON c.id = p.campaign_id
ORDER BY p.gmv_ads DESC LIMIT 20;

\echo ''
\echo '=== 5. KURS: baris dengan kurs tidak masuk akal ==='
SELECT id, campaign_id, ad_id, ad_name, tanggal, cost_usd, gross_revenue_usd, kurs, purchases, clicks
FROM ads_performance
WHERE kurs < 5000 OR kurs > 25000
ORDER BY kurs LIMIT 20;

\echo ''
\echo '=== 6. KURS: berapa yang pakai default 18000 vs kurs sebenarnya? ==='
SELECT
  count(*) FILTER (WHERE kurs = 18000)                                    AS pakai_18000,
  count(*) FILTER (WHERE kurs <> 18000 AND kurs >= 5000)                  AS kurs_asli,
  count(*) FILTER (WHERE kurs < 5000)                                     AS kurs_rusak,
  min(kurs) FILTER (WHERE kurs >= 5000)                                   AS kurs_min,
  max(kurs) FILTER (WHERE kurs >= 5000)                                   AS kurs_max
FROM ads_performance;

\echo ''
\echo '=== 7. PRODUCT_ID di ads: ada yang bisa dicocokkan ke sales? ==='
SELECT count(*) AS baris_ads,
       count(*) FILTER (WHERE product_id IS NOT NULL) AS punya_product_id,
       count(DISTINCT product_id) AS product_unik
FROM ads_performance;

\echo ''
\echo '=== 8. APAKAH GMV ADS = GMV SALES UNTUK PRODUK & PERIODE YANG SAMA? ==='
-- Ini uji terakhir. Kalau cocok, berarti keduanya data yang sama.
WITH per AS (
  SELECT campaign_id, sum(gross_revenue_usd*kurs) AS gmv_ads
  FROM ads_performance GROUP BY 1
), sl AS (
  SELECT campaign_id, sum(gmv) AS gmv_sales
  FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL GROUP BY 1
)
SELECT p.campaign_id, c.nama, round(p.gmv_ads) AS gmv_ads, round(COALESCE(s.gmv_sales,0)) AS gmv_sales,
       round(p.gmv_ads / NULLIF(COALESCE(s.gmv_sales,0),0), 1) AS rasio
FROM per p LEFT JOIN sl s ON s.campaign_id = p.campaign_id
JOIN campaigns c ON c.id = p.campaign_id
ORDER BY p.gmv_ads DESC;

\echo ''
\echo '=== 9. APA YANG AKTUALNYA DITAMPILKAN DASHBOARD SEKARANG ==='
SELECT campaign_id, nama, total_gmv, total_gmv_achievement, tracked_creator_gmv,
       total_ads_spend, budget_ads_plafon, official_daily_gmv
FROM vw_campaign_summary
WHERE total_gmv > 0
ORDER BY total_gmv DESC LIMIT 15;

\echo ''
\echo '=== 10. KOLOM TABEL sales yang relevan ==='
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sales' ORDER BY ordinal_position;
