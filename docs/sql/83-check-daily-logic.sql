\pset pager off
-- Cek semua video di videos untuk campaign 57 dengan link_video NOT NULL
SELECT 
  v.id,
  v.campaign_creator_id,
  cc.creator_id,
  c.username,
  v.link_video,
  v.content_uid,
  v.created_at,
  -- ekstrak timestamp dari link atau uid jika 19 digit
  substring(v.link_video from '/video/([0-9]+)') as extracted_uid
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
LEFT JOIN creators c ON cc.creator_id = c.id
WHERE cc.campaign_id = 57 AND v.link_video IS NOT NULL
ORDER BY v.id DESC;
