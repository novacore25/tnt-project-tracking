-- =====================================================================
-- VERIFIKASI MD GLOW (campaign 54) vs FILE TIKTOK
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- FILE SUMBER:
--   "MD Glow CustomReport_Campaign_Creator_Product_Shop_Video_
--    Product Category 2026-08-01_2026-10-01.xlsx"
--   56 baris data -> 53 video unik (3 video punya 2 baris karena multi-produk)
--
-- ANGKA DARI FILE (MAX per video unik, sudah dihitung manual):
--   video unik : 53
--   views      : 8.627      (dijumlah mentah 10.234, selisih 1.607 duplikat)
--   likes      : 305
--   GMV kol 18 : 1.713.823
--   kreator    : 15,  product id : 3
--
-- ANGKA DARI SCREENSHOT SISTEM (2 Okt 2026):
--   Performa      : 7.608 views | 293 likes | "58 video unik" | Rp 2.067.111
--   Video menu    : Total Video 63 | Total Views 5.562 | Total GMV Rp 2.067.111
--   Riwayat Import: 61 diimport | 47 terkoneksi | 14 belum
--
-- PERHATIAN: 53 video unik dari file, tapi sistem bilang 58 / 61 / 63.
-- Tiga angka berbeda untuk satu hal. Script ini mencari penjelasannya.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §1. ANGKA SISTEM UNTUK CAMPAIGN 54 =###############'
SELECT c.nama, c.tipe_campaign, c.target_video,
       s.achievement_video        AS VIEW_achievement_video,
       s.total_gmv                AS TOTAL_GMV,
       s.achievement_creator      AS KREATOR_APPROVED,
       (SELECT COUNT(*) FROM skus WHERE campaign_id = 54) AS jumlah_sku,
       (SELECT COUNT(*) FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
         WHERE cc.campaign_id = 54 AND v.link_video IS NOT NULL) AS VIDEO_TABEL_link,
       (SELECT COUNT(*) FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
         WHERE cc.campaign_id = 54) AS VIDEO_TABEL_total,
       (SELECT COUNT(*) FROM organic_videos WHERE campaign_id = 54) AS ORGANIC_BARIS,
       (SELECT COUNT(DISTINCT content_uid) FROM organic_videos
         WHERE campaign_id = 54 AND content_uid IS NOT NULL) AS ORGANIC_UNIK
FROM campaigns c JOIN vw_campaign_summary s ON s.campaign_id = c.id
WHERE c.id = 54;

\echo ''
\echo '################ §2. 53 VIDEO DARI FILE - ADA DI SISTEM? ###############'
WITH file_videos(uid, v_file, l_file) AS (
    VALUES
      ('7684658722538278165'::text, 1107, 6), ('7685146224147598600', 759, 4),
      ('7686315005750332692', 681, 49), ('7686426042164104468', 637, 4),
      ('7686330014307978517', 614, 35), ('7689707548416462098', 552, 11),
      ('7690452643797372168', 513, 6),  ('7688592734596107528', 368, 8),
      ('7686390177610140949', 312, 5),  ('7690473727062035733', 207, 7),
      ('7684792722217061640', 203, 1),  ('7687110634751790354', 199, 8),
      ('7690479034853117190', 197, 6),  ('7686030156095327495', 164, 5),
      ('7690707877215866133', 161, 5),  ('7685997372714863890', 157, 2),
      ('7688964185102863634', 131, 13), ('7686115088578743559', 124, 5),
      ('7688968583426116871', 124, 2),  ('7688963915123854599', 105, 2),
      ('7688181611900177671', 90, 21),  ('7690506000931065095', 80, 18),
      ('7691580586321890578', 80, 3),   ('7688183469314215176', 73, 20),
      ('7690483418676661511', 72, 0),   ('7689579805645212946', 69, 1),
      ('7690836577903267090', 63, 6),   ('7690806181819960583', 62, 18),
      ('7688960783568342279', 59, 2),   ('7687615922575543570', 55, 4),
      ('7688182015434181896', 54, 3),   ('7690776773138648328', 51, 1),
      ('7691298651729300743', 46, 0),   ('7690839446459026706', 45, 3),
      ('7691171953830317319', 44, 4),   ('7688497084642659592', 38, 0),
      ('7690840021007420680', 38, 0),   ('7690487047554927893', 34, 1),
      ('7690954697913404679', 32, 0),   ('7690486379922377990', 30, 2),
      ('7688985307911326994', 28, 2),   ('7687589445570186503', 25, 2),
      ('7687972026367102226', 23, 3),   ('7691664974393003316', 18, 3),
      ('7690947453008366855', 18, 0),   ('7689791184415296776', 18, 1),
      ('7691244733506522376', 13, 1),   ('7689002526007495956', 13, 2),
      ('7689406351365229842', 12, 0),   ('7689001700790783253', 9, 0),
      ('7691192978131619080', 9, 0),    ('7689001329095642389', 9, 0),
      ('7684664501240679700', 2, 0)
),
sistem AS (
    SELECT content_uid,
           MAX(video_views) AS v_sistem,
           MAX(video_likes) AS l_sistem,
           MAX(COALESCE(campaign_id,0)) AS cid,
           COUNT(*) AS n_baris,
           MIN(COALESCE(content_type,'video')) AS tipe
    FROM organic_videos WHERE content_uid IS NOT NULL GROUP BY content_uid
)
SELECT
  CASE WHEN s.content_uid IS NULL THEN 'TIDAK ADA DI ORGANIC_VIDEOS'
       WHEN EXISTS (SELECT 1 FROM videos v WHERE v.content_uid = f.uid) THEN 'ada di tabel videos'
       ELSE 'hanya di organic_videos' END                     AS status,
  COUNT(*)                                                   AS jumlah,
  COALESCE(SUM(f.v_file),0)                                  AS views_file,
  COALESCE(SUM(s.v_sistem),0)                                AS views_sistem,
  COALESCE(SUM(f.v_file),0) - COALESCE(SUM(s.v_sistem),0)    AS selisih_views,
  COALESCE(SUM(f.l_file),0)                                  AS likes_file,
  COALESCE(SUM(s.l_sistem),0)                                AS likes_sistem
