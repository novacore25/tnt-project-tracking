-- =====================================================================
-- LANJUTAN §58: campaign 52 terindeksi bersih, tapi user melihat live.
-- Kenapa? 2.280 baris videos punya content_uid yang TIDAK ADA di
-- organic_videos, jadi join-based detection tidak bisa menangkapnya.
--
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- TEMUAN §58 (sudah dipakai di sini):
--   654 dari 29.165 baris videos TERBUKTI livestream
--   2.280 baris "tidak diketahui" (content_uid tidak ada di organic_videos)
--   177 baris tanpa content_uid sama sekali
--   0 link mengandung '/live/' -> deteksi harus lewat organic_videos
--
-- PERTANYAAN SEKARANG:
--   1. Campaign 52: dari 3.268 video-nya, berapa yang live / video / unknown?
--   2. Apakah "unknown" itu sebenarnya live? (dibandingkan ke live_sessions)
--   3. Kalau difilter, berapa achievement_video per campaign?
--   4.ampel berapa campaign yang berubah angkanya, dan seberapa besar.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §1. KLASIFIKASI LENGKAP videos (bukan hanya live) ################'
WITH live_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
),
video_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'video')) NOT IN ('livestream','live')
)
SELECT
  CASE WHEN v.content_uid IS NULL OR BTRIM(v.content_uid) = '' THEN 'C) tanpa content_uid'
       WHEN l.content_uid IS NOT NULL                            THEN 'A) TERBUKTI LIVESTREAM'
       WHEN vid.content_uid IS NOT NULL                          THEN 'B) TERBUKTI VIDEO'
       ELSE 'D) tidak ada di organic_videos'
  END                                                            AS kelas,
  COUNT(*)                                                       AS baris,
  COUNT(*) FILTER (WHERE v.link_video IS NOT NULL)              AS dengan_link,
  COUNT(DISTINCT cc.campaign_id)                                AS campaign_terpengaruh
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
LEFT JOIN live_uids  l   ON l.content_uid  = v.content_uid
LEFT JOIN video_uids vid ON vid.content_uid = v.content_uid
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '################ §2. KAMPAIGN 52 - RINCIAN ################'
WITH live_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
),
video_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'video')) NOT IN ('livestream','live')
)
SELECT
  COUNT(*) FILTER (WHERE l.content_uid IS NOT NULL)  AS terbukti_live,
  COUNT(*) FILTER (WHERE vid.content_uid IS NOT NULL) AS terbukti_video,
  COUNT(*) FILTER (WHERE v.content_uid IS NOT NULL
                     AND l.content_uid IS NULL AND vid.content_uid IS NULL) AS tidak_diketahui,
  COUNT(*) FILTER (WHERE v.content_uid IS NULL)       AS tanpa_content_uid,
  COUNT(*)                                           AS total_baris,
  COUNT(*) FILTER (WHERE v.link_video IS NOT NULL)    AS dengan_link
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
LEFT JOIN live_uids  l   ON l.content_uid  = v.content_uid
LEFT JOIN video_uids vid ON vid.content_uid = v.content_uid
WHERE cc.campaign_id = 52;

\echo ''
\echo '################ §3. APAKAH "TIDAK DIKETAHUI" ITU LIVESTREAM? ################'
-- Cross-check ke live_sessions.livestream_room_id. Kalau content_uid videos
-- ada di sana, itu live.
SELECT
  (SELECT COUNT(*) FROM videos v
    JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
   WHERE cc.campaign_id = 52
     AND v.content_uid IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM organic_videos ov WHERE ov.content_uid = v.content_uid)
     AND v.content_uid IN (SELECT livestream_room_id FROM live_sessions)) AS unknown_yang_live_sessions,
  (SELECT COUNT(*) FROM videos v
    JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
   WHERE cc.campaign_id = 52
     AND v.content_uid IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM organic_videos ov WHERE ov.content_uid = v.content_uid)) AS total_unknown_52,
  (SELECT COUNT(*) FROM videos v
    JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
   WHERE cc.campaign_id = 52 AND v.content_uid IS NULL) AS tanpa_uid_52,
  -- Global: berapa "unknown" yang match live_sessions
  (SELECT COUNT(*) FROM videos v
   WHERE v.content_uid IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM organic_videos ov WHERE ov.content_uid = v.content_uid)
     AND v.content_uid IN (SELECT livestream_room_id FROM live_sessions)) AS unknown_live_sessions_global;

