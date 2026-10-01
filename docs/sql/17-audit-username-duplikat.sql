-- =====================================================================
-- 17 - Audit duplikat username kreator (case-insensitive)
-- Tanggal : 2026-10-01
-- Alasan  : di /campaigns/36/performa terlihat "bunaandshanum" dan
--           "Bunaandshanum" sebagai 2 baris dengan angka IDENTIK
--           (12 pcs, Rp 202.255). Semua agregasi server memakai
--           username.toLowerCase() sebagai key, jadi keduanya dapat data
--           yang sama lalu total campaign terhitung 2x.
--
-- JALANKAN READ-ONLY. File ini tidak mengubah data.
-- =====================================================================

\echo ''
\echo '=== A. Username duplikat (case-insensitive) di tabel creators ==='
SELECT LOWER(username) AS username_lower,
       count(*)       AS jumlah_baris,
       string_agg(id::text || ':' || username, ' | ' ORDER BY id) AS baris
FROM creators
GROUP BY LOWER(username)
HAVING count(*) > 1
ORDER BY count(*) DESC, LOWER(username);

\echo ''
\echo '=== B. Total dampak: berapa campaign_creators & sales terdampak ==='
SELECT
  (SELECT count(*) FROM creators) AS total_creators,
  (SELECT count(DISTINCT LOWER(username)) FROM creators) AS creator_uniq_lower,
  (SELECT count(*) FROM campaign_creators cc
     JOIN creators c ON c.id = cc.creator_id
    WHERE c.id IN (
      SELECT min(id) FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
    )) AS cc_txbakal_yang_kena;

\echo ''
\echo '=== C. Creator yg punya >1 baris creator_pool_case, rincian ==='
SELECT c.id, c.username, c.nama_asli, c.status,
       cc.id AS campaign_creator_id, cc.campaign_id, cam.nama AS campaign,
       cc.approval, cc.price
FROM creators c
LEFT JOIN campaign_creators cc ON cc.creator_id = c.id
LEFT JOIN campaigns cam ON cam.id = cc.campaign_id
WHERE LOWER(c.username) IN (
  SELECT LOWER(username) FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
ORDER BY LOWER(c.username), c.id, cc.id;

\echo ''
\echo '=== D. Sales: apakah username yg terduplikasi punya order? ==='
SELECT LOWER(creator_username) AS username_lower,
       count(*)  AS jml_order,
       sum(gmv)  AS total_gmv
FROM sales
WHERE LOWER(creator_username) IN (
  SELECT LOWER(username) FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
GROUP BY LOWER(creator_username)
ORDER BY jml_order DESC;

\echo ''
\echo '=== E. Verifikasi bug order_time (k supposedly tidak ada kolom ini) ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name IN ('order_time','tanggal','order_date');

\echo ''
\echo '=== F. Verifikasi sales.campaign_id nullable + berapa yang NULL ==='
SELECT
  count(*) FILTER (WHERE campaign_id IS NULL) AS campaign_id_null,
  count(*) FILTER (WHERE campaign_id IS NOT NULL) AS campaign_id_terisi,
  count(*) FILTER (WHERE product_id IS NOT NULL) AS ada_product_id,
  count(*) AS total
FROM sales;