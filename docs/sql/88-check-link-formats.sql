\pset pager off
-- 1. Berapa video yang match format /video/(\d+) di videos untuk campaign 57?
WITH vids AS (
  SELECT 
    v.id,
    v.campaign_creator_id,
    v.link_video,
    v.content_uid,
    substring(v.link_video from '/video/([0-9]{15,22})') as extracted_uid,
    v.created_at
  FROM videos v
  JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
  WHERE cc.campaign_id = 57 AND v.link_video IS NOT NULL
)
SELECT 
  count(*) as total_with_link,
  count(extracted_uid) as valid_uids,
  count(CASE WHEN extracted_uid IS NULL THEN 1 END) as invalid_uids
FROM vids;

-- 2. Tampilkan yang invalid_uids jika ada:
SELECT v.id, v.link_video, v.content_uid
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57 AND v.link_video IS NOT NULL
  AND substring(v.link_video from '/video/([0-9]{15,22})') IS NULL;
