-- =====================================================================
-- CEK CEPAT SETELAH IMPORT ULANG (MD Glow / campaign 54)
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- =====================================================================
-- RINGKASAN VERIFIKASI 2 Okt 2026 (hasil, bukan dugaan):
--
--   File TikTok "MD Glow CustomReport...Video...2026-08-01_2026-10-01.xlsx"
--     56 baris data -> 53 video unik (3 video 2 baris karena multi-produk)
--     views 8.627 | likes 305 | GMV kol18 1.713.823 | 15 kreator | 3 produk
--
--   SISTEM (sebelum import ulang):
--     organic_videos unik 53  -> PERSIS ✅
--     53 video file semua ada di sistem             -> ✅
--     product_id 3, SKU terdaftar 3                 -> ✅ PERSIS
--     video ekstra 5 (0 views, belum ada di TikTok) -> ✅ WAJAR
--       (PIC input link sebelum data TikTok masuk)
--     views 7.608 (selisih -1.019)  -> ⚠️ FILE BELUM DI-IMPORT
--     likes 293   (selisih   -12)  -> ⚠️ FILE BELUM DI-IMPORT
--
--   PENYEBAB views/likes (dibuktikan dari raw_data):
--     Yang pernah diimport punya Date = 2026-09-29-2026-10-01 (2 hari)
--     File yang sekarang          punya Date = 2026-08-01-2026-10-01 (2 bulan)
--     Periode lebih panjang = views lebih banyak. 16 video tidak berubah
--     (sudah tidak nambah), 37 video naik. Total naiknya persis 1.019.
--
--   BUKA BUG - kode import pakai GREATEST:
--     importActions.ts:194  video_views = GREATEST(lama, baru)
--     importActions.ts:195  video_likes = GREATEST(lama, baru)
--     -> Nilai tidak pernah turun. Import file terbaru = langsung jadi 8.627.
--
--   CATATAN PENTING soal file TikTok:
--     Kolom "Video views" itu views DALAM PERIODE LAPORAN, bukan kumulatif.
--     Makanya file berperiode 2 bulan selalu lebih besar dari file 2 hari.
--     Jumlahkan views TANPA perhitungkan periode akan selalu salah banding.
--
-- =====================================================================

\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ HASIL YANG HARUSNYA MUNCUL ################'
\echo ''
\echo ' File TikTok (2 bulan) : 53 video | 8.627 views | 305 likes'
\echo ' Setelah import ulang   : 53 video | 8.627 views | 305 likes'
\echo '                        62 di tabel videos (53 + 5 menunggu TikTok)'
\echo ''

\echo '################ §1. ANGKA SAAT INI ################'
SELECT
  (SELECT COUNT(DISTINCT content_uid) FROM organic_videos
    WHERE campaign_id = 54 AND content_uid IS NOT NULL)                       AS ORGANIC_UNIK,
  (SELECT COALESCE(SUM(MAXV),0) FROM (
      SELECT MAX(o.video_views) AS MAXV FROM organic_videos o
      JOIN (SELECT content_uid FROM organic_videos
             WHERE campaign_id = 54 AND content_uid IS NOT NULL) f
        ON f.content_uid = o.content_uid
      GROUP BY o.content_uid) z)                                              AS TOTAL_VIEWS,
  (SELECT COALESCE(SUM(MAXL),0) FROM (
      SELECT MAX(o.video_likes) AS MAXL FROM organic_videos o
      JOIN (SELECT content_uid FROM organic_videos
             WHERE campaign_id = 54 AND content_uid IS NOT NULL) f
        ON f.content_uid = o.content_uid
      GROUP BY o.content_uid) z)                                              AS TOTAL_LIKES,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE campaign_id = 54)     AS GMV_SISTEM,
  (SELECT achievement_video FROM vw_campaign_summary WHERE campaign_id = 54)  AS ACHIEVEMENT_VIDEO,
  (SELECT target_video FROM campaigns WHERE id = 54)                         AS TARGET_VIDEO;

\echo ''
\echo '-- Tanggal laporan yang TERAKHIR tersimpan di raw_data'
-- Ini yang menentukan views-nya dari periode mana. Kalau masih 29 Sep-2026-10-01,
-- berarti file 2 bulan belum masuk.
SELECT raw_data ->> 'Date' AS periode_laporan, COUNT(*) AS baris,
       SUM(video_views::numeric) AS views
FROM organic_videos
WHERE campaign_id = 54 AND raw_data ->> 'Date' IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC;

