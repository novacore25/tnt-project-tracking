-- =====================================================================
-- 46 - ANGKA ADS YANG BENAR (MAX per ad) + BERAPA TOTAL GMV SEHARUSNYA
-- Tanggal : 2026-10-02
-- READ-ONLY. Hanya SELECT. Tidak menulis apa pun.
--
-- KENAPA FILE 45 TIDAK BISA DIPAKAI UNTUK MENGHITUNG
--   File 45 memakai `sum(gross_revenue_usd * kurs)` dan `sum(purchases)`.
--   SALAH. `ads_performance` itu KUMULATIF per ad per tanggal (sudah terbukti
--   di SKILL.md 3.35 dan dipakai view lewat MAX per ad). Menjumlahkan semua
--   snapshot menghitung ulang revenue yang sama.
--
--   Buktinya langsung dari output file 45:
--     sum(cost_usd * kurs)          = Rp  688.182.209
--     view total_ads_spend (MAX)   = Rp  173.207.991
--     -> SUMammonium 4x lebih besar
--     sum(gross_revenue_usd*kurs)  = Rp 14.838.157.153   <- bukan angka revenue
--
--   Jadi angka Rp 14,8 miliar itu ARTEFAK, bukan revenue.
--
-- PERTANYAAN YANG SUDAH DIJAWAB USER (2 Okt 2026)
--   "Order dari video yang di-ads, muncul di Partner Center atau tidak?"
--   -> TIDAK. Partner Center itu PURE ORGANIK.
--   -> Jadi ads adalah revenue TAMBAHAN, dan HARUS dijumlahkan.
--
-- TUJUAN FILE INI
--   Menghitung angka ads yang benar (MAX per ad) supaya besarannya diketahui
--   SEBELUM view dibangun ulang. Tidak ada yang ditulis.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== §1. BUKTI ads_performance ITU KUMULATIF (kenapa SUM salah) ==='
\echo '-- Satu ad_id, semua tanggalnya. Nilai HARUS monoton naik.'
SELECT
  ad_id,
  count(*) AS jumlah_baris,
  min(tanggal) AS tanggal_pertama,
  max(tanggal) AS tanggal_terakhir,
  min(gross_revenue_usd) AS gmv_terendah,
  max(gross_revenue_usd) AS gmv_tertinggi,
  CASE WHEN max(gross_revenue_usd) > min(gross_revenue_usd) * 2
       THEN 'KUMULATIF' ELSE 'mungkin harian' END AS pola
FROM ads_performance
GROUP BY ad_id
HAVING count(*) > 5
ORDER BY count(*) DESC
LIMIT 8;

\echo ''
\echo '=== §2. TOTAL ADS YANG BENAR (MAX per ad) vs SUM yang salah ==='
WITH per_ad AS (
  SELECT campaign_id, ad_id,
         MAX(gross_revenue_usd * kurs) AS ads_gmv_idr,
         MAX(cost_usd * kurs)          AS ads_cost_idr,
         MAX(purchases)               AS purchases_akhir
  FROM ads_performance
  GROUP BY campaign_id, ad_id
)
SELECT
  count(*)                                              AS jumlah_ad,
  round(COALESCE(sum(ads_gmv_idr), 0))                  AS ads_gmv_BENAR,
  round(COALESCE(sum(ads_cost_idr), 0))                 AS ads_spend_BENAR,
  sum(purchases_akhir)                                  AS purchases_akhir,
  round(COALESCE(sum(ads_gmv_idr), 0) / NULLIF(sum(purchases_akhir), 0)) AS nilai_per_item,
  (SELECT round(sum(gross_revenue_usd * kurs)) FROM ads_performance)      AS ads_gmv_SUM_yang_SALAH,
  (SELECT round(sum(cost_usd * kurs))          FROM ads_performance)      AS ads_spend_SUM_yang_SALAH
FROM per_ad;

