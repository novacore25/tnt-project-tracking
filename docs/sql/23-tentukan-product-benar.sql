-- =====================================================================
-- 23 - TENTUKAN product_id yang BENAR untuk video yang ditag banyak SKU
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan:
-- curl -s https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/23-tentukan-product-benar.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. APAKAH campaign punya kolom tiktok_campaign_id? ==='
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'campaigns' ORDER BY ordinal_position;

\echo ''
\echo '=== 2. ACUAN: video ">20 SKU" yang punya ORDER NYATA di tabel sales ==='
-- sales.order_id itu UNIQUE, jadi ini order asli, bukan duplikat.
-- Kalau ada order, product_id di sales = product yang BENAR untuk video itu.
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT
  count(DISTINCT ov.content_uid)                                    AS video_crossjoin,
  count(DISTINCT ov.content_uid) FILTER (WHERE s.content_uid IS NOT NULL) AS punya_order,
  count(DISTINCT ov.content_uid) FILTER (WHERE s.content_uid IS NULL)     AS tanpa_order
FROM organic_videos ov
JOIN g ON g.content_uid = ov.content_uid
LEFT JOIN sales s ON s.content_uid = ov.content_uid;

\echo ''
\echo '=== 3. VIDEO TANPA ORDER: berapa product_id di sales? ==='
-- Kalau sales tidak punya product_id, tidak bisa dipakai sebagai acuan.
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT
  count(DISTINCT s.content_uid)                                        AS video_punya_order,
  count(DISTINCT s.content_uid) FILTER (WHERE s.product_id IS NOT NULL) AS order_punya_product,
  count(DISTINCT s.content_uid) FILTER (WHERE s.product_id IS NULL)     AS order_product_null
FROM sales s JOIN g ON g.content_uid = s.content_uid;

\echo ''
\echo '=== 4. CROSS-CHECK: product_id dari organic_videos vs dari sales ==='
-- Kalau organic_videos punya 70 product tapi sales cuma 1, maka 69-nya palsu.
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
),
ovp AS (
  SELECT ov.content_uid, count(DISTINCT ov.product_id) AS jml_ov
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid GROUP BY 1
),
slp AS (
  SELECT s.content_uid, count(DISTINCT s.product_id) AS jml_sales
  FROM sales s JOIN g ON g.content_uid = s.content_uid GROUP BY 1
)
SELECT
  ovp.jml_ov                                                          AS jml_product_di_organic,
  COALESCE(slp.jml_sales, 0)                                          AS jml_product_di_sales,
  count(*)                                                            AS jumlah_video
FROM ovp LEFT JOIN slp ON slp.content_uid = ovp.content_uid
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;

\echo ''
\echo '=== 5. APAKAH PRODUCT_ID PALSU ITU SAMA DENGAN SKU YANG DITUGASKAN? ==='
-- cross-join itu berarti 1 video jadi milik 7 campaign. Tapikreator
-- hanya punya 1-2 campaign. Berarti campaign yang bukan miliknya = palsu.
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT
  count(DISTINCT ov.content_uid) AS video,
  count(DISTINCT ov.content_uid) FILTER (WHERE cc.id IS NOT NULL)     AS vid_product_sesuai_tugas,
  count(DISTINCT ov.content_uid) FILTER (WHERE cc.id IS NULL)          AS vid_product_bukan_tugasnya
FROM organic_videos ov
JOIN g ON g.content_uid = ov.content_uid
LEFT JOIN skus s ON s.product_id = ov.product_id
LEFT JOIN campaign_creators cc
  ON cc.campaign_id = ov.campaign_id
 AND cc.creator_id = (SELECT c.id FROM creators c WHERE LOWER(c.username) = LOWER(ov.creator_username) LIMIT 1)
 AND s.id = ANY(cc.assigned_sku_ids);

\echo ''
\echo '=== 6. TIAP VIDEO: berapa product yang "cocok" sama tugas kreator? ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
), per AS (
  SELECT ov.content_uid, ov.creator_username,
         count(DISTINCT ov.product_id) AS total_product,
         count(DISTINCT ov.product_id) FILTER (WHERE cc.id IS NOT NULL) AS product_cocok
  FROM organic_videos ov
  JOIN g ON g.content_uid = ov.content_uid
  LEFT JOIN skus s ON s.product_id = ov.product_id
  LEFT JOIN campaign_creators cc
    ON cc.campaign_id = ov.campaign_id
   AND cc.creator_id = (SELECT c.id FROM creators c WHERE LOWER(c.username) = LOWER(ov.creator_username) LIMIT 1)
   AND s.id = ANY(cc.assigned_sku_ids)
  GROUP BY 1,2
)
SELECT total_product, product_cocok, count(*) AS jumlah_video
FROM per GROUP BY 1,2 ORDER BY 1 DESC LIMIT 25;

