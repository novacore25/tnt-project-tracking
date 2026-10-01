-- =====================================================================
-- 22 - VI: apakah satu video reallyditag banyak SKU, atau itu cross-join?
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan:
-- curl -s https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/22-vi-banyak-sku.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. SEBARAN: berapa product_id per video (buckets) ==='
SELECT jml_product AS product_per_video, count(*) AS jumlah_video
FROM (
  SELECT content_uid, count(DISTINCT product_id) AS jml_product
  FROM organic_videos GROUP BY content_uid
) x
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== 2. KELOMPOK BESAR: video dengan >20 product_id ==='
SELECT count(*) AS jumlah_video, min(jml) AS min_product, max(jml) AS max_product,
       COALESCE(sum(jml),0) AS total_baris_seluruhnya
FROM (
  SELECT count(DISTINCT product_id) AS jml FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
) y;

\echo ''
\echo '=== 3. product_id yang dipakai video ">20 SKU" itu ==='
-- Kalau semua video itu memakai product_id yang SAMA persis, itu cross-join.
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT ov.product_id, count(DISTINCT ov.content_uid) AS dipakai_oleh_berapa_video,
       count(*) AS baris, min(c.nama) AS satu_contoh_campaign
FROM organic_videos ov
JOIN g ON g.content_uid = ov.content_uid
LEFT JOIN skus s ON s.product_id = ov.product_id
LEFT JOIN campaigns c ON c.id = ov.campaign_id
GROUP BY ov.product_id
ORDER BY 2 DESC LIMIT 20;

\echo ''
\echo '=== 4. DARI MANA product_id itu? campaign mana? ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT COALESCE(ov.campaign_id::text, '(NULL)') AS campaign_id,
       COALESCE(c.nama, '(tidak ada)')          AS campaign_nama,
       count(*) AS baris,
       count(DISTINCT ov.content_uid) AS video,
       count(DISTINCT ov.creator_username) AS kreator
FROM organic_videos ov
JOIN g ON g.content_uid = ov.content_uid
LEFT JOIN campaigns c ON c.id = ov.campaign_id
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;

\echo ''
\echo '=== 5. SIAPA kreator di video ">20 SKU" itu? ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT ov.creator_username, count(DISTINCT ov.content_uid) AS video,
       count(DISTINCT ov.product_id) AS total_product, min(ov.post_time) AS pertama
FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

\echo ''
\echo '=== 6. VIEWS: apakah SUM per baris menghitung video yang sama berulang? ==='
-- Ini akar angka "54 juta views" yang jauh lebih besar dari reality.
SELECT
  (SELECT COALESCE(sum(video_views),0) FROM organic_videos)                AS jumlah_views_per_baris,
  (SELECT COALESCE(sum(mx),0) FROM (
      SELECT MAX(video_views) AS mx FROM organic_videos GROUP BY content_uid) t) AS jumlah_views_per_video_unik,
  (SELECT COALESCE(sum(video_likes),0) FROM organic_videos)               AS jumlah_likes_per_baris,
  (SELECT COALESCE(sum(mx),0) FROM (
      SELECT MAX(video_likes) AS mx FROM organic_videos GROUP BY content_uid) u) AS jumlah_likes_per_video_unik;

\echo ''
\echo '=== 7. LIKES: apakah satu video punya likes BERBEDA antar product_id? ==='
SELECT count(*) AS video_dengan_likes_berbeda, COALESCE(sum(jml-1),0) AS selisih_baris
FROM (
  SELECT content_uid, count(DISTINCT video_likes) AS jml
  FROM organic_videos GROUP BY content_uid HAVING count(DISTINCT video_likes) > 1
) a;

\echo ''
\echo '=== 8. VIEWS DISTRIBUSI (lengkap, yang tadi terpotong) ==='
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE video_views IS NULL) AS views_null,
  count(*) FILTER (WHERE video_views = 0)     AS views_nol,
  count(*) FILTER (WHERE video_views > 0)     AS views_ada,
  min(video_views)                            AS min,
  percentile_disc(0.25) WITHIN GROUP (ORDER BY video_views) AS p25,
  percentile_disc(0.50) WITHIN GROUP (ORDER BY video_views) AS median,
  percentile_disc(0.90) WITHIN GROUP (ORDER BY video_views) AS p90,
  max(video_views)                            AS max
FROM (SELECT DISTINCT ON (content_uid) content_uid, video_views
      FROM organic_videos ORDER BY content_uid, video_views DESC) uniq;

\echo ''
\echo '=== 9. views di luar masuk akal (>5 juta, engagement >100%) ==='
SELECT count(*) AS views_sangat_tinggi
FROM (SELECT DISTINCT ON (content_uid) content_uid, video_views, video_likes
      FROM organic_videos ORDER BY content_uid, video_views DESC) u
WHERE video_views > 5000000;

SELECT count(*) AS like_lebih_besar_dari_views
FROM (SELECT DISTINCT ON (content_uid) content_uid, video_views, video_likes
      FROM organic_videos ORDER BY content_uid, video_views DESC) u
WHERE video_likes > video_views;

\echo ''
\echo '=== 10. TABEL videos: 75 kelompok duplikat, detail ==='
SELECT v.content_uid, count(*) AS jml,
       count(DISTINCT v.campaign_creator_id) AS cc_berbeda,
       count(DISTINCT v.vt_approval) AS approval_berbeda,
       string_agg(DISTINCT v.vt_approval, ',') AS approval
FROM videos v
WHERE v.content_uid IS NOT NULL
GROUP BY v.content_uid HAVING count(*) > 1
ORDER BY jml DESC LIMIT 20;

\echo ''
\echo '=== 11. 3 kasus content_uid sama tapi campaign_creator BEDA ==='
SELECT v.content_uid, v.campaign_creator_id, cc.campaign_id,
       c.username, v.vt_approval, v.urutan, v.link_video IS NOT NULL AS ada_link
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
JOIN creators c ON c.id = cc.creator_id
WHERE v.content_uid IN (
  SELECT content_uid FROM videos
  WHERE content_uid IS NOT NULL
  GROUP BY content_uid HAVING count(DISTINCT campaign_creator_id) > 1
)
ORDER BY v.content_uid, v.campaign_creator_id;

\echo ''
\echo '=== 12. live_sessions: 209 baris / 62 kreator, wajar? ==='
SELECT creator_username, count(*) AS jumlah_session,
       min(start_time) AS pertama, max(start_time) AS terakhir
FROM live_sessions GROUP BY 1 ORDER BY 2 DESC LIMIT 15;

\echo ''
\echo '=== 13. Total views unik per campaign (angka BENAR untuk halaman Performa) ==='
SELECT c.id, c.nama,
       count(DISTINCT ov.content_uid) AS video_unik,
       COALESCE(sum(ov.video_views),0) AS views_benar,
       count(*) AS baris_mentah
FROM campaigns c
JOIN organic_videos ov ON ov.campaign_id = c.id
GROUP BY c.id, c.nama
ORDER BY views_benar DESC NULLS LAST LIMIT 25;
