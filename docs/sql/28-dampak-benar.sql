-- =====================================================================
-- 28 - DAMPAK YANG BENAR (perbaikan label dari query 27)
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan (pakai commit SHA, JANGAN pakai "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/28-dampak-benar.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
--
-- KESALAHAN DI QUERY 27
--   Kolom video_sesudah dan views_sesudah di sana dihitung dari _lanjut, yang
--   hanya berisi baris milik 329 video cross-join. Semua campaign yang tidak
--   punya video cross-join muncul sebagai 0, padahal tidak kehilangan apa pun.
--   Query ini menghitung sisa SEBENARNYA: video_sesudah = video_sebelum
--   dikurangi video yang barisnya benar-benar dihapus.
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. SIAPAKAH YANG BENAR-BENAR TERDAMPAK? ==='
CREATE TEMP TABLE _g AS
SELECT content_uid FROM organic_videos
GROUP BY content_uid HAVING count(DISTINCT product_id) > 20;

CREATE TEMP TABLE _vc AS
SELECT content_uid, min(campaign_id) AS kc
FROM (
  SELECT DISTINCT ov.content_uid, c.id AS campaign_id
  FROM organic_videos ov
  JOIN _g g ON g.content_uid = ov.content_uid
  JOIN campaigns c ON ov.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE ov.tiktok_campaign_id IS NOT NULL AND ov.tiktok_campaign_id <> ''
) x
GROUP BY content_uid
HAVING count(DISTINCT campaign_id) = 1;

CREATE TEMP TABLE _hapus AS
SELECT ov.id
FROM organic_videos ov
JOIN _vc vc ON vc.content_uid = ov.content_uid
WHERE ov.campaign_id IS DISTINCT FROM vc.kc
  AND NOT EXISTS (
    SELECT 1 FROM sales sl
    WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id
  );

\echo ''
\echo '=== 2. HANYA campaign yang benar-benar berubah ==='
-- kolom video_kurang = video_sebelum - video_sesudah
-- Kalau video_kurang kecil dibanding video_sebelum, dampaknya ringan.
SELECT c.id, c.nama,
       count(DISTINCT ov.content_uid) AS video_sebelum,
       count(DISTINCT CASE WHEN h.id IS NULL THEN ov.content_uid END) AS video_sesudah,
       count(DISTINCT ov.content_uid) - count(DISTINCT CASE WHEN h.id IS NULL THEN ov.content_uid END) AS video_kurang,
       round(100.0 * (count(DISTINCT ov.content_uid) - count(DISTINCT CASE WHEN h.id IS NULL THEN ov.content_uid END))
             / NULLIF(count(DISTINCT ov.content_uid),0), 2) AS persen_kurang,
       COALESCE(sum(ov.video_views),0) AS views_sebelum,
       COALESCE(sum(CASE WHEN h.id IS NULL THEN ov.video_views END),0) AS views_sesudah,
       (SELECT COALESCE(sum(sl.gmv),0) FROM sales sl
         WHERE sl.campaign_id = c.id AND NOT sl.is_refund) AS gmv_dari_sales
FROM campaigns c
LEFT JOIN organic_videos ov ON ov.campaign_id = c.id
LEFT JOIN _hapus h ON h.id = ov.id
GROUP BY c.id, c.nama
HAVING count(DISTINCT ov.content_uid)
       <> count(DISTINCT CASE WHEN h.id IS NULL THEN ov.content_uid END)
ORDER BY video_kurang DESC;

\echo ''
\echo '=== 3. TOTAL KESELURUHAN (tidak ada campaign lain yang tersentuh) ==='
SELECT
  (SELECT count(DISTINCT content_uid) FROM organic_videos) AS video_sebelum,
  (SELECT count(DISTINCT ov.content_uid) FROM organic_videos ov
    WHERE NOT EXISTS (SELECT 1 FROM _hapus h WHERE h.id = ov.id)) AS video_sesudah,
  (SELECT COALESCE(sum(video_views),0) FROM organic_videos) AS views_sebelum,
  (SELECT COALESCE(sum(ov.video_views),0) FROM organic_videos ov
    WHERE NOT EXISTS (SELECT 1 FROM _hapus h WHERE h.id = ov.id)) AS views_per_video_sesudah,
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(video_views) mx FROM organic_videos GROUP BY content_uid) t) AS views_per_video_sebelum;

\echo ''
\echo '=== 4. CEK GMV TIDAK IKUT ANJLOK DI MANA SAJA ==='
-- Views boleh turun, karena tag palsu memang bukan views milik campaign itu.
-- Tapi GMV dari sales tidak boleh tersentuh sama sekali, karena tidak ada
-- satu pun baris sales yang dihapus migration ini.
SELECT count(*) AS baris_sales_yang_akan_terhapus FROM sales sl
WHERE EXISTS (SELECT 1 FROM _hapus h JOIN organic_videos ov ON ov.id = h.id
               WHERE ov.content_uid = sl.content_uid);

SELECT COALESCE(sum(gmv),0) AS total_gmv_sales_sekarang
FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL;