\echo ''
\echo '################ §4. 15 "TIDAK DIKETAHUI" DARI CAMPAIGN 52 ################'
-- Kalau user melihat live di menu, mungkin ada di daftar ini.
SELECT v.id, c.username, v.content_uid, v.link_video, v.created_at
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
JOIN creators c ON c.id = cc.creator_id
WHERE cc.campaign_id = 52
  AND v.content_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM organic_videos ov WHERE ov.content_uid = v.content_uid)
ORDER BY v.id DESC
LIMIT 15;

\echo ''
\echo '################ §5. SIMULASI FIX: achievement_video SETELAH FILTER ################'
-- Kalau baris live dikeluarkan, ini angka barunya. Penting: berapa campaign
-- yang BERUBAH dan seberapa jauh.
WITH live_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
)
SELECT c.id, c.nama,
       COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL) AS sekarang,
       COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL
            AND v.content_uid NOT IN (SELECT content_uid FROM live_uids)) AS setelah_fix,
       COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL
            AND v.content_uid IN (SELECT content_uid FROM live_uids)) AS dicoret,
       CASE WHEN c.target_video > 0 THEN
         ROUND(100.0 * COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL
              AND v.content_uid NOT IN (SELECT content_uid FROM live_uids)) / c.target_video)
       END AS persen_target_sekarang,
       CASE WHEN c.target_video > 0 THEN
         ROUND(100.0 * COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL
              AND v.content_uid NOT IN (SELECT content_uid FROM live_uids)) / c.target_video)
       END AS persen_target_setelah_fix
FROM campaigns c
LEFT JOIN campaign_creators cc ON cc.campaign_id = c.id
LEFT JOIN videos v ON v.campaign_creator_id = cc.id
GROUP BY c.id, c.nama, c.target_video
HAVING COUNT(v.id) FILTER (WHERE v.link_video IS NOT NULL
         AND v.content_uid IN (SELECT content_uid FROM live_uids)) > 0
ORDER BY 4 DESC;

\echo ''
\echo '################ §6. KAMPAIGN 52 SETELAH FIX (target 4000) ################'
WITH live_uids AS (
    SELECT DISTINCT content_uid FROM organic_videos
    WHERE content_uid IS NOT NULL
      AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
)
SELECT
  (SELECT COUNT(v.id) FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
    WHERE cc.campaign_id = 52 AND v.link_video IS NOT NULL) AS sekarang,
  (SELECT COUNT(v.id) FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
    WHERE cc.campaign_id = 52 AND v.link_video IS NOT NULL
      AND v.content_uid NOT IN (SELECT content_uid FROM live_uids)) AS setelah_fix,
  (SELECT target_video FROM campaigns WHERE id = 52) AS target,
  (SELECT target_video FROM campaigns WHERE id = 52) AS _target2;

\echo ''
\echo '################ §7. RINGKASAN ################'
\echo ' §1  kelas A (live) / B (video) / D (tidak ada di organic_videos)'
\echo ' §2  rincian campaign 52'
\echo ' §3  apakah "tidak diketahui" ternyata live (dicek ke live_sessions)'
\echo ' §5  ACHIEVEMENT VIDEO SETELAH FILTER - campaign mana yang berubah'
\echo ' §6  campaign 52 vs target 4000'
\echo ''
\echo ' PENTING untuk laporan brand:'
\echo '   §5 = daftar campaign yang angkanya meleset dan sudah dilaporkan ke brand.'
