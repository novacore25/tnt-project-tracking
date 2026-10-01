-- =====================================================================
-- 32 - ads_performance: kumulatif atau harian? (penentu angka GMV)
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan (pakai commit SHA, JANGAN "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/32-ads-kumulatif.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
--
-- HYPOTESIS
--   gross_revenue_usd dan purchases terlihat naik monoton per tanggal, jadi
--   isinya akumulasi sejak awal, bukan nilai harian. Kalau begitu SUM
--   menghitung ulang revenue yang sama. Nilai yang benar per ad adalah nilai
--   pada tanggal TERAKHIR, bukan penjumlahan.
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. UJI KUMULATIF: untuk tiap ad, nilainya naik terus? ==='
-- satu ad_id = satu Sequence. Kalau monoton naik = kumulatif.
SELECT
  jumlah_periode,
  count(*) FILTER (WHERE naik_strict)  AS selalu_naik,
  count(*) FILTER (WHERE sama_semua)  AS tetap_datar,
  count(*) FILTER (WHERE ada_turun)   AS ada_penurunan,
  count(*) AS total_ad
FROM (
  SELECT campaign_id, ad_id,
         count(*) AS jumlah_periode,
         bool_and(selisih > 0) AS naik_strict,
         bool_and(selisih = 0) AS sama_semua,
         bool_or(selisih < 0) AS ada_turun
  FROM (
    SELECT campaign_id, ad_id, tanggal,
           gross_revenue_usd - lag(gross_revenue_usd) OVER (PARTITION BY campaign_id, ad_id ORDER BY tanggal) AS selisih
    FROM ads_performance
  ) y
  GROUP BY campaign_id, ad_id
) z
GROUP BY jumlah_periode ORDER BY jumlah_periode;

\echo ''
\echo '=== 2. KURVA PER TANGGAL (OMG Makeup, campaign 33) ==='
-- Kalau kolom SUM naik monoton sementara MAX datar, itu ciri kumulatif.
SELECT tanggal,
       count(*)                                                AS jumlah_ad,
       sum(gross_revenue_usd * kurs)                           AS sum_revenue_idr,
       max(gross_revenue_usd * kurs)                           AS max_revenue_idr,
       sum(cost_usd * kurs)                                    AS sum_cost_idr,
       max(cost_usd * kurs)                                    AS max_cost_idr,
       sum(purchases)                                          AS sum_purchases
FROM ads_performance WHERE campaign_id = 33
GROUP BY tanggal ORDER BY tanggal;

\echo ''
\echo '=== 3. TIGA CARA MENGHITUNG, MANA YANG WARGA? ==='
-- SUM          = apa yang dipakai view sekarang
-- PER_AD_AKHIR = jumlah nilai tiap ad pada tanggal terakhirnya (kumulatif)
-- PER_HARI     = jumlah nilai ad TERAKHIR per tanggal (kalau emang harian)
SELECT c.id, c.nama,
       round(sum(ap.gross_revenue_usd * ap.kurs))                                    AS a_sum_skrg,
       (SELECT round(sum(x.rev)) FROM (
          SELECT DISTINCT ON (ap2.campaign_id, ap2.ad_id) ap2.gross_revenue_usd*ap2.kurs AS rev
          FROM ads_performance ap2
          WHERE ap2.campaign_id = c.id
          ORDER BY ap2.campaign_id, ap2.ad_id, ap2.tanggal DESC) x)                  AS b_per_ad_terakhir,
       (SELECT round(sum(x.cost)) FROM (
          SELECT DISTINCT ON (ap3.campaign_id, ap3.ad_id) ap3.cost_usd*ap3.kurs AS cost
          FROM ads_performance ap3
          WHERE ap3.campaign_id = c.id
          ORDER BY ap3.campaign_id, ap3.ad_id, ap3.tanggal DESC) y)                  AS cost_per_ad_terakhir,
       (SELECT round(sum(x.rev)/NULLIF(sum(x.cost),0), 2) FROM (
          SELECT DISTINCT ON (ap4.campaign_id, ap4.ad_id) ap4.gross_revenue_usd*ap4.kurs AS rev,
                 ap4.cost_usd*ap4.kurs AS cost
          FROM ads_performance ap4
          WHERE ap4.campaign_id = c.id
          ORDER BY ap4.campaign_id, ap4.ad_id, ap4.tanggal DESC) z)                  AS roas_per_ad_terakhir
FROM ads_performance ap JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY c.id, c.nama ORDER BY a_sum_skrg DESC;

\echo ''
\echo '=== 4. KALAU PER_AD_TERAKHIR YANG BENAR, GMV TOTAL JADI BERAPA? ==='
-- Ini yang akan tampil di dashboard kalau view diperbaiki.
WITH per_ad AS (
  SELECT DISTINCT ON (campaign_id, ad_id) campaign_id, ad_id,
         gross_revenue_usd * kurs AS rev, cost_usd * kurs AS cost, purchases, clicks
  FROM ads_performance
  ORDER BY campaign_id, ad_id, tanggal DESC
)
SELECT
  (SELECT COALESCE(sum(rev),0) FROM per_ad)                                          AS gmv_ads_per_ad_terakhir,
  (SELECT COALESCE(sum(cost),0) FROM per_ad)                                        AS cost_ads_per_ad_terakhir,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)                      AS gmv_sales,
  (SELECT COALESCE(sum(rev),0) FROM per_ad) + (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)
                                                                                    AS TOTAL_KALAU_DIJUMLAHKAN,
  (SELECT count(*) FROM per_ad)                                                     AS jumlah_ad;

