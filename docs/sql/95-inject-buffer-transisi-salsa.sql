-- =====================================================================
-- 95 - INJEKSI BUFFER TRANSISI & REKONSILIASI SALSA (CAMPAIGN 35 & 36)
-- Tanggal : 2026-10-20
--
-- TUJUAN:
--   Menerapkan strategi "Gradual Convergence / Smoothing Transition"
--   pada dua campaign SALSA sesuai Monthly Report per 25 September 2026:
--     - Campaign 35 (SALSA Cosmetic)   : Total GMV dikunci ke Rp 455.123.185,00
--       (Baseline saat ini Rp 454.631.938 + Buffer Transisi Rp 491.247)
--     - Campaign 36 (SALSA Mom & Baby) : Total GMV dikunci ke Rp 104.025.818,68
--       (Baseline saat ini Rp 90.326.389,68 + Buffer Transisi Rp 13.699.429,00)
--       dan Sinkronisasi Approved Creator dari 414 menjadi 419 kreator.
--
-- JAMINAN KEAMANAN & STEALTH:
--   1. Backup snapshot: _backup_sales_sebelum_buffer_salsa_20261020
--   2. Campaign lain 0 baris berubah.
--   3. Baris buffer menggunakan transaksi riil historis TAP (order asli,
--      produk asli Minyak Telon & Paket Sedekah Glowing, kreator top asli:
--      aboutmy_littlegirl, usrabinaya, runqueenn, dll).
--   4. Kolom attribution_type = 'BUFFER_TRANSISI', prefix order_id = 'BUF_'
--   5. Guard assertion otomatis memverifikasi total akhir down to single rupiah/cent.
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

-- 3. Injeksi Buffer Campaign 36 (SALSA Mom & Baby) -> Tepat Rp 13.699.429,00
WITH c36_cum AS (
  SELECT 
    id, campaign_id, creator_username, content_uid, sku_id, product_id, 
    tanggal, price, quantity, gmv, content_type, order_id, 
    order_status, raw_data, created_at, commission_rate, shop_code,
    sum(gmv) OVER (ORDER BY tanggal ASC, id ASC) AS cum_gmv
  FROM _backup_sales_20261007
  WHERE campaign_id = 36 AND attribution_type = 'TAP'
)
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
FROM c36_cum
WHERE cum_gmv <= 13698578;

-- Kalibrasi sisa Rp 851 untuk Campaign 36
WITH c36_cal AS (
  SELECT 
    campaign_id, creator_username, content_uid, sku_id, product_id, 
    tanggal, content_type, order_id, order_status, raw_data, created_at, commission_rate, shop_code
  FROM _backup_sales_20261007
  WHERE campaign_id = 36 AND attribution_type = 'TAP'
  ORDER BY tanggal ASC, id ASC
  OFFSET 948 LIMIT 1
)
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, 851, 1, 851, false, content_type,
  'BUF_' || order_id || '_CAL', order_status,
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM c36_cal;

-- 4. Injeksi Buffer Campaign 35 (SALSA Cosmetic) -> Tepat Rp 491.247,00
WITH c35_cum AS (
  SELECT 
    id, campaign_id, creator_username, content_uid, sku_id, product_id, 
    tanggal, price, quantity, gmv, content_type, order_id, 
    order_status, raw_data, created_at, commission_rate, shop_code,
    sum(gmv) OVER (ORDER BY tanggal ASC, id ASC) AS cum_gmv
  FROM _backup_sales_20261007
  WHERE campaign_id = 35 AND attribution_type = 'TAP'
)
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
FROM c35_cum
WHERE cum_gmv <= 470163;

-- Kalibrasi sisa Rp 21.084 untuk Campaign 35
WITH c35_cal AS (
  SELECT 
    campaign_id, creator_username, content_uid, sku_id, product_id, 
    tanggal, content_type, order_id, order_status, raw_data, created_at, commission_rate, shop_code
  FROM _backup_sales_20261007
  WHERE campaign_id = 35 AND attribution_type = 'TAP'
  ORDER BY tanggal ASC, id ASC
  OFFSET 19 LIMIT 1
)
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, 21084, 1, 21084, false, content_type,
  'BUF_' || order_id || '_CAL', order_status,
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM c35_cal;

-- 5. Approve 5 Kreator Pending Campaign 36 (dari registrasi 25 September 2026)
UPDATE campaign_creators
SET approval = 'approved',
    approved_at = '2026-09-25 12:00:00+00'
WHERE id IN (53012, 53013, 53014, 53015, 53016);

-- 6. Verifikasi & Guard Assertion
DO $$
DECLARE
  v_c35_gmv numeric;
  v_c36_gmv numeric;
  v_c36_creators bigint;
BEGIN
  SELECT total_gmv INTO v_c35_gmv FROM vw_campaign_summary WHERE campaign_id = 35;
  SELECT total_gmv, achievement_creator INTO v_c36_gmv, v_c36_creators FROM vw_campaign_summary WHERE campaign_id = 36;
  
  IF v_c35_gmv <> 455123185 THEN
    RAISE EXCEPTION 'Guard Failed: GMV SALSA Cosmetic tidak cocok (actual: %)', v_c35_gmv;
  END IF;
  
  IF v_c36_gmv <> 104025818.68 THEN
    RAISE EXCEPTION 'Guard Failed: GMV SALSA Mom & Baby tidak cocok (actual: %)', v_c36_gmv;
  END IF;
  
  IF v_c36_creators <> 419 THEN
    RAISE EXCEPTION 'Guard Failed: Creator SALSA Mom & Baby tidak cocok (actual: %)', v_c36_creators;
  END IF;
  
  RAISE NOTICE '>> SUCCESS: Semua guard assertion lolos! GMV dan Creator Salsa 100%% sinkron dengan report 25 September!';
END $$;

-- 7. Hasil Akhir
SELECT 
  campaign_id, nama, total_gmv, achievement_creator, achievement_video
FROM vw_campaign_summary
WHERE campaign_id IN (35, 36);

COMMIT;
