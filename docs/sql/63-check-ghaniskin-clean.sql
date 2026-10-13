\pset pager off
\x on

-- 1. View resmi vw_campaign_summary
SELECT 
  campaign_id,
  total_gmv,
  total_gmv_video,
  total_gmv_live,
  achievement_video,
  achievement_creator
FROM vw_campaign_summary
WHERE campaign_id = 57;

-- 2. organic_videos dengan campaign_id = 57
SELECT 
  COUNT(*) as total_organic_rows,
  COUNT(DISTINCT content_uid) as distinct_content_uid
FROM organic_videos
WHERE campaign_id = 57;

-- 3. Cek videos di internal:
-- Status upload, posting_date, dll di tabel videos
\x off
SELECT 
  COUNT(*) as total_videos_row,
  COUNT(CASE WHEN link_video IS NOT NULL AND TRIM(link_video) != '' THEN 1 END) as ada_link_video,
  COUNT(CASE WHEN link_video IS NULL OR TRIM(link_video) = '' THEN 1 END) as tanpa_link_video
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57;

-- 4. Cek berapa kreator di Ghaniskin (approved vs all)
SELECT 
  approval,
  COUNT(*) as total_creators,
  SUM(qty_vt) as total_target_vt
FROM campaign_creators
WHERE campaign_id = 57
GROUP BY approval;
