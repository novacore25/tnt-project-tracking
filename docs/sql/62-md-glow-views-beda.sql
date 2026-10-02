-- =====================================================================
-- MD GLOW: VIDEO MANA YANG VIEWS-NYA BEDA DARI FILE TIKTOK?
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- HASIL YANG SUDAH DIKETAHUI (docs/sql/61):
--   File TikTok : 53 video unik, 8.627 views, 305 likes  (MAX per video)
--   organic_videos campaign 54 : 53 unik  <- COCOK
--   Tabel videos : 62 (53 + 5 yang belum ada di TikTok, 0 views)
--   Performa UI  : 7.608 views  -> 1.019 LEBIH RENDAH dari file
--   5 video ekstra itu WAJAR (PIC input sebelum data TikTok masuk)
--
-- PERTANYAAN: 1.019 views itu hilang dari video yang mana, dan kenapa.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

-- 53 video dari file, beserta views/likes file-nya
CREATE TEMP TABLE file_videos(uid text, v_file bigint, l_file bigint, dibuat_ke int);

\echo ''
\echo '=== MEMASUKKAN 53 VIDEO DARI FILE ==='
INSERT INTO file_videos VALUES
 ('7684658722538278165',1107,6,1), ('7685146224147598600',759,4,1),
 ('7686315005750332692',681,49,1),  ('7686426042164104468',637,4,1),
 ('7686330014307978517',614,35,1),  ('7689707548416462098',552,11,1),
 ('7690452643797372168',513,6,1),   ('7688592734596107528',368,8,1),
 ('7686390177610140949',312,5,1),   ('7690473727062035733',207,7,1),
 ('7684792722217061640',203,1,1),   ('7687110634751790354',199,8,1),
 ('7690479034853117190',197,6,1),   ('7686030156095327495',164,5,1),
 ('7690707877215866133',161,5,1),   ('7685997372714863890',157,2,1),
 ('7688964185102863634',131,13,1),  ('7686115088578743559',124,5,1),
 ('7688968583426116871',124,2,1),   ('7688963915123854599',105,2,1),
 ('7688181611900177671',90,21,1),   ('7690506000931065095',80,18,1),
 ('7691580586321890578',80,3,1),    ('7688183469314215176',73,20,1),
 ('7690483418676661511',72,0,1),    ('7689579805645212946',69,1,1),
 ('7690836577903267090',63,6,1),    ('7690806181819960583',62,18,1),
 ('7688960783568342279',59,2,1),    ('7687615922575543570',55,4,1),
 ('7688182015434181896',54,3,1),    ('7690776773138648328',51,1,1),
 ('7691298651729300743',46,0,1),    ('7690839446459026706',45,3,1),
 ('7691171953830317319',44,4,1),    ('7688497084642659592',38,0,1),
 ('7690840021007420680',38,0,1),    ('7690487047554927893',34,1,1),
 ('7690954697913404679',32,0,1),    ('7690486379922377990',30,2,1),
 ('7688985307911326994',28,2,1),    ('7687589445570186503',25,2,1),
 ('7687972026367102226',23,3,1),    ('7691664974393003316',18,3,1),
 ('7690947453008366855',18,0,1),    ('7689791184415296776',18,1,1),
 ('7691244733506522376',13,1,1),    ('7689002526007495956',13,2,1),
 ('7689406351365229842',12,0,1),    ('7689001700790783253',9,0,1),
 ('7691192978131619080',9,0,1),     ('7689001329095642389',9,0,1),
 ('7684664501240679700',2,0,1);
SELECT count(*) AS video_dimasukkan FROM file_videos;

\echo ''
\echo '################ §1. RINGKASAN PERBANDINGAN ################'
SELECT
  (SELECT COUNT(*) FROM file_videos)                                    AS file_video,
  (SELECT COALESCE(SUM(v_file),0) FROM file_videos)                    AS views_file,
  (SELECT COALESCE(SUM(l_file),0) FROM file_videos)                    AS likes_file,
  -- sistem: MAX per uid dari organic_videos (tanpa filter campaign)
  (SELECT COALESCE(SUM(ov.v),0) FROM file_videos f
     JOIN LATERAL (SELECT MAX(o.video_views) AS v FROM organic_videos o
                     WHERE o.content_uid = f.uid) ov ON true)          AS views_sistem_semua,
  -- sistem dengan filter campaign 54 saja
  (SELECT COALESCE(SUM(ov.v),0) FROM file_videos f
     JOIN LATERAL (SELECT MAX(o.video_views) AS v FROM organic_videos o
                     WHERE o.content_uid = f.uid AND o.campaign_id = 54) ov ON true)
                                                                          AS views_sistem_campaign54,
  -- sistem dengan filter campaign 54 DAN product_id terdaftar
  (SELECT COALESCE(SUM(ov.v),0) FROM file_videos f
     JOIN LATERAL (SELECT MAX(o.video_views) AS v FROM organic_videos o
                     WHERE o.content_uid = f.uid AND o.campaign_id = 54
                       AND o.product_id IN (SELECT product_id FROM skus WHERE campaign_id = 54))
                   ov ON true)                                          AS views_sistem_sku;

