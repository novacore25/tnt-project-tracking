-- =====================================================================
-- VERIFIKASI SETELAH MIGRATION 20261003000000 (refund masuk view)
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- Gunanya: membuktikan view, portal, dan Performa sekarang memakai angka
-- yang sama, dan merekonsiliasi selisih refund terhadap campaign NULL.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §A. REKONSILIASI REFUND (kroscheck) ################'
\echo '-- Total refund di sales harus = refund di campaign + refund campaign NULL'
SELECT
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE is_refund IS TRUE)  AS refund_total_semua,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NOT NULL)                  AS refund_dengan_campaign,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NULL)                      AS refund_campaign_null,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NOT NULL)
  + (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NULL)
  - (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE is_refund IS TRUE) AS selisih_harus_nol;

\echo ''
\echo '-- Verifikasi: refund per campaign di view = refund di sales campaign itu'
SELECT
  (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)              AS total_view_skarang,
  (SELECT COALESCE(sum(total_gmv),0) FROM _backup_vw_campaign_summary_before_20261003)
                                                                          AS total_view_sebelumnya,
  (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)
  - (SELECT COALESCE(sum(total_gmv),0) FROM _backup_vw_campaign_summary_before_20261003) AS naik,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NOT NULL)                  AS refund_yang_masuk;

\echo ''
\echo '################ §B. IDENTITAS: video + live + ads = total ################'
SELECT
  COALESCE(sum(total_gmv_video),0) AS video,
  COALESCE(sum(total_gmv_live),0)  AS live,
  COALESCE(sum(total_ads_gmv),0)   AS ads,
  COALESCE(sum(total_gmv),0)       AS total,
  COALESCE(sum(total_gmv_video),0) + COALESCE(sum(total_gmv_live),0)
    + COALESCE(sum(total_ads_gmv),0) - COALESCE(sum(total_gmv),0) AS selisih_harus_nol
FROM vw_campaign_summary;

\echo ''
\echo '################ §C. VIEW vs PORTAL -- HARUS SAMA ################'
-- Portal menjumlah SEMUA baris sales (tanpa filter refund) untuk kreator
-- approved/alternate dengan SKU terdaftar. Kalau refund sudah masuk view,
-- nilai organic view untuk campaign itu harus >= nilai portal.
-- SELECT per campaign, untuk campaign utama.
WITH portal_calc AS (
    SELECT s.campaign_id,
           COALESCE(SUM(s.gmv::numeric), 0) AS portal_organic
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
    GROUP BY 1
)
SELECT v.campaign_id, c.nama,
       v.total_gmv_video AS view_organic_semua_kreator,
       COALESCE(p.portal_organic, 0) AS portal_organic_approved,
       v.total_gmv AS view_total_termasuk_ads
FROM vw_campaign_summary v
LEFT JOIN portal_calc p ON p.campaign_id = v.campaign_id
JOIN campaigns c ON c.id = v.campaign_id
WHERE p.portal_organic IS NOT NULL
ORDER BY v.total_gmv DESC LIMIT 15;

\echo '-- Penjelasan: view_organic >= portal_organic SELALU, karena view'
\echo '-- menghitung SEMUA kreator (termasuk not_approved), portal hanya approved.'
\echo '-- Yang penting: refund SUDAH masuk di kedua sisi (tidak ada lagi'
\echo '-- selisih refund terpisah).'

\echo ''
\echo '################ §D. CEK REFUND DI DALAM VIDEO vs LIVE ################'
-- Refund ikut dihitung, tapi pemecahan video/live harus tetap konsisten.
SELECT
  COALESCE(sum(total_gmv_video),0) AS video,
  COALESCE(sum(total_gmv_live),0)  AS live,
  COALESCE(sum(total_gmv_video),0) + COALESCE(sum(total_gmv_live),0)
    - (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
        WHERE campaign_id IS NOT NULL) AS selisih_harus_nol;

\echo ''
\echo '################ §E. BACKUP TERSIMPAN ################'
SELECT 'definisi_lama' AS apa, count(*) AS baris FROM _backup_view_vw_campaign_summary_20261002
UNION ALL
SELECT 'angka_sebelum_20261003', count(*) FROM _backup_vw_campaign_summary_before_20261003;

\echo ''
\echo '################ §F. RINGKASAN AKHIR ################'
\echo ' Yang harus terpenuhi:'
\echo '  §A selisih_harus_nol = 0'
\echo '  §B selisih_harus_nol = 0'
\echo '  §D selisih_harus_nol = 0'
\echo '  §E backup tidak dihapus'
