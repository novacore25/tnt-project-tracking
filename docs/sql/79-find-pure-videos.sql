\pset pager off
-- Pilih kandidat yang DIJAMIN bukan livestream (content_type bukan live/livestream)
WITH candidate_pure_videos AS (
  SELECT DISTINCT ON (ov.content_uid)
    cc.id as campaign_creator_id,
    c.username,
    ov.content_uid,
    'https://www.tiktok.com/@' || c.username || '/video/' || ov.content_uid as link_video,
    ov.post_time
  FROM organic_videos ov
  JOIN creators c ON LOWER(ov.creator_username) = LOWER(c.username)
  JOIN campaign_creators cc ON cc.creator_id = c.id
  WHERE cc.campaign_id = 57 
    AND cc.approval = 'approved'
    AND ov.content_uid NOT IN (
      SELECT ov2.content_uid FROM organic_videos ov2 
      WHERE lower(COALESCE(ov2.content_type, '')) IN ('livestream', 'live')
    )
    AND ov.post_time >= '2026-08-31'
    AND ov.content_uid NOT IN (
      SELECT v.content_uid 
      FROM videos v 
      JOIN campaign_creators cc2 ON v.campaign_creator_id = cc2.id 
      WHERE cc2.campaign_id = 57 AND v.content_uid IS NOT NULL
    )
  ORDER BY ov.content_uid, ov.post_time DESC
  LIMIT 5
)
SELECT * FROM candidate_pure_videos;
