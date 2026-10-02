-- =====================================================================
-- CEK APAKAH SKU SUDAH TERDAFTAR SEMUA (jalan setelah staff selesai)
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- TARGET setelah semua didaftarkan:
--   §A produk_belum_daftar = 0
--   §B tidak ada campaign dengan `diterima = 0` padahal view > 0
--   §C total tampil di portal naik dari 97,69% ke ~100%
--
-- Daftar kerja yang harus dikerjakan: `docs/DAFTAR-KERJA-SKU-PORTAL.md`
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §A. APAKAH MASIH ADA PRODUK YANG BELUM TERDAFTAR? ################'
WITH sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
)
SELECT COUNT(*) AS produk_belum_daftar,
       COALESCE(SUM(s.gmv::numeric),0) AS gmv_tersembunyi
FROM sales s
LEFT JOIN sku_set k
       ON k.campaign_id = s.campaign_id
      AND k.pid = BTRIM(COALESCE(s.product_id,''))
WHERE s.campaign_id IS NOT NULL AND k.pid IS NULL;

\echo ''
\echo '-- Rincian (boleh kosong kalau produk_belum_daftar = 0)'
WITH sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
)
SELECT BTRIM(COALESCE(s.product_id,'(kosong)')) AS product_id,
       COUNT(DISTINCT s.campaign_id)             AS campaign,
       string_agg(DISTINCT s.campaign_id::text, ',' ORDER BY s.campaign_id::text) AS daftar_campaign,
       COALESCE(SUM(s.gmv::numeric),0)           AS gmv_idr
FROM sales s
LEFT JOIN sku_set k
       ON k.campaign_id = s.campaign_id
      AND k.pid = BTRIM(COALESCE(s.product_id,''))
WHERE s.campaign_id IS NOT NULL AND k.pid IS NULL
GROUP BY 1 ORDER BY 5 DESC LIMIT 30;

\echo ''
\echo '################ §B. CAMPAIGN YANG PORTAL-NYA MASIH NOL ################'
-- Kosong = semua campaign sudah punya angka di portal.
WITH approved_set AS (
    SELECT DISTINCT cc.campaign_id, LOWER(BTRIM(COALESCE(c.username,''))) AS u
    FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
    WHERE LOWER(COALESCE(cc.approval,'')) IN ('approved','alternate')
),
sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
),
portal_calc AS (
    SELECT s.campaign_id, COALESCE(SUM(s.gmv::numeric),0) AS portal_organic
    FROM sales s
    LEFT JOIN approved_set a
           ON a.campaign_id = s.campaign_id
          AND a.u = LOWER(BTRIM(COALESCE(s.creator_username,'')))
    LEFT JOIN sku_set k
           ON k.campaign_id = s.campaign_id
          AND k.pid = BTRIM(COALESCE(s.product_id,''))
    WHERE s.campaign_id IS NOT NULL AND a.u IS NOT NULL AND k.pid IS NOT NULL
    GROUP BY 1
)
SELECT v.campaign_id, c.nama, c.status,
       v.total_gmv - v.total_ads_gmv AS organic_view,
       COALESCE(p.portal_organic,0) AS portal_organic
FROM vw_campaign_summary v
JOIN campaigns c ON c.id = v.campaign_id
LEFT JOIN portal_calc p ON p.campaign_id = v.campaign_id
WHERE (v.total_gmv - v.total_ads_gmv) > 0
  AND COALESCE(p.portal_organic,0) = 0
ORDER BY 4 DESC;

\echo ''
\echo '################ §C. SEBERAPA BANYAK SEKARANG YANG TAMPIL DI PORTAL? ################'
-- Satu query saja (script 54 §E4 punya 4 correlated subquery, makan 12 detik).
WITH approved_set AS (
    SELECT DISTINCT cc.campaign_id, LOWER(BTRIM(COALESCE(c.username,''))) AS u
    FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
    WHERE LOWER(COALESCE(cc.approval,'')) IN ('approved','alternate')
),
sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
),
tagged AS (
    SELECT s.gmv::numeric AS gmv,
           (a.u IS NOT NULL AND k.pid IS NOT NULL) AS tampil
    FROM sales s
    LEFT JOIN approved_set a
           ON a.campaign_id = s.campaign_id
          AND a.u = LOWER(BTRIM(COALESCE(s.creator_username,'')))
    LEFT JOIN sku_set k
           ON k.campaign_id = s.campaign_id
          AND k.pid = BTRIM(COALESCE(s.product_id,''))
    WHERE s.campaign_id IS NOT NULL
)
SELECT COALESCE(SUM(gmv),0)                                          AS total_semua,
       COALESCE(SUM(gmv) FILTER (WHERE tampil),0)                   AS tampil_di_portal,
       COALESCE(SUM(gmv) FILTER (WHERE NOT tampil),0)               AS disembunyikan,
       ROUND(100.0 * COALESCE(SUM(gmv) FILTER (WHERE tampil),0)
             / NULLIF(COALESCE(SUM(gmv),0),0), 2)                   AS persen_tampil,
       -- sebelum daftar: 1.126.935.057 = 97,69%
       CASE WHEN COALESCE(SUM(gmv) FILTER (WHERE tampil),0) >= 1126935057
            THEN 'sudah membaik' ELSE 'belum berubah' END            AS progres
FROM tagged;

\echo ''
\echo '################ §D. 7 PRODUK PRIORITAS TINGGI (P1) ################'
-- Cek satu per satu. 'TERDAFTAR' = sudah ada di skus untuk campaign tsb.
WITH target(product_id, campaign_id, nama, gmv) AS (
    VALUES
      ('1729461099640227837'::text, 43::int, 'SKINMOLOGY Paket 5in1',        18194715::numeric),
      ('1730815212454840317',       43,       'SKINMOLOGY Paket 6in1',         346561),
      ('1736265279953143270',       60,       'Pojok Perabot (nama kosong)',    104900),
      ('1733994253054477950',       47,       'ISWHITE Vitamin C Serum',       594263),
      ('1731113887927666067',       34,       'OMG Cushion 15g',              533805),
      ('1735142567530038690',       70,       'Garnier (nama kosong)',         343671),
      ('1730270828651775129',       38,       'PWS (nama kosong)',            106046)
)
SELECT t.campaign_id, t.product_id, t.nama, t.gmv,
       CASE WHEN EXISTS (SELECT 1 FROM skus k
                          WHERE k.campaign_id = t.campaign_id
                            AND BTRIM(COALESCE(k.product_id,'')) = t.product_id)
            THEN 'TERDAFTAR' ELSE 'BELUM' END AS status
FROM target t
ORDER BY t.gmv DESC;

\echo ''
\echo '################ §E. RINGKASAN ################'
\echo ' §A  produk_belum_daftar  harus 0       (sebelum: 14, Rp 21.515.353)'
\echo ' §B  harus kosong                      (sebelum: 2 campaign)'
\echo ' §C  persen_tampil  harus ~99,5%       (sebelum: 97,69%)'
\echo ' §D  semua P1 harus BERUBAH jadi TERDAFTAR'
