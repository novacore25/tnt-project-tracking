-- =====================================================================
-- 06 — HAPUS BARIS AUTO-SYNC YANG DUPLIKAT DARI EXCEL
-- Tanggal: 30 Sep 2026
--
-- KONTEKS (hasil diagnostik 05, produksi terverifikasi):
--   total baris                 32.320
--   is_refund = true             7.053  (Rp 310.135.021)
--     ├ auto-sync (TAP)           7.039
--     └ dari Excel                   14  <- INI ASLINYA refund
--
--   Auto-sync order_id = OrderID SAJA            (583702651078411403)
--   Excel       order_id = OrderID_SKU_ProductID_SKUID
--                product_id = segmen ke-3
--
--   7.035 auto-sync punya kembaran di Excel  -> hapus
--            4 auto-sync tidak punya kembaran -> JAGA, dan lepas flag refund
--                                         (order TikTok asli, Excel kelewat)
--
-- ATURAN BISNIS: SEMUA order dihitung, termasuk refund dan cancelled.
-- Karena itu 14 refund asli dari Excel TIDAK disentuh — begitu filternya
-- dihapus di script 07, mereka otomatis ikut terhitung.
--
-- PENGAMAN: script ini punya guard yang membatalkan seluruh transaksi
-- kalau hasil tidak sesuai harapan. Kalau guard meleset, TIDAK ADA
-- yang berubah.
-- =====================================================================

\pset pager off
\t on

BEGIN;

-- ① Backup
CREATE TABLE IF NOT EXISTS sales_backup_pre_flag_20260930 AS
SELECT * FROM sales;

\echo '--- ① Backup selesai ---'

-- ② Klasifikasi dulu, sebelum menghapus apa pun
CREATE TEMP TABLE _klasifikasi AS
WITH excel_keys AS (
  -- Kunci dari sisi Excel: OrderID (segmen 1) + product_id
  SELECT DISTINCT
         split_part(order_id, '_', 1) AS order_key,
         product_id
  FROM sales
  WHERE attribution_type IS DISTINCT FROM 'TAP'
    AND order_id LIKE '%!_!%' ESCAPE '!'
)
SELECT
  s.ctid,
  s.order_id,
  s.product_id,
  s.creator_username,
  s.gmv,
  s.quantity,
  s.campaign_id,
  s.content_uid,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM excel_keys e
      WHERE e.order_key = split_part(s.order_id, '_', 1)
        AND e.product_id = s.product_id
    ) THEN 'DUPLIKAT'
    ELSE 'ORAKAN'
  END AS kategori
FROM sales s
WHERE s.is_refund
  AND s.attribution_type = 'TAP';

\echo '--- ② Klasifikasi ---'
SELECT kategori, count(*) AS baris, sum(gmv) AS gmv, sum(quantity) AS qty
FROM _klasifikasi GROUP BY kategori ORDER BY kategori;

-- ③ Simpan angka sebelum, untuk checking invariants
CREATE TEMP TABLE _sebelum AS
SELECT
  (SELECT count(*) FROM sales)                     AS baris,
  (SELECT COALESCE(sum(gmv),0) FROM sales)         AS gmv,
  (SELECT COALESCE(sum(quantity),0) FROM sales)    AS qty,
  (SELECT count(DISTINCT creator_username) FROM sales) AS kreator,
  (SELECT count(DISTINCT product_id) FROM sales)   AS produk,
  (SELECT count(*) FROM sales WHERE is_refund)     AS flagged;

-- ④ Hapus yang DUPLIKAT
DELETE FROM sales s
USING _klasifikasi k
WHERE k.ctid = s.ctid AND k.kategori = 'DUPLIKAT';

-- ⑤ Lepas flag refund pada ORAKAN (4 baris)
--    Ini order TikTok asli yang tidak ada di Excel. Flag refund-nya salah
--    (bug lama), jadi dilepas supaya ikut terhitung.
UPDATE sales s SET is_refund = false
FROM _klasifikasi k
WHERE k.ctid = s.ctid AND k.kategori = 'ORAKAN';

