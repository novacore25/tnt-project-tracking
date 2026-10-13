\pset pager off
-- Cek SKU campaign 57
SELECT id, product_id, nama_produk FROM skus WHERE campaign_id = 57;

-- Cek berapa video non-live di organic_videos yang cocok dengan product_id campaign 57:
SELECT 
  to_char(ov.post_time, 'YYYY-MM') as month,
  count(distinct ov.content_uid) as total_vids
FROM organic_videos ov
JOIN skus s ON trim(ov.product_id::text) = trim(s.product_id::text)
WHERE s.campaign_id = 57
  AND (ov.content_type IS NULL OR (ov.content_type NOT ILIKE '%live%' AND ov.content_type NOT ILIKE '%livestream%'))
GROUP BY 1 ORDER BY 1;
