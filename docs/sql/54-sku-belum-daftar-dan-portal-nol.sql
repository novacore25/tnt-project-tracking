-- =====================================================================
-- BUG KE-3 "SELECT TANPA FROM" + TEMUAN BARU: CAMPAIGN NOL DI PORTAL
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- 1. §D1 di script 53 tidak punya `FROM tagged`. Error
--    "column gmv does not exist". Ini kesalahan ke-3 dari jenis yang SAMA
--    dalam satu sesi (script 51 §D, script 52 §D, script 53 §D1) --
--    padahal pelvicariannya sudah ditulis di dokumen sebelum yang ketiga.
--
-- 2. TEMUAN BARU dari §D2: campaign 43 SKINMOLOGY dan 60 Pojok Perabot
--    punya `diterima = 0`. Artinya PORTAL MENAMPILKAN Rp 0 untuk campaign
--    yang di view valued Rp 18.541.276 dan Rp 104.900. Penyebabnya satu
--    product_id yang tidak terdaftar sebagai SKU.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §E1. RINCIAN PEMBUANGAN (DIPERBAIKI: ada FROM tagged) ################'
WITH approved_set AS (
    SELECT DISTINCT cc.campaign_id,
           LOWER(BTRIM(COALESCE(c.username,''))) AS u
    FROM campaign_creators cc
    JOIN creators c ON cc.creator_id = c.id
    WHERE LOWER(COALESCE(cc.approval,'')) IN ('approved','alternate')
),
sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus
    WHERE COALESCE(BTRIM(product_id),'') <> ''
),
tagged AS (
    SELECT s.gmv::numeric AS gmv,
           (a.u IS NOT NULL) AS oke_kreator,
           (k.pid IS NOT NULL) AS oke_sku
    FROM sales s
    LEFT JOIN approved_set a
           ON a.campaign_id = s.campaign_id
          AND a.u = LOWER(BTRIM(COALESCE(s.creator_username,'')))
    LEFT JOIN sku_set k
           ON k.campaign_id = s.campaign_id
          AND k.pid = BTRIM(COALESCE(s.product_id,''))
    WHERE s.campaign_id IS NOT NULL
)
SELECT
  COALESCE(SUM(gmv),0)                                               AS total_semua_sales,
  COALESCE(SUM(gmv) FILTER (WHERE  oke_kreator AND  oke_sku),0)    AS diterima_portal,
  COALESCE(SUM(gmv) FILTER (WHERE NOT oke_kreator AND  oke_sku),0) AS a_kreator_non_approved,
  COALESCE(SUM(gmv) FILTER (WHERE  oke_kreator AND NOT oke_sku),0) AS b_di_luar_sku,
  COALESCE(SUM(gmv) FILTER (WHERE NOT oke_kreator AND NOT oke_sku),0) AS c_keduanya,
  COALESCE(SUM(gmv) FILTER (WHERE NOT (oke_kreator AND oke_sku)),0) AS total_dibuang_portal,
  -- GUARD: diterima + dibuang WAJIB sama dengan total_semua
  COALESCE(SUM(gmv) FILTER (WHERE oke_kreator AND oke_sku),0)
    + COALESCE(SUM(gmv) FILTER (WHERE NOT (oke_kreator AND oke_sku)),0)
    - COALESCE(SUM(gmv),0) AS selisih_harus_nol
FROM tagged;

\echo ''
\echo '################ §E2. KAMPAIGN YANG PORTAL-NYA NOL (PALING SERIUS) ################'
-- Kalau view > 0 tapi portal = 0, brand melihat nol untuk campaign yang
-- sebenarnya punya penjualan. Ini yang paling merusak untuk kredibilitas.
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
    WHERE s.campaign_id IS NOT NULL
      AND a.u IS NOT NULL AND k.pid IS NOT NULL
    GROUP BY 1
)
SELECT v.campaign_id, c.nama, v.status,
       v.total_gmv - v.total_ads_gmv              AS organic_view,
       COALESCE(p.portal_organic, 0)              AS portal_organic,
       (v.total_gmv - v.total_ads_gmv) - COALESCE(p.portal_organic, 0) AS hilang_dari_portal
