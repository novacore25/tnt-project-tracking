-- ==============================================================================
-- Script 82: Buat Tabel Staging tiktok_sync_sales_staging
-- Tanggal: 2026-10-08
-- Tujuan: Membuat zona isolasi (staging) untuk penarikan pesanan otomatis OpenAPI,
--         sehingga tabel raw 'sales' dan 'organic_videos' 100% aman dan steril.
-- ==============================================================================

\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS tiktok_sync_sales_staging (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  sku_id TEXT,
  campaign_id INT REFERENCES campaigns(id) ON DELETE SET NULL,
  creator_username TEXT,
  content_uid TEXT,
  tanggal TIMESTAMPTZ,
  price NUMERIC(18, 2) DEFAULT 0,
  quantity INT DEFAULT 1,
  gmv NUMERIC(18, 2) DEFAULT 0,
  is_refund BOOLEAN DEFAULT false,
  content_type TEXT DEFAULT 'video',
  order_status TEXT,
  commission_rate TEXT,
  attribution_type TEXT DEFAULT 'TAP',
  tiktok_campaign_id TEXT,
  sync_batch_id TEXT,
  sync_status TEXT DEFAULT 'pending', -- 'pending' | 'applied' | 'ignored'
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  CONSTRAINT uq_staging_order_product UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_staging_sync_status ON tiktok_sync_sales_staging(sync_status);
CREATE INDEX IF NOT EXISTS idx_staging_campaign_id ON tiktok_sync_sales_staging(campaign_id);
CREATE INDEX IF NOT EXISTS idx_staging_product_id ON tiktok_sync_sales_staging(product_id);

COMMIT;

\echo '---------------------------------------------------------'
\echo 'SUKSES: Tabel tiktok_sync_sales_staging berhasil dibuat!'
\echo '---------------------------------------------------------'

SELECT count(*) as total_baris_staging FROM tiktok_sync_sales_staging;
