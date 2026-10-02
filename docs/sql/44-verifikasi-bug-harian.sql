-- =====================================================================
-- 44 - VERIFIKASI BUG HALAMAN HARIAN & TIMELINE TARGET
-- Tanggal : 2026-10-01
-- READ-ONLY. Hanya SELECT. Tidak menulis apa pun.
--
-- TUJUAN
--   Menguji 6 temuan audit terhadap data nyata di database produksi:
--
--   §1  Rekap Harian: `Not Approve` & `Alternate` pernah terhitung? (dugaan: TIDAK PERNAH)
--   §2  `kurs = 0` ada? Kalau ada, berapa rupiah yang jadi terinflasi jadi 16000?
--   §3  GMV Harian vs SUM(sales.gmv) resmi - seberapa jauh selisihnya?
--   §4  `approved_at` basi - kreator approved lalu dibalik
--   §5  Filter produk terdaftar di Harian - berapa GMV yang tersaring?
--   §6  Baseline sebelum ada perbaikan
--
-- CARA PAKAI
--   Ganti `campaign_id = 57` dengan campaign yang mau dicek, atau hapus
--   filter itu untuk lihat semua campaign sekaligus.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. REKAP HARIAN: apakah alternate/not_approved punya approved_at? ==='
\echo '-- Dugaan bug: keduanya TIDAK punya approved_at, jadi tidak pernah terhitung.'
SELECT
  approval,
  count(*) AS total,
  count(*) FILTER (WHERE approved_at IS NOT NULL) AS punya_approved_at,
  count(*) FILTER (WHERE not_approved_at IS NOT NULL) AS punya_not_approved_at,
  count(*) FILTER (WHERE approved_at IS NOT NULL AND not_approved_at IS NOT NULL) AS punya_keduanya
FROM campaign_creators
GROUP BY approval
ORDER BY total DESC;

\echo ''
\echo '=== 2. VARIASI 1b: khusus campaign 57 ==='
SELECT
  approval,
  count(*) AS total,
  count(*) FILTER (WHERE approved_at IS NOT NULL) AS punya_approved_at,
  count(*) FILTER (WHERE not_approved_at IS NOT NULL) AS punya_not_approved_at
FROM campaign_creators
WHERE campaign_id = 57
GROUP BY approval
ORDER BY total DESC;

\echo ''
\echo '=== 3. KURS = 0 (efek koreksi 20261001230000) ==='
\echo '-- Kalau baris ini ada, halaman Harian & Ads menampilkannya pada kurs 16000.'
SELECT
  id, campaign_id, ad_id, ad_name, tanggal,
  cost_usd, gross_revenue_usd, kurs,
  round(cost_usd * 16000) AS biaya_yang_salah_tampil,
  round(gross_revenue_usd * 16000) AS revenue_yang_salah_tampil
FROM ads_performance
WHERE kurs = 0;

\echo ''
\echo '=== 4. TOTAL INFLASI dari baris kurs=0 (kalau ada) ==='
SELECT
  count(*) AS baris,
  round(COALESCE(sum(gross_revenue_usd), 0) * 16000) AS revenue_inflasi,
  round(COALESCE(sum(cost_usd), 0) * 16000) AS biaya_inflasi
FROM ads_performance
WHERE kurs = 0;

\echo ''
\echo '=== 5. APPROVED_AT BASI (sudah approved lalu statusnya berubah) ==='
\echo '-- Dugaan: ada baris approval != approved tapi approved_at terisi.'
SELECT
  cc.campaign_id, c.nama AS campaign, cc.approval,
  count(*) AS jml,
  min(cc.approved_at)::date AS approved_terlama,
  max(cc.approved_at)::date AS approved_terbaru
FROM campaign_creators cc
JOIN campaigns c ON c.id = cc.campaign_id
WHERE cc.approved_at IS NOT NULL
  AND cc.approval <> 'approved'
GROUP BY cc.campaign_id, c.nama, cc.approval
ORDER BY jml DESC;

\echo ''
\echo '=== 6. CEK SPESIFIK: campaign 57, approved <> approved tapi punya approved_at ==='
\echo '-- Inilah yang bikin Listing 263 vs Daily 265.'
SELECT
  cc.id AS cc_id,
  c.username,
  cc.approval,
  cc.approved_at,
  cc.not_approved_at
