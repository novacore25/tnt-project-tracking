\pset pager off
-- Cek 19 baris yang baru diinsert di videos
SELECT 
  v.id,
  v.campaign_creator_id,
  v.content_uid,
  v.link_video,
  vk.punya_link,
  vk.is_livestream
FROM videos v
JOIN vw_video_klasifikasi vk ON v.id = vk.id
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57
ORDER BY v.id DESC
LIMIT 20;
