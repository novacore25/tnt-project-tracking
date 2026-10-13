\pset pager off
-- Cek apakah videos dari campaign 57 masuk ke videos
SELECT 
  count(*) as total_vids,
  count(v.link_video) as with_link,
  count(v.content_uid) as with_uid
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57;

-- Cek berapa video di videos yang linked ke creator approved
SELECT 
  cc.approval,
  count(*) as count_videos,
  count(v.link_video) as count_with_link
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57
GROUP BY cc.approval;
