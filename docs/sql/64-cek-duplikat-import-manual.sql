-- =====================================================================
-- APAKAH VIDEO MANUAL DI-HITUNG DUA KALI?
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- ATURAN PEMILIK (2 Okt 2026):
--   "yang import manual juga kehitung yaa kan ke bagian Pencapaian Target
--    Video, jadi nanti di cek duplikat aja jika udh ada data yang dari tiktok
--    berarti jangan di hitung, jika belom baru hitung"
--
-- RUMUS YANG DIHARAPKAN:
--   total video = (video dari TikTok) + (video manual yang BELUM ada di TikTok)
--   video yang ada di KEDUA sumber dihitung SATU KALI
--
-- TIGA TEMPAT YANG HARUS SAMA:
--   1. View `vw_campaign_summary.achievement_video`
--   2. `PerformaClient.tsx` -> allApprovedVideoIds (pakai Set, otomatis dedup)
--   3. `portalActions.ts`  -> allApprovedVideoIds (pakai Set, otomatis dedup)
--
-- Perhatikan: view pakai `COUNT(id)` = menghitung BARIS.
-- Kalau satu video diinput manual 2x, view menghitung 2x.
-- Dua tempat lain pakai Set = uid unik = benar.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §1. CARA MEMBEDAKAN VIDEO MANUAL vs TIKTOK ################'
-- "Ada di TikTok" = content_uid-nya ada di organic_videos.
-- "Manual saja"    = ada di tabel videos tapi tidak ada di organic_videos.
WITH per AS (
    SELECT v.id, v.campaign_creator_id, cc.campaign_id, v.content_uid, v.link_video,
           EXISTS (SELECT 1 FROM organic_videos o
                   WHERE o.content_uid = v.content_uid) AS ada_di_tiktok
    FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
    WHERE cc.campaign_id = 54 AND v.link_video IS NOT NULL
)
SELECT
  CASE WHEN content_uid IS NULL OR BTRIM(content_uid) = '' THEN 'C) tanpa content_uid'
       WHEN ada_di_tiktok THEN 'A) ada di TikTok (input PIC dicocokkan)'
       ELSE 'B) MANUAL SAJA (TikTok belum melapor)' END  AS sumber,
  COUNT(*)                                              AS baris,
  COUNT(DISTINCT content_uid)                           AS uid_unik,
  COUNT(*) - COUNT(DISTINCT content_uid)                AS baris_ganda
FROM per GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '################ §2. TIGA CARA MENGHITUNG, APA HASILNYA? ################'
WITH per AS (
    SELECT v.id, v.content_uid,
           EXISTS (SELECT 1 FROM organic_videos o
                   WHERE o.content_uid = v.content_uid) AS ada_di_tiktok
    FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
    WHERE cc.campaign_id = 54 AND v.link_video IS NOT NULL
)
SELECT
  -- (1) CARA VIEW sekarang: COUNT(*) per baris
  (SELECT COUNT(*) FROM per)                                          AS cara_VIEW_SKRG,
  -- (2) CARA yang benar: uid unik, video tanpa uid tetap dihitung 1x
  (SELECT COUNT(DISTINCT content_uid) FROM per WHERE content_uid IS NOT NULL)
  + (SELECT COUNT(*) FROM per WHERE content_uid IS NULL OR BTRIM(content_uid) = '')
                                                                     AS cara_BENAR,
  -- (3) Total unik = TikTok + manual yang belum ada di TikTok
  (SELECT COUNT(DISTINCT content_uid) FROM per p
    WHERE p.content_uid IS NOT NULL)
  + (SELECT COUNT(*) FROM per p
    WHERE (p.content_uid IS NULL OR BTRIM(p.content_uid) = '')
      AND NOT EXISTS (SELECT 1 FROM organic_videos o
                      WHERE o.content_uid = p.content_uid))           AS CARA_RUMUS_OWNER,
  -- view
  (SELECT achievement_video FROM vw_campaign_summary WHERE campaign_id = 54)
                                                                     AS achievement_view;

