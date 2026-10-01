-- =====================================================================
-- 41 - DAMPAK koreksi kurs ke budget (READ-ONLY, tidak mengubah apa pun)
-- Tanggal : 2026-10-01
--
-- MASALAH
--   ads_performance.kurs adalah nilai tukar USD -> IDR per baris, dan
--   memang BERUBAH-UBAH per tanggal. Itu desain yang benar, tidak masalah.
--
--   Yang rusak hanya baris yang tersimpan dengan satu titik desimal, yaitu
--   16.993 yang seharusnya 16993. Itu 1000x terlalu kecil, dan karena
--   kurs didahulukan di 1.000, nilai 1.000 bukan kurs yang mungkin terjadi
--   (kurs riil terverifikasi di kisaran 16.993 sampai 18.045).
--     - 313 baris format 16.9xx
--     -   1 baris format 1.000
--
--   TIDAK DISENTUH: nilai 18.000. Itu angka 5 digit dan berada di dalam
--   rentang kurs riil, jadi bukan rusak. Dulu saya menyebutnya "default
--   bulat" itu tebakan yang salah.
--
-- PERTANYAAN
--   Kalau 314 baris itu dikoreksi x1000, berapa biaya iklan yang bertambah,
--   dan apakah campaign jadi terbaca over budget padahal sebenarnya tidak.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. KLASIFIKASI KURS (baca dulu) ==='
SELECT
  count(*)                                              AS total_baris,
  count(*) FILTER (WHERE kurs >= 16000 AND kurs <= 20000) AS kurs_riil,
  count(*) FILTER (WHERE kurs < 16000)                    AS kurs_rusak_satu_titik,
  count(*) FILTER (WHERE kurs = 18000)                    AS kurs_18000,
  count(*) FILTER (WHERE kurs = 1000)                     AS kurs_1000,
  min(kurs) AS min_kurs, max(kurs) AS max_kurs
FROM ads_performance;

\echo ''
\echo '=== 2. NILAI KURS YANG ADA ==='
SELECT kurs, count(*) AS baris, min(tanggal) AS dari, max(tanggal) AS sampai
FROM ads_performance
GROUP BY kurs ORDER BY kurs;

\echo ''
\echo '=== 3. KURS RUSAK PER CAMPAIGN ==='
SELECT campaign_id, kurs, count(*) AS baris,
       round(COALESCE(sum(cost_usd * kurs),0)) AS biaya_idr_sekarang,
       round(COALESCE(sum(cost_usd * kurs * 1000),0)) AS biaya_idr_setelah_x1000
FROM ads_performance
WHERE kurs < 16000
GROUP BY 1,2
ORDER BY biaya_idr_sekarang DESC;

\echo ''
\echo '=== 4. BIAYA ADS PER CAMPAIGN: sekarang vs dikoreksi vs plafon ==='
-- Cara hitung sama persis dengan view yang sekarang dipakai:
-- MAX per ad, bukan SUM, karena kolomnya kumulatif.
WITH per_ad AS (
  SELECT campaign_id, ad_id,
         MAX(cost_usd * kurs) AS biaya_skrg,
         MAX(cost_usd * CASE WHEN kurs < 16000 THEN kurs * 1000 ELSE kurs END) AS biaya_koreksi
  FROM ads_performance
  GROUP BY campaign_id, ad_id
), per AS (
  SELECT campaign_id,
         SUM(biaya_skrg)   AS biaya_sekarang,
         SUM(biaya_koreksi) AS biaya_koreksi
  FROM per_ad GROUP BY campaign_id
)
SELECT c.id, c.nama,
       c.budget_ads_plafon                    AS plafon,
       round(COALESCE(p.biaya_sekarang,0))    AS biaya_sekarang,
       round(COALESCE(p.biaya_koreksi,0))     AS biaya_setelah_koreksi,
       round(COALESCE(p.biaya_sekarang,0) - COALESCE(p.biaya_koreksi,0)) AS tambahan,
       CASE
         WHEN c.budget_ads_plafon = 0 THEN 'tidak ada plafon'
         WHEN COALESCE(p.biaya_koreksi,0) > c.budget_ads_plafon THEN 'OVER setelah koreksi'
         WHEN COALESCE(p.biaya_sekarang,0) > c.budget_ads_plafon THEN 'over sekarang, aman setelah koreksi'
         ELSE 'dalam budget'
       END AS status_setelah_koreksi,
       round(c.budget_ads_plafon - COALESCE(p.biaya_koreksi,0)) AS sisa_budget
