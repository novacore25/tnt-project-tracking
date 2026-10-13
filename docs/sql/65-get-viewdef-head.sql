\pset pager off
SELECT substring(pg_get_viewdef('vw_campaign_summary', true) from 1 for 1500);
