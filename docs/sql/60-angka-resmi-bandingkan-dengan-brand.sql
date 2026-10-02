-- =====================================================================
-- ANGKA RESMI PER CAMPAIGN + CARA BACAINVOICE BRAND
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- GUNANYA DUA:
--   §1 menjawab selisih 4.116 vs 3.268 di campaign 52 yang BELUM
--      saya jelaskan. Saya tidak akan menebak angka untuk verifikasi.
--   §2-§6-print semua angka yang TAMPIL di portal, supaya saat brand
--      kirim report bisa dibandingkan baris per baris.
--
-- SEBELUM migration 20261003030000, achievement_video ikut menghitung
-- livestream. Sekarang sudah dipisah (10 campaign berubah, 654 dicoret).
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §1. SELISIH 4.116 vs 3.268 DI CAMPAIGN 52 ################'
-- Dua definisi yang saya pakai berbeda. Ini yang bedanya:
--   (a) lewat vw_video_klasifikasi  -> dipakai view
--   (b) langsung FROM videos        -> dipakai diagnostic §58
WITH via_view AS (
    SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE punya_link) AS dengan_link
    FROM vw_video_klasifikasi WHERE campaign_id = 52
),
langsung AS (
    SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE v.link_video IS NOT NULL) AS dengan_link
    FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
    WHERE cc.campaign_id = 52
)
SELECT
  (SELECT n FROM via_view)              AS baris_lewat_view,
  (SELECT dengan_link FROM via_view)    AS dengan_link_lewat_view,
  (SELECT n FROM langsung)              AS baris_langsung,
  (SELECT dengan_link FROM langsung)    AS dengan_link_langsung,
  (SELECT dengan_link FROM via_view) - (SELECT dengan_link FROM langsung) AS selisih;

\echo ''
\echo '-- Rincian: apa bedanya? content_uid & link per campaign_creator'
SELECT
  CASE WHEN v.content_uid IS NULL OR BTRIM(v.content_uid) = '' THEN 'tanpa content_uid'
       WHEN v.link_video IS NULL THEN 'tanpa link_video'
       ELSE 'lengkap' END                                AS kelas,
  COUNT(*)                                                 AS baris,
  COUNT(*) FILTER (WHERE k.is_livestream IS TRUE)        AS live,
  COUNT(*) FILTER (WHERE k.is_livestream IS FALSE)       AS bukan_live
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
LEFT JOIN vw_video_klasifikasi k ON k.id = v.id
WHERE cc.campaign_id = 52
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '-- Apakah ada videos yang terhubung ke >1 campaign_creator?'
-- Kalau iya, satu baris bisa terhitung beberapa kali.
SELECT COUNT(*) AS video_terhubung_ganda
FROM (
  SELECT v.campaign_creator_id, COUNT(*) n
  FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
  WHERE cc.campaign_id = 52
  GROUP BY 1 HAVING COUNT(*) > 0
) z;

\echo ''
\echo '################ §2. SEMUA ANGKA YANG TAMPIL DI PORTAL ################'
-- Ganti 52 dengan campaign yang mau dicek.
SELECT c.id, c.nama, c.status,
       c.target_gmv, c.target_video, c.target_creator,
       s.total_gmv              AS TOTAL_GMV,
       s.total_gmv_video        AS GMV_VIDEO,
       s.total_gmv_live         AS GMV_LIVE,
       s.total_ads_gmv          AS GMV_ADS,
       s.achievement_video      AS VIDEO_TAYANG,
       s.achievement_creator    AS KREATOR_APPROVED,
       s.total_ads_spend        AS BIAYA_ADS,
       CASE WHEN c.target_gmv > 0
            THEN ROUND(100.0 * s.total_gmv / c.target_gmv) END AS PERSEN_TARGET_GMV,
       CASE WHEN c.target_video > 0
            THEN ROUND(100.0 * s.achievement_video / c.target_video) END AS PERSEN_TARGET_VIDEO