\echo ''
\echo '################ §2. VIDEO YANG VIEWS-NYA BEDA ################'
SELECT f.uid, f.v_file AS views_file, ov.v AS views_sistem,
       f.v_file - COALESCE(ov.v,0) AS selisih,
       f.l_file AS likes_file, ov.l AS likes_sistem,
       ov.n_baris, ov.n_produk, ov.pids, ov.tipe, ov.cids, ov.post
FROM file_videos f
LEFT JOIN LATERAL (
    SELECT MAX(o.video_views)  AS v,
           MAX(o.video_likes)  AS l,
           COUNT(*)            AS n_baris,
           COUNT(DISTINCT o.product_id) AS n_produk,
           string_agg(DISTINCT COALESCE(o.product_id,'(null)'), ' | ') AS pids,
           string_agg(DISTINCT COALESCE(o.content_type,'-'), ' | ') AS tipe,
           string_agg(DISTINCT COALESCE(o.campaign_id::text,'NULL'), ' | ') AS cids,
           MIN(o.post_time)    AS post
    FROM organic_videos o WHERE o.content_uid = f.uid
) ov ON true
WHERE COALESCE(ov.v,0) <> f.v_file
ORDER BY abs(f.v_file - COALESCE(ov.v,0)) DESC;

\echo ''
\echo '################ §3. POLA: APAKAH SELISIHNYA TERATUR? ################'
-- Kalau semua video sebelum tanggal tertentu lebih rendah, berarti
-- organic_videos diimpor dari LAPORAN YANG LEBIH LAMA.
SELECT
  CASE WHEN selisih = 0 THEN 'sama' ELSE 'beda' END AS status,
  COUNT(*)                                                AS jumlah,
  COALESCE(SUM(selisih),0)                              AS total_selisih
FROM (
  SELECT f.uid, f.v_file - COALESCE((SELECT MAX(o.video_views) FROM organic_videos o
                                      WHERE o.content_uid = f.uid),0) AS selisih
  FROM file_videos f
) z
GROUP BY 1;

\echo ''
\echo '-- Hubungkan selisih dengan tanggal post video'
SELECT
  CASE WHEN selisih = 0 THEN 'sama' ELSE 'beda' END AS status,
  MIN(post)::date  AS post_terlama,
  MAX(post)::date  AS post_terbaru,
  COUNT(*)         AS jumlah,
  COALESCE(SUM(selisih),0) AS total_selisih
FROM (
  SELECT f.uid, f.v_file - COALESCE((SELECT MAX(o.video_views) FROM organic_videos o
                                      WHERE o.content_uid = f.uid),0) AS selisih,
         (SELECT MIN(o.post_time) FROM organic_videos o
           WHERE o.content_uid = f.uid) AS post
  FROM file_videos f
) z
GROUP BY 1;

\echo ''
\echo '################ §4. CEK PRODUCT_ID DI ORGANIC_VIDEOS ################'
-- File punya 3 product ID. Kalau organic_videos punya product_id lain,
-- import mungkin tidak masuk semua baris.
SELECT o.product_id, COUNT(*) AS baris, COUNT(DISTINCT o.content_uid) AS unik,
       SUM(o.video_views::numeric) AS views
FROM organic_videos o
WHERE o.campaign_id = 54
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '-- SKU terdaftar campaign 54'
SELECT id, product_id, nama_produk FROM skus WHERE campaign_id = 54;

\echo ''
\echo '################ §5. KAPAN organic_videos DI-UPDATE TERAKHIR? ################'
SELECT MAX(created_at) AS dibuat_terakhir,
       MAX(post_time)  AS post_terakhir,
       COUNT(*)        AS baris
FROM organic_videos WHERE campaign_id = 54;

\echo ''
\echo '################ §6. CEK KOLOM "Date" DI FILE ################'
-- Kolom 1 = "Date" (tanggal snapshot laporan), kolom 2 = "Comparison date".
-- Kalau organic_videos diimpor dari laporan lebih lama, views-nya lebih kecil.
-- Cek apakah ada tanda laporan lama di raw_data.
SELECT content_uid,
       raw_data ->> 'Date'            AS date_file,
       raw_data ->> 'Comparison date'  AS comparison_date,
       raw_data ->> 'Video views'     AS views_file_raw,
       video_views                    AS views_sistem
FROM organic_videos
WHERE campaign_id = 54
  AND content_uid IN (SELECT uid FROM file_videos)
  AND COALESCE((SELECT v_file FROM file_videos f WHERE f.uid = organic_videos.content_uid),0)
      <> video_views
ORDER BY 3 DESC NULLS LAST
LIMIT 20;