-- ⑥ GUARD — kalau salah satu tidak cocok, batalkan semua
DO $$
DECLARE
  v_baris   INT;  v_gmv  NUMERIC;  v_qty INT;
  v_kreator INT;  v_produk INT;    v_flagged INT;
  v_gmv_orakan NUMERIC;
  v_qty_orakan INT;
BEGIN
  SELECT count(*), COALESCE(sum(gmv),0), COALESCE(sum(quantity),0),
         count(DISTINCT creator_username), count(DISTINCT product_id),
         count(*) FILTER (WHERE is_refund)
  INTO v_baris, v_gmv, v_qty, v_kreator, v_produk, v_flagged
  FROM sales;

  SELECT COALESCE(sum(gmv),0), COALESCE(sum(quantity),0)
  INTO v_gmv_orakan, v_qty_orakan
  FROM sales WHERE NOT is_refund AND attribution_type = 'TAP';

  RAISE NOTICE 'SEBELUM  baris=% gmv=% qty=% kreator=% produk=% flagged=%',
    (SELECT baris FROM _sebelum), (SELECT gmv FROM _sebelum),
    (SELECT qty FROM _sebelum), (SELECT kreator FROM _sebelum),
    (SELECT produk FROM _sebelum), (SELECT flagged FROM _sebelum);
  RAISE NOTICE 'SESUDAH  baris=% gmv=% qty=% kreator=% produk=% flagged=%',
    v_baris, v_gmv, v_qty, v_kreator, v_produk, v_flagged;

  -- (a) Yang tersisa ber-flag refund harus TEPAT 14 (refund asli dari Excel)
  IF v_flagged <> 14 THEN
    RAISE EXCEPTION 'GAGAL: sisa is_refund harus 14, dapat %', v_flagged;
  END IF;

  -- (b) Tidak boleh ada auto-sync ber-flag refund lagi
  IF EXISTS (SELECT 1 FROM sales WHERE is_refund AND attribution_type = 'TAP') THEN
    RAISE EXCEPTION 'GAGAL: masih ada auto-sync ber-flag refund';
  END IF;

  -- (c) INVARIAN PENTING: quantity harus TETAP.
  -- Menghapus duplikat tidak boleh mengurangi total item yang terjual,
  -- karena kembarannya di Excel membawa quantity yang sama.
  IF v_qty <> (SELECT qty FROM _sebelum) THEN
    RAISE EXCEPTION 'GAGAL: quantity berubah dari % menjadi %. Duplikat yang dihapus bukan kembaran sejati.',
      (SELECT qty FROM _sebelum), v_qty;
  END IF;

  -- (d) Kreator dan produk tidak boleh hilang
  IF v_kreator <> (SELECT kreator FROM _sebelum) THEN
    RAISE EXCEPTION 'GAGAL: jumlah kreator turun dari % menjadi %',
      (SELECT kreator FROM _sebelum), v_kreator;
  END IF;
  IF v_produk <> (SELECT produk FROM _sebelum) THEN
    RAISE EXCEPTION 'GAGAL: jumlah produk turun dari % menjadi %',
      (SELECT produk FROM _sebelum), v_produk;
  END IF;

  RAISE NOTICE 'SEMUA GUARD LOLOS - menyimpan perubahan.';
END $$;

\echo '--- ⑦ Verifikasi akhir ---'
SELECT count(*) AS baris, sum(gmv) AS gmv, sum(quantity) AS qty,
       count(DISTINCT creator_username) AS kreator,
       count(DISTINCT product_id) AS produk,
       count(*) FILTER (WHERE is_refund) AS flagged
FROM sales;

\echo ''
\echo '--- 8 Order orakan yang dipertahankan ---'
SELECT order_id, product_id, creator_username, gmv, quantity, is_refund
FROM sales WHERE attribution_type = 'TAP' AND NOT is_refund
ORDER BY order_id LIMIT 10;

COMMIT;
