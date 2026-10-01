-- =====================================================================
-- 35 - 951 ORDER YANG HILANG DARI sales
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- TEMUAN
--   sales_aman_backup_20260930 dan sales_excel_backup_20260930 keduanya
--   memuat 951 order_id yang tidak ada di tabel sales,total GMV Rp 34.296.053.
--   Dua backup independen yang Agree berarti order itu nyata dan hilang.
--   sales_bk_20260930b adalah snapshot sales waktu itu, jadi 0 selisih wajar.
--
-- TUJUAN
--   Cari alasan kenapa hilang: refund, di luar rentang tanggal import, atau
--   gagal ter-sinkron. Kalau penyebabnya bisa ditentukan, perbaikannya
--   permanen, bukan hanya memulihkan 951 baris.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. KOLOM backup (pakai yang ada, jangan menebak) ==='
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('sales_aman_backup_20260930','sales_excel_backup_20260930')
ORDER BY table_name, ordinal_position;

\echo ''
\echo '=== 2. RENTANG TANGGAL: order hilang vs yang ada di sales ==='
WITH hilang AS (
  SELECT b.* FROM sales_aman_backup_20260930 b
  WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)
)
SELECT
  (SELECT min(tanggal) FROM hilang)                                   AS hilang_dari,
  (SELECT max(tanggal) FROM hilang)                                   AS hilang_sampai,
  (SELECT count(*) FROM hilang)                                       AS jumlah_hilang,
  (SELECT min(tanggal) FROM sales)                                   AS sales_dari,
  (SELECT max(tanggal) FROM sales)                                   AS sales_sampai,
  (SELECT COALESCE(sum(gmv),0) FROM hilang)                          AS gmv_hilang;

\echo ''
\echo '=== 3. KENAPA HILANG? ==='
WITH hilang AS (
  SELECT b.* FROM sales_aman_backup_20260930 b
  WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)
)
SELECT
  count(*)                                                        AS total,
  count(*) FILTER (WHERE is_refund)                               AS refund,
  count(*) FILTER (WHERE NOT is_refund)                           AS bukan_refund,
  count(*) FILTER (WHERE campaign_id IS NULL)                     AS campaign_null,
  count(*) FILTER (WHERE campaign_id IS NOT NULL)                 AS ada_campaign,
  count(*) FILTER (WHERE content_uid IS NULL)                     AS content_uid_null,
  count(*) FILTER (WHERE creator_username IS NULL OR creator_username = '') AS creator_kosong
FROM hilang;

\echo ''
\echo '=== 4. order_id hilang itu unik? (dari 2 backup) ==='
SELECT count(*) AS union_hilang,
       count(DISTINCT order_id) AS order_id_unik
FROM (
  SELECT b.order_id FROM sales_aman_backup_20260930 b
  WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)
  UNION ALL
  SELECT b2.order_id FROM sales_excel_backup_20260930 b2
  WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b2.order_id)
) x;

\echo ''
\echo '=== 5. CEK: order_id hilang mungkin ada dengan format lain di sales? ==='
-- Mungkin tidak hilang, cuma berubah format: spasi, huruf besar, atau prefix.
WITH hilang AS (
  SELECT DISTINCT b.order_id FROM sales_aman_backup_20260930 b
  WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)
)
SELECT
  count(*)                                                          AS total_hilang,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM sales s WHERE upper(trim(s.order_id)) = upper(trim(h.order_id))))  AS ketemu_case_spasi,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM sales s WHERE s.order_id LIKE '%' || right(h.order_id, 12) || '%'))    AS ketemu_suffix,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM sales s WHERE s.order_id LIKE left(h.order_id, 12) || '%'))           AS ketemu_prefix
FROM hilang h;

\echo ''
\echo '=== 6. 15 CONTOH order yang hilang ==='
SELECT b.order_id, b.tanggal, b.gmv, b.quantity, b.price,
       b.creator_username, b.content_type, b.campaign_id, b.is_refund, b.order_status
FROM sales_aman_backup_20260930 b
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)
ORDER BY b.tanggal LIMIT 15;

\echo ''
\echo '=== 7. DISTRIBUSI per bulan (lokal atau temporal?) ==='
SELECT to_char(tanggal,'YYYY-MM') AS bulan, count(*) AS order_hilang, sum(gmv) AS gmv_hilang
FROM sales_aman_backup_20260930 b
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== 8. KREATORAPA YANG TERDAMPAK ==='
SELECT b.creator_username, count(*) AS order_hilang, sum(b.gmv) AS gmv_hilang
FROM sales_aman_backup_20260930 b
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)
GROUP BY 1 ORDER BY 3 DESC NULLS LAST LIMIT 20;

\echo ''
\echo '=== 9. DAMPAK kalau dipulihkan ==='
SELECT
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)                  AS gmv_sales_skarang,
  (SELECT COALESCE(sum(b.gmv),0) FROM sales_aman_backup_20260930 b
     WHERE NOT is_refund AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)) AS gmv_akan_kembali,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)
    + (SELECT COALESCE(sum(b.gmv),0) FROM sales_aman_backup_20260930 b
       WHERE NOT is_refund AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id)) AS total_setelah_dipulihkan,
  (SELECT count(*) FROM sales)                                                   AS order_sALES,
  (SELECT count(*) FROM sales_aman_backup_20260930 b
     WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id))     AS order_akan_kembali;

\echo ''
\echo '=== 10. APAKAH ADA ORDER DI sales YANG SEBENARNYA SHOULDNYA TIDAK ADA? ==='
-- Kebalikannya: baris di sales yang tidak ada di backup mana pun.
-- Kalau keduanya 0, sales subset dari backup dan tidak ada data asing.
SELECT count(*) AS di_sales_tidak_ada_di_aman
FROM sales s
WHERE NOT EXISTS (SELECT 1 FROM sales_aman_backup_20260930 b WHERE b.order_id = s.order_id);
