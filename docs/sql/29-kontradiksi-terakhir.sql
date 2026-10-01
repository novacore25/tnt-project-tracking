-- =====================================================================
-- 29 - KONTRADIKSI TERAKHIR sebelum migration
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- Jalankan (pakai commit SHA, JANGAN "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/29-kontradiksi-terakhir.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
--
-- TUJUAN
--   1. Video yang dikeluarkan dari campaign X tapi punya order di campaign X
--      = kontradiksi. Kalau ada, video itu tidak boleh dikeluarkan.
--   2. Baris sales yang memakai product_id dari tag palsu = GMV salah campaign.
--      Ini kemungkinan penyebab angka GMV per campaign tidak cocok.
--   3. Pastikan views per video unik tidak berubah sama sekali.
-- =====================================================================
\pset pager off
\t on

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
\echo '=== 1. KONTRADIKSI: video dikeluarkan dari campaign tapi punya order di situ ==='
-- NOL berarti aman. Tidak nol berarti ada video yang salah dikeluarkan.
CREATE TEMP TABLE _hilang AS
SELECT ov.campaign_id, ov.content_uid, ov.creator_username
FROM organic_videos ov
JOIN _hapus h ON h.id = ov.id
WHERE NOT EXISTS (
  SELECT 1 FROM organic_videos o2
  WHERE o2.content_uid = ov.content_uid AND o2.campaign_id = ov.campaign_id
    AND NOT EXISTS (SELECT 1 FROM _hapus h2 WHERE h2.id = o2.id)
);

SELECT hl.campaign_id, c.nama, count(*) AS video_dikeluarkan,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM sales sl
         WHERE sl.content_uid = hl.content_uid AND sl.campaign_id = hl.campaign_id
       )) AS DARI_YANG_PUNYA_ORDER
FROM _hilang hl
JOIN campaigns c ON c.id = hl.campaign_id
GROUP BY 1,2 ORDER BY 5 DESC, 3 DESC;

\echo ''
\echo '=== 2. TOTAL KONTRADIKSI (harus 0) ==='
SELECT count(*) AS total_kontradiksi
FROM _hilang hl
WHERE EXISTS (SELECT 1 FROM sales sl
              WHERE sl.content_uid = hl.content_uid AND sl.campaign_id = hl.campaign_id);

\echo ''
\echo '=== 3. GMV: baris sales yang product_id-nya ikut tag palsu ==='
-- INI YANG PENTING. Kalau ada, GMV per campaign juga salah dan perlu
-- dibersihkan terpisah setelah tag video dibereskan.
SELECT count(*) AS baris_sales_terpengaruh,
       COALESCE(sum(sl.gmv),0) AS gmv_berpengaruh,
       count(DISTINCT sl.content_uid) AS video_terlibat
FROM sales sl
WHERE NOT sl.is_refund
  AND EXISTS (
    SELECT 1 FROM _hapus h
    JOIN organic_videos ov ON ov.id = h.id
    WHERE ov.content_uid = sl.content_uid AND ov.product_id = sl.product_id
  );

\echo ''
\echo '=== 4. RINCIAN GMV per campaign yang terpengaruh ==='
SELECT sl.campaign_id, c.nama, count(*) AS baris_sales, COALESCE(sum(sl.gmv),0) AS gmv
FROM sales sl
JOIN campaigns c ON c.id = sl.campaign_id
WHERE NOT sl.is_refund
  AND EXISTS (
    SELECT 1 FROM _hapus h
    JOIN organic_videos ov ON ov.id = h.id
    WHERE ov.content_uid = sl.content_uid AND ov.product_id = sl.product_id
  )
GROUP BY 1,2 ORDER BY 4 DESC LIMIT 20;

\echo ''
\echo '=== 5. VIEWS PER VIDEO UNIK (harus tetap 37.590.000) ==='
SELECT
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(ov.video_views) mx FROM organic_videos ov
     WHERE NOT EXISTS (SELECT 1 FROM _hapus h WHERE h.id = ov.id)
     GROUP BY ov.content_uid) t) AS views_per_video_sesudah,
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(video_views) mx FROM organic_videos
     GROUP BY content_uid) u) AS views_per_video_sebelum,
  (SELECT count(DISTINCT ov.content_uid) FROM organic_videos ov
     WHERE NOT EXISTS (SELECT 1 FROM _hapus h WHERE h.id = ov.id)) AS jumlah_video_sesudah;

\echo ''
\echo '=== 6. SIAPA KREATOR YANG TERDAMPAK per campaign ==='
SELECT hl.campaign_id, c.nama, hl.creator_username, count(*) AS video
FROM _hilang hl JOIN campaigns c ON c.id = hl.campaign_id
GROUP BY 1,2,3 ORDER BY 1, 4 DESC LIMIT 30;
