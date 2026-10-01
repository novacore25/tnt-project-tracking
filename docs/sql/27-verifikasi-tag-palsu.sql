-- =====================================================================
-- 27 - VERIFIKASI terakhir sebelum migration
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT. Tidak mengubah data apa pun.
--
-- Jalankan:
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/27-verifikasi-tag-palsu.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
--
-- CATATAN JALUR: pakai commit SHA, bukan "main".
-- Cache di jalur VPS mengabaikan query string pada path "main".
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. YANG DIJAGA APA SAJA (12 video dengan tag terbanyak) ==='
-- Kalau campaign_resolusi cuma punya 1 campaign dan produknya semua milik
-- campaign itu, maka setiap video Excess.video dihapus dengan benar.
CREATE TEMP TABLE _g AS
SELECT content_uid FROM organic_videos
GROUP BY content_uid HAVING count(DISTINCT product_id) > 20;

CREATE TEMP TABLE _vc AS
SELECT content_uid, min(campaign_id) AS kc
FROM (
  SELECT DISTINCT ov.content_uid, c.id AS campaign_id
  FROM organic_videos ov
  JOIN _g g ON g.content_uid = ov.content_uid
  JOIN campaigns c ON ov.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE ov.tiktok_campaign_id IS NOT NULL AND ov.tiktok_campaign_id <> ''
) x
GROUP BY content_uid
HAVING count(DISTINCT campaign_id) = 1;

SELECT vc.content_uid,
       cp.nama                                          AS campaign_resolusi,
       count(*)                                         AS produk_ditahan,
       string_agg(DISTINCT ov.product_id, ',')          AS product_ids
FROM _vc vc
JOIN campaigns cp ON cp.id = vc.kc
JOIN organic_videos ov ON ov.content_uid = vc.content_uid AND ov.campaign_id = vc.kc
GROUP BY vc.content_uid, cp.nama
ORDER BY count(*) DESC, vc.content_uid
LIMIT 12;

\echo ''
\echo '=== 2. SANITY: semua produk yang disimpan, PRODUCT-nya milik campaign itu? ==='
-- Kalau hasilnya 0 baris, semua tag yang dipertahankan benar 100%.
SELECT count(*) AS produk_ditahan_yang_salah_campaign
FROM _vc vc
JOIN organic_videos ov ON ov.content_uid = vc.content_uid AND ov.campaign_id = vc.kc
WHERE NOT EXISTS (SELECT 1 FROM skus s WHERE s.product_id = ov.product_id AND s.campaign_id = vc.kc);

\echo ''
\echo '=== 3. APAKAH TIAP VIDEO MASIH PUNYA >= 1 BARIS SETELAH BERSIH? ==='
SELECT count(*) AS video_yang_akan_hilang_total
FROM _vc vc
WHERE NOT EXISTS (
  SELECT 1 FROM organic_videos ov
  WHERE ov.content_uid = vc.content_uid
    AND (ov.campaign_id = vc.kc
         OR EXISTS (SELECT 1 FROM sales sl WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id))
);

\echo ''
\echo '=== 4. VIDEO YANG MASIH SISA BANYAK PRODUCT (perlu mata) ==='
-- Lanjutan dari dry run 25 section 6: ada 1 video sisa 20 product,
-- 2 video sisa 9 sampai 10 product, sisanya sudah 1 sampai 7.
SELECT vc.content_uid, cp.nama AS campaign_resolusi,
       count(*) AS produk_ditahan,
       count(DISTINCT s.id) AS skunya_beneran_ada_di_campaign,
       string_agg(DISTINCT ov.creator_username, ', ') AS kreator
FROM _vc vc
JOIN campaigns cp ON cp.id = vc.kc
JOIN organic_videos ov ON ov.content_uid = vc.content_uid AND ov.campaign_id = vc.kc
LEFT JOIN skus s ON s.product_id = ov.product_id AND s.campaign_id = vc.kc
GROUP BY vc.content_uid, cp.nama
HAVING count(*) > 7
ORDER BY count(*) DESC LIMIT 15;

\echo ''
\echo '=== 5. DAMPAK KE DASHBOARD: video & views per campaign SEBELUM vs SESUDAH ==='
-- Ini yang paling penting. Kalau jumlah video sebuah campaign anjlok drastis
-- padahal tidak ada order yang hilang, berarti ada salah tag di campaign itu.
CREATE TEMP TABLE _lanjut AS
SELECT ov.content_uid, ov.campaign_id, ov.creator_username, ov.video_views
FROM organic_videos ov
JOIN _vc vc ON vc.content_uid = ov.content_uid
WHERE ov.campaign_id = vc.kc
   OR EXISTS (SELECT 1 FROM sales sl WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id);

SELECT c.id, c.nama,
       (SELECT count(DISTINCT ov.content_uid) FROM organic_videos ov WHERE ov.campaign_id = c.id)     AS video_sebelum,
       (SELECT count(DISTINCT l.content_uid) FROM _lanjut l WHERE l.campaign_id = c.id)               AS video_sesudah,
       (SELECT COALESCE(sum(ov.video_views),0) FROM organic_videos ov WHERE ov.campaign_id = c.id)    AS views_sebelum,
       (SELECT COALESCE(sum(l.video_views),0) FROM _lanjut l WHERE l.campaign_id = c.id)              AS views_sesudah,
       (SELECT COALESCE(sum(sl.gmv),0) FROM sales sl WHERE sl.campaign_id = c.id AND NOT sl.is_refund) AS gmv_dari_sales
FROM campaigns c
WHERE (SELECT count(DISTINCT ov.content_uid) FROM organic_videos ov WHERE ov.campaign_id = c.id) > 0
ORDER BY video_sebelum DESC NULLS LAST LIMIT 30;

\echo ''
\echo '=== 6. TOTAL SELURUH TABEL (harus tetap sama setelah migration) ==='
SELECT
  (SELECT count(*) FROM organic_videos) AS total_baris,
  (SELECT count(DISTINCT content_uid) FROM organic_videos) AS video_unik,
  (SELECT COALESCE(sum(video_views),0) FROM organic_videos) AS views_per_baris,
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(video_views) mx FROM organic_videos GROUP BY content_uid) t) AS views_per_video,
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(video_likes) mx FROM organic_videos GROUP BY content_uid) u) AS likes_per_video;
