-- =====================================================================
-- 47 - SELIDIKI 54 AD YANG NILAINYA LEBIH RENDAH DI TANGGAL TERAKHIR
-- Tanggal : 2026-10-02
-- READ-ONLY. Hanya SELECT.
--
-- KENAPA FILE INI ADA
--   Migration 20261002000000 memakai "baris pada TANGGAL TERAKHIR per ad_id"
--   sesuai aturan pemilik sistem. Hasilnya:
--     MAX per ad          = Rp 3.248.391.566
--     Tanggal terakhir    = Rp 3.240.023.432
--     Beda                = Rp     8.368.134  (0,26% dari total)
--     Jumlah ad berbeda   = 54 dari 316
--
--   Kalau laporan Ads benar-benar ALL TIME kumulatif, nilai di tanggal
--   terakhir harus SELALU yang tertinggi. Kalau tidak, ada sesuatu yang
--   tidak sesuai premis -- dan itu belum ketahuan apa.
--
--   Yang tidak kita tahu:
--     - apakah counter TikTok pernah di-reset / di-restate
--     - apakah ada baris duplikat atau salah impor
--     - apakah ad_id yang sama dipakai ulang untuk ad yang berbeda
--     - apakah kurs di baris terakhir berbeda dari biasanya
--
--   Bedanya cuma 0,26% jadi dampaknya kecil, tapi tidak boleh dibiarkan
--   tanpa penjelasan.
--
-- CARA PAKAI
--   Ubah AD_ID di §A untuk melihat semua baris milik satu iklan.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== §A. SEMUA BARIS UNTUK SATU AD (ubah AD_ID di bawah) ==='
SELECT
  id,
  tanggal,
  ad_name,
  round(gross_revenue_usd, 2)  AS gmv_usd,
  round(cost_usd, 2)           AS cost_usd,
  kurs,
  purchases,
  clicks,
  impressions,
  campaign_id
FROM ads_performance
WHERE ad_id = '1863499379234897'
ORDER BY tanggal, id;

\echo ''
\echo '=== §B. RINGKASAN 54 AD BERBEDA: apakah kurs penyebabnya? ==='
\echo '-- Kalau kurs di tanggal terakhir jauh berbeda, itu penjelasan lain.'
WITH max_per_ad AS (
    SELECT campaign_id, ad_id,
           MAX(gross_revenue_usd * kurs) AS gmv_max,
           MIN(kurs) AS kurs_min, MAX(kurs) AS kurs_max
    FROM ads_performance GROUP BY campaign_id, ad_id
),
last_per_ad AS (
    SELECT DISTINCT ON (campaign_id, ad_id)
           campaign_id, ad_id, tanggal,
           gross_revenue_usd * kurs AS gmv_terakhir,
           gross_revenue_usd      AS gmv_usd_terakhir,
           kurs                   AS kurs_terakhir
    FROM ads_performance
    ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
)
SELECT
  l.campaign_id,
  count(*)                                    AS ad_berbeda,
  round(sum(m.gmv_max - l.gmv_terakhir))     AS total_gmv_beda,
  min(m.kurs_min)                             AS kurs_min,
  max(m.kurs_max)                             AS kurs_max,
  min(l.kurs_terakhir)                        AS kurs_terakhir_min,
  max(l.kurs_terakhir)                        AS kurs_terakhir_max,
  round(avg(m.gmv_max - l.gmv_terakhir))      AS rata_rata_beda
FROM last_per_ad l
JOIN max_per_ad m ON m.ad_id = l.ad_id AND m.campaign_id = l.campaign_id
WHERE m.gmv_max <> l.gmv_terakhir
GROUP BY l.campaign_id
ORDER BY total_gmv_beda DESC;

\echo ''
\echo '=== §C. APAKAH ADA BARIS GANDU (ad_id + tanggal sama, nilai beda)? ==='
\echo '-- Kalau ada, mungkin impor dobel. Kalau tidak, nilainya memang turun.'
SELECT
  ad_id,
  tanggal,
  count(*)                       AS jumlah_baris,
  count(DISTINCT gross_revenue_usd) AS nilai_berbeda,
  min(gross_revenue_usd)          AS gmv_min,
  max(gross_revenue_usd)          AS gmv_maks
FROM ads_performance
GROUP BY ad_id, tanggal
HAVING count(*) > 1
ORDER BY jumlah_baris DESC
LIMIT 20;

\echo ''
\echo '=== §D. CEK MONOTON: ad mana yang nilainya NAIK lalu TURUN? ==='
\echo '-- Menghitung penurunan antar baris berurutan per ad.'
WITH susun AS (
  SELECT
    campaign_id, ad_id, tanggal, id,
    gross_revenue_usd * kurs AS nilai,
    LAG(gross_revenue_usd * kurs) OVER (
      PARTITION BY campaign_id, ad_id ORDER BY tanggal, id
    ) AS nilai_sebelumnya
  FROM ads_performance
)
SELECT
  campaign_id,
  count(*) FILTER (WHERE nilai < nilai_sebelumnya) AS ada_penurunan,
  count(*)                                          AS total_baris,
  round(sum(nilai_sebelumnya - nilai) FILTER (WHERE nilai < nilai_sebelumnya)) AS total_penurunan,
  round(max(nilai_sebelumnya - nilai) FILTER (WHERE nilai < nilai_sebelumnya)) AS penurunan_terbesar
FROM susun
GROUP BY campaign_id
HAVING count(*) FILTER (WHERE nilai < nilai_sebelumnya) > 0
ORDER BY total_penurunan DESC;

\echo ''
\echo '=== §E. TOTAL KALAU DIPAKAI MAX (bandingkan) ==='
\echo '-- Tanpa perubahan: total_gmv sekarang memakai TANGGAL TERAKHIR.'
WITH per_ad_max AS (
  SELECT campaign_id, ad_id, MAX(gross_revenue_usd * kurs) AS gmv
  FROM ads_performance GROUP BY campaign_id, ad_id
),
per_ad_last AS (
  SELECT DISTINCT ON (campaign_id, ad_id) campaign_id, ad_id, gross_revenue_usd * kurs AS gmv
  FROM ads_performance ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
)
SELECT
  round((SELECT sum(gmv) FROM per_ad_max))                     AS ads_max_per_ad,
  round((SELECT sum(gmv) FROM per_ad_last))                   AS ads_tanggal_terakhir,
  round((SELECT sum(gmv) FROM per_ad_max) - (SELECT sum(gmv) FROM per_ad_last)) AS beda,
  round((SELECT sum(total_gmv) FROM vw_campaign_summary))     AS total_gmv_skrg,
  round((SELECT sum(total_gmv) FROM vw_campaign_summary)
        + (SELECT sum(gmv) FROM per_ad_max)
        - (SELECT sum(gmv) FROM per_ad_last))                 AS total_kalau_max;
