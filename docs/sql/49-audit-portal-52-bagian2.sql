-- =====================================================================
-- AUDIT PORTAL BRAND - BAGIAN 2 (menutup semua pertanyaan yang tersisa)
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- Bagian 1 (docs/sql/48) memakai nama view yang salah (`total_gmv`).
-- Nama view sebenarnya adalah `vw_campaign_summary`, dan `total_gmv`
-- itu NAMA KOLOM di dalamnya. Script ini memakai nama yang benar.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §12. VIEW vw_campaign_summary UNTUK CAMPAIGN 52 ################'
SELECT campaign_id, nama, status, target_gmv,
       total_organic_gmv, total_gmv, total_gmv_video, total_gmv_live,
       total_ads_gmv_idr, total_ads_cost_idr, total_creator_approved,
       total_video_tayang
FROM vw_campaign_summary WHERE campaign_id = 52;

\echo ''
\echo '################ §13. APAKAH GMV REFUND POSITIF ATAU NEGATIF? ################'
-- Tentukan ini, karena menentukan apakah portal LEBIH BESAR atau lebih kecil.
SELECT tanggal, creator_username, content_type, gmv::numeric AS gmv,
       quantity, is_refund
FROM sales WHERE campaign_id = 52 AND is_refund IS TRUE ORDER BY gmv;

\echo '-- rekap: tanda nilai refund di SELURUH database, bukan cuma campaign 52'
SELECT COUNT(*) AS baris_refund,
       COUNT(*) FILTER (WHERE gmv > 0) AS gmv_positif,
       COUNT(*) FILTER (WHERE gmv < 0) AS gmv_negatif,
       COUNT(*) FILTER (WHERE gmv = 0) AS gmv_nol,
       COALESCE(SUM(gmv::numeric) FILTER (WHERE gmv > 0),0) AS sum_positif,
       COALESCE(SUM(gmv::numeric) FILTER (WHERE gmv < 0),0) AS sum_negatif
FROM sales WHERE is_refund IS TRUE;

\echo ''
\echo '################ §14. SELISIH FINAL: PORTAL vs INTERNAL vs VIEW ################'
WITH portal AS (
  SELECT COALESCE(SUM(gmv::numeric),0) AS v
  FROM sales s
  WHERE s.campaign_id = 52
    AND LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (
      SELECT DISTINCT LOWER(BTRIM(COALESCE(c.username,'')))
      FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = 52 AND cc.approval IN ('approved','alternate'))
),
internal AS (SELECT total_gmv AS v FROM vw_campaign_summary WHERE campaign_id = 52)
SELECT
  (SELECT v FROM portal)                                          AS organic_portal,
  (SELECT total_organic_gmv FROM vw_campaign_summary WHERE campaign_id=52) AS organic_view,
  (SELECT v FROM portal) - (SELECT v FROM internal)                AS selisih_portal_vs_view,
  ROUND(100.0 * ((SELECT v FROM portal) - (SELECT v FROM internal))
        / NULLIF((SELECT v FROM internal),0), 2)                  AS selisih_persen,
  (SELECT v FROM portal) = (SELECT v FROM internal)                AS sama_saat_ini;

\echo ''
\echo '################ §15. DATA KORUP: LIKES > VIEWS ################'
SELECT campaign_id, content_type,
       COUNT(*) AS baris,
       SUM(COALESCE(video_views,0)) AS views,
       SUM(COALESCE(video_likes,0)) AS likes,
       SUM(COALESCE(video_likes,0)) - SUM(COALESCE(video_views,0)) AS kelebihan
FROM organic_videos
WHERE COALESCE(video_likes,0) > COALESCE(video_views,0)
GROUP BY 1,2 ORDER BY kelebihan DESC LIMIT 20;

\echo '-- 15 baris terparah di campaign 52'
SELECT content_uid, content_type, video_views, video_likes, creator_username, post_time
FROM organic_videos
WHERE campaign_id = 52 AND COALESCE(video_likes,0) > COALESCE(video_views,0)
ORDER BY (COALESCE(video_likes,0) - COALESCE(video_views,0)) DESC LIMIT 15;

\echo ''
\echo '################ §16. JUMLAH VIDEO: PORTAAL vs INTERNAL (per campaign utama) ################'
-- Portal  : hanya organic unik.
-- Internal: organic unik + video manual dari tabel `videos` (approved).
-- Kita hitung keduanya untuk 10 campaign dengan sales terbesar.
WITH sk AS (
  SELECT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
  FROM skus WHERE COALESCE(BTRIM(product_id),'') <> '' GROUP BY 1,2
),
org AS (
  SELECT ov.campaign_id, COUNT(DISTINCT ov.content_uid) AS n
  FROM organic_videos ov
  WHERE ov.content_uid IS NOT NULL
    AND LOWER(COALESCE(ov.content_type,'video')) NOT IN ('livestream','live')
    AND EXISTS (SELECT 1 FROM sk WHERE sk.campaign_id = ov.campaign_id
                AND sk.pid = BTRIM(COALESCE(ov.product_id,'')))
  GROUP BY 1
),
man AS (
  SELECT cc.campaign_id, COUNT(*) AS n,
         COUNT(DISTINCT v.content_uid) AS n_uid
  FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
  WHERE cc.approval IN ('approved','alternate') AND v.content_uid IS NOT NULL
  GROUP BY 1
)
SELECT c.id, c.nama,
       COALESCE(org.n,0) AS portal_video,
       COALESCE(org.n,0) + COALESCE(man.n,0) AS internal_video_perkiraan,
       COALESCE(man.n,0) AS video_manual,
       COALESCE(man.n,0) - COALESCE(man.n_uid,0) AS manual_uid_ganda
