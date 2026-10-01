-- =====================================================================
-- 24 - RESOLUSI product_id video cross-join, pakai tiktok_campaign_id
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan:
-- curl -s https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/24-resolusi-product.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. KOLOM organic_videos yang dipakai (cek dulu) ==='
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'organic_videos' ORDER BY ordinal_position;

\echo ''
\echo '=== 2. tiktok_campaign_id: 1 video punya berapa nilai? ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
)
SELECT n_tiktok AS jumlah_nilai_tiktok_per_video, count(*) AS jumlah_video
FROM (
  SELECT ov.content_uid, count(DISTINCT ov.tiktok_campaign_id) AS n_tiktok
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
  GROUP BY ov.content_uid
) x
GROUP BY n_tiktok ORDER BY n_tiktok;

\echo ''
\echo '=== 3. PETA tiktok_campaign_id -> campaign (lewat array campaigns) ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
), t AS (
  SELECT ov.content_uid, ov.tiktok_campaign_id, count(*) AS baris
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
  WHERE ov.tiktok_campaign_id IS NOT NULL AND ov.tiktok_campaign_id <> ''
  GROUP BY 1,2
)
SELECT t.tiktok_campaign_id, count(DISTINCT t.content_uid) AS jumlah_video,
       count(DISTINCT c.id) AS jumlah_campaign_yang_cocok,
       string_agg(DISTINCT c.nama, ' | ') AS nama_campaign
FROM t
LEFT JOIN campaigns c ON t.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
GROUP BY 1 ORDER BY 2 DESC LIMIT 25;

\echo ''
\echo '=== 4. KEBUTUHAN: berapa video yang tiktok_campaign_id-nya COCOK 1 campaign? ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
), t AS (
  SELECT ov.content_uid, ov.tiktok_campaign_id
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
  WHERE ov.tiktok_campaign_id IS NOT NULL AND ov.tiktok_campaign_id <> ''
  GROUP BY 1,2
), r AS (
  SELECT t.content_uid, count(DISTINCT c.id) AS n_campaign
  FROM t LEFT JOIN campaigns c ON t.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  GROUP BY 1
)
SELECT n_campaign AS campaign_cocok, count(*) AS jumlah_video
FROM r GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== 5. RESOLUSI: untuk tiap video cross-join, product mana yang benar? ==='
-- Aturan berurutan, dari yang paling kuat ke yang paling lemah:
--   A. ada di sales           -> PALING KUAT (order nyata)
--   B. campaign-nya sama dengan campaign hasil tiktok_campaign_id
--   C. tidak bisa ditentukan
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
), ovc AS (
  SELECT ov.content_uid, ov.product_id, ov.campaign_id, ov.tiktok_campaign_id
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
), truth AS (
  SELECT ovc.content_uid,
         ovc.product_id,
         ovc.campaign_id,
         (SELECT c.id FROM campaigns c
           WHERE ovc.tiktok_campaign_id <> '' AND ovc.tiktok_campaign_id IS NOT NULL
             AND ovc.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
           LIMIT 1) AS campaign_dari_tiktok,
         EXISTS (SELECT 1 FROM sales s
                  WHERE s.content_uid = ovc.content_uid
                    AND s.product_id = ovc.product_id) AS ada_di_sales
  FROM ovc
), per AS (
  SELECT content_uid,
         count(*) AS total_product,
         count(*) FILTER (WHERE ada_di_sales) AS via_sales,
         count(*) FILTER (WHERE campaign_dari_tiktok IS NOT NULL
                            AND campaign_dari_tiktok = campaign_id) AS via_tiktok,
         count(*) FILTER (WHERE campaign_dari_tiktok IS NOT NULL) AS punya_tiktok_campaign
  FROM truth GROUP BY content_uid
)
SELECT total_product, via_sales, via_tiktok, punya_tiktok_campaign, count(*) AS jumlah_video
FROM per
GROUP BY total_product, via_sales, via_tiktok, punya_tiktok_campaign
ORDER BY jumlah_video DESC LIMIT 40;

\echo ''
\echo '=== 6. RINGKASAN RESOLUSI (yang ini yang dipakai buat keputusan) ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
), ovc AS (
  SELECT ov.content_uid, ov.product_id, ov.campaign_id, ov.tiktok_campaign_id
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
), truth AS (
  SELECT ovc.content_uid, ovc.product_id, ovc.campaign_id,
         (SELECT c.id FROM campaigns c
           WHERE ovc.tiktok_campaign_id <> '' AND ovc.tiktok_campaign_id IS NOT NULL
             AND ovc.tiktok_campaign_id = ANY(c.tiktok_campaign_ids) LIMIT 1) AS ct,
         EXISTS (SELECT 1 FROM sales s WHERE s.content_uid = ovc.content_uid
                    AND s.product_id = ovc.product_id) AS sl
  FROM ovc
), per AS (
  SELECT content_uid,
         count(*) FILTER (WHERE sl) AS via_sales,
         count(*) FILTER (WHERE ct IS NOT NULL AND ct = campaign_id) AS via_tiktok
  FROM truth GROUP BY content_uid
)
SELECT
  count(*)                                                              AS total_video,
  count(*) FILTER (WHERE via_sales = 1)                                 AS aman_satu_product_dari_sales,
  count(*) FILTER (WHERE via_sales = 0 AND via_tiktok = 1)              AS aman_satu_product_dari_tiktok,
  count(*) FILTER (WHERE via_sales = 1 AND via_tiktok = 1)              AS dua_arang_sama,
  count(*) FILTER (WHERE via_sales = 0 AND via_tiktok = 0)              AS tidak_bisa_ditentukan,
  count(*) FILTER (WHERE via_sales > 1)                                 AS ambigu_sales
