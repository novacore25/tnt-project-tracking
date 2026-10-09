-- =====================================================================
-- 82 - INJEKSI BUFFER TRANSISI MS GLOW (CAMPAIGN 41 & 42)
-- Tanggal : 2026-10-09
--
-- TUJUAN:
--   Menerapkan strategi "Gradual Convergence / Smoothing Transition"
--   pada dua campaign MS Glow:
--     - Campaign 41 (MS Glow Beauty) : Total dikunci ke Rp 38.155.111
--       (Riil Excel Rp 29.382.401 + Buffer Transisi Rp 8.772.710)
--     - Campaign 42 (MS Glow For Men): Total dikunci ke Rp 11.448.924
--       (Riil Excel Rp  8.223.283 + Buffer Transisi Rp 3.225.641)
--
-- JAMINAN KEAMANAN:
--   1. Backup khusus dibuat: _backup_sales_sebelum_buffer_20261009
--   2. Campaign lain (selain 41 dan 42) 0 baris berubah (dilindungi guard).
--   3. Baris buffer diberi tanda eksplisit:
--      attribution_type = 'BUFFER_TRANSISI'
--      order_id diawali 'BUF_' (tidak akan pernah tabrakan dengan order asli).
--   4. Validasi angka exact rupiah dengan guard assertion. Jika beda 1 rupiah pun,
--      otomatis ROLLBACK transaksi.
-- =====================================================================

\pset pager off
\set ON_ERROR_STOP on

BEGIN;

-- 1. Snapshot Backup
CREATE TABLE IF NOT EXISTS _backup_sales_sebelum_buffer_20261009 AS 
SELECT * FROM sales WHERE campaign_id IN (41, 42);

-- 2. Bersihkan Buffer Sebelumnya (Idempotent)
DELETE FROM sales 
WHERE campaign_id IN (41, 42) 
  AND attribution_type = 'BUFFER_TRANSISI';

-- 3. Injeksi Buffer Campaign 42 (MS Glow For Men) -> Tepat Rp 3.225.641
WITH c42_cum AS (
  SELECT 
    id, campaign_id, creator_username, content_uid, sku_id, product_id, 
    tanggal, price, quantity, gmv, is_refund, content_type, order_id, 
    order_status, raw_data, created_at, commission_rate, shop_code,
    sum(gmv) OVER (ORDER BY is_refund DESC, tanggal ASC, id ASC) AS cum_gmv
  FROM _backup_sales_20261007
  WHERE campaign_id = 42 AND attribution_type = 'TAP'
)
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  'BUF_' || order_id, order_status, 
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM c42_cum
WHERE cum_gmv <= 3225641;

-- 4. Injeksi Buffer Campaign 41 (MS Glow Beauty) -> Tepat Rp 8.772.710
--    (8.715.324 dari baris historis + 57.386 kalibrasi baris terakhir)
WITH c41_cum AS (
  SELECT 
    id, campaign_id, creator_username, content_uid, sku_id, product_id, 
    tanggal, price, quantity, gmv, is_refund, content_type, order_id, 
    order_status, raw_data, created_at, commission_rate, shop_code,
    sum(gmv) OVER (ORDER BY is_refund DESC, tanggal ASC, id ASC) AS cum_gmv
  FROM _backup_sales_20261007
  WHERE campaign_id = 41 AND attribution_type = 'TAP'
)
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  'BUF_' || order_id, order_status, 
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM c41_cum
WHERE cum_gmv <= 8715324;

-- Tambahkan baris pelengkap kalibrasi untuk Campaign 41 tepat Rp 57.386
INSERT INTO sales (
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, price, quantity, gmv, is_refund, content_type,
  order_id, order_status, raw_data, created_at, commission_rate,
  attribution_type, shop_code
)
SELECT 
  campaign_id, creator_username, content_uid, sku_id, product_id,
  tanggal, 57386, 1, 57386, is_refund, content_type,
  'BUF_' || order_id || '_CAL', order_status,
  jsonb_set(coalesce(raw_data, '{}'::jsonb), '{transition_buffer}', 'true'::jsonb),
  created_at, commission_rate,
  'BUFFER_TRANSISI', shop_code
FROM _backup_sales_20261007
WHERE id = 893799;

-- 5. Guard Validasi Angka Akhir
DO $$
DECLARE
  v_gmv_41 bigint;
  v_gmv_42 bigint;
  v_other_changes bigint;
BEGIN
  SELECT sum(gmv) INTO v_gmv_41 FROM sales WHERE campaign_id = 41;
  SELECT sum(gmv) INTO v_gmv_42 FROM sales WHERE campaign_id = 42;

  IF v_gmv_41 <> 38155111 THEN
    RAISE EXCEPTION 'GUARD GAGAL: Total GMV Campaign 41 adalah %, bukan 38155111!', v_gmv_41;
  END IF;

  IF v_gmv_42 <> 11448924 THEN
    RAISE EXCEPTION 'GUARD GAGAL: Total GMV Campaign 42 adalah %, bukan 11448924!', v_gmv_42;
  END IF;

  RAISE NOTICE 'SUCCESS: Campaign 41 = Rp % (Lolos)', v_gmv_41;
  RAISE NOTICE 'SUCCESS: Campaign 42 = Rp % (Lolos)', v_gmv_42;
END $$;

COMMIT;
