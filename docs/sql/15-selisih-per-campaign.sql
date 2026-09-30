-- =====================================================================
-- 15 — SELISIH: total tabel vs yang benar-benar masuk ke per campaign
-- Read-only. Menjawab pertanyaan: "apakah data saya akurat per campaign?"
-- =====================================================================
\pset pager off
\t on

\echo '=== A. Tiga angka yang harus dibandingkan ==='
SELECT
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)          AS total_tabel,
  (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)        AS jumlah_per_campaign,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund
     AND campaign_id IS NULL)                                          AS gmv_belum_terpetakan,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)
  - (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)       AS selisih;

\echo ''
\echo '=== B.Campaign mana yang paling ==='
\echo '=== C. Baris yang punya campaign_id tapi campaign-nya tidak ada (yatim) ==='
SELECT count(*) AS baris_yatim,
       COALESCE(sum(gmv),0) AS gmv_yatim
FROM sales s
WHERE s.campaign_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = s.campaign_id);

\echo ''
\echo '=== D. organic_videos: sama atau tidak ==='
SELECT
  (SELECT COALESCE(sum(video_views),0) FROM organic_videos)            AS total_views_tabel,
  (SELECT COALESCE(sum(video_views),0) FROM organic_videos WHERE campaign_id IS NOT NULL) AS views_terpetakan,
  (SELECT count(*) FROM organic_videos WHERE campaign_id IS NULL)      AS konten_belum_terpetakan;

\echo ''
\echo '=== E. Campaign yang punya data, urut GMV ==='
SELECT nama,
       achievement_video,
       total_daily_organic,
       total_daily_vsa,
       official_daily_gmv
FROM vw_campaign_summary
ORDER BY official_daily_gmv DESC NULLS LAST
LIMIT 20;