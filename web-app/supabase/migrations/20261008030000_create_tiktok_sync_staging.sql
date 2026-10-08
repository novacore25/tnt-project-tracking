-- Migration: Create tiktok_sync_sales_staging table
-- Date: 2026-10-08
-- Purpose: Staging table for TikTok Shop OpenAPI auto-synced affiliate orders,
-- protecting main 'sales' and 'organic_videos' tables from direct unverified writes.

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
