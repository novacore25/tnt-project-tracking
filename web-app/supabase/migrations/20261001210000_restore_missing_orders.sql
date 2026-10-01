-- =====================================================================
-- 20261001210000 - Pulihkan 951 order affiliate yang hilang dari sales
--
-- MASALAH
--   Dua backup independen, sales_aman_backup_20260930 dan
--   sales_excel_backup_20260930, sama-sama memuat 951 order_id yang tidak
--   ada di tabel sales, total GMV Rp 34.296.053. Dua sumber yang agree
--   berarti order itu nyata. sales_bk_20260930b adalah snapshot sales waktu
--   itu dan menunjukkan nol selisih, jadi acts sebagai kontrol.
--
--   Bukti bahwa order ini normal, bukan data cacat:
--     - 950 dari 951 bukan refund
--     - tanggalnya 2026-02-23 sampai 2026-09-29, di dalam rentang sales
--       yang 2026-01-18 sampai 2026-10-01
--     - content_uid dan creator_username terisi di semua baris
--     - 912 baris punya campaign_id, jadi atribusi campaign ikut pulih
--     - kedua backup memuat order_id yang sama, jadi ini satu set hilang
--       dan bukan dua masalah yang berbeda
--
-- SUMBER
--   Dipakai sales_aman_backup_20260930 karena paling lengkap, 32.813 baris
--   dibanding 25.774 di excel_backup. Keduanya menghasilkan 951 order_id
--   yang sama, jadi sumber pilihan tidak mengubah hasil.
--
-- CATATAN: id dari backup TIDAK dipakai. Kolom id di sales memakai serial,
--   dan id lama akan bentrok dengan baris yang sudah ada. Biarkan sequence
--   yang memberikan nomor baru, created_at tetap diambil dari backup agar
--   jejak auditnya utuh.
--
-- AMAN
--   - Satu transaksi. Kalau gagal tidak ada yang berubah.
--   - Idempotent. ON CONFLICT (order_id) DO NOTHING, jadi aman dijalankan
--     berulang dan tidak akan menggandakan data.
--   - Hanya INSERT. Tidak ada UPDATE atau DELETE di tabel sales.
--   - Tabel backup tidak disentuh, jadi sumbernya tetap utuh untuk audit.
--   - Guard membatalkan transaksi kalau jumlah baris yang pulih tidak
--     sama dengan yang dihitung sebelumnya.
-- =====================================================================

\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Rencana sebelum INSERT
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _pulihkan ON COMMIT DROP AS
SELECT b.*
FROM sales_aman_backup_20260930 b
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id);

\echo '--- yang akan dipulihkan ---'
SELECT count(*)                        AS order_hilang,
       count(*) FILTER (WHERE NOT is_refund) AS bukan_refund,
       COALESCE(sum(gmv),0)            AS gmv_total,
       COALESCE(sum(gmv) FILTER (WHERE NOT is_refund),0) AS gmv_bukan_refund,
       count(*) FILTER (WHERE campaign_id IS NULL) AS campaign_null,
       min(tanggal) AS dari, max(tanggal) AS sampai
FROM _pulihkan;

-- ---------------------------------------------------------------------
-- 2. Sanity: tidak boleh ada yang duplikat di dalam backup
-- ---------------------------------------------------------------------
DO $$
DECLARE dupe integer;
BEGIN
  SELECT count(*) INTO dupe FROM (
    SELECT order_id FROM _pulihkan GROUP BY order_id HAVING count(*) > 1
  ) d;
  IF dupe > 0 THEN
    RAISE EXCEPTION 'Batal: ada % order_id duplikat di dalam backup', dupe;
  END IF;
  RAISE NOTICE 'Sanity OK: tidak ada order_id duplikat';
END $$;

-- ---------------------------------------------------------------------
-- 3.-before totals
-- ---------------------------------------------------------------------
\echo ''
\echo '=== SEBELUM ==='
SELECT (SELECT count(*) FROM sales)                          AS order_sales,
       (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund) AS gmv_sales;

-- ---------------------------------------------------------------------
-- 4. Pulihkan. id tidak dipakai, created_at dipertahankan.
-- ---------------------------------------------------------------------
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type, order_id,
  order_status, raw_data, created_at, commission_rate, attribution_type,
  tiktok_campaign_id, shop_code
)
SELECT
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type, order_id,
  order_status, raw_data, created_at, commission_rate, attribution_type,
  tiktok_campaign_id, shop_code
FROM _pulihkan
ON CONFLICT (order_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Verifikasi: tidak boleh ada order_id dari backup yang masih hilang
-- ---------------------------------------------------------------------
DO $$
DECLARE masih_hilang integer;
BEGIN
  SELECT count(*) INTO masih_hilang
  FROM sales_aman_backup_20260930 b
  WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = b.order_id);

  IF masih_hilang <> 0 THEN
    RAISE EXCEPTION 'Batal: masih ada % order dari backup yang tidak ada di sales', masih_hilang;
  END IF;

  RAISE NOTICE 'Verifikasi OK: semua order dari backup sudah ada di sales';
END $$;

\echo ''
\echo '=== SESUDAH ==='
SELECT (SELECT count(*) FROM sales)                          AS order_sales,
       (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund) AS gmv_sales,
       (SELECT COALESCE(sum(gmv),0) FROM sales WHERE is_refund)     AS gmv_refund,
       (SELECT count(*) FROM sales WHERE campaign_id IS NULL)       AS campaign_null;

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Dampak ke GMV per campaign
-- ---------------------------------------------------------------------
\echo ''
\echo '=== GMV PER CAMPAIGN SETELAH DIPULIHKAN ==='
SELECT campaign_id, count(*) AS order, COALESCE(sum(gmv),0) AS gmv
FROM sales
WHERE NOT is_refund AND campaign_id IS NOT NULL
GROUP BY campaign_id
ORDER BY gmv DESC NULLS LAST
LIMIT 20;
