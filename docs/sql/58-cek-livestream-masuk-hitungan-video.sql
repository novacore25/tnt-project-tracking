-- =====================================================================
-- URGENT: apakah LIVESTREAM ikut terhitung sebagai VIDEO?
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- KHAUWATAN PEMILIK:
--   "di menu video masih ada yang kecampur dengan konten id live ...
--    pastikan Pencapaian Target Video tidak menghitung livestream,
--    mana sudah report ke brand"
--
-- SUDAH TERBUKTI DI KODE (tidak perlu speculate):
--   1. `VideoClient.tsx:1322-1341` menyusun daftar video dari tabel
--      `videos` TANPA filter content_type sama sekali.
--   2. `videoActions.ts:48-56` mengambil `content_type` tapi tidak
--      memakainya sebagai filter.
--   3. View `vw_campaign_summary.achievement_video` =
--        COUNT(v.id) FROM videos v WHERE link_video IS NOT NULL
--      -- TIDAK ada filter content_type.
--   4. Portal `allApprovedVideoIds` (saya tulis 2 Okt 2026) juga
--      mengambil SEMUA baris tabel `videos` tanpa cek content_type.
--
--   -> Kalau tabel `videos` memuat livestream, maka SEMUAempat tempat
--      di atas ikut menghitung livestream sebagai "video".
--
-- Yang script ini jawab: APAKAH tabel `videos` benar-benar memuat
-- livestream, dan berapa banyak dampaknya per campaign.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §1. TABEL videos: ADA LIVESTREAM DI DALAMNYA? ################'
-- Cara deteksi: content_uid yang SAMA ada di organic_videos dengan
-- content_type live. Itu bukti kuat, bukan tebakan dari pola angka.
WITH live_uids AS (
    SELECT DISTINCT content_uid
    FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
),
nonlive_uids AS (
    SELECT DISTINCT content_uid
    FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'video')) NOT IN ('livestream','live')
)
SELECT
  (SELECT COUNT(*) FROM videos)                                          AS total_baris_videos,
  (SELECT COUNT(*) FROM videos v JOIN live_uids l
     ON l.content_uid = v.content_uid)                                  AS TERBUKTI_LIVESTREAM,
  (SELECT COUNT(*) FROM videos v JOIN nonlive_uids n
     ON n.content_uid = v.content_uid)                                  AS TERBUKTI_VIDEO,
  (SELECT COUNT(*) FROM videos v
     WHERE v.content_uid IS NOT NULL
       AND v.content_uid NOT IN (SELECT content_uid FROM live_uids)
       AND v.content_uid NOT IN (SELECT content_uid FROM nonlive_uids)) AS tidak_diketahui,
  (SELECT COUNT(*) FROM videos WHERE content_uid IS NULL)               AS tanpa_content_uid;

\echo ''
\echo '################ §2. DAMPAK PER CAMPAIGN (achievement_video) ################'
-- Bandingkan achievement_video (view) dengan hitungan yang benar.
-- Kalau ada selisih, itu jumlah livestream yang ikut terhitung.
WITH live_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
),
calc AS (
    SELECT cc.campaign_id,
           COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL) AS achievement_video_skarang,
           COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL
                AND v.content_uid IN (SELECT content_uid FROM live_uids)) AS dari_livestream,
           COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL
                AND v.content_uid NOT IN (SELECT content_uid FROM live_uids)) AS video_benar
    FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    GROUP BY cc.campaign_id
)
SELECT v.campaign_id, c.nama,
       v.achievement_video                    AS view_sekarang,
       COALESCE(cal.achievement_video_skarang,0) AS hitung_ulang,
       COALESCE(cal.dari_livestream,0)        AS DARI_LIVESTREAM,
       COALESCE(cal.video_benar,0)            AS video_benar,
       ROUND(100.0 * COALESCE(cal.dari_livestream,0)
             / NULLIF(COALESCE(cal.achievement_video_skarang,0),0), 1) AS persen_terkontaminasi
FROM vw_campaign_summary v
JOIN campaigns c ON c.id = v.campaign_id
LEFT JOIN calc cal ON cal.campaign_id = v.campaign_id
WHERE COALESCE(cal.dari_livestream,0) > 0
ORDER BY 4 DESC
LIMIT 25;

