-- =====================================================================
-- 06 — HAPUS BARIS AUTO-SYNC YANG DUPLIKAT DARI EXCEL
-- Tanggal: 30 Sep 2026   -> jalankan SETELAH tidak ada, ini langkah pertama
--
-- KONTEKS (diagnostik 05, produksi terverifikasi):
--   total baris              32.320
--   is_refund = true          7.053  (Rp 310.135.021)
--     |- auto-sync (TAP)        7.039
--     |- dari Excel                14   <- INI ASLINYA refund
--
--   Format order_id:
--     auto-sync : OrderID saja                  (583702651078411403)
--     Excel     : OrderID_SKU_ProductID_SKUID   product_id = segmen ke-3
--
--   7.035 auto-sync punya kembaran di Excel -> hapus (duplikat)
--           4 auto-sync tidak punya kembaran -> JAGA, lepas flag refund
--                                            (order TikTok asli, Excel kelewat)
--
-- ATURAN BISNIS: semua order dihitung, termasuk refund dan cancelled.
-- Karena itu 14 refund asli dari Excel TIDAK disentuh. Begitu filternya
-- dihapus di script 07, mereka otomatis ikut terhitung.
--
-- PENGAMAN: guard di bawah membatalkan SELURUH transaksi kalau hasil
-- tidak sesuai. Kalau guard meleset, tidak ada yang berubah.
-- =====================================================================

\pset pager off
\t on

BEGIN;

-- (1) Backup
CREATE TABLE IF NOT EXISTS sales_bk_20260930b AS SELECT * FROM sales;

-- (2) Klasifikasi dulu, sebelum menghapus apa pun.
--     'rid' = alias untuk ctid. ctid adalah kolom sistem PostgreSQL,
--     jadi TIDAK BOLEH dipakai sebagai nama kolom hasil SELECT.
CREATE TEMP TABLE _k AS
WITH ek AS (
  SELECT DISTINCT
         split_part(order_id, '_', 1) AS ok,
         product_id
  FROM sales
  WHERE attribution_type IS DISTINCT FROM 'TAP'
    AND order_id LIKE '%!_!%' ESCAPE '!'
)
SELECT
  s.ctid AS rid,
  s.order_id,
  s.product_id,
  s.creator_username,
  s.gmv,
  s.quantity,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM ek
      WHERE ek.ok = split_part(s.order_id, '_', 1)
        AND ek.product_id = s.product_id
    ) THEN 'DUPLIKAT'
    ELSE 'ORAKAN'
  END AS kat
FROM sales s
WHERE s.is_refund
  AND s.attribution_type = 'TAP';

\echo '--- Klasifikasi ---'
SELECT kat, count(*) AS baris, sum(gmv) AS gmv, sum(quantity) AS qty
FROM _k GROUP BY kat ORDER BY kat;

-- (3) Angka sebelum, untuk checking invariants
CREATE TEMP TABLE _s AS SELECT
  (SELECT count(*) FROM sales)                          AS b,
  (SELECT COALESCE(sum(quantity),0) FROM sales)         AS q,
  (SELECT count(DISTINCT creator_username) FROM sales)  AS k,
  (SELECT count(DISTINCT product_id) FROM sales)        AS p;

-- (4) Hapus yang DUPLIKAT
DELETE FROM sales s
USING _k k
WHERE k.rid = s.ctid AND k.kat = 'DUPLIKAT';

-- (5) Lepas flag refund pada ORAKAN.
--     Ini order TikTok asli yang tidak ada di Excel. Flag refund-nya salah
--     (bug lama: string "false" dianggap truthy), jadi dilepas supaya ikut
--     terhitung.
UPDATE sales s SET is_refund = false
FROM _k k
WHERE k.rid = s.ctid AND k.kat = 'ORAKAN';

-- (6) GUARD
DO $$
DECLARE
  v_b INT; v_q INT; v_k INT; v_p INT; v_f INT;
BEGIN
  SELECT count(*),
         COALESCE(sum(quantity),0),
         count(DISTINCT creator_username),
         count(DISTINCT product_id),
         count(*) FILTER (WHERE is_refund)
  INTO v_b, v_q, v_k, v_p, v_f
  FROM sales;

  RAISE NOTICE 'SEBELUM b=% qty=% kreator=% produk=%',
    (SELECT b FROM _s), (SELECT q FROM _s), (SELECT k FROM _s), (SELECT p FROM _s);
  RAISE NOTICE 'SESUDAH b=% gmv=% qty=% kreator=% produk=% flagged=%',
    v_b, (SELECT COALESCE(sum(gmv),0) FROM sales), v_q, v_k, v_p, v_f;

  -- (a) sisa ber-flag refund harus tepat 14 (refund asli dari Excel)
  IF v_f <> 14 THEN
    RAISE EXCEPTION 'GAGAL: sisa is_refund harus 14, dapat %', v_f;
  END IF;

  -- (b) tidak boleh ada auto-sync ber-flag refund lagi
  IF EXISTS (SELECT 1 FROM sales WHERE is_refund AND attribution_type = 'TAP') THEN
    RAISE EXCEPTION 'GAGAL: masih ada auto-sync ber-flag refund';
  END IF;

  -- (c) INVARIAN PENTING: quantity harus TETAP.
  --     Menghapus duplikat tidak boleh mengurangi total item terjual,
  --     karena kembarannya di Excel membawa quantity yang sama.
  IF v_q <> (SELECT q FROM _s) THEN
    RAISE EXCEPTION 'GAGAL: quantity berubah dari % menjadi % - yang dihapus bukan kembaran sejati',
      (SELECT q FROM _s), v_q;
  END IF;

  -- (d) kreator dan produk tidak boleh hilang
  IF v_k <> (SELECT k FROM _s) THEN
    RAISE EXCEPTION 'GAGAL: kreator turun dari % menjadi %', (SELECT k FROM _s), v_k;
  END IF;
  IF v_p <> (SELECT p FROM _s) THEN
    RAISE EXCEPTION 'GAGAL: produk turun dari % menjadi %', (SELECT p FROM _s), v_p;
  END IF;

  RAISE NOTICE 'SEMUA GUARD LOLOS';
END $$;

-- (7) Verifikasi akhir
SELECT count(*) AS baris,
       sum(gmv) AS gmv,
       sum(quantity) AS qty,
       count(DISTINCT creator_username) AS kreator,
       count(DISTINCT product_id) AS produk,
       count(*) FILTER (WHERE is_refund) AS flagged
FROM sales;

COMMIT;
