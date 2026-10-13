\pset pager off
-- Cek 205 video dari vw_video_klasifikasi
WITH klas AS (
  SELECT 
    v.id,
    v.campaign_creator_id,
    v.link_video,
    v.content_uid,
    substring(v.link_video from '/video/([0-9]+)') as url_uid
  FROM vw_video_klasifikasi v
  WHERE v.campaign_id = 57 AND v.punya_link IS TRUE AND v.is_livestream IS NOT TRUE
),
org AS (
  SELECT DISTINCT ov.content_uid::text as org_uid
  FROM organic_videos ov
  JOIN skus s ON trim(ov.product_id::text) = trim(s.product_id::text)
  WHERE s.campaign_id = 57
    AND (ov.content_type IS NULL OR (ov.content_type NOT ILIKE '%live%' AND ov.content_type NOT ILIKE '%livestream%'))
)
SELECT 
  k.id,
  k.link_video,
  k.content_uid,
  k.url_uid,
  (CASE WHEN o1.org_uid IS NOT NULL THEN 'MATCH_CONTENT_UID'
        WHEN o2.org_uid IS NOT NULL THEN 'MATCH_URL_UID'
        ELSE 'NOT_IN_ORGANIC_SKU'
   END) as match_status
FROM klas k
LEFT JOIN org o1 ON k.content_uid::text = o1.org_uid
LEFT JOIN org o2 ON k.url_uid::text = o2.org_uid
WHERE o1.org_uid IS NULL AND o2.org_uid IS NULL;