\echo ''
\echo '################ §2. TARGET YANG HARUSNYA TERCAPAI ################'
WITH per AS (
  SELECT content_uid, MAX(video_views) AS v, MAX(video_likes) AS l
  FROM organic_videos
  WHERE content_uid IN (
    '7684658722538278165','7685146224147598600','7686315005750332692','7686426042164104468',
    '7686330014307978517','7689707548416462098','7690452643797372168','7688592734596107528',
    '7686390177610140949','7690473727062035733','7684792722217061640','7687110634751790354',
    '7690479034853117190','7686030156095327495','7690707877215866133','7685997372714863890',
    '7688964185102863634','7686115088578743559','7688968583426116871','7688963915123854599',
    '7688181611900177671','7690506000931065095','7691580586321890578','7688183469314215176',
    '7690483418676661511','7689579805645212946','7690836577903267090','7690806181819960583',
    '7688960783568342279','7687615922575543570','7688182015434181896','7690776773138648328',
    '7691298651729300743','7690839446459026706','7691171953830317319','7688497084642659592',
    '7690840021007420680','7690487047554927893','7690954697913404679','7690486379922377990',
    '7688985307911326994','7687589445570186503','7687972026367102226','7691664974393003316',
    '7690947453008366855','7689791184415296776','7691244733506522376','7689002526007495956',
    '7689406351365229842','7689001700790783253','7691192978131619080','7689001329095642389',
    '7684664501240679700')
  GROUP BY content_uid
)
SELECT
  COUNT(*)                                       AS VIDEO_HARUS,
  COALESCE(SUM(v),0)                             AS VIEWS_HARUS,
  COALESCE(SUM(l),0)                             AS LIKES_HARUS,
  8627                                           AS views_file,
  305                                            AS likes_file,
  COALESCE(SUM(v),0) - 8627                      AS selisih_views,
  COALESCE(SUM(l),0) - 305                       AS selisih_likes,
  CASE WHEN COALESCE(SUM(v),0) = 8627 AND COALESCE(SUM(l),0) = 305
       THEN 'COCOK - import berhasil' ELSE 'belum cocok' END AS STATUS
FROM per;

\echo ''
\echo '################ §3. MASIH ADA YANG BEDA? ################'
WITH per AS (
  SELECT o.content_uid, MAX(o.video_views) AS v
  FROM organic_videos o
  WHERE o.content_uid IN (
    '7684658722538278165','7685146224147598600','7686315005750332692','7686426042164104468',
    '7686330014307978517','7689707548416462098','7690452643797372168','7688592734596107528',
    '7686390177610140949','7690473727062035733','7684792722217061640','7687110634751790354',
    '7690479034853117190','7686030156095327495','7690707877215866133','7685997372714863890',
    '7688964185102863634','7686115088578743559','7688968583426116871','7688963915123854599',
    '7688181611900177671','7690506000931065095','7691580586321890578','7688183469314215176',
    '7690483418676661511','7689579805645212946','7690836577903267090','7690806181819960583',
    '7688960783568342279','7687615922575543570','7688182015434181896','7690776773138648328',
    '7691298651729300743','7690839446459026706','7691171953830317319','7688497084642659592',
    '7690840021007420680','7690487047554927893','7690954697913404679','7690486379922377990',
    '7688985307911326994','7687589445570186503','7687972026367102226','7691664974393003316',
    '7690947453008366855','7689791184415296776','7691244733506522376','7689002526007495956',
    '7689406351365229842','7689001700790783253','7691192978131619080','7689001329095642389',
    '7684664501240679700')
  GROUP BY o.content_uid
)
SELECT p.content_uid, p.v AS views_sistem, f.v AS views_file, p.v - f.v AS selisih
FROM per p
JOIN (VALUES
    ('7684658722538278165'::text,1107),('7685146224147598600',759),('7686315005750332692',681),
    ('7686426042164104468',637),('7686330014307978517',614),('7689707548416462098',552),
    ('7690452643797372168',513),('7688592734596107528',368),('7686390177610140949',312),
    ('7690473727062035733',207),('7684792722217061640',203),('7687110634751790354',199),
    ('7690479034853117190',197),('7686030156095327495',164),('7690707877215866133',161),
    ('7685997372714863890',157),('7688964185102863634',131),('7686115088578743559',124),
    ('7688968583426116871',124),('7688963915123854599',105),('7688181611900177671',90),
    ('7690506000931065095',80),('7691580586321890578',80),('7688183469314215176',73),
    ('7690483418676661511',72),('7689579805645212946',69),('7690836577903267090',63),
    ('7690806181819960583',62),('7688960783568342279',59),('7687615922575543570',55),
    ('7688182015434181896',54),('7690776773138648328',51),('7691298651729300743',46),
    ('7690839446459026706',45),('7691171953830317319',44),('7688497084642659592',38),
    ('7690840021007420680',38),('7690487047554927893',34),('7690954697913404679',32),
    ('7690486379922377990',30),('7688985307911326994',28),('7687589445570186503',25),
    ('7687972026367102226',23),('7691664974393003316',18),('7690947453008366855',18),
    ('7689791184415296776',18),('7691244733506522376',13),('7689002526007495956',13),
    ('7689406351365229842',12),('7689001700790783253',9),('7691192978131619080',9),
    ('7689001329095642389',9),('7684664501240679700',2)
) AS f(uid, v) ON f.uid = p.content_uid
WHERE p.v <> f.v
ORDER BY abs(p.v - f.v) DESC;

\echo ''
\echo '################ §CARA PAKAI UNTUK CAMPAIGN LAIN ################'
\echo ' Logikanya sama untuk semua campaign, hanya angkanya yang beda.'
\echo ' Yang perlu dijaga saat verifikasi:'
\echo '   1. views/likes  -> bandingkan PERIODE YANG SAMA'
\echo '      Kolom "Video views" = views DALAM periode laporan, bukan kumulatif.'
\echo '      File 2 bulan vs file 2 hari SELALU beda. Itu bukan bug.'
\echo '   2. jumlah video -> pakai DISTINCT content_uid. 1 video multi-produk'
\echo '      muncul beberapa kali di file, itu normal (aturan pemilik).'
\echo '   3. GMV         -> file kol 18 = video-attributed GMV saja.'
\echo '      Sistem = organic sales (termasuk refund) + ads.'
\echo '   4. video ekstra di sistem -> PIC input sebelum TikTok melapor. WAJAR.'
