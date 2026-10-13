\pset pager off
\x on

-- 1. Cek di view resmi vw_campaign_summary
SELECT 
  campaign_id,
  campaign_nama,
  total_gmv,
  total_gmv_video,
  total_gmv_live,
  achievement_video,
  achievement_creator
FROM vw_campaign_summary
WHERE campaign_id = 57;

-- 2. Cek di tabel videos (internal tracking)
SELECT 
  COUNT(*) as total_rows_videos,
  COUNT(CASE WHEN link_video IS NOT NULL AND TRIM(link_video) != '' THEN 1 END) as videos_with_link,
  COUNT(CASE WHEN content_uid IS NOT NULL AND TRIM(content_uid) != '' THEN 1 END) as videos_with_content_uid,
  COUNT(DISTINCT COALESCE(content_uid, link_video)) as videos_unique_identifier
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57;

-- 2b. Breakdown per approval campaign_creators di tabel videos
\x off
SELECT 
  cc.approval,
  COUNT(v.id) as total_video
FROM campaign_creators cc
LEFT JOIN videos v ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57
GROUP BY cc.approval;

-- 3. Cek di tabel organic_videos (data impor TikTok)
\x on
SELECT 
  COUNT(*) as total_rows_organic_videos,
  COUNT(DISTINCT content_uid) as distinct_content_uid,
  COUNT(DISTINCT video_id) as distinct_video_id
FROM organic_videos
WHERE campaign_id = 57;

-- 3b. Cek organic_videos via username creator yang ada di campaign 57
SELECT 
  COUNT(*) as total_organic_via_creator,
  COUNT(DISTINCT ov.content_uid) as distinct_content_uid_via_creator
FROM organic_videos ov
WHERE LOWER(ov.creator_username) IN (
  SELECT LOWER(c.username)
  FROM campaign_creators cc
  JOIN creators c ON cc.creator_id = c.id
  WHERE cc.campaign_id = 57
);

-- 4. Cek target_video di campaigns
SELECT id, nama, target_video, target_gmv, target_creator FROM campaigns WHERE id = 57;