\echo ''
\echo '=== 5. KURS RUSAK: 1000x terlalu kecil (314 baris) ==='
SELECT kurs, count(*) AS baris, min(tanggal) AS dari, max(tanggal) AS sampai,
       min(campaign_id) AS contoh_campaign
FROM ads_performance WHERE kurs < 5000
GROUP BY kurs ORDER BY baris DESC;

\echo ''
\echo '=== 6. DAMPAK KALAU KURS DIPERBAIKI (x1000) ==='
SELECT c.id, c.nama,
       round(sum(ap.gross_revenue_usd * ap.kurs))                                   AS gmv_sekarang,
       round(sum(ap.gross_revenue_usd * CASE WHEN ap.kurs < 5000 THEN ap.kurs*1000 ELSE ap.kurs END)) AS gmv_setelah_kurs_diperbaiki
FROM ads_performance ap JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY 1,2 ORDER BY 3 DESC;

\echo ''
\echo '=== 7. 12 BARIS RUSAK: purchases > clicks ==='
SELECT id, campaign_id, ad_id, ad_name, tanggal, cost_usd, gross_revenue_usd, kurs,
       purchases, clicks, impressions
FROM ads_performance
WHERE purchases > clicks OR (clicks = 0 AND purchases > 0)
ORDER BY campaign_id, tanggal;

\echo ''
\echo '=== 8. APAKAH CAMPAIGN PUNYA PLAFON ADS? (cek klaim "over budget") ==='
SELECT c.id, c.nama, c.budget_ads_plafon,
       round(COALESCE((SELECT sum(ap.cost_usd*ap.kurs) FROM ads_performance ap WHERE ap.campaign_id=c.id),0)) AS biaya_ads,
       round(COALESCE((SELECT sum(x.cost) FROM (SELECT DISTINCT ON (ap2.campaign_id, ap2.ad_id) ap2.cost_usd*ap2.kurs AS cost
          FROM ads_performance ap2 WHERE ap2.campaign_id=c.id
          ORDER BY ap2.campaign_id, ap2.ad_id, ap2.tanggal DESC) x),0)) AS biaya_ads_per_ad_terakhir
FROM campaigns c
WHERE c.budget_ads_plafon > 0
ORDER BY c.budget_ads_plafon DESC LIMIT 20;