\echo ''
\echo '################ §3. VIDEO YANG TERINPUT 2X (DUPLIKAT) ################'
SELECT v.content_uid, COUNT(*) AS jumlah,
       string_agg(c.username, ' | ') AS kreator,
       MAX(ada_di_tiktok::int)      AS ada_di_tiktok
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
JOIN creators c ON c.id = cc.creator_id
LEFT JOIN organic_videos o ON o.content_uid = v.content_uid
WHERE cc.campaign_id = 54 AND v.link_video IS NOT NULL
  AND v.content_uid IS NOT NULL
GROUP BY v.content_uid
HAVING COUNT(*) > 1
ORDER BY 2 DESC;

\echo ''
\echo '################ §4. DAMPAK KE SELURUH DATABASE ################'
-- Kalau view pakai COUNT(id) tapi 2 halaman lain pakai uid unik,
-- angkanya bisa berbeda. Seberapa besar di semua campaign?
SELECT
  (SELECT COALESCE(SUM(baris),0) FROM (
     SELECT COUNT(*) AS baris FROM videos v
     JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
     WHERE v.link_video IS NOT NULL GROUP BY cc.campaign_id) z)      AS total_baris_view,
  (SELECT COALESCE(SUM(achievement_video),0) FROM vw_campaign_summary) AS total_achievement_view,
  (SELECT COALESCE(SUM(baris),0) FROM (
     SELECT COUNT(*) AS baris FROM videos v
     JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
     WHERE v.link_video IS NOT NULL GROUP BY cc.campaign_id) z)
  - (SELECT COALESCE(SUM(achievement_video),0) FROM vw_campaign_summary)
                                                                     AS selisih_harus_nol;

\echo ''
\echo '################ §5. PER CAMPAIGN YANG BEDA ################'
WITH calc AS (
    SELECT cc.campaign_id,
           COUNT(*) FILTER (WHERE v.link_video IS NOT NULL) AS baris,
           COUNT(DISTINCT v.content_uid) FILTER (WHERE v.link_video IS NOT NULL
                    AND v.content_uid IS NOT NULL) AS uid_unik,
           COUNT(*) FILTER (WHERE v.link_video IS NOT NULL
                    AND (v.content_uid IS NULL OR BTRIM(v.content_uid) = '')) AS tanpa_uid
    FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
    GROUP BY cc.campaign_id
)
SELECT s.campaign_id, c.nama, s.achievement_video AS view_skrg,
       cal.baris, cal.uid_unik, cal.tanpa_uid,
       (cal.uid_unik + cal.tanpa_uid) AS seharusnya,
       cal.baris - (cal.uid_unik + cal.tanpa_uid) AS kelebihan
FROM vw_campaign_summary s
JOIN campaigns c ON c.id = s.campaign_id
JOIN calc cal ON cal.campaign_id = s.campaign_id
WHERE cal.baris <> (cal.uid_unik + cal.tanpa_uid)
ORDER BY 7 DESC;

\echo ''
\echo '################ §6. APAKAH PERFORMA/PORTAL SUDAH BENAR? ################'
\echo ' Keduanya pakai Set isinya, jadi video yang ada di TikTok DAN diinput PIC'
\echo ' dihitung SATU KALI. Itu sudah sesuai aturan owner.'
\echo ' Yang perlu dicek hanya apakah view ikut konsisten.'
\echo ''
\echo ' RUMUS OWNER:'
\echo '   total = (video unik dari TikTok) + (video manual yang uid-nya belum'
\echo '            ada di organic_videos)'
\echo ' Karena organic_videos sudah berisi video yang diinput PIC lalu dicocokkan,'
\echo ' "video unik" di organic_videos + "manual yang belum ada" = jawaban owner's.'
\echo ' Dan itu PERSIS sama dengan COUNT(DISTINCT content_uid) di tabel videos.'
\echo ''
\echo ' Jadi perbaikan view: COUNT(id) -> COUNT(DISTINCT content_uid),'
\echo ' dengan videos tanpa content_uid tetap dihitung 1 baris.'
