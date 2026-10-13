\pset pager off
WITH vids AS (
  SELECT 
    v.id,
    substring(v.link_video from '/video/([0-9]{15,22})') as uid
  FROM videos v
  JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
  WHERE cc.campaign_id = 57 AND v.link_video IS NOT NULL
),
dated_vids AS (
  SELECT 
    v.id,
    v.uid,
    to_char((to_timestamp((v.uid::numeric / 4294967296)::bigint) AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') as month,
    to_char((to_timestamp((v.uid::numeric / 4294967296)::bigint) AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') as upload_date
  FROM vids v
  WHERE v.uid IS NOT NULL
)
SELECT 
  month,
  count(distinct uid) as unique_videos_count
FROM dated_vids
GROUP BY month
ORDER BY month;
