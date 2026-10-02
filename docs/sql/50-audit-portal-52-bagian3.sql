-- =====================================================================
-- AUDIT PORTAL BRAND - BAGIAN 3 (ANGKA FINAL)
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- Bagian 2 gagal di §12 dan §14 karena nama kolom view salah.
-- Nama kolom yang benar di vw_campaign_summary:
--   total_gmv_achievement, total_gmv, total_gmv_video, total_gmv_live,
--   total_ads_gmv, total_ads_spend, achievement_video, achievement_creator,
--   budget_ads_terpakai, sisa_budget_ads, tracked_creator_gmv
-- Tidak ada kolom `total_organic_gmv` di view (hanya ada di CTE internal).
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §23. VIEW UNTUK CAMPAIGN 52 (nama kolom benar) ################'
SELECT campaign_id, nama, status, target_gmv,
       total_gmv, total_gmv_achievement, total_gmv_video, total_gmv_live,
       total_ads_gmv, total_ads_spend, achievement_video, achievement_creator
FROM vw_campaign_summary WHERE campaign_id = 52;

\echo ''
\echo '################ §24. ANGKA FINAL CAMPAIGN 52 ################'
WITH portal AS (
  SELECT COALESCE(SUM(gmv::numeric),0) AS v
  FROM sales s
  WHERE s.campaign_id = 52
    AND LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (
      SELECT DISTINCT LOWER(BTRIM(COALESCE(c.username,'')))
      FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = 52 AND cc.approval IN ('approved','alternate'))
),
view AS (SELECT total_gmv::numeric AS v FROM vw_campaign_summary WHERE campaign_id = 52)
SELECT
  (SELECT v FROM portal)                              AS organic_portal,
  (SELECT v FROM view)                                AS total_view,
  (SELECT v FROM portal) - (SELECT v FROM view)       AS selisih,
  ROUND(100.0*((SELECT v FROM portal)-(SELECT v FROM view))
        / NULLIF((SELECT v FROM view),0), 2)          AS persen,
  (SELECT SUM(gmv::numeric) FROM sales
    WHERE campaign_id=52 AND is_refund IS TRUE)       AS refund_yang_terhitung,
  (SELECT total_gmv_live::numeric FROM vw_campaign_summary WHERE campaign_id=52) AS live_dari_view,
  (SELECT total_gmv_video::numeric FROM vw_campaign_summary WHERE campaign_id=52) AS video_dari_view;

\echo ''
\echo '################ §25. DAMPAK REFUND DI SELURUH DATABASE ################'
-- Portal & Performa menjumlah refund sebagai penjualan. quantifying.
WITH portal_scope AS (
  -- Meniru portal: sales dihitung hanya bila creator-nya approved/alternate
  -- DAN product_id-nya terdaftar sebagai SKU campaign tersebut.
  SELECT s.campaign_id, s.gmv::numeric AS gmv, s.is_refund
  FROM sales s
  WHERE LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (
          SELECT DISTINCT LOWER(BTRIM(COALESCE(c.username,'')))
          FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
          WHERE cc.campaign_id = s.campaign_id
            AND cc.approval IN ('approved','alternate'))
    AND BTRIM(COALESCE(s.product_id,'')) IN (
          SELECT BTRIM(COALESCE(product_id,'')) FROM skus sk
          WHERE sk.campaign_id = s.campaign_id
            AND COALESCE(BTRIM(product_id),'') <> '')
)
SELECT ps.campaign_id, c.nama,
       COALESCE(SUM(ps.gmv) FILTER (WHERE ps.is_refund IS TRUE),0) AS refund_terhitung,
       COALESCE(SUM(ps.gmv),0)                                  AS total_portal,
       COALESCE(SUM(ps.gmv) FILTER (WHERE ps.is_refund IS NOT TRUE),0) AS total_benar
FROM portal_scope ps JOIN campaigns c ON c.id = ps.campaign_id
GROUP BY 1,2
HAVING COALESCE(SUM(ps.gmv) FILTER (WHERE ps.is_refund IS TRUE),0) > 0
ORDER BY 3 DESC LIMIT 25;

\echo '-- TOTAL keseluruhan: berapa rupiah refund yang masuk ke angka portal'
SELECT
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales) AS total_semua_baris,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE is_refund IS TRUE) AS total_refund,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE is_refund IS NOT TRUE) AS total_benar,
  ROUND(100.0 * (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE is_refund IS TRUE)
        / NULLIF((SELECT COALESCE(SUM(gmv::numeric),0) FROM sales),0), 2) AS persen_overstatement;

