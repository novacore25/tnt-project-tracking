-- =====================================================================
-- 13 — PRODUCT YANG GAGAL SMART ROUTING
-- Read-only. Melanjutkan bagian 6 dari SQL 12.
-- =====================================================================
\pset pager off
\t on

\echo '=== A. Product ID di sales baru yang TIDAK punya SKU terdaftar ==='
SELECT s.product_id,
       count(*) AS jml_baris,
       sum(s.gmv) AS gmv,
       count(DISTINCT s.creator_username) AS kreator,
       min(s.tanggal) AS tgl_awal,
       max(s.tanggal) AS tgl_akhir
FROM sales s
LEFT JOIN skus k ON k.product_id = s.product_id
WHERE s.campaign_id IS NULL
  AND s.tanggal >= '2026-09-28'
GROUP BY 1
ORDER BY gmv DESC;

\echo ''
\echo '=== B. Ringkasan: sudah terpetakan vs belum ==='
SELECT
  CASE WHEN k.id IS NULL THEN 'SKU TIDAK ADA di Master Produk'
       ELSE 'SKU ada, tapi campaign_id kosong' END AS kategori,
  count(DISTINCT s.product_id) AS jumlah_product,
  count(*) AS jumlah_baris,
  sum(s.gmv) AS gmv
FROM sales s
LEFT JOIN skus k ON k.product_id = s.product_id
WHERE s.campaign_id IS NULL
  AND s.tanggal >= '2026-09-28'
GROUP BY 1 ORDER BY gmv DESC;

\echo ''
\echo '=== C. Organic videos baru yang belum terpetakan, per product ==='
SELECT o.product_id,
       count(*) AS jml_konten,
       count(DISTINCT o.creator_username) AS kreator
FROM organic_videos o
LEFT JOIN skus k ON k.product_id = o.product_id
WHERE o.campaign_id IS NULL
  AND o.post_time >= '2026-09-28'
GROUP BY 1
ORDER BY jml_konten DESC;

\echo ''
\echo '=== D. SKU terdaftar yang punya product_id NULL (kandidat salah input) ==='
SELECT count(*) AS sku_tanpa_product_id FROM skus WHERE product_id IS NULL OR product_id = '';

\echo ''
\echo '=== E. Total seluruh tabel (bumbu pembanding) ==='
SELECT
  (SELECT count(*) FROM sales WHERE campaign_id IS NULL)                  AS sales_unmapped_semua,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE campaign_id IS NULL)      AS gmv_unmapped_semua,
  (SELECT count(*) FROM skus)                                             AS total_sku,
  (SELECT count(DISTINCT product_id) FROM skus WHERE product_id IS NOT NULL) AS sku_dengan_product_id;