-- =====================================================================
-- 38 - DAFTAR KERJA: 91 product_id yang perlu didaftarkan per campaign
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- KESIMPULAN AUDIT (sudah terverifikasi, tidak perlu diulang)
--   1. Atribusi order yang SUDAH punya campaign_id itu BENAR.
--      Dari 12.834 order yang tiktok_campaign_id-nya resolve ke tepat 1
--      campaign, semuanya cocok, nol yang berbeda. Angka 9.060 dari query
--      sebelumnya hanya order yang tiktok_campaign_id-nya ada di array
--      beberapa campaign, jadi tidak bisa dipakai sebagai bukti salah.
--
--   2. Satu masalah tersisa: 4.436 order (Rp 224.219.990) campaign_id-nya
--      NULL karena 91 product_id-nya belum terdaftar di tabel skus.
--      orders ini harus didaftarkan dari menu Produk per campaign.
--
--   3. Nama produk SUDAH ada di sales.raw_data ->> 'Product Name', jadi
--      daftar di bawah tidak perluDicek manual ke TikTok satu per satu.
--
-- CARA PAKAI
--   Salin hasil bagian 2 ke file, pakai kolom PRODUCT_ID untuk kolom
--   Product ID di menu Produk, dan PRODUCT_NAME untuk nama produk.
--   Kolom PARTNER_CAMPAIGN_ID adalah Partner campaign ID dari TikTok. Pakai
--   ini untuk memilih campaign yang benar, karena setiap product_id hanya
--   muncul di satu Partner campaign ID, jadi pasangan ini unik.
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. RINGKASAN ==='
SELECT (SELECT count(DISTINCT product_id) FROM sales
         WHERE campaign_id IS NULL AND NOT is_refund)                     AS product_id,
       (SELECT count(*) FROM sales
         WHERE campaign_id IS NULL AND NOT is_refund)                     AS order_total,
       (SELECT COALESCE(sum(gmv),0) FROM sales
         WHERE campaign_id IS NULL AND NOT is_refund)                     AS gmv_total,
       (SELECT count(DISTINCT tiktok_campaign_id) FROM sales
         WHERE campaign_id IS NULL AND NOT is_refund)                     AS partner_campaign,
       (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)       AS total_gmv_skarang,
       (SELECT COALESCE(sum(gmv),0) FROM sales
         WHERE campaign_id IS NULL AND NOT is_refund)
         + (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)    AS total_gmv_setelah_daftar;

\echo ''
\echo '=== 2. DAFTAR KERJA LENGKAP: partner campaign + shop + product + nama ==='
-- Percobaan pertama gagal dengan "column t.tt does not exist" karena subquery
-- t tidak punya alias tt, dan LEFT JOIN-nya memang tidak perlu karena
-- tiktok_campaign_id sudah diambil langsung dari sales.
\pset format unaligned
\pset tuples_only on
SELECT
    rpad(COALESCE(p.partner,'(kosong)'), 20) || ' | ' ||
    rpad(COALESCE(p.shop,'?'), 22) || ' | ' ||
    rpad(p.pid, 20) || ' | ' ||
    rpad(p.gmv::bigint::text, 12) || ' | ' ||
    rpad(p.jml::text, 5) || ' | ' ||
    p.nama_produk
FROM (
    SELECT
        sl.tiktok_campaign_id                AS partner,
        max(sl.raw_data ->> 'Shop name')     AS shop,
        sl.product_id                        AS pid,
        max(sl.raw_data ->> 'Product Name')  AS nama_produk,
        count(*)                             AS jml,
        sum(sl.gmv)                          AS gmv
    FROM sales sl
    WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
    GROUP BY sl.tiktok_campaign_id, sl.product_id
) p
ORDER BY p.gmv DESC;
\pset tuples_only off
\pset format aligned

\echo ''
\echo '=== 3. PRODUCT_ID BERSERTA NAMA, TANPA PARTNER CAMPAIGN (buat referensi) ==='
\pset format unaligned
\pset tuples_only on
SELECT rpad(p.pid, 20) || ' | ' || rpad(p.gmv::bigint::text, 12) || ' | ' || p.nama_produk
FROM (
    SELECT sl.product_id                       AS pid,
           max(sl.raw_data ->> 'Product Name') AS nama_produk,
           count(*)                            AS jml,
           sum(sl.gmv)                         AS gmv
    FROM sales sl
    WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
    GROUP BY sl.product_id
) p
ORDER BY p.gmv DESC;
\pset tuples_only off
\pset format aligned

\echo ''
\echo '=== 4. SHOP NAME per Partner campaign (bantu memilih campaign) ==='
SELECT sl.tiktok_campaign_id,
       count(DISTINCT sl.raw_data ->> 'Shop name') AS jumlah_shop,
       string_agg(DISTINCT sl.raw_data ->> 'Shop name', ' | ') AS shop_name,
       count(*) AS order, COALESCE(sum(sl.gmv),0) AS gmv
FROM sales sl
WHERE sl.campaign_id IS NULL AND NOT sl.is_refund
GROUP BY sl.tiktok_campaign_id
ORDER BY gmv DESC;

\echo ''
\echo '=== 5. KALAU DAFTARKAN, INI YANG AKAN TERJADI DI VIEW ==='
-- Setelah product_id didaftarkan, syncUnmappedForProduct akan mengisi
-- campaign_id pada order itu. Tidak perlu migration tambahan.
SELECT c.id, c.nama,
       COALESCE(sum(sl.gmv),0) AS gmv_skarang
FROM campaigns c
LEFT JOIN sales sl ON sl.campaign_id = c.id AND NOT sl.is_refund
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15;