FROM per;

\echo ''
\echo '=== 7. TOTAL BARIS yang akan terhapus per kategori ==='
WITH g AS (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
), ovc AS (
  SELECT ov.content_uid, ov.product_id, ov.campaign_id, ov.tiktok_campaign_id
  FROM organic_videos ov JOIN g ON g.content_uid = ov.content_uid
), truth AS (
  SELECT ovc.*,
         (SELECT c.id FROM campaigns c
           WHERE ovc.tiktok_campaign_id <> '' AND ovc.tiktok_campaign_id IS NOT NULL
             AND ovc.tiktok_campaign_id = ANY(c.tiktok_campaign_ids) LIMIT 1) AS ct,
         EXISTS (SELECT 1 FROM sales s WHERE s.content_uid = ovc.content_uid
                    AND s.product_id = ovc.product_id) AS sl
  FROM ovc
), per AS (
  SELECT content_uid,
         count(*) FILTER (WHERE sl) AS via_sales,
         count(*) FILTER (WHERE ct IS NOT NULL AND ct = campaign_id) AS via_tiktok
  FROM truth GROUP BY content_uid
), keep AS (
  SELECT t.content_uid, t.product_id
  FROM truth t JOIN per p ON p.content_uid = t.content_uid
  WHERE (p.via_sales = 1 AND t.sl)
     OR (p.via_sales = 0 AND p.via_tiktok = 1 AND t.ct = t.campaign_id)
)
SELECT
  (SELECT count(*) FROM ovc)                                          AS baris_sekarang,
  (SELECT count(DISTINCT content_uid) FROM keep)                     AS video_yang_bisa_diselamatkan,
  (SELECT count(*) FROM ovc) - (SELECT count(*) FROM keep)            AS baris_akan_terhapus;

\echo ''
\echo '=== 8. LIKES > VIEWS: ringkasan ==='
SELECT count(*) AS total,
       count(*) FILTER (WHERE video_likes > video_views) AS likes_lebih_besar,
       count(*) FILTER (WHERE video_views = 0 AND video_likes > 0) AS views_nol_likes_ada,
       count(*) FILTER (WHERE video_views > 0 AND video_likes = 0) AS likes_nol
FROM (SELECT DISTINCT ON (content_uid) content_uid, video_views, video_likes
      FROM organic_videos ORDER BY content_uid, video_views DESC) u;

\echo ''
\echo '=== 9. 10 CONTOH video dengan likes > views ==='
SELECT content_uid, creator_username, video_views, video_likes, campaign_id,
       duration_str, video_product_rpm, post_time
FROM (SELECT DISTINCT ON (content_uid) content_uid, creator_username, video_views,
             video_likes, campaign_id, duration_str, video_product_rpm, post_time
      FROM organic_videos ORDER BY content_uid, video_views DESC) u
WHERE video_likes > video_views
ORDER BY video_likes DESC LIMIT 10;

\echo ''
\echo '=== 10. USERNAME MIRIP (tanda baca dihapus) - sudah termasuk 582? ==='
SELECT count(*) AS pasangan_mirip_tanda_baca
FROM creators a JOIN creators b ON a.id < b.id
WHERE regexp_replace(a.username,'[^a-z0-9]','','g') = regexp_replace(b.username,'[^a-z0-9]','','g')
  AND a.username <> b.username;

\echo ''
\echo '=== 11. 25 pasangan username mirip yang paling kuat ==='
SELECT a.username AS username_a, b.username AS username_b,
       (SELECT count(*) FROM campaign_creators x JOIN campaign_creators y
          ON y.campaign_id = x.campaign_id
         WHERE x.creator_id = a.id AND y.creator_id = b.id) AS campaign_sama,
       (SELECT count(*) FROM videos x JOIN videos y ON y.content_uid = x.content_uid
         WHERE x.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = a.id)
           AND y.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = b.id)) AS video_sama
FROM creators a JOIN creators b ON a.id < b.id
WHERE regexp_replace(a.username,'[^a-z0-9]','','g') = regexp_replace(b.username,'[^a-z0-9]','','g')
  AND a.username <> b.username
ORDER BY video_sama DESC, campaign_sama DESC LIMIT 25;

\echo ''
\echo '=== 12. VIDEO_SAMA = 0 berarti SEPATIH, jangan digabung ==='
SELECT count(*) AS pasangan_tanpa_bukti
FROM creators a JOIN creators b ON a.id < b.id
WHERE regexp_replace(a.username,'[^a-z0-9]','','g') = regexp_replace(b.username,'[^a-z0-9]','','g')
  AND a.username <> b.username
  AND (SELECT count(*) FROM videos x JOIN videos y ON y.content_uid = x.content_uid
        WHERE x.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = a.id)
          AND y.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = b.id)) = 0;