\echo ''
\echo '################ §3. TOTAL KERUSAKAN SE-DATABASE ################'
WITH live_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
)
SELECT
  (SELECT COUNT(*) FROM videos v
     JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    WHERE v.link_video IS NOT NULL)                                  AS total_terhitung_view,
  (SELECT COUNT(*) FROM videos v
     JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    JOIN live_uids l ON l.content_uid = v.content_uid
    WHERE v.link_video IS NOT NULL)                                  AS dari_livestream,
  (SELECT COUNT(*) FROM videos v
     JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    WHERE v.link_video IS NOT NULL
      AND v.content_uid NOT IN (SELECT content_uid FROM live_uids))  AS video_benar,
  (SELECT COUNT(DISTINCT cc.campaign_id) FROM videos v
     JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
     JOIN live_uids l ON l.content_uid = v.content_uid
    WHERE v.link_video IS NOT NULL)                                  AS campaign_terpengaruh;

\echo ''
\echo '################ §4. 20 BARIS YANG TERBUKTI LIVESTREAM ################'
WITH live_uids AS (
    SELECT content_uid, MIN(COALESCE(content_type,'')) AS tipe
    FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
    GROUP BY content_uid
)
SELECT v.id, cc.campaign_id, c.username,
       v.content_uid, l.tipe,
       CASE WHEN v.link_video ILIKE '%/live/%' THEN 'link: /live/'
            WHEN v.link_video ILIKE '%live%'   THEN 'link: mengandung live'
            ELSE 'link: tidak menandai live' END AS bukti_link,
       v.link_video
FROM videos v
JOIN live_uids l ON l.content_uid = v.content_uid
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
JOIN creators c ON c.id = cc.creator_id
WHERE v.link_video IS NOT NULL
ORDER BY cc.campaign_id, v.id
LIMIT 20;

\echo ''
\echo '################ §5. KASUS KHUSUS CAMPAIGN 52 ################'
-- Yang user lihat dan laporkan.
WITH live_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
)
SELECT
  (SELECT COUNT(*) FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    WHERE cc.campaign_id = 52 AND v.link_video IS NOT NULL) AS achievement_video_skarang,
  (SELECT COUNT(*) FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    JOIN live_uids l ON l.content_uid = v.content_uid
    WHERE cc.campaign_id = 52 AND v.link_video IS NOT NULL) AS dari_livestream,
  (SELECT target_video FROM campaigns WHERE id = 52)         AS target_video,
  (SELECT COUNT(DISTINCT v.content_uid) FROM videos v
     JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    WHERE cc.campaign_id = 52 AND v.link_video IS NOT NULL) AS video_unik_skarang;

\echo ''
\echo '################ §6. CEK LINK VIDEO: ADA YANG MENANDAI LIVE? ################'
-- Link livestream TikTok mengandung '/live/'. Kalau banyak, bisa jadi
-- filter tambahan selain join ke organic_videos.
SELECT COUNT(*) FILTER (WHERE link_video ILIKE '%/live/%')  AS link_dengan_live,
       COUNT(*) FILTER (WHERE link_video ILIKE '%/video/%') AS link_dengan_video,
       COUNT(*) FILTER (WHERE link_video IS NOT NULL)      AS link_ada,
       COUNT(*)                                            AS total_baris
FROM videos;

\echo ''
\echo '################ §7. RINGKASAN UNTUK KEPUTUSAN ################'
\echo ' §1  berapa baris videos yang TERBUKTI livestream'
\echo ' §2  campaign mana saja yang terdampak + persen'
\echo ' §3  total-Russian dampak se-database'
\echo ' §5  khusus campaign 52 (yang dilaporkan)'
\echo ' §6  apakah link video bisa jadi deteksi tambahan'
\echo ''
\echo ' KESIMPULAN yang diharapkan:'
\echo '   §1 > 0 ->achievement_video selama ini SALAH, dan sudah dilaporkan ke brand'
\echo ' §1 = 0 -> contamination hanya di sisi UI, angka_TARGET aman'
