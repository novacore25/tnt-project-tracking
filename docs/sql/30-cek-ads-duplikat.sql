-- =====================================================================
-- 30 - APAKAH ads_performance BERDOUBLIKASI (penyebab GMV 11,7 miliar)
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan (pakai commit SHA, JANGAN "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/30-cek-ads-doouble.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. KOLOM ads_performance yang benar-benar ada ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns WHERE table_name = 'ads_performance' ORDER BY ordinal_position;

\echo ''
\echo '=== 2. INDEX / CONSTRAINT (apakah ada unique?) ==='
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ads_performance';

\echo ''
\echo '=== 3. FAKTOR DUPLIKASI ==='
-- kunci alami: satu baris = satu ad pada satu tanggal untuk satu campaign
SELECT
  (SELECT count(*) FROM ads_performance)                                  AS total_baris,
  (SELECT count(DISTINCT (campaign_id, ad_id, tanggal)) FROM ads_performance) AS unik_campaign_ad_tanggal,
  (SELECT count(DISTINCT (ad_id, tanggal)) FROM ads_performance)           AS unik_ad_tanggal,
  (SELECT count(DISTINCT ad_id) FROM ads_performance)                      AS jumlah_ad,
  round((SELECT count(*) FROM ads_performance)::numeric
        / NULLIF((SELECT count(DISTINCT (campaign_id, ad_id, tanggal)) FROM ads_performance),0), 2) AS faktor_duplikasi;

\echo ''
\echo '=== 4. FAKTOR DUPLIKASI PER CAMPAIGN ==='
SELECT c.id, c.nama,
       count(*)                                                   AS baris,
       count(DISTINCT (ap.ad_id, ap.tanggal))                    AS unik_ad_tanggal,
       round(count(*)::numeric / NULLIF(count(DISTINCT (ap.ad_id, ap.tanggal)),0), 2) AS faktor,
       min(ap.tanggal) AS dari, max(ap.tanggal) AS sampai
FROM ads_performance ap JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY 1,2 ORDER BY count(*) DESC LIMIT 25;

\echo ''
\echo '=== 5. APAKAH BARISNYA BENAR-BENAR IDENTIK? ==='
-- kalau nilainya beda-beda, itu bukan duplikasi import tapi data berbeda
SELECT jumlah_varian, count(*) AS kelompok
FROM (
  SELECT campaign_id, ad_id, tanggal, count(DISTINCT cost_usd || '|' || gross_revenue_usd) AS jumlah_varian
  FROM ads_performance
  GROUP BY 1,2,3
) x
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== 6. SANITY AOV: GMV per pembelian (harus ~50rb - 500rb) ==='
SELECT c.id, c.nama,
       COALESCE(sum(ap.gross_revenue_usd * ap.kurs),0)                AS gmv_idr,
       COALESCE(sum(ap.purchases),0)                                   AS pembelian,
       COALESCE(sum(ap.items_purchased),0)                              AS item_terjual,
       round(COALESCE(sum(ap.gross_revenue_usd * ap.kurs),0)
             / NULLIF(sum(ap.purchases),0))                             AS aov_idr_per_pembelian,
       round(COALESCE(sum(ap.gross_revenue_usd * ap.kurs),0)
             / NULLIF(sum(ap.items_purchased),0))                       AS harga_per_item
FROM ads_performance ap JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY 1,2 ORDER BY 4 DESC NULLS LAST LIMIT 25;

\echo ''
\echo '=== 7. SANITY CPC & CPM (harga per klik harus ~500 - 5000) ==='
SELECT c.id, c.nama,
       round(COALESCE(sum(ap.cost_usd * ap.kurs),0) / NULLIF(sum(ap.clicks),0))          AS cpc_idr,
       round(COALESCE(sum(ap.cost_usd * ap.kurs),0) / NULLIF(sum(ap.impressions),0)*1000) AS cpm_idr,
       COALESCE(sum(ap.clicks),0)     AS total_klik,
       COALESCE(sum(ap.impressions),0) AS total_tayang
FROM ads_performance ap JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY 1,2 ORDER BY 3 DESC NULLS LAST LIMIT 25;

\echo ''
\echo '=== 8. KURS: apakah seragam? (variasinya bisa mengacaukan rasio) ==='
SELECT kurs, count(*) AS baris, min(tanggal) AS dari, max(tanggal) AS sampai
FROM ads_performance GROUP BY kurs ORDER BY baris DESC LIMIT 15;

\echo ''
\echo '=== 9. ROAS SEBELUM vs SESUDAH DI-DEDUP ==='
-- Ini inti masalahnya. Kalau ROAS sesudah dedup masuk 2x - 8x, duplikatnya
-- penyebabnya. Kalau tetap 30x+, berarti kolom revenue-nya yang salah.
SELECT c.id, c.nama,
       round(sum(ap.gross_revenue_usd * ap.kurs) / NULLIF(sum(ap.cost_usd * ap.kurs),0), 2) AS roas_mentah,
       (SELECT round(sum(x.gross_revenue_usd * x.kurs) / NULLIF(sum(x.cost_usd * x.kurs),0), 2)
        FROM (SELECT DISTINCT ON (campaign_id, ad_id, tanggal) *
              FROM ads_performance ORDER BY campaign_id, ad_id, tanggal, id) x
        WHERE x.campaign_id = c.id)                                                        AS roas_dedup
FROM ads_performance ap JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25;

\echo ''
\echo '=== 10. BARIS PER BULAN (apakah ada yang diimport berulang tiap bulan?) ==='
SELECT to_char(tanggal,'YYYY-MM') AS bulan, count(*) AS baris,
       count(DISTINCT (campaign_id, ad_id, tanggal)) AS unik,
       round(COALESCE(sum(gross_revenue_usd * kurs),0),0) AS gmv_idr
FROM ads_performance GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== 11. 10 BARIS OMG MAKEUP (yang ROAS-nya 39x) ==='
SELECT id, ad_id, ad_name, tanggal, cost_usd, gross_revenue_usd, kurs,
       purchases, items_purchased, clicks, impressions
FROM ads_performance
WHERE campaign_id = 33
ORDER BY tanggal, ad_id LIMIT 10;

\echo ''
\echo '=== 12. RAW_DATA salah satu baris (lihat apa sebenarnya kolom aslinya) ==='
SELECT jsonb_pretty(raw_data) FROM ads_performance WHERE campaign_id = 33 AND gross_revenue_usd > 0 LIMIT 1;