FROM vw_campaign_summary v
JOIN campaigns c ON c.id = v.campaign_id
LEFT JOIN portal_calc p ON p.campaign_id = v.campaign_id
WHERE (v.total_gmv - v.total_ads_gmv) > 0
  AND COALESCE(p.portal_organic, 0) = 0
ORDER BY 4 DESC;

\echo ''
\echo '################ §E3. PRODUCT_ID YANG BELUM TERDAFTAR (nama sudah ada) ################'
-- Nama produk diambil dari sales.raw_data, jadi tidak perlu tebak.
-- Daftarkan lewat Campaign Settings > SKU, lalu `syncUnmappedForProduct`
-- akan mengisi campaign_id-nya di sync berikutnya.
-- Daftar kerja produk yang sudah pernah dibuat: `docs/sql/38`.
WITH sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
)
SELECT BTRIM(COALESCE(s.product_id,'(kosong)'))      AS product_id,
       max(s.raw_data ->> 'Product Name')           AS nama_produk,
       max(s.raw_data ->> 'Shop name')              AS shop,
       COUNT(*)                                     AS baris,
       COALESCE(SUM(s.gmv::numeric),0)              AS gmv_idr,
       COUNT(DISTINCT s.campaign_id)                AS campaign,
       string_agg(DISTINCT s.campaign_id::text, ',' ORDER BY s.campaign_id::text) AS daftar_campaign
FROM sales s
LEFT JOIN sku_set k
       ON k.campaign_id = s.campaign_id
      AND k.pid = BTRIM(COALESCE(s.product_id,''))
WHERE s.campaign_id IS NOT NULL AND k.pid IS NULL
GROUP BY 1
ORDER BY 5 DESC
LIMIT 40;

\echo ''
\echo '################ §E4. TOTAL YANG "HILANG" DARI SEMUA PORTAL BRAND ################'
-- Angka yang akan hilang kalau SKU-s-nya tidak didaftarkan.
WITH sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
),
approved_set AS (
    SELECT DISTINCT cc.campaign_id, LOWER(BTRIM(COALESCE(c.username,''))) AS u
    FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
    WHERE LOWER(COALESCE(cc.approval,'')) IN ('approved','alternate')
)
SELECT
  (SELECT COALESCE(SUM(s.gmv::numeric),0) FROM sales s WHERE s.campaign_id IS NOT NULL)
    AS total_semua,
  (SELECT COALESCE(SUM(s.gmv::numeric),0) FROM sales s
    LEFT JOIN approved_set a ON a.campaign_id = s.campaign_id
       AND a.u = LOWER(BTRIM(COALESCE(s.creator_username,'')))
    LEFT JOIN sku_set k ON k.campaign_id = s.campaign_id
       AND k.pid = BTRIM(COALESCE(s.product_id,''))
    WHERE s.campaign_id IS NOT NULL AND a.u IS NOT NULL AND k.pid IS NOT NULL)
    AS tampil_di_portal,
  (SELECT COALESCE(SUM(s.gmv::numeric),0) FROM sales s
    LEFT JOIN approved_set a ON a.campaign_id = s.campaign_id
       AND a.u = LOWER(BTRIM(COALESCE(s.creator_username,'')))
    LEFT JOIN sku_set k ON k.campaign_id = s.campaign_id
       AND k.pid = BTRIM(COALESCE(s.product_id,''))
    WHERE s.campaign_id IS NOT NULL AND k.pid IS NULL)
    AS hilang_karena_sku_belum_daftar,
  (SELECT COUNT(DISTINCT BTRIM(COALESCE(s.product_id,''))) FROM sales s
    LEFT JOIN sku_set k ON k.campaign_id = s.campaign_id
       AND k.pid = BTRIM(COALESCE(s.product_id,''))
    WHERE s.campaign_id IS NOT NULL AND k.pid IS NULL)
    AS jumlah_product_id_belum_daftar;

\echo ''
\echo '################ §E5. CARI SECTION YANG GAGAL ################'
\echo ' Kalau ada ERROR di atas, section itu BELUM LULUS -- jangan dianggap nol.'
\echo ' E1  total_semua_sales  harus 1.153.546.708'
\echo ' E1  selisih_harus_nol  harus 0'
\echo ' E2  campaign yang portal-nya 0 padahal view > 0'
\echo ' E3  product_id + NAMA + shop, urut dari GMV terbesar'
\echo ' E4  rekap total yang hilang dari semua portal brand'
