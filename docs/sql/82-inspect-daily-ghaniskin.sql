\pset pager off
-- 1. Berapa banyak baris di videos untuk campaign 57?
SELECT count(*) as total_videos_cc
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57;

-- 2. Berapa banyak yang link_video NOT NULL?
SELECT count(*) as total_videos_with_link
FROM videos v
JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
WHERE cc.campaign_id = 57 AND v.link_video IS NOT NULL;

-- 3. Cek video yang baru kita insert (ID 66043 - 66063):
SELECT v.id, v.campaign_creator_id, v.link_video, v.content_uid, v.created_at
FROM videos v
WHERE v.id >= 66043 AND v.id <= 66063;

-- 4. Cek organic_videos breakdown per month untuk campaign 57:
SELECT to_char(post_time, 'YYYY-MM') as month, count(distinct content_uid) as total_organic_vids
FROM organic_videos
WHERE campaign_id = 57
GROUP BY 1 ORDER BY 1;