FROM campaign_creators cc
JOIN creators c ON c.id = cc.creator_id
WHERE cc.campaign_id = 57
  AND cc.approved_at IS NOT NULL
  AND cc.approval <> 'approved'
ORDER BY cc.approved_at;

\echo ''
\echo '=== 7. GMV HARIAN vs GMV RESMI (campaign 57) ==='
\echo '-- Harian = sales dari kreator approved+alternate DAN product_id terdaftar.'
\echo '-- Resmi = SUM(sales.gmv) mentah. Selisihnya = yang hilang dari Harian.'
WITH resmi AS (
  SELECT count(*) AS order_total,
         round(sum(gmv)) AS gmv_total
  FROM sales
  WHERE campaign_id = 57 AND NOT is_refund
),
tak_terdaftar AS (
  SELECT count(*) AS order_tak_terdaftar,
         round(COALESCE(sum(s.gmv), 0)) AS gmv_tak_terdaftar
  FROM sales s
  WHERE s.campaign_id = 57 AND NOT s.is_refund
    AND NOT EXISTS (SELECT 1 FROM skus k
                     WHERE k.campaign_id = 57
                       AND trim(k.product_id) = trim(s.product_id))
)
SELECT
  r.order_total,
  r.gmv_total                                            AS gmv_resmi,
  t.order_tak_terdaftar,
  t.gmv_tak_terdaftar,
  round(COALESCE(r.gmv_total, 0) - COALESCE(t.gmv_tak_terdaftar, 0)) AS gmv_setelah_filter_produk
FROM resmi r CROSS JOIN tak_terdaftar t;

\echo ''
\echo '=== 8. GMV YANG DITERIMA HARIAN: hanya kreator approved+alternate ==='
\echo '-- Harian menyaring 2x: (a) kreator approved/alternate, (b) product_id terdaftar.'
\echo '-- Query ini menghitung berapa GMV yang lolos filter itu.'
WITH sah AS (
  SELECT s.* FROM sales s
  WHERE s.campaign_id = 57 AND NOT s.is_refund
    AND EXISTS (SELECT 1 FROM skus k
                 WHERE k.campaign_id = 57 AND trim(k.product_id) = trim(s.product_id))
),
bertaut AS (
  SELECT DISTINCT lower(trim(c.username)) AS uname
  FROM campaign_creators cc
  JOIN creators c ON c.id = cc.creator_id
  WHERE cc.campaign_id = 57
    AND cc.approval IN ('approved', 'alternate')
)
SELECT
  CASE WHEN bt.uname IS NOT NULL THEN 'MASUK harian' ELSE 'TERFILTER oleh Harian' END AS status,
  count(*) AS jml_order,
  round(COALESCE(sum(sah.gmv), 0)) AS gmv
FROM sah
LEFT JOIN bertaut bt ON bt.uname = lower(trim(sah.creator_username))
GROUP BY 1
ORDER BY 3 DESC;

\echo ''
\echo '=== 9. TOTAL GMV PER CAMPAIGN dari vw_campaign_summary (acuan resmi) ==='
SELECT campaign, campaign_id, total_gmv, total_gmv_video, total_gmv_live, total_ads_gmv
FROM vw_campaign_summary
ORDER BY total_gmv DESC NULLS LAST
LIMIT 15;

\echo ''
\echo '=== 10. TARGET campaign 57 (kenapa Timeline tampil "GMV 0 / -") ==='
SELECT id, nama, tipe_campaign, status,
       target_gmv, target_video, target_live, target_creator, target_creator_live,
       start_date, end_date
FROM campaigns WHERE id = 57;

\echo ''
\echo '=== 11. campaign awareness: berapa yang punya target_gmv = 0? ==='
SELECT
  tipe_campaign,
  count(*) AS jml_campaign,
  count(*) FILTER (WHERE COALESCE(target_gmv,0) = 0) AS tanpa_target_gmv,
  count(*) FILTER (WHERE COALESCE(target_gmv,0) > 0) AS ada_target_gmv
FROM campaigns
GROUP BY tipe_campaign
ORDER BY jml_campaign DESC;
