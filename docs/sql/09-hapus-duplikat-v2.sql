-- =====================================================================
-- 09 — HAPUS DUPLIKAT AUTO-SYNC (versi 2, setelah gagal di 06)
-- Tanggal: 30 Sep 2026
--
-- PENYEBAB KEGAGALAN 06:
--   Filter kumpulan Excel di 06 memakai LIKE '%!_!%' ESCAPE '!'.
--   Dengan ESCAPE, pola itu dibaca: wildcard + '_' literal + wildcard
--   + '%' LITERAL. Hasilnya 0 baris dari 25.281.
--   Kumpulan Excel kosong -> semua 7.039 auto-sync diklasifikasi ORAKAN
--   -> DELETE 0 -> semua flag justru dilepas (dashboard +Rp 309 juta palsu).
--   Sudah dipulihkan: flag 7053, gmv 1376548680, qty 33989.
--
--   Perbaikan: pakai REGEX, bukan LIKE.
--
-- FAKTA HASIL DIAGNOSIS 08:
--   order_id  Excel   = 4 segmen, panjang 78
--   order_id  TAP     = 1 segmen, panjang 18 (OrderID saja)
--   product_id TAP cocok dengan product_id Excel pada 7.039 dari 7.039
--
-- INVARIAN YANG DIPERKUAT:
--   Script ini hanya menghapus baris ber-is_refund = true, yang tidak
--   dihitung dashboard. Jadi GMV dashboard WAJIB tidak berubah sama
--   sekali. Guard membandingkan langsung GMV yang terlihat dashboard
--   sebelum dan sesudah, bukan cuma jumlah flag.
-- =====================================================================

\pset pager off
\t on

BEGIN;

CREATE TABLE IF NOT EXISTS sales_bk_20260930c AS SELECT * FROM sales;

-- (1) Klasifikasi dengan REGEX, bukan LIKE
CREATE TEMP TABLE _k AS
WITH excel_keys AS (
  SELECT DISTINCT
         split_part(order_id, '_', 1) AS ok,
         product_id
  FROM sales
  WHERE attribution_type IS DISTINCT FROM 'TAP'
    AND order_id ~ '^[0-9]+(_[0-9]+)+$'
)
SELECT
  s.ctid AS rid,
  s.order_id,
  s.product_id,
  s.gmv,
  s.quantity,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM excel_keys e
      WHERE e.ok = split_part(s.order_id, '_', 1)
        AND e.product_id = s.product_id
    ) THEN 'DUPLIKAT'
    ELSE 'ORAKAN'
  END AS kat
FROM sales s
WHERE s.is_refund
  AND s.attribution_type = 'TAP';

\echo '--- Klasifikasi ---'
SELECT kat, count(*) AS baris, sum(gmv) AS gmv, sum(quantity) AS qty
FROM _k GROUP BY kat ORDER BY kat;

-- (2) Angka sebelum. YANG PENTING: gmv_dashboard (yang tidak dihitung filter)
CREATE TEMP TABLE _s AS SELECT
  (SELECT count(*) FROM sales)                                    AS baris,
  (SELECT COALESCE(sum(quantity),0) FROM sales)                   AS qty,
  (SELECT count(DISTINCT creator_username) FROM sales)            AS kreator,
  (SELECT count(DISTINCT product_id) FROM sales)                  AS produk,
  (SELECT count(*) FROM sales WHERE is_refund)                    AS flagged,
  (SELECT COALESCE(sum(gmv),0) FROM sales)                        AS gmv_total,
  -- GMV yang benar-benar terlihat di dashboard (filter is_refund = false)
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)    AS gmv_dashboard;

\echo ''
\echo '--- Angka sebelum ---'
SELECT * FROM _s;

-- (3) Hapus duplikat
DELETE FROM sales s
USING _k k
WHERE k.rid = s.ctid AND k.kat = 'DUPLIKAT';

-- (4) Orakan: lepas flag refund supaya ikut terhitung
UPDATE sales s SET is_refund = false
FROM _k k
WHERE k.rid = s.ctid AND k.kat = 'ORAKAN';