FROM campaigns c
LEFT JOIN per p ON p.campaign_id = c.id
WHERE p.campaign_id IS NOT NULL
ORDER BY c.budget_ads_plafon DESC, c.id;

\echo ''
\echo '=== 5. RINGKASAN KEPUTUSAN ==='
WITH per_ad AS (
  SELECT campaign_id, ad_id,
         MAX(cost_usd * kurs) AS biaya_skrg,
         MAX(cost_usd * CASE WHEN kurs < 16000 THEN kurs * 1000 ELSE kurs END) AS biaya_koreksi
  FROM ads_performance GROUP BY campaign_id, ad_id
), per AS (
  SELECT campaign_id, SUM(biaya_skrg) AS s, SUM(biaya_koreksi) AS k
  FROM per_ad GROUP BY campaign_id
)
SELECT
  (SELECT count(*) FROM per)                                    AS campaign_pakai_ads,
  (SELECT count(*) FROM per p JOIN campaigns c ON c.id=p.campaign_id
     WHERE c.budget_ads_plafon > 0 AND p.s > c.budget_ads_plafon)   AS over_sekarang,
  (SELECT count(*) FROM per p JOIN campaigns c ON c.id=p.campaign_id
     WHERE c.budget_ads_plafon > 0 AND p.k > c.budget_ads_plafon)   AS over_setelah_koreksi,
  (SELECT count(*) FROM per p JOIN campaigns c ON c.id=p.campaign_id
     WHERE c.budget_ads_plafon > 0
       AND p.s <= c.budget_ads_plafon AND p.k > c.budget_ads_plafon) AS berubah_jadi_over,
  (SELECT round(COALESCE(sum(k - s),0)) FROM per)              AS tambahan_biaya_idr;

\echo ''
\echo '=== 6. GMV ADS per campaign: sekarang vs dikoreksi ( informational ) ==='
-- Total GMV campaign TIDAK terpengaruh, karena ads tidak masuk total_gmv.
-- Ini hanya supaya jelas kalau yang bergerak cuma angka informasi.
WITH per_ad AS (
  SELECT campaign_id, ad_id,
         MAX(gross_revenue_usd * kurs) AS gmv_skrg,
         MAX(gross_revenue_usd * CASE WHEN kurs < 16000 THEN kurs * 1000 ELSE kurs END) AS gmv_koreksi
  FROM ads_performance GROUP BY campaign_id, ad_id
)
SELECT campaign_id,
       round(COALESCE(sum(gmv_skrg),0))   AS gmv_ads_sekarang,
       round(COALESCE(sum(gmv_koreksi),0)) AS gmv_ads_setelah_koreksi,
       (SELECT round(total_gmv) FROM vw_campaign_summary v WHERE v.campaign_id = p.campaign_id) AS total_gmv_campaign
FROM per_ad p GROUP BY campaign_id ORDER BY 1;

\echo ''
\echo '=== 7. TOTAL GMV CAMPAIGN (harus TIDAK BERUBAH sama sekali) ==='
SELECT round(COALESCE(sum(total_gmv),0))      AS total_gmv,
       round(COALESCE(sum(total_gmv_video),0)) AS gmv_video,
       round(COALESCE(sum(total_gmv_live),0))  AS gmv_live,
       round(COALESCE(sum(total_ads_spend),0)) AS total_ads_spend
FROM vw_campaign_summary;
