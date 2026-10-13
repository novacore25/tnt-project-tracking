\pset pager off
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name IN ('daily_performance', 'vw_campaign_summary');

SELECT * FROM daily_performance WHERE campaign_id = 57 LIMIT 5;
