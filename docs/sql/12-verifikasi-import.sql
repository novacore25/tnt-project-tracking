-- =====================================================================
-- 12 — VERIFIKASI IMPORT 3 FILE PARTNER CENTER
-- Read-only. Jalankan setelah upload 3 file (Sales, Awareness Video, Awareness Live)
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. KESELURUHAN: sales & organic_videos ==='
SELECT
  (SELECT count(*) FROM sales)                                              AS sales_total,
  (SELECT count(*) FROM sales WHERE campaign_id IS NULL)                    AS sales_unmapped,
  (SELECT COALESCE(sum(gmv),0) FROM sales)                                  AS sales_gmv_total,
  (SELECT COALESCE(sum(gmv),0) FROM sales WHERE NOT is_refund)             AS gmv_dashboard,
  (SELECT count(*) FROM organic_videos)                                     AS organic_total,
  (SELECT count(*) FROM organic_videos WHERE campaign_id IS NULL)           AS organic_unmapped,
  (SELECT count(*) FROM organic_videos WHERE content_type ILIKE '%live%')   AS organic_live,
  (SELECT count(*) FROM organic_videos WHERE content_type ILIKE '%video%')  AS organic_video;

\echo ''
\echo '=== 2. DUPLIKAT (harus 0) ==='
SELECT
  (SELECT count(*) FROM (SELECT order_id FROM sales GROUP BY order_id HAVING count(*)>1) a)   AS sales_duplikat_order_id,
  (SELECT count(*) FROM (SELECT content_uid, product_id FROM organic_videos
                          GROUP BY 1,2 HAVING count(*)>1) b)                                  AS organic_duplikat;

\echo ''
\echo '=== 3. DATA BARU (28-30 Sep 2026) ==='
SELECT 'sales' AS tabel,
       count(*) AS total,
       count(*) FILTER (WHERE campaign_id IS NULL) AS belum_terpetakan,
       count(*) FILTER (WHERE creator_username IS NULL) AS tanpa_kreator,
       min(tanggal) AS tanggal_awal,
       max(tanggal) AS tanggal_akhir
FROM sales WHERE tanggal >= '2026-09-28'
UNION ALL
SELECT 'organic_videos',
       count(*),
       count(*) FILTER (WHERE campaign_id IS NULL),
       count(*) FILTER (WHERE creator_username IS NULL),
       min(post_time)::date,
       max(post_time)::date
FROM organic_videos WHERE post_time >= '2026-09-28';

\echo ''
\echo '=== 4. PEMETAAN CAMPAIGN: data baru per campaign ==='
SELECT COALESCE(c.nama, '>>> BELUM TERPETAKAN <<<') AS campaign,
       count(*) AS jml_sales,
       sum(s.gmv) AS gmv
FROM sales s
LEFT JOIN campaigns c ON c.id = s.campaign_id
WHERE s.tanggal >= '2026-09-28'
GROUP BY 1 ORDER BY gmv DESC NULLS LAST;

\echo ''
\echo '=== 5. PEMETAAN CAMPAIGN: organic videos baru ==='
SELECT COALESCE(c.nama, '>>> BELUM TERPETAKAN <<<') AS campaign,
       count(*) AS jml_konten
FROM organic_videos o
LEFT JOIN campaigns c ON c.id = o.campaign_id
WHERE o.post_time >= '2026-09-28'
GROUP BY 1 ORDER BY jml_konten DESC;

\echo ''
\echo '=== 6. PRODUCT YANG BELUM TERPETAKAN (Smart Routing gagal) ==='
SELECT s.product_id, s.product_name, count(*) AS jml, sum(s.gmv) AS gmv
FROM sales s
WHERE s.campaign_id IS NULL AND s.tanggal >= '2026-09-28'
GROUP BY 1,2 ORDER BY jml DESC LIMIT 15;