-- =====================================================================
-- 25 - CEK TAG PALSU (dry run cepat, tanpa subquery korelasi berat)
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan:
-- curl -s https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/25-cek-tag-palsu.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on
\pset format unaligned
\pset fieldsep ' | '

\echo ''
\echo '=== 1. VIDEO YANG BISA DICHAYA (tiktok_campaign_id -> 1 campaign) ==='
CREATE TEMP TABLE _g AS
SELECT content_uid FROM organic_videos
GROUP BY content_uid HAVING count(DISTINCT product_id) > 20;

CREATE TEMP TABLE _vid_campaign AS
SELECT content_uid, min(campaign_id) AS keep_campaign_id
FROM (
  SELECT DISTINCT ov.content_uid, c.id AS campaign_id
  FROM organic_videos ov
  JOIN campaigns c ON ov.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE ov.tiktok_campaign_id IS NOT NULL AND ov.tiktok_campaign_id <> ''
) x
GROUP BY content_uid
HAVING count(DISTINCT campaign_id) = 1;

SELECT
  (SELECT count(*) FROM _g)                       AS video_crossjoin,
  (SELECT count(*) FROM _vid_campaign)            AS resolve_1_campaign,
  (SELECT count(*) FROM _g) - (SELECT count(*) FROM _vid_campaign) AS tidak_resolve;

\echo ''
\echo '=== 2. VIDEO YANG AMAN: ada baris di campaign hasil resolusi? ==='
CREATE TEMP TABLE _safe AS
SELECT v.content_uid, v.keep_campaign_id
FROM _vid_campaign v
WHERE EXISTS (
  SELECT 1 FROM organic_videos ov
  WHERE ov.content_uid = v.content_uid AND ov.campaign_id = v.keep_campaign_id
);

SELECT
  (SELECT count(*) FROM _safe) AS video_aman,
  (SELECT count(*) FROM _vid_campaign) - (SELECT count(*) FROM _safe) AS video_tanpa_baris_di_campaign_hasil;

\echo ''
\echo '=== 3. BARIS YANG AKAN DIHAPUS ==='
CREATE TEMP TABLE _hapus AS
SELECT ov.id
FROM organic_videos ov
JOIN _safe s ON s.content_uid = ov.content_uid
WHERE ov.campaign_id IS DISTINCT FROM s.keep_campaign_id
  AND NOT EXISTS (
    SELECT 1 FROM sales sl
    WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id
  );

SELECT
  (SELECT count(*) FROM organic_videos ov JOIN _g g ON g.content_uid = ov.content_uid) AS baris_skSekarang,
  (SELECT count(*) FROM organic_videos ov JOIN _safe s ON s.content_uid = ov.content_uid
     WHERE ov.campaign_id IS NOT DISTINCT FROM s.keep_campaign_id
        OR EXISTS (SELECT 1 FROM sales sl WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id)) AS baris_akan_disisa,
  (SELECT count(*) FROM _hapus) AS baris_akan_dihapus,
  (SELECT count(DISTINCT content_uid) FROM _safe) AS video_tetap_ada;

\echo ''
\echo '=== 4. VIDEO YANG TIDAK DISENTUH (aman, tapi tidak punya bukti) ==='
SELECT g.content_uid, count(DISTINCT ov.product_id) AS jml_product, ov.creator_username
FROM _g g JOIN organic_videos ov ON ov.content_uid = g.content_uid
WHERE g.content_uid NOT IN (SELECT content_uid FROM _safe)
GROUP BY 1,3 ORDER BY 2 DESC LIMIT 20;

\echo ''
\echo '=== 5. CONTOH KASUS BERSIH: 3 video yang akan dirapikan ==='
-- Cek manual: video_ts, campaign_ts, product_ts, campaign_sebenarnya,
-- dan berapa product_asal. Kalau product_asal >> jumlah yang tersisa = bagus.
SELECT ov.content_uid,
       ov.campaign_id              AS campaign_di_baris,
       c.nama                      AS nama_campaign,
       ov.product_id,
       ov.video_views,
       ov.video_likes,
       CASE WHEN ov.campaign_id IS NOT DISTINCT FROM s.keep_campaign_id THEN 'DITAHAN' ELSE 'dihapus' END AS aksi,
       CASE WHEN EXISTS (SELECT 1 FROM sales sl WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id)
            THEN 'ada order' ELSE '' END AS bukti_order
FROM organic_videos ov
JOIN _safe s ON s.content_uid = ov.content_uid
LEFT JOIN campaigns c ON c.id = ov.campaign_id
WHERE ov.content_uid IN (SELECT content_uid FROM _safe ORDER BY content_uid LIMIT 3)
ORDER BY ov.content_uid, aksi DESC, campaign_di_baris
LIMIT 80;

\echo ''
\echo '=== 6. SETELAH BERSIH: sisa product per video cross-join ==='
SELECT jml_product, count(*) AS jumlah_video
FROM (
  SELECT ov.content_uid, count(DISTINCT ov.product_id) AS jml_product
  FROM organic_videos ov
  JOIN _safe s ON s.content_uid = ov.content_uid
  WHERE ov.campaign_id IS NOT DISTINCT FROM s.keep_campaign_id
     OR EXISTS (SELECT 1 FROM sales sl WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id)
  GROUP BY ov.content_uid
) x
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== 7. TOTAL SELURUH TABEL (tidak berubah, hanya reassurance) ==='
SELECT
  (SELECT count(*) FROM organic_videos) AS total_baris,
  (SELECT count(DISTINCT content_uid) FROM organic_videos) AS video_unik,
  (SELECT COALESCE(sum(video_views),0) FROM organic_videos) AS views_per_baris,
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(video_views) mx FROM organic_videos GROUP BY content_uid) t) AS views_per_video;
