-- =====================================================================
-- 37 - DAFTAR PRODUK YANG PERLU DIDAFTARKAN
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- SITUASI
--   4.436 order (Rp 224.219.990) tidak masuk campaign manapun karena 91
--   product_id-nya belum terdaftar di tabel skus. Dosb sendiri juga belum
--   ada di campaigns.tiktok_campaign_ids, sehingga mapping lewat tiktok
--   tidak bisa menolong: 4.433 order resolve ke 0 campaign.
--
--   accordingTo pemilik sistem, produk di menu Produk per campaign diisi
--   dengan product_id dari TikTok sesuai campaign-nya. Jadi 91 product_id
--   ini harus didaftarkan dari menu Produk, tidak bisa ditebak dari sini.
--
--   File ini membuat daftar kerjamya per tiktok_campaign_id supaya bisa
--   didaftarkan per campaign, bukan campur.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. 38 tiktok_campaign_id yang BELUM terdaftar di campaign manapun ==='
SELECT tt.tiktok_campaign_id,
       count(sl.order_id)      AS order,
       COALESCE(sum(sl.gmv),0) AS gmv,
       count(DISTINCT sl.product_id) AS product_id,
       count(DISTINCT sl.creator_username) AS kreator,
       min(sl.tanggal) AS dari, max(sl.tanggal) AS sampai
FROM sales sl
JOIN (SELECT DISTINCT tiktok_campaign_id FROM sales
      WHERE campaign_id IS NULL AND NOT is_refund
        AND tiktok_campaign_id IS NOT NULL AND tiktok_campaign_id <> '') tt
  ON tt.tiktok_campaign_id = sl.tiktok_campaign_id
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
GROUP BY tt.tiktok_campaign_id
ORDER BY gmv DESC;

\echo ''
\echo '=== 2. DAFTAR KERJA: product_id yang perlu didaftarkan, per tiktok_campaign_id ==='
-- Grouping per tiktok_campaign_id supaya jelas produk ini milik campaign mana.
-- Tiktok campaign id tidak bisa dipetakan ke campaign secara otomatis, jadi
-- kolom ini butuh diisi manual dari menu Produk.
SELECT sl.tiktok_campaign_id,
       sl.product_id,
       count(*)               AS order,
       COALESCE(sum(sl.gmv),0) AS gmv,
       string_agg(DISTINCT sl.creator_username, ', ') AS kreator,
       min(sl.tanggal) AS dari, max(sl.tanggal) AS sampai
FROM sales sl
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
  AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> ''
GROUP BY sl.tiktok_campaign_id, sl.product_id
ORDER BY sl.tiktok_campaign_id, gmv DESC;

\echo ''
\echo '=== 3. RINGKASAN: total yang bisa kembali kalau semua didaftarkan ==='
SELECT count(*) AS product_id_yang_perlu_daftarkan,
       (SELECT count(DISTINCT sl2.product_id) FROM sales sl2
         WHERE sl2.campaign_id IS NULL AND NOT sl2.is_refund) AS dari_section_2,
       (SELECT COALESCE(sum(sl3.gmv),0) FROM sales sl3
         WHERE sl3.campaign_id IS NULL AND NOT sl3.is_refund) AS gmv_yang_bisa_kembali,
       (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary) AS total_gmv_sekarang
FROM (SELECT 1) x;

\echo ''
\echo '=== 4. APAKAH PRODUCT_ID ITU SUDAH PERNAH MUNCUL DI SKUS (pernah dihapus?) ==='
SELECT count(DISTINCT sl.product_id) AS product_id,
       count(DISTINCT sl.product_id) FILTER (WHERE s.id IS NOT NULL) AS masih_ada_di_skus,
       (SELECT count(*) FROM skus) AS total_sku_terdaftar
FROM sales sl
LEFT JOIN skus s ON s.product_id = sl.product_id
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund;

\echo ''
\echo '=== 5. CONTOH raw_data order tanpa campaign (cari nama produk) ==='
-- Mungkin ada nama produk di raw_data supaya daftar daftarnya lebih mudah
-- diisi tanpa harus membuka TikTok satu per satu.
SELECT sl.order_id, sl.tanggal, sl.gmv, sl.product_id,
       sl.creator_username, sl.tiktok_campaign_id,
       jsonb_object_keys(COALESCE(sl.raw_data,'{}'::jsonb)) AS kunci_raw_data
