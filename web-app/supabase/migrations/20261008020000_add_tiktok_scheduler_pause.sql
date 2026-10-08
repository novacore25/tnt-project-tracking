-- Migration: Add is_scheduler_paused to tiktok_authorizations
-- Date: 2026-10-08
-- Purpose: Allow pausing/resuming TikTok OpenAPI auto-sync scheduler to protect raw tables.

ALTER TABLE IF EXISTS tiktok_authorizations 
ADD COLUMN IF NOT EXISTS is_scheduler_paused BOOLEAN DEFAULT true;

-- Update existing active record to default paused for safety
UPDATE tiktok_authorizations 
SET is_scheduler_paused = true 
WHERE is_scheduler_paused IS NULL;