\echo ''
\echo '################ §26. LIVESTREAM TERDUPLIKASI ################'
-- Dari §15 bagian 2: content_uid livestream yang sama muncul 3x di campaign 52.
SELECT campaign_id, content_uid, COUNT(*) AS jumlah_baris,
       COUNT(DISTINCT video_views::text) AS views_berbeda,
       MIN(post_time) AS post_time
FROM organic_videos
WHERE content_uid IS NOT NULL
GROUP BY campaign_id, content_uid
HAVING COUNT(*) > 1
ORDER BY jumlah_baris DESC, campaign_id LIMIT 25;

\echo '-- rekap duplikasi livestream di seluruh DB'
WITH dup AS (
  SELECT content_uid FROM organic_videos
  WHERE content_uid IS NOT NULL
  GROUP BY content_uid HAVING COUNT(*) > 1
)
SELECT
  (SELECT COUNT(*) FROM dup)                                    AS content_uid_ganda,
  (SELECT COUNT(*) FROM organic_videos WHERE content_uid IS NOT NULL) AS total_baris,
  (SELECT COUNT(*) FROM organic_videos o JOIN dup d ON d.content_uid = o.content_uid) AS baris_terdampak,
  (SELECT COUNT(*) FROM organic_videos o JOIN dup d ON d.content_uid = o.content_uid
     WHERE LOWER(COALESCE(o.content_type,'')) IN ('livestream','live')) AS baris_livestream_ganda;

\echo ''
\echo '################ §27. VIDEO: PORTAIL vs INTERNAL, SEMUA CAMPAIGN ################'
-- Portal = organic unik. Internal = organic unik + manual approved.
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
  SELECT cc.campaign_id, COUNT(*) AS n
  FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
  WHERE cc.approval IN ('approved','alternate') AND v.content_uid IS NOT NULL
  GROUP BY 1
)
SELECT
  (SELECT COUNT(*) FROM campaigns)                                        AS total_campaign,
  (SELECT COALESCE(SUM(n),0) FROM org)                                    AS total_video_portal,
  (SELECT COALESCE(SUM(n),0) FROM org) + (SELECT COALESCE(SUM(n),0) FROM man) AS total_video_internal,
  (SELECT COALESCE(SUM(n),0) FROM man)                                    AS total_video_manual,
  ROUND(100.0*(SELECT COALESCE(SUM(n),0) FROM org)
        / NULLIF((SELECT COALESCE(SUM(n),0) FROM org)+(SELECT COALESCE(SUM(n),0) FROM man),0), 1)
        AS persen_yang_tampil_portal;

\echo ''
\echo '################ §28. ACHIEVEMENT_VIDEO DI VIEW vs PERFORMA ################'
-- View: COUNT(v.id) WHERE link_video IS NOT NULL. Tidak cares status approval.
SELECT campaign_id, nama, achievement_video, achievement_creator
FROM vw_campaign_summary
WHERE campaign_id IN (33,34,36,37,41,44,45,46,52,76) ORDER BY campaign_id;

\echo '-- berapa video punya link_video NULL (tidak dihitung view)'
SELECT cc.campaign_id, c.nama,
       COUNT(*) AS video_tanpa_link,
       COUNT(*) FILTER (WHERE v.content_uid IS NOT NULL) DAN_punya_uid
FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
JOIN campaigns c ON c.id = cc.campaign_id
WHERE v.link_video IS NULL
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15;

\echo ''
\echo '################ §29. RINGKASAN UNTUK KEPUTUSAN PERBAIKAN ################'
\echo ' Yang sudah TERBUKTI dari audit:'
\echo '  A. GMV portal lebih besar karena refund dihitung positif (7.054 baris)'
\echo '  B. Views portal +11.711, likes portal +79.250 karena livestream ikut dihitung'
\echo '  C. Video portal hanya ~50% karena video manual tidak dihitung'
\echo '  D. 6.160 kreator not_approved tampil di portal tapi tidak di internal'
\echo '  E. 47 dari 49 campaign masih pakai PIN default 1234'
\echo '  F. 37 dari 49 campaign tidak punya target_gmv (persentase selalu 0)'
\echo '  G. Cabang tt_campaign_id di filter live_session tidak pernah kena (0 dari 209)'
\echo '  H. Livestream terduplikasi di organic_videos'
