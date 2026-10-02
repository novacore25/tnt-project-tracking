-- =====================================================================
-- VERIFIKASI LENGKAP SETELAH MIGRATION 20261003000000
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- PERBAIKAN script 51 (`51-verifikasi-setelah-refund.sql`):
--   §C salah: memakai `total_gmv_video` sebagai "organic view".
--     `total_gmv_video` itu HANYA pecahan VIDEO. Organic total =
--     `total_gmv - total_ads_gmv`. Karena itu §C membandingkan video saja
--     vs organic portal, dan arah selisihnya kelihatan bolak-balik.
--     Penjelasan saya di §C script 51 ("view selalu >= portal") juga SALAH.
--   §D salah: `SELECT SUM(...)` tanpa FROM, jadi tidak menghasilkan apa pun.
--
-- Script ini perbaikannya. Yang diuji:
--   A. Rekonsiliasi refund (sudah OK di script 51, diulang sebentar)
--   B. Identitas video + live + ads = total
--   C. Organic view >= organic portal, dan selisihnya TERJELASKAN
--   D. Selisih C = sales kreator non-approved + product_id di luar SKU
--   E. Backup utuh
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §A. REKONSILIASI REFUND ################'
SELECT
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE is_refund IS TRUE)  AS refund_total,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NOT NULL)                  AS refund_ada_campaign,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NULL)                      AS refund_tanpa_campaign,
  (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)
  - (SELECT COALESCE(sum(total_gmv),0) FROM _backup_vw_campaign_summary_before_20261003)
                                                                          AS naik_view,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales
     WHERE is_refund IS TRUE AND campaign_id IS NOT NULL)                  AS refund_yang_masuk_view;

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
\echo '################ §C. ORGANIC: VIEW vs PORTAL (kolom yang benar) ################'
-- Organic total di view = total_gmv - total_ads_gmv (BUKAN total_gmv_video).
-- Portal organic = sales dari kreator approved/alternate dengan SKU terdaftar.
--
-- HARUSNYA: organic_view >= organic_portal, karena portal punya 2 filter
-- tambahan (kreator non-approved dibuang, product_id di luar SKU dibuang).
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
       v.total_gmv - v.total_ads_gmv          AS organic_view,
       COALESCE(p.portal_organic, 0)          AS organic_portal,
       (v.total_gmv - v.total_ads_gmv) - COALESCE(p.portal_organic, 0) AS dibuang_portal,
       CASE WHEN (v.total_gmv - v.total_ads_gmv) >= COALESCE(p.portal_organic, 0)
            THEN 'OK' ELSE 'BAHAYA - portal lebih besar!' END AS status
FROM vw_campaign_summary v
JOIN campaigns c ON c.id = v.campaign_id
LEFT JOIN portal_calc p ON p.campaign_id = v.campaign_id
WHERE COALESCE(p.portal_organic, 0) > 0
ORDER BY v.total_gmv DESC LIMIT 20;

\echo ''
\echo '-- Campaign yang statusnya BAHAYA harus nol. Kalau ada, ada bug filter.'
WITH portal_calc AS (
    SELECT s.campaign_id, COALESCE(SUM(s.gmv::numeric), 0) AS portal_organic
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
SELECT count(*) AS campaign_portal_lebih_besar
FROM vw_campaign_summary v JOIN portal_calc p ON p.campaign_id = v.campaign_id
WHERE v.total_gmv - v.total_ads_gmv < p.portal_organic;

\echo ''
\echo '################ §D. RINCIAN YANG DIBUANG PORTAL (harus terJustified) ################'
-- Portal membuang sales yang:
--   (a) kreatornya BUKAN approved/alternate
--   (b) product_id-nya TIDAK terdaftar sebagai SKU campaign
-- Kalau (a) + (b) menjelaskan selisih §C, berarti portal tidak membuang apa pun
-- yang tidak beralasan. Kalau ada sisa, ada pembuangan lain yang belum tercatat.
WITH approved_set AS (
    SELECT DISTINCT cc.campaign_id,
           LOWER(BTRIM(COALESCE(c.username,''))) AS u
    FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
    WHERE LOWER(COALESCE(cc.approval,'')) IN ('approved','alternate')
),
totals AS (
    SELECT COALESCE(SUM(gmv::numeric),0) AS semua_sales
    FROM sales WHERE campaign_id IS NOT NULL
)
SELECT
  (SELECT COALESCE(SUM(s.gmv::numeric),0) FROM sales s
    WHERE s.campaign_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM approved_set a
                      WHERE a.campaign_id = s.campaign_id
                        AND a.u = LOWER(BTRIM(COALESCE(s.creator_username,'')))))
      AS a_kreator_non_approved,
  (SELECT COALESCE(SUM(s.gmv::numeric),0) FROM sales s
    WHERE s.campaign_id IS NOT NULL
      AND BTRIM(COALESCE(s.product_id,'')) NOT IN (
            SELECT BTRIM(COALESCE(product_id,'')) FROM skus sk
            WHERE sk.campaign_id = s.campaign_id
              AND COALESCE(BTRIM(product_id),'') <> ''))
      AS b_di_luar_sku,
  (SELECT semua_sales FROM totals) AS total_sales,
  (SELECT semua_sales FROM totals)
    - (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales s
       WHERE s.campaign_id IS NOT NULL
         AND LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (
               SELECT a.u FROM approved_set a WHERE a.campaign_id = s.campaign_id)
         AND BTRIM(COALESCE(s.product_id,'')) IN (
               SELECT BTRIM(COALESCE(product_id,'')) FROM skus sk
               WHERE sk.campaign_id = s.campaign_id
                 AND COALESCE(BTRIM(product_id),'') <> ''))
      AS c_total_diterima_portal;

\echo ''
\echo '-- Campaign dengan pembuangan terbesar (portal membuang paling banyak)'
WITH approved_set AS (
    SELECT DISTINCT cc.campaign_id, LOWER(BTRIM(COALESCE(c.username,''))) AS u
    FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
    WHERE LOWER(COALESCE(cc.approval,'')) IN ('approved','alternate')
)
SELECT s.campaign_id, c.nama,
       COALESCE(SUM(s.gmv::numeric),0) AS dibuang_portal
FROM sales s JOIN campaigns c ON c.id = s.campaign_id
WHERE s.campaign_id IS NOT NULL
  AND NOT (LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (
            SELECT a.u FROM approved_set a WHERE a.campaign_id = s.campaign_id)
        AND BTRIM(COALESCE(s.product_id,'')) IN (
            SELECT BTRIM(COALESCE(product_id,'')) FROM skus sk
            WHERE sk.campaign_id = s.campaign_id
              AND COALESCE(BTRIM(product_id),'') <> ''))
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 12;

\echo ''
\echo '################ §E. BACKUP UTUH ################'
SELECT 'definisi_lama' AS apa, count(*) AS baris FROM _backup_view_vw_campaign_summary_20261002
UNION ALL
SELECT 'angka_sebelum_20261003', count(*) FROM _backup_vw_campaign_summary_before_20261003;

\echo ''
\echo '################ §F. RINGKASAN ################'
\echo ' Lolos  : §A refund naik view = refund yang punya campaign'
\echo ' Lolos  : §B selisih_harus_nol = 0'
\echo ' Lolos  : §C campaign_portal_lebih_besar = 0'
\echo ' Lolos  : §E backup tidak dihapus'
\echo ' Catat  : §C script 51 salah kolom (total_gmv_video), §D tanpa FROM.'
\echo '          Script ini pembenarannya.'