FROM file_videos f LEFT JOIN sistem s ON s.content_uid = f.uid
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '################ §3. RINGKASAN PERBANDINGAN =###############'
WITH file_videos(uid, v_file, l_file) AS (
    VALUES
      ('7684658722538278165'::text, 1107, 6), ('7685146224147598600', 759, 4),
      ('7686315005750332692', 681, 49), ('7686426042164104468', 637, 4),
      ('7686330014307978517', 614, 35), ('7689707548416462098', 552, 11),
      ('7690452643797372168', 513, 6),  ('7688592734596107528', 368, 8),
      ('7686390177610140949', 312, 5),  ('7690473727062035733', 207, 7),
      ('7684792722217061640', 203, 1),  ('7687110634751790354', 199, 8),
      ('7690479034853117190', 197, 6),  ('7686030156095327495', 164, 5),
      ('7690707877215866133', 161, 5),  ('7685997372714863890', 157, 2),
      ('7688964185102863634', 131, 13), ('7686115088578743559', 124, 5),
      ('7688968583426116871', 124, 2),  ('7688963915123854599', 105, 2),
      ('7688181611900177671', 90, 21),  ('7690506000931065095', 80, 18),
      ('7691580586321890578', 80, 3),   ('7688183469314215176', 73, 20),
      ('7690483418676661511', 72, 0),   ('7689579805645212946', 69, 1),
      ('7690836577903267090', 63, 6),   ('7690806181819960583', 62, 18),
      ('7688960783568342279', 59, 2),   ('7687615922575543570', 55, 4),
      ('7688182015434181896', 54, 3),   ('7690776773138648328', 51, 1),
      ('7691298651729300743', 46, 0),   ('7690839446459026706', 45, 3),
      ('7691171953830317319', 44, 4),   ('7688497084642659592', 38, 0),
      ('7690840021007420680', 38, 0),   ('7690487047554927893', 34, 1),
      ('7690954697913404679', 32, 0),   ('7690486379922377990', 30, 2),
      ('7688985307911326994', 28, 2),   ('7687589445570186503', 25, 2),
      ('7687972026367102226', 23, 3),   ('7691664974393003316', 18, 3),
      ('7690947453008366855', 18, 0),   ('7689791184415296776', 18, 1),
      ('7691244733506522376', 13, 1),   ('7689002526007495956', 13, 2),
      ('7689406351365229842', 12, 0),   ('7689001700790783253', 9, 0),
      ('7691192978131619080', 9, 0),    ('7689001329095642389', 9, 0),
      ('7684664501240679700', 2, 0)
),
sistem AS (
    SELECT content_uid, MAX(video_views) AS v_sistem, MAX(video_likes) AS l_sistem
    FROM organic_videos WHERE content_uid IS NOT NULL GROUP BY content_uid
)
SELECT
  (SELECT COUNT(*) FROM file_videos)                                    AS file_video_unik,
  (SELECT COUNT(*) FROM file_videos f JOIN sistem s USING (content_uid)) AS ADA_di_sistem,
  (SELECT COUNT(*) FROM file_videos f LEFT JOIN sistem s USING (content_uid)
     WHERE s.content_uid IS NULL)                                      AS HILANG,
  (SELECT COALESCE(SUM(v_file),0) FROM file_videos)                    AS views_file,
  (SELECT COALESCE(SUM(s.v_sistem),0) FROM file_videos f
     JOIN sistem s USING (content_uid))                                AS views_sistem_53,
  (SELECT COALESCE(SUM(l_file),0) FROM file_videos)                    AS likes_file,
  (SELECT COALESCE(SUM(s.l_sistem),0) FROM file_videos f
     JOIN sistem s USING (content_uid))                                AS likes_sistem_53,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE campaign_id = 54) AS gmv_sistem,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE campaign_id = 54 AND is_refund IS TRUE)                     AS refund_sistem,
  1713823                                                              AS gmv_file_kol18;

