\pset pager off
SELECT 
  v.id as video_id,
  v.content_uid,
  ov.product_id as ov_product_id,
  ov.campaign_id as ov_campaign_id
FROM videos v
LEFT JOIN organic_videos ov ON v.content_uid = ov.content_uid
WHERE v.id >= 66043 AND v.id <= 66063;