\echo ''
\echo '=== 7. tiktok_campaign_id: satu video punya berapa nilai berbeda? ==='
-- Kolom ini dari ekspor TikTok, jadi kalauvideo punya 7 campaign berbeda
-- tapi 1 tiktok_campaign_id, berarti product_id-nya yang salah tag.
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT count(DISTINCT n_tiktok) AS jumlah_nilai_tiktok_per_video, count(*) AS jumlah_video
FROM (
  SELECT ov.content_uid, count(DISTINCT ov.tiktok_campaign_id) AS n_tiktok
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
  GROUP BY 1
) x
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== 8. LIKES > VIEWS (3.529 video) - apakah kolomnya TERBALIK? ==='
-- secara fisik tidak mungkin. Cek apakah views/likes tertukar di baris itu.
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE video_likes > video_views) AS likes_lebih_besar,
  count(*) FILTER (WHERE video_views > 0 AND video_likes = 0) AS likes_nol,
  count(*) FILTER (WHERE video_views = 0 AND video_likes > 0) AS views_nol_likes_ada
FROM (SELECT DISTINCT ON (content_uid) content_uid, video_views, video_likes
      FROM organic_videos ORDER BY content_uid, video_views DESC) u;

\echo ''
\echo '=== 9. 10 CONTOH video yang likes > views, plus raw_data ==='
SELECT content_uid, creator_username, video_views, video_likes, campaign_id, post_time
FROM (SELECT DISTINCT ON (content_uid) content_uid, creator_username, video_views, video_likes, campaign_id, post_time
      FROM organic_videos ORDER BY content_uid, video_views DESC) u
WHERE video_likes > video_views
ORDER BY video_likes DESC LIMIT 10;

\echo ''
\echo '=== 10. DUKUNGAN: berapa video lain dari kreator yang sama yang masuk akal? ==='
-- Kalau kreator ini punya 100 video lain dengan likes < views normal,
-- maka 1 video anomaly-nya adalah salah input, bukan format data.
SELECT ov.creator_username,
       count(DISTINCT ov.content_uid) AS video,
       count(DISTINCT ov.content_uid) FILTER (WHERE v.video_likes <= v.video_views) AS video_normal,
       count(DISTINCT ov.content_uid) FILTER (WHERE v.video_likes >  v.video_views) AS video_anomali
FROM organic_videos ov
JOIN (SELECT DISTINCT ON (content_uid) content_uid, video_likes, video_views
      FROM organic_videos ORDER BY content_uid, video_views DESC) v ON v.content_uid = ov.content_uid
GROUP BY 1 HAVING count(DISTINCT ov.content_uid) FILTER (WHERE v.video_likes > v.video_views) > 0
ORDER BY 4 DESC LIMIT 15;

\echo ''
\echo '=== 11. USERNAME MIRIP: peng_ganti karakter (emak_kekinian vs emak__kekinian) ==='
-- 582 duplikat yg ketemu earlier cuma beda KAPITAL. Yang ini beda TANDA.
SELECT a.username AS username_a, b.username AS username_b,
       (SELECT count(*) FROM campaign_creators x JOIN campaign_creators y ON y.campaign_id = x.campaign_id
         WHERE x.creator_id = a.id AND y.creator_id = b.id) AS campaign_yang_sama,
       (SELECT count(*) FROM videos x JOIN videos y ON y.content_uid = x.content_uid
         WHERE x.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = a.id)
           AND y.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = b.id)) AS video_yang_sama
FROM creators a JOIN creators b ON a.id < b.id
WHERE regexp_replace(a.username,'[^a-z0-9]','','g') = regexp_replace(b.username,'[^a-z0-9]','','g')
  AND a.username <> b.username
ORDER BY video_yang_sama DESC, campaign_yang_sama DESC LIMIT 25;

\echo ''
\echo '=== 12. Berapa TOTAL pasangan username mirip (tanda baca dihapus)? ==='
SELECT count(*) AS pasangan_mirip
FROM creators a JOIN creators b ON a.id < b.id
WHERE regexp_replace(a.username,'[^a-z0-9]','','g') = regexp_replace(b.username,'[^a-z0-9]','','g')
  AND a.username <> b.username;
