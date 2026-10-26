-- Migration: Menambahkan kolom product_id dan raw_data ke ads_performance
-- Diperlukan untuk menyimpan mapping produk dan payload baris mentah TikTok Ads Manager
ALTER TABLE ads_performance ADD COLUMN IF NOT EXISTS product_id text;
ALTER TABLE ads_performance ADD COLUMN IF NOT EXISTS raw_data jsonb;
