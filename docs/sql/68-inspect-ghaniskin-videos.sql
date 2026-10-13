\pset pager off
\x on

-- Cek rincian penghitungan 189 video Ghaniskin di vw_video_klasifikasi
SELECT 
  count(id) as total_video_tayang
FROM vw_video_klasifikasi
WHERE campaign_id = 57 AND punya_link IS TRUE AND is_livestream IS NOT TRUE;

-- Cek apakah ada video yang tidak punya content_uid tapi punya link_video
\x off
SELECT 
  v.id,
  v.campaign_creator_id,
  v.link_video,
  v.content_uid,
  cc.approval
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57 AND v.link_video IS NOT NULL
ORDER BY v.id DESC
LIMIT 10;