\echo ''
\echo '=== §3. PER KAMPOS: GMV YANG SEHARUSNYA (sales + ads) ==='
WITH s AS (
  SELECT campaign_id, round(sum(gmv)) AS gmv_sales
  FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL GROUP BY campaign_id
),
per_ad AS (
  SELECT campaign_id, ad_id,
         MAX(gross_revenue_usd * kurs) AS ads_gmv_idr,
         MAX(cost_usd * kurs)          AS ads_cost_idr
  FROM ads_performance GROUP BY campaign_id, ad_id
),
d AS (
  SELECT campaign_id,
         round(sum(ads_gmv_idr))  AS ads_gmv,
         round(sum(ads_cost_idr)) AS ads_spend
  FROM per_ad GROUP BY campaign_id
)
SELECT
  c.id AS campaign_id,
  c.nama,
  COALESCE(s.gmv_sales, 0)                                        AS gmv_sales,
  COALESCE(d.ads_gmv, 0)                                          AS ads_gmv,
  COALESCE(d.ads_spend, 0)                                        AS ads_spend,
  COALESCE(s.gmv_sales, 0) + COALESCE(d.ads_gmv, 0)               AS TOTAL_BARU,
  (COALESCE(s.gmv_sales, 0) + COALESCE(d.ads_gmv, 0)) * 100
    / NULLIF(COALESCE(s.gmv_sales, 0), 0)                         AS persen_naik,
  c.budget_ads_plafon,
  CASE WHEN COALESCE(d.ads_spend,0) > COALESCE(c.budget_ads_plafon,0) THEN 'OVER' ELSE 'aman' END AS status_budget
FROM campaigns c
LEFT JOIN s ON s.campaign_id = c.id
LEFT JOIN d ON d.campaign_id = c.id
WHERE COALESCE(s.gmv_sales,0) <> 0 OR COALESCE(d.ads_gmv,0) <> 0
ORDER BY TOTAL_BARU DESC;

\echo ''
\echo '=== §4. TOTAL KESELURUHAN (angka yang akan dipakai) ==='
WITH per_ad AS (
  SELECT campaign_id, ad_id, MAX(gross_revenue_usd * kurs) AS gmv, MAX(cost_usd * kurs) AS cst
  FROM ads_performance GROUP BY campaign_id, ad_id
)
SELECT
  (SELECT round(sum(gmv)) FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL) AS gmv_sales,
  (SELECT round(sum(gmv)) FROM per_ad)                                                 AS ads_gmv,
  (SELECT round(sum(cst)) FROM per_ad)                                                 AS ads_spend,
  (SELECT round(sum(gmv)) FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL)
    + (SELECT round(sum(gmv)) FROM per_ad)                                             AS TOTAL_BARU,
  (SELECT count(*) FROM sales WHERE NOT is_refund AND campaign_id IS NULL)              AS order_tanpa_campaign;

\echo ''
\echo '=== §5. ORDER TANPA CAMPAIGN (tidak masuk total mana pun) ==='
SELECT count(*) AS jml_order, round(COALESCE(sum(gmv),0)) AS gmv
FROM sales WHERE NOT is_refund AND campaign_id IS NULL;

\echo ''
\echo '=== §6. UJI OVERLAP: DELTA ADS HARIAN vs SALES HARIAN ==='
\echo '-- PENTING: yang dibandingkan harus DELTA ads, bukan nilai kumulatif.'
\echo '-- delta = nilai_kumulatif(hari ini) - nilai_kumulatif(hari sebelumnya)'
\echo '-- Kalau ads menghitung ulang order yang sama, delta akan mengikuti sales.'
\echo '-- Kalau stream terpisah, tidak akan pola.'
WITH susun AS (
  SELECT campaign_id, ad_id, tanggal,
         MAX(gross_revenue_usd * kurs) AS nilai_kumulatif,
         LAG(MAX(gross_revenue_usd * kurs)) OVER (
           PARTITION BY campaign_id, ad_id ORDER BY tanggal
         ) AS nilai_sebelumnya
  FROM ads_performance
  GROUP BY campaign_id, ad_id, tanggal
),
delta AS (
  SELECT campaign_id, tanggal,
         round(sum(COALESCE(nilai_kumulatif, 0) - COALESCE(nilai_sebelumnya, 0))) AS ads_delta,
         count(*) AS jumlah_ad_aktif
  FROM susun
  GROUP BY campaign_id, tanggal
),
sales_harian AS (
  SELECT campaign_id, tanggal, round(sum(gmv)) AS gmv_sales
  FROM sales WHERE NOT is_refund GROUP BY campaign_id, tanggal
)
SELECT
  d.campaign_id,
  d.tanggal,
  d.ads_delta,
  COALESCE(sh.gmv_sales, 0) AS gmv_sales,
  d.jumlah_ad_aktif,
  CASE
    WHEN COALESCE(sh.gmv_sales,0) = 0 THEN 'tidak ada sales hari itu'
    WHEN abs(d.ads_delta - COALESCE(sh.gmv_sales,0)) < 1 THEN 'IDENTIK - curiga dobel'
    WHEN abs(d.ads_delta - COALESCE(sh.gmv_sales,0)) < COALESCE(sh.gmv_sales,0) * 0.05 THEN 'hampir sama - periksa'
    ELSE 'beda jauh - stream terpisah'
  END AS bacaan