FROM campaigns c
LEFT JOIN org ON org.campaign_id = c.id
LEFT JOIN man ON man.campaign_id = c.id
WHERE c.id IN (SELECT campaign_id FROM sales GROUP BY 1 ORDER BY SUM(gmv::numeric) DESC LIMIT 10)
ORDER BY c.id;

\echo ''
\echo '################ §17. KAMPAIGN YANG PUNYA DATA ADS ################'
-- Temuan soal ads hanya relevan untuk campaign yang punya ads_performance.
SELECT ap.campaign_id, c.nama,
       COUNT(*) AS baris_ads,
       COUNT(DISTINCT ad_id) AS ad_unik,
       MAX(ap.tanggal) AS laporan_terakhir
FROM ads_performance ap LEFT JOIN campaigns c ON c.id = ap.campaign_id
GROUP BY 1,2 ORDER BY 3 DESC;

\echo '-- campaign yang punya sales tapi TIDAK punya ads'
SELECT c.id, c.nama, COUNT(s.*) AS baris_sales
FROM campaigns c JOIN sales s ON s.campaign_id = c.id
LEFT JOIN (SELECT DISTINCT campaign_id FROM ads_performance) a ON a.campaign_id = c.id
WHERE a.campaign_id IS NULL
GROUP BY 1,2 ORDER BY 3 DESC;

\echo ''
\echo '################ §18. STATUS CREATOR DI SELURUH DB ################'
SELECT approval, COUNT(*) AS baris,
       COUNT(DISTINCT campaign_id) AS campaign_terpengaruh
FROM campaign_creators GROUP BY 1 ORDER BY 2 DESC;

\echo '-- campaign yang punya `not_approved` (tidak tampil di internal, tapi tampil di portal)'
SELECT cc.campaign_id, c.nama, COUNT(*) AS baris_not_approved
FROM campaign_creators cc JOIN campaigns c ON c.id = cc.campaign_id
WHERE cc.approval = 'not_approved'
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;

\echo ''
\echo '################ §19. PIN DEFAULT DI SELURUH DB ################'
SELECT CASE WHEN pin IS NULL OR pin = '' THEN '(kosong)'
            WHEN pin = '1234' THEN 'DEFAULT 1234'
            ELSE 'kustom' END AS jenis_pin,
       COUNT(*) AS campaign,
       string_agg(id::text || ' ' || nama, ', ' ORDER BY id) AS daftar
FROM campaigns GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '################ §20. TARGET GMV KOSONG ################'
SELECT COUNT(*) AS total_campaign,
       COUNT(*) FILTER (WHERE target_gmv IS NULL OR target_gmv = 0) AS target_kosong,
       COUNT(*) FILTER (WHERE require_client_approval IS TRUE) AS perlu_approval_client
FROM campaigns;

\echo '-- campaign aktif tanpa target (persentase selalu 0 di portal)'
SELECT id, nama, status, require_client_approval
FROM campaigns
WHERE (target_gmv IS NULL OR target_gmv = 0) AND status = 'aktif'
ORDER BY id;

\echo ''
\echo '################ §21. TT_CAMPAIGN_ID = KOLOM APA? ################'
-- Portal memakai `tt_campaign_id = '52'`. Kalau kolomnya berisi id internal,
-- cabang itu tidak pernah kena untuk campaign mana pun. Perlu dipastikan.
SELECT tt_campaign_id, COUNT(*) AS session,
       MIN(start_time) AS pertama, MAX(start_time) AS terakhir
FROM live_sessions
WHERE tt_campaign_id IN ('52','33','35','57','46')
GROUP BY 1 ORDER BY 2 DESC;

\echo '-- apakah tt_campaign_id pernah sama dengan id campaigns kita?'
SELECT COUNT(*) AS session,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM campaigns c WHERE c.id::text = ls.tt_campaign_id)) AS cocok_id_internal
FROM live_sessions ls WHERE COALESCE(tt_campaign_id,'') <> '';

\echo ''
\echo '################ §22. RINGKASAN AKHIR ################'
\echo 'Angka-angka ini dipakai untuk keputusan perbaikan:'
\echo '  - organic portal vs view (selisih refund)'
\echo '  - views/likes portal vs internal (selisih livestream)'
\echo '  - jumlah video portal vs internal (selisih video manual)'
\echo '  - campaign yang benar-benar punya data ads'
\echo '  - campaign dengan PIN default / target kosong'
