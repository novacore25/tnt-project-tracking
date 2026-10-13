\pset pager off
-- Cek join campaign_creators dengan videos
SELECT 
  count(v.id) as total_joined_videos,
  count(distinct v.campaign_creator_id) as total_creators_with_videos
FROM campaign_creators cc
JOIN videos v ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57;

-- Cek apakah 21 video yang baru kita buat (ID 66043 - 66063) masuk join ini:
SELECT 
  v.id,
  v.campaign_creator_id,
  cc.campaign_id,
  c.username,
  v.link_video
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
JOIN creators c ON cc.creator_id = c.id
WHERE v.id >= 66043 AND v.id <= 66063;