FROM delta d
LEFT JOIN sales_harian sh ON sh.campaign_id = d.campaign_id AND sh.tanggal = d.tanggal
ORDER BY d.tanggal DESC, d.campaign_id
LIMIT 40;

\echo ''
\echo '=== §6b. RINGKASAN UJI OVERLAP ==='
WITH susun AS (
  SELECT campaign_id, ad_id, tanggal,
         MAX(gross_revenue_usd * kurs) AS nilai_kumulatif,
         LAG(MAX(gross_revenue_usd * kurs)) OVER (
           PARTITION BY campaign_id, ad_id ORDER BY tanggal
         ) AS nilai_sebelumnya
  FROM ads_performance
  GROUP BY campaign_id, ad_id, tanggal
),
delta AS (
  SELECT campaign_id, tanggal,
         round(sum(COALESCE(nilai_kumulatif,0) - COALESCE(nilai_sebelumnya,0))) AS ads_delta
  FROM susun GROUP BY campaign_id, tanggal
),
sales_harian AS (
  SELECT campaign_id, tanggal, round(sum(gmv)) AS gmv_sales
  FROM sales WHERE NOT is_refund GROUP BY campaign_id, tanggal
)
SELECT
  count(*) FILTER (WHERE COALESCE(sh.gmv_sales,0) > 0)                          AS hari_ada_keduanya,
  count(*) FILTER (WHERE abs(d.ads_delta - COALESCE(sh.gmv_sales,0)) < 1)       AS nyaris_identik,
  count(*) FILTER (WHERE COALESCE(sh.gmv_sales,0) > 0
                     AND abs(d.ads_delta - COALESCE(sh.gmv_sales,0))
                         < COALESCE(sh.gmv_sales,0) * 0.05)                     AS mirip_dalam_5 persen,
  count(*) FILTER (WHERE COALESCE(sh.gmv_sales,0) > 0
                     AND abs(d.ads_delta - COALESCE(sh.gmv_sales,0))
                         >= COALESCE(sh.gmv_sales,0) * 0.05)                    AS beda_jauh
FROM delta d
LEFT JOIN sales_harian sh ON sh.campaign_id = d.campaign_id AND sh.tanggal = d.tanggal;

\echo ''
\echo '=== §7. PETA BULANAN: kapan ads ada, kapan tidak ==='
\echo '-- Ini untuk memastikan tidak ada bulan yang terhitung 2x.'
WITH s AS (SELECT date_trunc('month', tanggal)::date AS bulan, round(sum(gmv)) AS gmv
           FROM sales WHERE NOT is_refund GROUP BY 1),
per_ad AS (SELECT campaign_id, ad_id, tanggal, MAX(gross_revenue_usd * kurs) AS gmv
           FROM ads_performance GROUP BY campaign_id, ad_id, tanggal),
d AS (SELECT date_trunc('month', tanggal)::date AS bulan, round(sum(gmv)) AS gmv
      FROM per_ad GROUP BY 1)
SELECT COALESCE(s.bulan, d.bulan) AS bulan,
       COALESCE(s.gmv, 0) AS gmv_sales,
       COALESCE(d.gmv, 0) AS ads_gmv,
       COALESCE(s.gmv, 0) + COALESCE(d.gmv, 0) AS total
FROM s FULL OUTER JOIN d ON s.bulan = d.bulan
ORDER BY 1;

\echo ''
\echo '=== §8. CEK: total_ads_spend view harus sama dengan MAX per ad ==='
\echo '-- Kalau berbeda, definisi view perlu ditinjau juga.'
WITH per_ad AS (
  SELECT campaign_id, ad_id, MAX(cost_usd * kurs) AS cst
  FROM ads_performance GROUP BY campaign_id, ad_id
)
SELECT
  (SELECT round(sum(budget_ads_terpakai)) FROM vw_campaign_summary) AS view_total_ads_spend,
  (SELECT round(sum(cst)) FROM per_ad)                             AS benar_total_ads_spend,
  (SELECT round(sum(budget_ads_terpakai)) FROM vw_campaign_summary)
    - (SELECT round(sum(cst)) FROM per_ad)                         AS selisih;
