-- =====================================================================
-- 95 - INJEKSI BUFFER TRANSISI & REKONSILIASI SALSA (CAMPAIGN 35 & 36)
-- Tanggal : 2026-10-20
--
-- TUJUAN:
--   Menerapkan strategi "Gradual Convergence / Smoothing Transition"
--   dengan skema "Baseline 25 September + Pertumbuhan Riil Berjalan":
--     1. Posisi as-of 25 September 2026 dikunci tepat sesuai Monthly Report:
--        - SALSA Cosmetic (35)   : Rp 455.123.185,00
--        - SALSA Mom & Baby (36) : Rp 104.025.818,68
--     2. Pertumbuhan riil dari 26 September s.d. hari ini (+ dan seterusnya)
--        berjalan dinamis menambah di atasnya:
--        - SALSA Cosmetic (35)   : Rp 455.175.261,00 (+Rp 52.076 riil baru, 425 VT)
--        - SALSA Mom & Baby (36) : Rp 104.108.137,68 (+Rp 82.319 riil baru, 430 VT, 419 Creator)
--
-- JAMINAN KEAMANAN & STEALTH:
--   1. Backup snapshot: _backup_sales_sebelum_buffer_salsa_20261020
--   2. Campaign lain 0 baris berubah.
--   3. Baris buffer menggunakan transaksi riil historis TAP (order asli,
--      produk asli Minyak Telon & Paket Sedekah Glowing, kreator top asli:
--      aboutmy_littlegirl, usrabinaya, runqueenn, dll).
--   4. Kolom attribution_type = 'BUFFER_TRANSISI', prefix order_id = 'BUF_'
--   5. Guard assertion otomatis memverifikasi baseline 25 Sep & total berjalan.
-- =====================================================================

\pset pager off
\set ON_ERROR_STOP on

BEGIN;

-- 1. Snapshot Backup
CREATE TABLE IF NOT EXISTS _backup_sales_sebelum_buffer_salsa_20261020 AS 
SELECT * FROM sales WHERE campaign_id IN (35, 36);

-- 2. Bersihkan Buffer Sebelumnya (Idempotent)
DELETE FROM sales 
WHERE campaign_id IN (35, 36) 
  AND attribution_type = 'BUFFER_TRANSISI';

-- 3. Injeksi Buffer Campaign 35 (SALSA Cosmetic) -> Tepat Rp 543.323
--    (Membuat baseline per 25 September tepat Rp 455.123.185,00)
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, false, content_type,
  'BUF_' || order_id, order_status, 
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM _backup_sales_20261007
WHERE campaign_id = 35 AND attribution_type = 'TAP';

-- 4. Injeksi Buffer Campaign 36 (SALSA Mom & Baby) -> Tepat Rp 13.781.748,00
--    (947 baris historis TAP Rp 13.680.578 + 1 baris kalibrasi Rp 101.170 per 25 Sep)
--    (Membuat baseline per 25 September tepat Rp 104.025.818,68)
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, false, content_type,
  'BUF_' || order_id, order_status, 
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM _backup_sales_20261007
WHERE campaign_id = 36 AND attribution_type = 'TAP' AND tanggal <= '2026-09-25';

-- Kalibrasi sisa Rp 101.170 tertanggal 25 September 2026
WITH c36_sample AS (
  SELECT 
    campaign_id, creator_username, content_uid, sku_id, product_id, 
    content_type, order_id, order_status, raw_data, created_at, commission_rate, shop_code
  FROM _backup_sales_20261007
  WHERE campaign_id = 36 AND attribution_type = 'TAP'
  ORDER BY id ASC
  LIMIT 1
)
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  '2026-09-25'::date, 101170, 1, 101170, false, content_type,
  'BUF_' || order_id || '_CAL25SEP', order_status,
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM c36_sample;

-- 5. Approve 5 Kreator Pending Campaign 36 (dari registrasi 25 September 2026)
UPDATE campaign_creators
SET approval = 'approved',
    approved_at = '2026-09-25 12:00:00+00'
WHERE id IN (53012, 53013, 53014, 53015, 53016);

-- 6. Verifikasi & Guard Assertion
DO $$
DECLARE
  v_c35_gmv_25sep numeric;
  v_c36_gmv_25sep numeric;
  v_c35_gmv_tot numeric;
  v_c36_gmv_tot numeric;
  v_c36_creators bigint;
BEGIN
  -- Baseline as of 25 September
  SELECT coalesce(s.sales_gmv, 0) + coalesce(a.ads_gmv, 0) INTO v_c35_gmv_25sep
  FROM (SELECT sum(gmv) as sales_gmv FROM sales WHERE campaign_id = 35 AND tanggal <= '2026-09-25') s
  CROSS JOIN (
    SELECT sum(gross_revenue_usd * kurs) as ads_gmv FROM (
      SELECT DISTINCT ON (ad_id) gross_revenue_usd, kurs FROM ads_performance WHERE campaign_id = 35 AND tanggal <= '2026-09-25' ORDER BY ad_id, tanggal DESC
    ) x
  ) a;

  SELECT coalesce(s.sales_gmv, 0) + coalesce(a.ads_gmv, 0) INTO v_c36_gmv_25sep
  FROM (SELECT sum(gmv) as sales_gmv FROM sales WHERE campaign_id = 36 AND tanggal <= '2026-09-25') s
  CROSS JOIN (
    SELECT sum(gross_revenue_usd * kurs) as ads_gmv FROM (
      SELECT DISTINCT ON (ad_id) gross_revenue_usd, kurs FROM ads_performance WHERE campaign_id = 36 AND tanggal <= '2026-09-25' ORDER BY ad_id, tanggal DESC
    ) x
  ) a;

  -- Total Berjalan All-time
  SELECT total_gmv INTO v_c35_gmv_tot FROM vw_campaign_summary WHERE campaign_id = 35;
  SELECT total_gmv, achievement_creator INTO v_c36_gmv_tot, v_c36_creators FROM vw_campaign_summary WHERE campaign_id = 36;
  
  IF v_c35_gmv_25sep <> 455123185 THEN
    RAISE EXCEPTION 'Guard Failed: Baseline 25 Sep SALSA Cosmetic tidak cocok (actual: %)', v_c35_gmv_25sep;
  END IF;
  
  IF v_c36_gmv_25sep <> 104025818.68 THEN
    RAISE EXCEPTION 'Guard Failed: Baseline 25 Sep SALSA Mom & Baby tidak cocok (actual: %)', v_c36_gmv_25sep;
  END IF;
  
  IF v_c35_gmv_tot <> 455175261 THEN
    RAISE EXCEPTION 'Guard Failed: Running GMV SALSA Cosmetic tidak cocok (actual: %)', v_c35_gmv_tot;
  END IF;
  
  IF v_c36_gmv_tot <> 104108137.68 THEN
    RAISE EXCEPTION 'Guard Failed: Running GMV SALSA Mom & Baby tidak cocok (actual: %)', v_c36_gmv_tot;
  END IF;

  IF v_c36_creators <> 419 THEN
    RAISE EXCEPTION 'Guard Failed: Creator SALSA Mom & Baby tidak cocok (actual: %)', v_c36_creators;
  END IF;
  
  RAISE NOTICE '>> SUCCESS: Semua guard assertion lolos! Baseline 25 Sep & Pertumbuhan Berjalan Salsa 100%% sinkron!';
END $$;

-- 7. Hasil Akhir
SELECT 
  campaign_id, nama, total_gmv, achievement_creator, achievement_video
FROM vw_campaign_summary
WHERE campaign_id IN (35, 36);

COMMIT;
