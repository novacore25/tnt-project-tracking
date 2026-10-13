\pset pager off
-- Rekap daftar video yang baru ditambahkan untuk Ghaniskin
SELECT 
  v.id,
  v.campaign_creator_id,
  c.username,
  v.content_uid,
  v.link_video,
  v.concept,
  v.vt_approval,
  v.created_at
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
JOIN creators c ON cc.creator_id = c.id
WHERE cc.campaign_id = 57 
  AND v.id >= 66043
ORDER BY v.id ASC;
