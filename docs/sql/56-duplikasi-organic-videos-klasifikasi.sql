-- =====================================================================
-- APAKAH DUPLIKASI organic_videos ITU (a) MULTI-PRODUK LEGIT, atau
-- (b) BARIS NULL YANG LOLOS UNIQUE CONSTRAINT?
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- KEPUTUSAN OWNER (2 Okt 2026):
--   "1 video tiktok emang bisa lebih dari 1 product id, jadi yang penting
--    kalo perhitungan video cukup hitung video id / content id aja"
--   -> User BENAR. Duplikasi (content_uid, product_id) itu struktur yang benar.
--   -> Perhitungan video sudah pakai content_uid. Tidak ada yang perlu diubah.
--
-- Yang BELUM jelas: kenapa satu content_uid bisa sampai 28 baris.
-- Hipotesis: product_id NULL. Di PostgreSQL, NULL di unique index dianggap
-- berbeda-beda, jadi (uid, NULL) bisa diulang tanpa violations.
-- Kalau begitu, ini bug NYATA -- bukan multi-produk yang sah.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §1. APA UNIQUE CONSTRAINT-NYA SEBENARNYA? ################'
SELECT conname, pg_get_constraintdef(oid) AS definisi
FROM pg_constraint
WHERE conrelid = 'organic_videos'::regclass AND contype IN ('u','p')
UNION ALL
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'organic_videos' AND indexdef ILIKE '%UNIQUE%';

\echo ''
\echo '################ §2. APAKAH PRODUCT_ID BANYAK NULL? ################'
SELECT COUNT(*)                                                   AS total_baris,
       COUNT(*) FILTER (WHERE product_id IS NULL)                AS product_id_null,
       COUNT(*) FILTER (WHERE BTRIM(COALESCE(product_id,'')) = '')
                                                              AS product_id_kosong,
       COUNT(*) FILTER (WHERE campaign_id IS NULL)               AS campaign_id_null,
       COUNT(DISTINCT content_uid)                               AS content_uid_unik
FROM organic_videos;

\echo ''
\echo '################ §3. KLASIFIKASI DUPLIKAT (INI JAWABANNYA) ################'
-- Bagi setiap content_uid yang dobel:
--   A) jumlah product_id NULL > 1  -> duplikat SENGAJA (NULL lolos unique)
--   B) jumlah product_id NULL = 1  -> multi-produk SAH (tiap baris beda produk)
--   C) jumlah product_id NULL = 0  -> lain, perlu lihat
WITH dup AS (
    SELECT content_uid,
           COUNT(*)                                              AS baris,
           COUNT(DISTINCT BTRIM(COALESCE(product_id,'#NULL')))    AS produk_unik,
           COUNT(*) FILTER (WHERE product_id IS NULL)            AS baris_null,
           COUNT(DISTINCT campaign_id)                           AS jumlah_campaign
    FROM organic_videos
    WHERE content_uid IS NOT NULL
    GROUP BY content_uid
    HAVING COUNT(*) > 1
)
SELECT
  CASE WHEN baris_null > 1 THEN 'A) duplikat SENGAJA - product_id NULL'
       WHEN baris_null = 1 THEN 'B) multi-produk SAH - tiap baris beda produk'
       ELSE 'C) tanpa NULL - perlu diperiksa' END                AS kelas,
  COUNT(*)                                                      AS jumlah_content_uid,
  SUM(baris)                                                    AS total_baris,
  SUM(baris_null)                                               AS baris_product_id_null,
  MAX(baris)                                                    AS salinan_terbanyak
FROM dup
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '################ §4. KELAS A DETAIL - 10 video paling banyak salinan ################'
SELECT content_uid,
       COUNT(*)                                        AS salinan,
       COUNT(*) FILTER (WHERE product_id IS NULL)      AS baris_null,
       COUNT(DISTINCT BTRIM(COALESCE(product_id,'#'))) AS produk_unik,
       COUNT(DISTINCT campaign_id)                     AS jumlah_campaign,
       MAX(video_views)                                AS views_maks,
       MAX(content_type)                               AS tipe,
       MIN(created_at)                                 AS dibuat_pertama,
       MAX(created_at)                                 AS dibuat_terakhir
FROM organic_videos
WHERE content_uid IS NOT NULL
GROUP BY content_uid
HAVING COUNT(*) > 1
ORDER BY salinan DESC
LIMIT 10;

\echo ''
\echo '################ §5. KELAS B DETAIL - multi-produk yang SAH ################'
-- Ini yang HARUS dipertahankan. Satu video, beberapa produk berbeda.
SELECT content_uid,
       COUNT(*)                                        AS salinan,
       COUNT(*) FILTER (WHERE product_id IS NULL)      AS baris_null,
       COUNT(DISTINCT BTRIM(COALESCE(product_id,'#'))) AS produk_unik,
       string_agg(DISTINCT COALESCE(BTRIM(product_id),'(null)'), ' | ') AS daftar_produk
FROM organic_videos
WHERE content_uid IS NOT NULL
GROUP BY content_uid
HAVING COUNT(*) > 1
   AND COUNT(*) FILTER (WHERE product_id IS NULL) <= 1
ORDER BY COUNT(DISTINCT BTRIM(COALESCE(product_id,'#'))) DESC
LIMIT 10;

\echo ''
\echo '################ §6. DAMPAK KELAS A BILA DIBERSIHKAN ################'
-- Kalau kelas A dihapus (sisakan 1 baris NULL per content_uid),
-- apakah views/likes per video berubah? Harusnya TIDAK.
--skilled Ini yang jadi guard di migration nanti.
WITH before_after AS (
    SELECT content_uid,
           MAX(video_views)  AS views_maks,
           MAX(video_likes)  AS likes_maks
    FROM organic_videos
    WHERE content_uid IS NOT NULL
    GROUP BY content_uid
)
SELECT COUNT(*)                        AS video_unik,
       COALESCE(SUM(views_maks),0)     AS total_views_setelah_dibersihkan,
       COALESCE(SUM(likes_maks),0)     AS total_likes_setelah_dibersihkan
FROM before_after;

\echo '-- Bandingkan dengan yang sekarang tampil (portal pakai MAX per uid)'
\echo '-- Kalau dua angka ini sama, cleaning TIDAK mengubah apa pun di layar.'

\echo ''
\echo '################ §7. RINGKASAN ################'
\echo ' §1  unique constraint apa yang benar-benar ada'
\echo ' §2  berapa product_id yang NULL'
\echo ' §3  KELAS A = bug (NULL), KELAS B = sah (multi-produk)'
\echo ' §6  apakah cleaning mengubah angka yang tampil'
\echo ''
\echo ' KESIMPULAN yang diharapkan:'
\echo '   Kalau §3 menunjukkan kelas A = 0, maka SEMUA duplikasi itu multi-produk'
\echo '   yang sah -> tidak ada yang perlu dibersihkan sama sekali.'
\echo '   Kalau kelas A > 0, hanya itu yang perlu dibersihkan, dan §6 membuktikan'
\echo '   angkanya tidak berubah.'
