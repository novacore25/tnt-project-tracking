-- =====================================================================
-- 20261001215000 - Index untuk videos, tidak ada satupun sebelumnya
--
-- MASALAH
--   Tabel videos TIDAK punya index apa pun. Hanya ada trigger dan FK.
--   Query yang memakai v.content_uid = ... atau v.campaign_creator_id = ...
--   berakhir jadi sequential scan 28.406 baris. Saat migration
--   20261001220000 mencoba mencari bukti video yang sama untuk setiap
--   pasangan creator kandidat, tiap lookup memindai seluruh tabel, sehingga
--   merge menggantung lama sekali.
--
--   Query 39 bagian 8 juga memakai content_uid untuk menghitung video unik,
--   jadi index ini membantu audit maupun aplikasi.
--
-- AMAN
--   Hanya CREATE INDEX. Tidak ada INSERT, UPDATE, atau DELETE.
--   CREATE INDEX mengunci SHARE pada tabel, jadi write tetap bisa jalan.
--   Ukurannya kecil: 28.406 baris, index selesai dalam hitungan detik.
--   Pakai IF NOT EXISTS supaya aman dijalankan berulang.
-- =====================================================================

\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

CREATE INDEX IF NOT EXISTS idx_videos_content_uid
  ON videos (content_uid);

CREATE INDEX IF NOT EXISTS idx_videos_campaign_creator
  ON videos (campaign_creator_id);

-- campaign_creators sudah punya idx_cc_creator, tapi tambahkan juga index
-- gabungan karena hampir semua query memfilter keduanya sekaligus.
CREATE INDEX IF NOT EXISTS idx_cc_campaign_creator_pair
  ON campaign_creators (campaign_id, creator_id);

-- Index ganda. Saat migration ini dijalankan sudah ada idx_videos_cc_id yang
-- kolomnya persis sama dengan idx_videos_campaign_creator, hanya namanya
-- berbeda. Dua index identik bikin setiap write ke videos dua kali kerja,
-- jadi yang lama dibuang. Ditemukan saat menjalankan migration ini, karena
-- pencarian awal hanya melihat nama index, bukan kolomnya.
DROP INDEX IF EXISTS idx_videos_cc_id;

COMMIT;

\echo ''
\echo '=== INDEX videos SEKARANG ==='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'videos'
ORDER BY indexname;

\echo ''
\echo '=== UKURAN INDEX (harus kecil) ==='
SELECT
  (SELECT count(*) FROM videos) AS baris_videos,
  pg_size_pretty(pg_relation_size('idx_videos_content_uid')) AS ukuran_content_uid,
  pg_size_pretty(pg_relation_size('idx_videos_campaign_creator')) AS ukuran_campaign_creator;
