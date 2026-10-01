-- =====================================================================
-- 21 - Akurasi data VIDEO & PROFIL KREATOR
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan:
-- curl -s https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/21-akurasi-video-profil.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. CONSTRAINT & INDEX yang benar-benar ada di organic_videos ==='
-- PENTING: import pakai ON CONFLICT (content_uid, product_id).
-- Kalau unique-nya bukan itu, semua klaim "baris dobel" jadi dipertanyakan.
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'organic_videos'
ORDER BY indexname;

\echo ''
\echo '=== 2. BENAR-BENARNYA DOBEL ATAU CUMA SATU VIDEO BANYAK PRODUCT? ==='
SELECT
  count(*)                                                        AS total_baris,
  count(DISTINCT (content_uid, product_id))                       AS unik_content_x_product,
  count(DISTINCT content_uid)                                     AS unik_content_uid,
  count(*) - count(DISTINCT (content_uid, product_id))            AS dobel_true,
  count(DISTINCT content_uid) - count(DISTINCT (content_uid, COALESCE(product_id,'')))  AS selisih_unik
FROM organic_videos;

\echo ''
\echo '=== 3. Rows dengan (content_uid, product_id) sama > 1 (dobot asli) ==='
SELECT count(*) AS kelompok_dobot, COALESCE(sum(jml-1),0) AS baris_lebih, max(jml) AS maks
FROM (
  SELECT count(*) AS jml FROM organic_videos
  GROUP BY content_uid, product_id HAVING count(*) > 1
) x;

\echo ''
\echo '=== 4. content_uid yang punya BEDA product_id (satu video, banyak SKU) ==='
SELECT count(*) AS kelompok, COALESCE(sum(jml-1),0) AS baris_tambahan, max(jml) AS maks_product_per_video
FROM (
  SELECT count(*) AS jml FROM organic_videos
  GROUP BY content_uid HAVING count(*) > 1
) y;

\echo ''
\echo '=== 5. 10 content_uid dengan product_id terbanyak ==='
SELECT content_uid, count(DISTINCT product_id) AS jml_product,
       count(*) AS jml_baris, string_agg(DISTINCT COALESCE(product_id,'(null)'), ', ') AS products
FROM organic_videos
GROUP BY content_uid HAVING count(*) > 1
ORDER BY jml_product DESC LIMIT 10;

\echo ''
\echo '=== 6. views: apakah baris satu video punya ANGKA BERBEDA? ==='
-- Kalau 1 video 1 product tapi views-nya beda2, itu race condition import.
SELECT count(*) AS video_product_dengan_views_berbeda
FROM (
  SELECT content_uid, product_id FROM organic_videos
  GROUP BY content_uid, product_id
  HAVING count(DISTINCT video_views) > 1
) z;

\echo ''
\echo '=== 7. PETA DUPLIKAT di tabel videos (tabel lain, bukan organic) ==='
SELECT count(*) AS groups, COALESCE(sum(jml-1),0) AS baris_lebih
FROM (
  SELECT count(*) AS jml FROM videos
  WHERE content_uid IS NOT NULL
  GROUP BY content_uid HAVING count(*) > 1
) v;

\echo ''
\echo '=== 8. videos: content_uid sama tapi campaign_creator BEDA ==='
SELECT count(*) AS groups, COALESCE(sum(jml-1),0) AS baris_lebih
FROM (
  SELECT count(*) AS jml FROM videos
  WHERE content_uid IS NOT NULL
  GROUP BY content_uid HAVING count(DISTINCT campaign_creator_id) > 1
) w;

\echo ''
\echo '=== 9. live_sessions: duplikat? ==='
SELECT
  (SELECT count(*) FROM live_sessions)                                          AS total_baris,
  (SELECT count(DISTINCT creator_username) FROM live_sessions)                   AS unik_creator,
  (SELECT count(*) FROM (SELECT 1 FROM live_sessions GROUP BY creator_username, start_time HAVING count(*)>1) a) AS dobrol_waktu;

\echo ''
\echo '=== 10. MAPPING: organic_videos campaign_id NULL tapi SKU-nya TERDAFTAR ==='
-- Ini yang harusnya 0 kalau mekanismenya benar.
SELECT count(*) AS baris_null_campaign,
       count(*) FILTER (WHERE s.id IS NOT NULL) AS sku_terdaftar,
       count(*) FILTER (WHERE s.id IS NULL)      AS sku_belum_terdaftar
FROM organic_videos ov
LEFT JOIN skus s ON s.product_id = ov.product_id
WHERE ov.campaign_id IS NULL AND ov.product_id IS NOT NULL;

\echo ''
\echo '=== 11. MAPPING: sales campaign_id NULL tapi SKU-nya TERDAFTAR ==='
SELECT count(*) AS baris_null_campaign,
       count(*) FILTER (WHERE s.id IS NOT NULL) AS sku_terdaftar,
       count(*) FILTER (WHERE s.id IS NULL)      AS sku_belum_terdaftar
FROM sales sl
LEFT JOIN skus s ON s.product_id = sl.product_id
WHERE sl.campaign_id IS NULL AND sl.product_id IS NOT NULL;

\echo ''
\echo '=== 12. product_id NULL (tidak akan pernah terpetakan) ==='
SELECT
  (SELECT count(*) FROM organic_videos WHERE product_id IS NULL) AS organic_product_null,
  (SELECT count(*) FROM sales WHERE product_id IS NULL)           AS sales_product_null;

\echo ''
\echo '=== 13. PROFIL KREATOR: username di organic_videos tapi tidak ada di creators ==='
-- Kalau banyak, profil kreator akan kosong untuk kreator itu.
SELECT count(DISTINCT ov.creator_username) AS username_tidak_terdaftar,
       count(*) AS baris_terkena
FROM organic_videos ov
LEFT JOIN creators c ON LOWER(c.username) = LOWER(ov.creator_username)
WHERE c.id IS NULL AND ov.creator_username <> 'unknown';

\echo ''
\echo '=== 14. 15 username itu ==='
SELECT ov.creator_username, count(*) AS jml_video
FROM organic_videos ov
LEFT JOIN creators c ON LOWER(c.username) = LOWER(ov.creator_username)
WHERE c.id IS NULL AND ov.creator_username <> 'unknown'
GROUP BY 1 ORDER BY jml_video DESC LIMIT 15;

\echo ''
\echo '=== 15. views SANITY: berapa video yang views-nya 0 atau NULL ==='
SELECT
  count(*) FILTER (WHERE video_views IS NULL)  AS views_null,
  count(*) FILTER (WHERE video_views = 0)      AS views_nol,
  count(*) FILTER (WHERE video_views > 0)      AS views_ada,
  min(video_views) AS views_min, max(video_views) AS views_max,
  percentile_disc(0.5) WITHIN GROUP (ORDER BY video_views) AS views_median
FROM organic_videos;

\echo ''
\echo '=== 16. 15 video dengan views tertinggi ==='
SELECT content_uid, creator_username, video_views, video_likes, product_id, campaign_id, post_time
FROM organic_videos
ORDER BY video_views DESC NULLS LAST LIMIT 15;
