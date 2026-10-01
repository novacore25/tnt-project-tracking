-- =====================================================================
-- 26 - ROLLBACK tag palsu cross-join
-- Tanggal : 2026-10-01
--
-- Jalankan HANYA kalau migration 20261001150000_cleanup_cross_join_product_tags
-- sudah jalan dan hasilnya tidak sesuai harapan.
--
-- Mengembalikan SEMUA baris organic_videos untuk 362 video cross-join ke
-- kondisi sebelum migration. Baris yang tidak pernah dihapus tetap ada,
-- jadi INSERT ... ON CONFLICT aman dipakai.
--
-- HATI-HATI: kalau sejak migration tersebut ada sync atau import yang
-- menambahkan baris baru untuk video yang sama, baris baru itu tidak
-- tersentuh oleh rollback ini.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_organic_videos_20261001_check AS
SELECT ov.id, ov.content_uid, ov.product_id, ov.video_views
FROM organic_videos ov
WHERE ov.content_uid IN (SELECT DISTINCT content_uid FROM _backup_organic_videos_20261001)
  AND NOT EXISTS (
    SELECT 1 FROM _backup_organic_videos_20261001 b
    WHERE b.id = ov.id
  );

\echo '--- baris yang muncul SETELAH migration (akan dihapus) ---'
SELECT count(*) AS baris_baru FROM _backup_organic_videos_20261001_check;

-- Hapus baris yang lahir sesudah migration, supaya tidak jadi dobel
DELETE FROM organic_videos ov
USING _backup_organic_videos_20261001_check c
WHERE ov.id = c.id;

-- Kembalikan baris yang dihapus
INSERT INTO organic_videos (
  id, content_uid, creator_username, post_time, video_views, video_likes,
  duration_str, video_product_rpm, created_at, raw_data, campaign_id,
  product_id, tiktok_campaign_id, content_type
)
SELECT
  b.id, b.content_uid, b.creator_username, b.post_time, b.video_views, b.video_likes,
  b.duration_str, b.video_product_rpm, b.created_at, b.raw_data, b.campaign_id,
  b.product_id, b.tiktok_campaign_id, b.content_type
FROM _backup_organic_videos_20261001 b
ON CONFLICT (id) DO NOTHING;

\echo '--- setelah rollback ---'
SELECT
  (SELECT count(*) FROM organic_videos) AS total_baris,
  (SELECT count(DISTINCT content_uid) FROM organic_videos) AS video_unik,
  (SELECT count(*) FROM _backup_organic_videos_20261001) AS baris_backup;

SELECT count(*) AS video_yang_masih_lebih_20_product
FROM (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
) x;

COMMIT;

-- Ingat: jika sudah selesai, backup boleh dihapus manual.
-- DROP TABLE _backup_organic_videos_20261001;
-- DROP TABLE _backup_organic_videos_20261001_check;