-- (5) GUARD
DO $$
DECLARE
  v_dup INT; v_ora INT;
  v_baris INT; v_qty INT; v_kreator INT; v_produk INT;
  v_flagged INT; v_gmv_dash NUMERIC;
  v_before JSON;
BEGIN
  SELECT count(*) FILTER (WHERE kat='DUPLIKAT'),
         count(*) FILTER (WHERE kat='ORAKAN')
  INTO v_dup, v_ora FROM _k;

  SELECT count(*), COALESCE(sum(quantity),0), count(DISTINCT creator_username),
         count(DISTINCT product_id), count(*) FILTER (WHERE is_refund),
         COALESCE(sum(gmv),0) FILTER (WHERE NOT is_refund)
  INTO v_baris, v_qty, v_kreator, v_produk, v_flagged, v_gmv_dash
  FROM sales;

  SELECT row_to_json(_s) INTO v_before FROM _s;

  RAISE NOTICE 'DUPLIKAT dihapus=%  ORAKAN dilepas=%', v_dup, v_ora;
  RAISE NOTICE 'GMV DASHBOARD  sebelum=%  sesudah=%', (v_before->>'gmv_dashboard')::numeric, v_gmv_dash;

  -- (a) WAJIB ada duplikat. Ini guard yang HILANG di script 06.
  --     Kalau nol, berarti kumpulan Excel kosong lagi = bug yang sama berulang.
  IF v_dup = 0 THEN
    RAISE EXCEPTION 'GAGAL: tidak ada duplikat terdeteksi. Kemungkinan filter kumpulan Excel kosong lagi.';
  END IF;
  IF v_dup < 1000 OR v_dup > 8000 THEN
    RAISE EXCEPTION 'GAGAL: jumlah duplikat % di luar rentang wajar 1000-8000', v_dup;
  END IF;

  -- (b) INARIAN UTAMA: angka yang terlihat dashboard tidak boleh berubah.
  --     Script ini hanya menghapus baris is_refund=true, jadi ini harus 0 selisih.
  IF v_gmv_dash <> (v_before->>'gmv_dashboard')::numeric THEN
    RAISE EXCEPTION 'GAGAL: GMV dashboard berubah dari % menjadi %',
      (v_before->>'gmv_dashboard'), v_gmv_dash;
  END IF;

  -- (c) sisanya
  IF v_flagged <> 14 THEN
    RAISE EXCEPTION 'GAGAL: sisa is_refund harus 14, dapat %', v_flagged;
  END IF;
  IF v_qty <> (v_before->>'qty')::int THEN
    RAISE EXCEPTION 'GAGAL: quantity berubah dari % menjadi %', (v_before->>'qty'), v_qty;
  END IF;
  IF v_kreator <> (v_before->>'kreator')::int THEN
    RAISE EXCEPTION 'GAGAL: kreator turun dari % menjadi %', (v_before->>'kreator'), v_kreator;
  END IF;
  IF v_produk <> (v_before->>'produk')::int THEN
    RAISE EXCEPTION 'GAGAL: produk turun dari % menjadi %', (v_before->>'produk'), v_produk;
  END IF;
  IF v_baris <> (v_before->>'baris')::int - v_dup THEN
    RAISE EXCEPTION 'GAGAL: baris tersisa % seharusnya %', v_baris, (v_before->>'baris')::int - v_dup;
  END IF;

  RAISE NOTICE 'SEMUA GUARD LOLOS - menyimpan perubahan.';
END $$;

\echo ''
\echo '--- Angka sesudah ---'
SELECT count(*) AS baris,
       sum(gmv) AS gmv_total,
       sum(gmv) FILTER (WHERE NOT is_refund) AS gmv_dashboard,
       sum(quantity) AS qty,
       count(DISTINCT creator_username) AS kreator,
       count(DISTINCT product_id) AS produk,
       count(*) FILTER (WHERE is_refund) AS flagged
FROM sales;

COMMIT;
