\pset pager off
SELECT 
  v.id,
  v.campaign_creator_id,
  v.urutan,
  v.vt_approval,
  v.concept,
  cc.creator_id,
  c.username,
  cc.approval
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
JOIN creators c ON cc.creator_id = c.id
WHERE cc.campaign_id = 57 AND (v.link_video IS NULL OR TRIM(v.link_video) = '')
ORDER BY v.id ASC
LIMIT 20;
