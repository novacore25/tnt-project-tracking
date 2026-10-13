\pset pager off
\x on
SELECT 
  campaign_id,
  achievement_video,
  achievement_creator
FROM vw_campaign_summary
WHERE campaign_id = 57;