FROM sales sl
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
  AND sl.raw_data IS NOT NULL
LIMIT 30;

\echo ''
\echo '=== 6. raw_data utuh dari 1 order (lihat isinya) ==='
SELECT jsonb_pretty(raw_data)
FROM sales
WHERE campaign_id IS NULL AND NOT is_refund AND raw_data IS NOT NULL
LIMIT 1;

\echo ''
\echo '=== 7. UJI KONSISTENSI BERSIH: order yang tiktok-nya resolve ke TEPAT 1 campaign ==='
-- Section 36 bagian 7 menghitung 9.060 order "berbeda", tapi itu bisa
-- overcount kalau satu tiktok_campaign_id masuk array lebih dari satu campaign.
-- Di sini hanya yang resolve ke satu campaign saja yang dihitung.
WITH per AS (
  SELECT sl.order_id, sl.gmv, sl.campaign_id,
         count(DISTINCT c.id) AS n_candidate
  FROM sales sl
  JOIN campaigns c ON sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE sl.campaign_id IS NOT NULL AND NOT sl.is_refund
    AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> ''
  GROUP BY sl.order_id, sl.gmv, sl.campaign_id
)
SELECT
  (SELECT count(*) FROM per WHERE n_candidate = 1)                        AS order_resolve_1,
  (SELECT count(*) FROM per WHERE n_candidate = 1 AND campaign_id IS NOT NULL
     AND campaign_id NOT IN (SELECT cc.id FROM campaigns cc))           AS sanity,
  (SELECT COALESCE(sum(gmv),0) FROM per WHERE n_candidate = 1)           AS gmv_resolve_1;

\echo ''
\echo '=== 8. DARI YANG RESOLVE KE 1: berapa yang campaign_id-nya BEDA? ==='
WITH per AS (
  SELECT sl.order_id, sl.gmv, sl.campaign_id AS campaign_sekarang,
         min(c.id) AS campaign_tiktok, count(DISTINCT c.id) AS n_candidate
  FROM sales sl
  JOIN campaigns c ON sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE sl.campaign_id IS NOT NULL AND NOT sl.is_refund
    AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> ''
  GROUP BY sl.order_id, sl.gmv, sl.campaign_id
)
SELECT CASE WHEN n_candidate = 1 AND campaign_sekarang = campaign_tiktok THEN 'cocok'
            WHEN n_candidate = 1 AND campaign_sekarang <> campaign_tiktok THEN 'BERDA'
            WHEN n_candidate > 1 THEN 'ambigu' END AS status,
       count(*) AS order, COALESCE(sum(gmv),0) AS gmv
FROM per GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== 9. CONTOH order BERDA (kalau ada) ==='
WITH per AS (
  SELECT sl.order_id, sl.gmv, sl.product_id, sl.creator_username, sl.tanggal,
         sl.tiktok_campaign_id, sl.campaign_id AS campaign_sekarang,
         min(c.id) AS campaign_tiktok, count(DISTINCT c.id) AS n_candidate,
         (SELECT c2.nama FROM campaigns c2 WHERE c2.id = sl.campaign_id) AS nama_sekarang,
         (SELECT c3.nama FROM campaigns c3 WHERE c3.id = min(c.id)) AS nama_tiktok
  FROM sales sl
  JOIN campaigns c ON sl.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE sl.campaign_id IS NOT NULL AND NOT sl.is_refund
    AND sl.tiktok_campaign_id IS NOT NULL AND sl.tiktok_campaign_id <> ''
  GROUP BY sl.order_id, sl.gmv, sl.product_id, sl.creator_username, sl.tanggal,
           sl.tiktok_campaign_id, sl.campaign_id
)
SELECT order_id, tanggal, gmv, product_id, creator_username, tiktok_campaign_id,
       nama_sekarang, nama_tiktok
FROM per
WHERE n_candidate = 1 AND campaign_sekarang <> campaign_tiktok
ORDER BY gmv DESC LIMIT 20;
