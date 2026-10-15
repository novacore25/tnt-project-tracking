-- Migration: 20261015000000_allow_gmv_awareness_tipe_campaign.sql
-- Description: Allow 'gmv_awareness' in campaigns.tipe_campaign check constraint

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_tipe_campaign_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_tipe_campaign_check 
  CHECK (tipe_campaign IN ('sales', 'awareness', 'gmv_awareness'));
