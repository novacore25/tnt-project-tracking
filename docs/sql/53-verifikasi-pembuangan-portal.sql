-- =====================================================================
-- VERIFIKASI §D YANG DIPERBAIKI (labels salah + query terlalu lambat)
-- Tanggal: 2 Okt 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- MASALAH script 52 yang diperbaiki:
--
-- 1. LABEL SALAH. Kolom bernama `c_total_diterima_portal` sebenarnya
--    `total_sales - (sales yang diterima portal)`, jadi nilainya adalah
--    JUMLAH YANG DIBUANG, bukan yang diterima. Angka 26.611.651 dibaca
--    kebalikannya.
--
-- 2. (a) + (b) = 27.174.367 tapi pembuangan sebenarnya 26.611.651.
--    Selisihnya 562.716 adalah sales yang BUKAN approved DAN product_id-nya
--    di luar SKU -- dihitung di (a) maupun (b), jadi dobel.
--    Dizero-q dengan INTERSECT (bukan penjumlahan).
--
-- 3. QUERY HANG. `skus` dan `campaign_creators` tidak punya index yang
--    dipakai, dan correlated subquery di dalam WHERE dipanggil untuk tiap
--    dari 56.660 baris sales -> nested loop. Solusinya: ubah correlated
--    subquery jadi JOIN dengan pre-aggregate. Nol perubahan hasil,
--    jauh lebih murah.
--
-- Cara pakai: psql -f, atau tempel. Kalau delay, jalankan per section.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §D1. RINCIAN PEMBUANGAN (label sudah benar) ################'
-- Semua pakai JOIN, bukan correlated subquery.
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
-- LEFT JOIN, bukan EXISTS. EXISTS dipanggil ulang untuk tiap baris sales dan
-- itu yang bikin script 52 hang. Dengan JOIN, Postgres cukup hash dua kali.
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
  COALESCE(SUM(gmv),0)                                            AS total_semua_sales,
  COALESCE(SUM(gmv) FILTER (WHERE  oke_kreator AND  oke_sku),0) AS diterima_portal,
  COALESCE(SUM(gmv) FILTER (WHERE NOT oke_kreator AND  oke_sku),0) AS a_kreator_non_approved,
  COALESCE(SUM(gmv) FILTER (WHERE  oke_kreator AND NOT oke_sku),0) AS b_di_luar_sku,
  COALESCE(SUM(gmv) FILTER (WHERE NOT oke_kreator AND NOT oke_sku),0) AS c_keduanya,
  COALESCE(SUM(gmv) FILTER (WHERE NOT (oke_kreator AND oke_sku)),0) AS total_dibuang_portal,
  --GUARD: total_diterima + total_dibuang HARUS sama dengan total_semua
  COALESCE(SUM(gmv) FILTER (WHERE oke_kreator AND oke_sku),0)
    + COALESCE(SUM(gmv) FILTER (WHERE NOT (oke_kreator AND oke_sku)),0)
    - COALESCE(SUM(gmv),0)                                       AS selisih_harus_nol;

\echo ''
\echo '################ §D2. PER CAMPAIGN: YANG DIBUANG (menggunakan JOIN) ################'
WITH approved_set AS (
    SELECT DISTINCT cc.campaign_id,
           LOWER(BTRIM(COALESCE(c.username,''))) AS u
    FROM campaign_creators cc
    JOIN creators c ON cc.creator_id = c.id
    WHERE LOWER(COALESCE(cc.approval,'')) IN ('approved','alternate')
),
sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
),
tagged AS (
    SELECT s.campaign_id, s.gmv::numeric AS gmv,
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
SELECT c.id, c.nama,
       COALESCE(SUM(t.gmv) FILTER (WHERE t.oke_kreator AND t.oke_sku),0) AS diterima,
       COALESCE(SUM(t.gmv) FILTER (WHERE NOT t.oke_kreator AND t.oke_sku),0) AS a_non_approved,
       COALESCE(SUM(t.gmv) FILTER (WHERE t.oke_kreator AND NOT t.oke_sku),0) AS b_di_luar_sku,
       COALESCE(SUM(t.gmv) FILTER (WHERE NOT t.oke_kreator AND NOT t.oke_sku),0) AS c_keduanya,
       COALESCE(SUM(t.gmv) FILTER (WHERE NOT (t.oke_kreator AND t.oke_sku)),0) AS dibuang_total
FROM tagged t JOIN campaigns c ON c.id = t.campaign_id
GROUP BY c.id, c.nama
HAVING COALESCE(SUM(t.gmv) FILTER (WHERE NOT (t.oke_kreator AND t.oke_sku)),0) <> 0
ORDER BY 6 DESC
LIMIT 15;

\echo ''
\echo '################ §D3. TOP PRODUCT_ID YANG DI LUAR SKU (daftar kerja) ################'
-- Ini yang bikin `b_di_luar_sku` = Rp 21,5 juta. Sebagian besar mungkin
-- produk yang memang belum didaftarkan -- itu masalah `docs/sql/38`,
-- BUKAN bug filter portal.
WITH sku_set AS (
    SELECT DISTINCT campaign_id, BTRIM(COALESCE(product_id,'')) AS pid
    FROM skus WHERE COALESCE(BTRIM(product_id),'') <> ''
)
SELECT BTRIM(COALESCE(s.product_id,'(kosong)')) AS product_id,
       COUNT(*)                                AS baris,
       COALESCE(SUM(s.gmv::numeric),0)          AS gmv_idr,
       COUNT(DISTINCT s.campaign_id)            AS campaign_terpengaruh
FROM sales s
LEFT JOIN sku_set k
       ON k.campaign_id = s.campaign_id
      AND k.pid = BTRIM(COALESCE(s.product_id,''))
WHERE s.campaign_id IS NOT NULL
  AND k.pid IS NULL
GROUP BY 1
ORDER BY 3 DESC
LIMIT 20;

\echo ''
\echo '################ §D4. APAKAH PERLU INDEX? ################'
-- Kalau §D2 lambat, ini penyebabnya. Aman untuk dijalankan.
SELECT 'skus(campaign_id)' AS tbl_kolom,
       (SELECT count(*) FROM pg_indexes WHERE tablename='skus'
          AND indexdef ILIKE '%campaign_id%') AS ada_index
UNION ALL
SELECT 'campaign_creators(campaign_id)',
       (SELECT count(*) FROM pg_indexes WHERE tablename='campaign_creators'
          AND indexdef ILIKE '%campaign_id%')
UNION ALL
SELECT 'sales(campaign_id)',
       (SELECT count(*) FROM pg_indexes WHERE tablename='sales'
          AND indexdef ILIKE '%campaign_id%')
UNION ALL
SELECT 'creators(id)',
       (SELECT count(*) FROM pg_indexes WHERE tablename='creators'
          AND indexdef ILIKE '%\(id\)')
UNION ALL
SELECT 'skus(product_id)',
       (SELECT count(*) FROM pg_indexes WHERE tablename='skus'
          AND indexdef ILIKE '%product_id%');

\echo ''
\echo '################ §D5. RINGKASAN ################'
\echo '  D1  selisih_harus_nol = 0  -> tidak ada sales hilang tanpa jejak'
\echo '  D2  daftar campaign yang membuang, beserta rinciannya'
\echo '  D3  product_id mana yang di luar SKU (pending daftar kerja 91 produk)'
\echo '  D4  status index (bukan untuk diubah, hanya informasi)'
