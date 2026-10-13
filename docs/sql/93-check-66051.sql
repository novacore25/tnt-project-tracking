\pset pager off
SELECT content_uid, post_time, to_char(post_time, 'YYYY-MM-DD HH24:MI:SS') as post_str
FROM organic_videos
WHERE content_uid = '7680053883103644946';
