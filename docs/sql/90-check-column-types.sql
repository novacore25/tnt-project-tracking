\pset pager off
SELECT 
  table_name,
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE (table_name = 'campaign_creators' AND column_name = 'id')
   OR (table_name = 'videos' AND column_name IN ('id', 'campaign_creator_id'));