\echo ''
\echo '################ §4. VIDEO DI SISTEM YANG TIDAK ADA DI FILE ###############'
-- Sistem bilang 58/61/63, file cuma 53. Sisanya dari mana?
WITH file_videos(uid) AS (
    VALUES ('7684658722538278165'::text),('7685146224147598600'),('7686315005750332692'),
      ('7686426042164104468'),('7686330014307978517'),('7689707548416462098'),
      ('7690452643797372168'),('7688592734596107528'),('7686390177610140949'),
      ('7690473727062035733'),('7684792722217061640'),('7687110634751790354'),
      ('7690479034853117190'),('7686030156095327495'),('7690707877215866133'),
      ('7685997372714863890'),('7688964185102863634'),('7686115088578743559'),
      ('7688968583426116871'),('7688963915123854599'),('7688181611900177671'),
      ('7690506000931065095'),('7691580586321890578'),('7688183469314215176'),
      ('7690483418676661511'),('7689579805645212946'),('7690836577903267090'),
      ('7690806181819960583'),('7688960783568342279'),('7687615922575543570'),
      ('7688182015434181896'),('7690776773138648328'),('7691298651729300743'),
      ('7690839446459026706'),('7691171953830317319'),('7688497084642659592'),
      ('7690840021007420680'),('7690487047554927893'),('7690954697913404679'),
      ('7690486379922377990'),('7688985307911326994'),('7687589445570186503'),
      ('7687972026367102226'),('7691664974393003316'),('7690947453008366855'),
      ('7689791184415296776'),('7691244733506522376'),('7689002526007495956'),
      ('7689406351365229842'),('7689001700790783253'),('7691192978131619080'),
      ('7689001329095642389'),('7684664501240679700')
)
SELECT v.id, c.username, v.content_uid,
       MAX(COALESCE(ov.video_views,0))  AS views,
       MIN(COALESCE(ov.content_type,'-')) AS tipe_organic,
       v.link_video
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
JOIN creators c ON c.id = cc.creator_id
LEFT JOIN organic_videos ov ON ov.content_uid = v.content_uid
WHERE cc.campaign_id = 54
  AND v.content_uid IS NOT NULL
  AND v.content_uid NOT IN (SELECT uid FROM file_videos)
GROUP BY 1,2,3,6
ORDER BY 1;

\echo ''
\echo '################ §5. PERIODE FILE vs DATA SISTEM ###############'
-- File: 2026-08-01 s.d. 2026-10-01. Sistem mungkin lebih lama/lebih baru.
SELECT MIN(tanggal) AS tanggal_awal, MAX(tanggal) AS tanggal_akhir,
       COUNT(DISTINCT tanggal) AS hari, COUNT(*) AS baris_sales
FROM sales WHERE campaign_id = 54;
SELECT MIN(post_time) AS post_awal, MAX(post_time) AS post_akhir
FROM organic_videos WHERE campaign_id = 54;
SELECT start_date, end_date, status FROM campaigns WHERE id = 54;

\echo ''
\echo '################ §6. TANGGAL DI FILE vs TANGGAL DI SISTEM ###############'
-- Kolom 1 "Date" dan kolom 15 "Post time". Kalau "Date" = tanggal snapshot
-- dan "Post time" = tanggal upload, keduanya perlu dicek: sistem pakai mana?
SELECT MIN(COALESCE(post_time::date, created_at::date)) AS tanggal_awal_sistem,
       MAX(COALESCE(post_time::date, created_at::date)) AS tanggal_akhir_sistem
FROM organic_videos WHERE campaign_id = 54;
