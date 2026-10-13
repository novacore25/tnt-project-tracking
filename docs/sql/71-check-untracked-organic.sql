\pset pager off
-- Cek apakah ada video organik di TikTok dari kreator Ghaniskin yang belum terhubung di tabel videos
SELECT 
  ov.creator_username,
  ov.content_uid,
  ov.post_time,
  ov.video_views,
  cc.id as campaign_creator_id
FROM organic_videos ov
JOIN creators c ON LOWER(ov.creator_username) = LOWER(c.username)
JOIN campaign_creators cc ON cc.creator_id = c.id
WHERE cc.campaign_id = 57 
  AND cc.approval = 'approved'
  AND ov.content_type NOT IN ('livestream', 'live')
  AND ov.content_uid NOT IN (
    SELECT v.content_uid 
    FROM videos v 
    JOIN campaign_creators cc2 ON v.campaign_creator_id = cc2.id 
    WHERE cc2.campaign_id = 57 AND v.content_uid IS NOT NULL
  )
ORDER BY ov.post_time DESC
LIMIT 30;
