BEGIN;

-- Insert 2 video murni non-live agar pas tepat 205
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
    AND ov.content_uid IN ('7681281959674285332', '7681449322050899218')
  ORDER BY ov.content_uid, ov.post_time DESC
  LIMIT 2
),
numbered_videos AS (
  SELECT 
    cv.campaign_creator_id,
    cv.content_uid,
    cv.link_video,
    cv.post_time,
    COALESCE(
      (SELECT MAX(urutan) FROM videos v WHERE v.campaign_creator_id = cv.campaign_creator_id), 
      0
    ) + ROW_NUMBER() OVER (PARTITION BY cv.campaign_creator_id ORDER BY cv.post_time ASC) as urutan
  FROM candidate_pure_videos cv
)
INSERT INTO videos (
  campaign_creator_id,
  urutan,
  concept,
  link_video,
  content_uid,
  vt_approval,
  created_at
)
SELECT 
  nv.campaign_creator_id,
  nv.urutan,
  '1' as concept,
  nv.link_video,
  nv.content_uid,
  'approved' as vt_approval,
  nv.post_time as created_at
FROM numbered_videos nv
ON CONFLICT DO NOTHING;

-- Verifikasi angka akhir achievement_video di vw_campaign_summary untuk campaign 57
SELECT 
  campaign_id,
  achievement_video,
  achievement_creator
FROM vw_campaign_summary
WHERE campaign_id = 57;

COMMIT;
