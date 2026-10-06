-- =====================================================================
-- Audit final: akurasi pembacaan data per campaign (6 Okt 2026)
--
-- User: "logikanya udah paham, cuman cara membaca datanya di tiap
-- campaign yang harus akurat, jangan sampe menghitung campaign lain"
--
-- ATURAN USER (dipakai sebagai definisi BAKU):
--   room + product_id = acuan. Sebuah room dihitung untuk campaign X
--   HANYA kalau produknya terdaftar di campaign X.
--   "1 live room itu banyak produk di banyak campaign ... jadi
--    livestream room id dan product id jadi acuan untuk menghitung
--    sesi live di campaign tersebut"
--
-- FAKTA PENTING (terbukti dari file Excel owner):
--   Satu creator = satu live room panjang (Creator Fest 2026), dan di
--   dalamnya dia jualan produk dari ~10 shop berbeda. TikTok menulis
--   SATU BARIS per (room x produk x campaign).
--
--   Contoh nyata dari file "1 APRIL - 31 AGUSTUS LIVE":
--     room 7645577769421867783 (creator mamizain.homedecor) muncul di
--     10 campaign: SORAE / MS GLOW / CRYSTAL GLOW / PWS / KIME /
--     KYMMSKIN / PRATISUN / BEAUTY OF ANGEL / USMILE / SYB
--     dengan produk yang berbeda-beda tiap baris.
--
--   Karena itu 62.876 baris organic_videos hanya berisi 42.586 uid.
--   itu BUKAN bug - itu format laporan TikTok.
--
-- HASIL VERIFIKASI:
--   44 campaign aktif
--     live  43/44 identik antara "by campaign_id" dan "by product_id"
--     video 43/44 identik
--     definisi longgar (videoActions) 44/44 identik -> tidak ada bleed
--
--   YANG BEDA HANYA: campaign 38 (PWS)
--     live   677 (campaign_id) vs 676 (product_id)   -1
--     video 8.125 (campaign_id) vs 8.037 (product_id) -88
--     >> PWS punya produk yang belum terdaftar di Master Produk-nya
--
--   SYB (46): identik di semua definisi. Angkanya akurat.
--
--   649 baris punya campaign_id tapi product_id TIDAK terdaftar
--   (8 campaign: SKINMOLOGY 246, PWS 241, OMG Skincare 70,
--    ISWHITE 69, OMG Makeup 14, NAISDAY 5, Garnier 3, Pojok 1)
--
-- File ini READ-ONLY. Tidak ada UPDATE/DELETE.
-- =====================================================================

\pset pager off
\pset footer off

CREATE TEMP VIEW chk AS
SELECT c.id, c.nama,
  (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
    WHERE o.campaign_id=c.id AND lower(o.content_type)='livestream') AS A_live,
  (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
    WHERE o.campaign_id=c.id AND lower(o.content_type)='video') AS A_video,
  (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
    JOIN skus sk ON sk.product_id=o.product_id AND sk.campaign_id=c.id
    WHERE lower(o.content_type)='livestream') AS B_live,
  (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
    JOIN skus sk ON sk.product_id=o.product_id AND sk.campaign_id=c.id
    WHERE lower(o.content_type)='video') AS B_video,
  (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
    WHERE (o.campaign_id=c.id OR (o.product_id IS NOT NULL AND o.product_id IN
           (SELECT product_id FROM skus WHERE campaign_id=c.id AND product_id IS NOT NULL)))
      AND lower(o.content_type)='livestream') AS C_live
FROM campaigns c WHERE c.status='aktif';

\echo '=== 1. berapa campaign yang definisinya beda ==='
SELECT count(*) AS total_campaign,
       count(*) FILTER (WHERE A_live  = B_live)  AS live_cocok,
       count(*) FILTER (WHERE A_live  <> B_live) AS live_BEDA,
       count(*) FILTER (WHERE A_video = B_video) AS video_cocok,
       count(*) FILTER (WHERE A_video <> B_video) AS video_BEDA,
       count(*) FILTER (WHERE A_live  = C_live)  AS longgar_cocok,
       count(*) FILTER (WHERE A_live  <> C_live) AS longgar_BEDA
FROM chk;

\echo ''
\echo '=== 2. campaign yang definisinya beda ==='
SELECT id, nama, A_live, B_live, C_live, A_video, B_video
FROM chk WHERE A_live<>B_live OR A_video<>B_video OR A_live<>C_live
ORDER BY 1;

\echo ''
\echo '=== 3. baris yang campaign_id-nya tapi produknya tidak terdaftar ==='
SELECT count(*) AS baris, count(DISTINCT o.campaign_id) AS campaign
FROM organic_videos o
WHERE o.campaign_id IS NOT NULL
  AND (o.product_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM skus sk WHERE sk.campaign_id=o.campaign_id AND sk.product_id=o.product_id));

\echo ''
\echo '=== 4. rincian per campaign ==='
SELECT o.campaign_id, c.nama, count(*) AS baris, count(DISTINCT o.product_id) AS produk_asing
FROM organic_videos o JOIN campaigns c ON c.id=o.campaign_id
WHERE o.campaign_id IS NOT NULL
  AND (o.product_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM skus sk WHERE sk.campaign_id=o.campaign_id AND sk.product_id=o.product_id))
GROUP BY 1,2 ORDER BY 3 DESC;

\echo ''
\echo '=== 5. SYB harusnya identik di semua kolom ==='
SELECT id, nama, A_live, B_live, C_live, A_video, B_video
FROM chk WHERE id=46;

\echo ''
\echo '=== 6. views: MAX (benar) atau SUM (salah)? ==='
\echo '--- satu room punya banyak baris produk, views-nya diulang tiap baris ---'
WITH per AS (
  SELECT content_uid, count(*) AS n_baris,
         sum(COALESCE(video_views,0)) AS sum_views,
         max(COALESCE(video_views,0)) AS max_views
  FROM organic_videos WHERE campaign_id=46 AND lower(content_type)='livestream'
  GROUP BY content_uid
)
SELECT count(*) AS room, sum(n_baris) AS baris,
       sum(sum_views) AS JIKA_dijumlah, sum(max_views) AS JIKA_max,
       round(100.0*(sum(sum_views)-sum(max_views))/nullif(sum(max_views),0),1) AS pct_lebih
FROM per;

\echo ''
\echo '--- contoh room dengan banyak produk ---'
SELECT content_uid, count(*) AS baris,
       sum(COALESCE(video_views,0)) AS sum_views, max(COALESCE(video_views,0)) AS max_views
FROM organic_videos WHERE campaign_id=46 AND lower(content_type)='livestream'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;