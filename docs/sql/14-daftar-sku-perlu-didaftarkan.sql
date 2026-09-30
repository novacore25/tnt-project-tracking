-- =====================================================================
-- 14 — DAFTAR SELURUH SKU YANG PERLU DIDAFTARKAN
-- Read-only. Semua Product ID yang muncul di data tapi belum ada di
-- tabel `skus`, diurutkan dari yang paling besar nilai GMV-nya.
-- =====================================================================
\pset pager off
\t on

\echo '=== A. Total dampak seluruh periode ==='
WITH muncul AS (
  SELECT DISTINCT product_id FROM sales WHERE product_id IS NOT NULL AND product_id <> ''
  UNION
  SELECT DISTINCT product_id FROM organic_videos WHERE product_id IS NOT NULL AND product_id <> ''
)
SELECT
  (SELECT count(*) FROM muncul)                                          AS product_id_ditemukan,
  (SELECT count(*) FROM muncul m WHERE NOT EXISTS
      (SELECT 1 FROM skus k WHERE k.product_id = m.product_id))          AS perlu_didaftarkan,
  (SELECT COALESCE(sum(gmv),0) FROM sales s WHERE NOT EXISTS
      (SELECT 1 FROM skus k WHERE k.product_id = s.product_id))          AS gmv_sales_tidak_terpetakan,
  (SELECT count(*) FROM sales s WHERE NOT EXISTS
      (SELECT 1 FROM skus k WHERE k.product_id = s.product_id))          AS baris_sales_tidak_terpetakan;

\echo ''
\echo '=== B. DAFTAR LENGKAP: product_id -> campaign mana yang paling cocok ==='
-- Menebak campaign dari campaign_creators yang punya gmV aktif di produk
-- serupa tidak reliable, jadi cukup tampilkan pola nama & nilai.
WITH belum AS (
  SELECT s.product_id,
         count(*)        AS jml_sales,
         sum(s.gmv)      AS gmv_sales,
         count(DISTINCT s.creator_username) AS kreator,
         min(s.tanggal)  AS tgl_awal,
         max(s.tanggal)  AS tgl_akhir
  FROM sales s
  WHERE s.product_id IS NOT NULL AND s.product_id <> ''
    AND NOT EXISTS (SELECT 1 FROM skus k WHERE k.product_id = s.product_id)
  GROUP BY 1
), belum_organic AS (
  SELECT o.product_id, count(*) AS jml_konten
  FROM organic_videos o
  WHERE o.product_id IS NOT NULL AND o.product_id <> ''
    AND NOT EXISTS (SELECT 1 FROM skus k WHERE k.product_id = o.product_id)
  GROUP BY 1
)
SELECT
  b.product_id,
  b.jml_sales,
  b.gmv_sales,
  COALESCE(bo.jml_konten, 0) AS jml_konten,
  b.kreator,
  b.tgl_awal,
  b.tgl_akhir
FROM belum b
LEFT JOIN belum_organic bo ON bo.product_id = b.product_id
ORDER BY b.gmv_sales DESC;

\echo ''
\echo '=== C. Nama produk dari file (bisa diambil dari raw_data) ==='
SELECT DISTINCT
  s.product_id,
  s.raw_data->>'Product name' AS nama_dari_file
FROM sales s
WHERE s.product_id IS NOT NULL AND s.product_id <> ''
  AND NOT EXISTS (SELECT 1 FROM skus k WHERE k.product_id = s.product_id)
  AND s.raw_data ? 'Product name'
ORDER BY 1 LIMIT 40;