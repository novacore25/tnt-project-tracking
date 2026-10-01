-- =====================================================================
-- 36 - 224 JUTA GMV YANG TIDAK MASUK CAMPAIGN MANAPUN
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- SITUASI
--   Setelah total_gmv diubah ke SUM(sales.gmv) per campaign:
--     SUM(sales.gmv) non-refund : Rp 1.144.431.700
--     total_gmv semua campaign  : Rp   920.211.710
--     selisih                   : Rp   224.220.000  (19,6 persen)
--
--   Penyebabnya order dengan campaign_id IS NULL. Menurut pemilik sistem ini
--   normal, karena product_id-nya SKU-nya belum terdaftar di tabel skus, dan
--   akan terpetakan sendiri begitu SKU didaftarkan. Tapi 19,6 persen terlalu
--   besar untuk dibiarkan, dan mapping lewat tiktok_campaign_id sudah
--   terbukti berhasil di organic_videos.
--
--   sales punya kolom tiktok_campaign_id, sama seperti organic_videos.
--   campaigns punya tiktok_campaign_ids ARRAY. Jadi order bisa dipetakan
--   tanpa menunggu SKU didaftarkan.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. BERAPA YANG TIDAK TERPETAKAN ==='
SELECT count(*) FILTER (WHERE NOT is_refund) AS order_tanpa_campaign,
       COALESCE(sum(gmv) FILTER (WHERE NOT is_refund),0) AS gmv_tanpa_campaign,
       count(*) FILTER (WHERE NOT is_refund AND tiktok_campaign_id IS NOT NULL
                          AND tiktok_campaign_id <> '') AS punya_tiktok_campaign_id,
       count(*) FILTER (WHERE NOT is_refund AND (tiktok_campaign_id IS NULL
                          OR tiktok_campaign_id = '')) AS tanpa_tiktok_campaign_id
FROM sales WHERE campaign_id IS NULL;

\echo ''
\echo '=== 2. PRODUCT_ID-nya terdaftar di skus? ==='
SELECT count(*) AS order_tanpa_campaign,
       count(*) FILTER (WHERE s.id IS NOT NULL) AS sku_sudah_terdaftar,
       count(*) FILTER (WHERE s.id IS NULL)      AS sku_belum_terdaftar,
       count(DISTINCT sl.product_id) AS product_id_unik
FROM sales sl
LEFT JOIN skus s ON s.product_id = sl.product_id
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund;

\echo ''
\echo '=== 3. PETAKAN LEWAT tiktok_campaign_id (metode yang berhasil untuk video) ==='
SELECT count(DISTINCT sl.content_uid) AS video_unique,
       count(*) AS order,
       COALESCE(sum(sl.gmv),0) AS gmv,
       count(DISTINCT c.id) AS campaign_tujuan,
       count(DISTINCT sl.tiktok_campaign_id) AS tiktok_id_unik
FROM sales sl
LEFT JOIN campaigns c ON sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
  AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> '';

\echo ''
\echo '=== 4. APAKAH SETIAP ORDER RESOLVE KE SATU CAMPAIGN? ==='
-- 0 campaign = tidak bisa dipetakan sama sekali
-- 1 campaign = aman
-- lebih dari 1 = ambigu, jangan dipBlind-kan
WITH per AS (
  SELECT sl.order_id, count(DISTINCT c.id) AS n_campaign
  FROM sales sl
  LEFT JOIN campaigns c ON sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
    AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> ''
  GROUP BY sl.order_id
)
SELECT n_campaign AS campaign_tujuan, count(*) AS order,
       COALESCE(sum((SELECT gmv FROM sales s2 WHERE s2.order_id = per.order_id)),0) AS gmv
FROM per GROUP BY n_campaign ORDER BY n_campaign;

\echo ''
\echo '=== 5. YANG TIDAK BISA DIPETAKAN (tiktok_campaign_id tidak dikenal) ==='
SELECT COALESCE(sl.tiktok_campaign_id,'(kosong)') AS tiktok_campaign_id,
       count(*) AS order, COALESCE(sum(sl.gmv),0) AS gmv,
       count(DISTINCT sl.product_id) AS product_id
FROM sales sl
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
  AND (sl.tiktok_campaign_id IS NULL OR sl.tiktok_campaign_id = ''
       OR NOT EXISTS (SELECT 1 FROM campaigns c
                      WHERE sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)))
GROUP BY 1 ORDER BY 2 DESC LIMIT 25;

\echo ''
\echo '=== 6. 20 PRODUCT_ID TANPA CAMPAIGN, urut GMV ==='
SELECT sl.product_id, count(*) AS order, COALESCE(sum(sl.gmv),0) AS gmv,
       count(DISTINCT sl.tiktok_campaign_id) AS tiktok_id,
       (SELECT c.nama FROM campaigns c
         WHERE sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids) LIMIT 1) AS campaign_dari_tiktok
FROM sales sl
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
GROUP BY sl.product_id ORDER BY 3 DESC LIMIT 20;

\echo ''
\echo '=== 7. KONSISTENSI: order yang SUDAH punya campaign_id, tiktok-nya cocok? ==='
-- Kalau order yang sudah terpetakan punya tiktok_campaign_id yang menunjuk
-- campaign lain, maka campaign_id yang sekarang bisa jadi salah juga.
SELECT count(*) AS order_sudah_terpetakan,
       count(*) FILTER (WHERE c.id IS NOT NULL) AS tiktok_cocok,
       count(*) FILTER (WHERE c.id IS NOT NULL AND c.id <> sl.campaign_id) AS tiktok_beda,
       count(*) FILTER (WHERE c.id IS NULL) AS tiktok_tidak_dikenal
FROM sales sl
LEFT JOIN campaigns c ON sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
WHERE sl.campaign_id IS NOT NULL AND NOT sl.is_refund
  AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> '';

\echo ''
\echo '=== 8. DAMPAK KALAU YANG RESOLVE KE 1 CAMPAIGN DIPETAKAN ==='
WITH per AS (
  SELECT sl.order_id, sl.gmv, min(c.id) AS target
  FROM sales sl
  JOIN campaigns c ON sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
    AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> ''
  GROUP BY sl.order_id, sl.gmv
  HAVING count(DISTINCT c.id) = 1
)
SELECT (SELECT count(*) FROM per)      AS order_akan_terpetakan,
       (SELECT COALESCE(sum(gmv),0) FROM per) AS gmv_akan_masuk,
       (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary) AS total_gmv_sekarang,
       (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary) + (SELECT COALESCE(sum(gmv),0) FROM per) AS total_gmv_setelahnya;