FROM campaigns c
JOIN vw_campaign_summary s ON s.campaign_id = c.id
WHERE c.id = 52;

\echo ''
\echo '################ §3. VIEWS & LIKES (yang tampil di portal) ################'
-- PENTING: portal menghitung views/likes untuk VIDEO + LIVESTREAM
-- (keputusan owner 2 Okt 2026). Ini BEDA dari mana video dihitung.
-- Kalau report brand tidak sama, cek dulu di sini.
WITH sk AS (
    SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE campaign_id = 52 AND COALESCE(BTRIM(product_id),'') <> ''
),
org AS (
    SELECT content_uid,
           MAX(video_views) AS views,
           MAX(video_likes) AS likes,
           MIN(COALESCE(content_type,'video')) AS tipe
    FROM organic_videos
    WHERE campaign_id = 52
      AND BTRIM(COALESCE(product_id,'')) IN (SELECT pid FROM sk)
      AND content_uid IS NOT NULL
    GROUP BY content_uid
)
SELECT COUNT(*)                                               AS video_unik,
       COALESCE(SUM(views),0)                                 AS TOTAL_VIEWS,
       COALESCE(SUM(likes),0)                                 AS TOTAL_LIKES,
       COALESCE(SUM(views) FILTER (WHERE LOWER(tipe) NOT IN ('livestream','live')),0) AS views_video_saja,
       COALESCE(SUM(likes) FILTER (WHERE LOWER(tipe) NOT IN ('livestream','live')),0) AS likes_video_saja,
       COALESCE(SUM(views) FILTER (WHERE LOWER(tipe) IN ('livestream','live')),0)     AS views_live_saja,
       COALESCE(SUM(likes) FILTER (WHERE LOWER(tipe) IN ('livestream','live')),0)     AS likes_live_saja
FROM org;

\echo ''
\echo '################ §4. KREATOR YANG DIHITUNG ################'
-- Portal: HANYA approved + alternate (keputusan owner: not_approved disembunyikan).
SELECT cc.approval,
       COUNT(*)                                              AS kreator,
       COUNT(*) FILTER (WHERE COALESCE(cc.nominal_pelunasan,0) > 0) AS sudah_dibayar
FROM campaign_creators cc
WHERE cc.campaign_id = 52
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '################ §5. TOTAL ITEM SOLD ################'
SELECT COUNT(*)                                        AS baris_sales,
       COUNT(DISTINCT creator_username)                AS kreator,
       COALESCE(SUM(gmv::numeric),0)                   AS GMV_SEMUA,
       COALESCE(SUM(quantity::numeric),0)              AS TOTAL_ITEM,
       COALESCE(SUM(gmv::numeric) FILTER (WHERE is_refund IS TRUE),0) AS refund_terhitung,
       COALESCE(SUM(gmv::numeric) FILTER (WHERE is_refund IS NOT TRUE),0) AS tanpa_refund
FROM sales WHERE campaign_id = 52;

\echo ''
\echo '################ §6. YANG MUNGKIN BEDA DARI LAPORAN BRAND ################'
\echo ' Kalau angkaTidak sama, cek urutan ini:'
\echo ''
\echo '  1. Views/Likes  -> portal VIDEO+LIVE. Laporan brand bisa VIDEO saja.'
\echo '  2. Item Sold   -> portal hanya kreator approved + SKU terdaftar.'
\echo '  3. GMV          -> sudah termasuk REFUND (keputusan owner). Brand sering'
\echo '                     menghitung net of refund. Beda ~5% untuk campaign ini.'
\echo '  4. Periode      -> cek tanggal awal/akhir campaign vs periode report.'
\echo '  5. Sales Share  -> brand bagi GMV ke campaign sesuai kreator. Kita pakai'
\echo '                     product_id. Hasilnya bisa beda kalau mapping SKU beda.'
