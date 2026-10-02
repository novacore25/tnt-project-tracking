-- =====================================================================
-- 45 - APAKAH ads_performance ITU REVENUE YANG BERBEDA DARI sales?
-- Tanggal : 2026-10-02
-- READ-ONLY. Hanya SELECT. Tidak menulis apa pun.
--
-- KENAPA FILE INI ADA
--   1 Okt 2026 saya menyimpulkan "ads_performance = revenue yang sama dengan
--   sales" hanya karena kedua angkanya urutan besarnya mirip (ads Rp 1,74 M vs
--   sales Rp 920 M), lalu menulisnya sebagai fakta terverifikasi. itu SALAH.
--
--   User membetulkan: laporan TikTok Partner Center itu PURE ORGANIK, dan order
--   dari video yang di-ads tidak masuk ke sana. Kalau benar, maka ads adalah
--   revenue TAMBAHAN, dan `vw_campaign_summary` yang sekarang `sales` saja
--   sedang kurang Rp 173 juta.
--
-- TUJUAN FILE INI
--   Mengumpulkan bukti dari database, TANPA menebak. Files 44-45 sengaja tidak
--   mengubah apa pun sampai jawabannya jelas.
--
-- CARA BACA HASILNYA
--   §A  order ads JAUH lebih sedikit dari order sales  -> stream terpisah (aman)
--   §B  nilai order avg MIRIP                            -> order dari tipe sama
--   §C  kreator ads TIDAK overlap sama sekali dengan sales -> tidak ada dobel
--   §D  lonjakan sales & ads TIDAK se synchronize        -> tidak ada dobel
--
--   Kalau §C dan §D sama-sama bersih, `sales + ads` aman dijumlahkan.
--   Kalau salah satu menunjukkan overlap, jangan jumlahkan.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== §0. KOLOM YANG BENERANGADA DI ads_performance ==='
\echo '-- Dipakai untuk memastikan query di bawah tidak menebak nama kolom.'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ads_performance'
ORDER BY ordinal_position;

\echo ''
\echo '=== §0b. KOLOM YANG BENERANGADA DI sales ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name IN ('order_id','gmv','quantity','price','creator_username',
                      'content_uid','product_id','campaign_id','tanggal',
                      'order_status','is_refund','content_type')
ORDER BY ordinal_position;

\echo ''
\echo '=== §A. JUMLAH ORDER: ads (purchases) vs sales (order unik) ==='
\echo '-- "purchases" di ads = jumlah item terjual dari video yang di-ads.'
\echo '-- Kalau ini jauh lebih kecil dari order sales, keduanya stream terpisah.'
WITH a AS (
  SELECT sum(purchases)::bigint AS item_terjual_ads,
         sum(impressions)::bigint AS impressions,
         sum(clicks)::bigint AS clicks
  FROM ads_performance
)
SELECT
  (SELECT count(DISTINCT order_id) FROM sales)  AS order_unik_sales,
  (SELECT count(*) FROM sales)                  AS baris_sales,
  a.item_terjual_ads,
  a.impressions,
  a.clicks,
  round(a.item_terjual_ads::numeric / NULLIF((SELECT count(DISTINCT order_id) FROM sales), 0) * 100, 1) AS persen_ads_vs_sales
FROM a;

\echo ''
\echo '=== §B. NILAI ORDER RATA-RATA ==='
\echo '-- Ads : gross_revenue_usd * kurs / purchases  (dikonversi ke rupiah)'
\echo '-- Sales: gmv / quantity'
\echo '-- Kalau keduanya mirip, order-nya dari tipe yang sama -> tidak dobel.'
WITH ads AS (
  SELECT
    round(sum(gross_revenue_usd * kurs) / NULLIF(sum(purchases), 0)) AS nilai_per_item_ads,
    sum(purchases) AS purchases
  FROM ads_performance
  WHERE purchases > 0
),
sls AS (
  SELECT
    round(sum(gmv) / NULLIF(sum(quantity), 0)) AS nilai_per_item_sales,
    sum(quantity) AS qty_sales
  FROM sales
  WHERE NOT is_refund
)
SELECT
  a.nilai_per_item_ads,
  s.nilai_per_item_sales,
  a.purchases,
  s.qty_sales,
  round(abs(a.nilai_per_item_ads - s.nilai_per_item_sales)
        / NULLIF(a.nilai_per_item_ads, 0) * 100, 1) AS selisih_persen
FROM ads a CROSS JOIN sls s;

\echo ''
\echo '=== §C. KREATOR: apakah ada yang sama? ==='
\echo '--INI UJI TERKEPUTUS. Kalau tidak ada kreator yang muncul di kedua sisi,'
\echo '-- sales dan ads tidak mungkin menghitung order yang sama.'
WITH ads_creator AS (
  SELECT DISTINCT cc.creator_id, c.username
  FROM ads_performance a
  JOIN creators c ON c.id = a.creator_id
  JOIN campaign_creators cc ON cc.creator_id = c.id AND cc.campaign_id = a.campaign_id
  WHERE a.creator_id IS NOT NULL
),
sales_creator AS (
  SELECT DISTINCT lower(trim(creator_username)) AS username
  FROM sales
  WHERE creator_username IS NOT NULL AND trim(creator_username) <> ''
)
SELECT
  (SELECT count(*) FROM ads_creator)                                  AS kreator_ads,
  (SELECT count(*) FROM sales_creator)                                AS kreator_sales,
  (SELECT count(*) FROM ads_creator ac
     JOIN sales_creator sc ON sc.username = lower(trim(ac.username))) AS KREATOR_OVERLAP;

\echo ''
\echo '=== §C2. 15 KREATOR YANG MUNCUL DI KEDUA SISI (kalau ada) ==='
WITH ads_creator AS (
  SELECT DISTINCT a.campaign_id, c.username
  FROM ads_performance a
  JOIN creators c ON c.id = a.creator_id
  WHERE a.creator_id IS NOT NULL
),
sales_creator AS (
  SELECT DISTINCT lower(trim(creator_username)) AS username
  FROM sales
  WHERE creator_username IS NOT NULL AND trim(creator_username) <> ''
)
SELECT ac.campaign_id, ac.username,
       (SELECT count(*) FROM sales s
         WHERE lower(trim(s.creator_username)) = lower(trim(ac.username))) AS order_sales,
       (SELECT sum(purchases) FROM ads_performance a
         JOIN creators c2 ON c2.id = a.creator_id
        WHERE lower(c2.username) = lower(trim(ac.username))) AS purchases_ads
FROM ads_creator ac
JOIN sales_creator sc ON sc.username = lower(trim(ac.username))
ORDER BY 3 DESC, 4 DESC
LIMIT 15;

\echo ''
\echo '=== §D. TIMELINE BULANAN: sales vs ads (deteksi se synchronize) ==='
\echo '-- Kalau sales melonjak PADA BULAN YANG SAMA ads melonjak, ada peluang overlap.'
\echo '-- Kalau tidak se synchronize, kandidat stream terpisah makin kuat.'
WITH s AS (
  SELECT date_trunc('month', tanggal)::date AS bulan,
         round(sum(gmv)) AS gmv_sales,
         count(DISTINCT order_id) AS order_sales
  FROM sales WHERE NOT is_refund GROUP BY 1
),
d AS (
  SELECT date_trunc('month', tanggal)::date AS bulan,
         round(sum(cost_usd * kurs)) AS biaya_ads,
         round(sum(gross_revenue_usd * kurs)) AS gmv_ads,
         sum(purchases) AS purchases_ads
  FROM ads_performance GROUP BY 1
)
SELECT
  COALESCE(s.bulan, d.bulan) AS bulan,
  s.gmv_sales,
  d.gmv_ads,
  d.biaya_ads,
  s.order_sales,
  d.purchases_ads,
  CASE WHEN d.gmv_ads IS NULL THEN 'tanpa data ads'
       WHEN s.gmv_sales IS NULL THEN 'tanpa data sales'
       ELSE round((d.gmv_ads / s.gmv_sales) * 100, 1)::text || '% dari sales' END AS rasio
FROM s FULL OUTER JOIN d ON s.bulan = d.bulan
ORDER BY 1;

\echo ''
\echo '=== §E. RONDEAN HARI: 30 hari terakhir, sales vs ads ==='
\echo '-- Ini yang paling tajam. Kalau order yang sama terhitung dua kali,'
\echo '-- puncak sales akan PERSIS berimpit dengan puncak ads.'
WITH s AS (
  SELECT tanggal, round(sum(gmv)) AS gmv_sales, count(DISTINCT order_id) AS order_sales
  FROM sales WHERE NOT is_refund AND tanggal >= CURRENT_DATE - 30 GROUP BY 1
),
d AS (
  SELECT tanggal, round(sum(gross_revenue_usd * kurs)) AS gmv_ads, sum(purchases) AS purchases_ads
  FROM ads_performance WHERE tanggal >= CURRENT_DATE - 30 GROUP BY 1
)
SELECT
  COALESCE(s.tanggal, d.tanggal) AS tanggal,
  COALESCE(s.gmv_sales, 0) AS gmv_sales,
  COALESCE(d.gmv_ads, 0) AS gmv_ads,
  COALESCE(s.order_sales, 0) AS order_sales,
  COALESCE(d.purchases_ads, 0) AS purchases_ads
FROM s FULL OUTER JOIN d ON s.tanggal = d.tanggal
ORDER BY 1 DESC
LIMIT 30;

\echo ''
\echo '=== §F. APAKAH ADA ORDER DI sales YANG product_idNYA = PRODUCT_ID ADS? ==='
\echo '-- Hanya sanity check, bukan bukti. Product yang sama bisa dipakai dua sumber.'
SELECT
  count(DISTINCT s.product_id) AS product_sales,
  (SELECT count(DISTINCT product_id) FROM ads_performance WHERE product_id IS NOT NULL) AS product_ads,
  (SELECT count(*) FROM (SELECT DISTINCT product_id FROM sales
      INTERSECT SELECT DISTINCT product_id FROM ads_performance) x) AS product_irisan;

\echo ''
\echo '=== §G. APAKAH ads_performance PUNYA order_id? ==='
\echo '-- Kalau tidak punya, kita tidak bisa mencocokkan order secara langsung.'
\echo '-- Itu sebabnya §A-§D pakai proxy (jumlah & timing).'
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'ads_performance' AND column_name = 'order_id'
) AS ads_punya_order_id;

\echo ''
\echo '=== §H. TOTAL SAAT INI (acuan, untuk dibandingkan nanti) ==='
WITH s AS (
  SELECT sum(gmv) AS gmv_sales FROM sales WHERE NOT is_refund
),
d AS (
  SELECT sum(gross_revenue_usd * kurs) AS gmv_ads,
         sum(cost_usd * kurs)          AS biaya_ads
  FROM ads_performance
)
SELECT
  round(s.gmv_sales)                                   AS gmv_sales,
  round(d.gmv_ads)                                     AS gmv_ads,
  round(s.gmv_sales + d.gmv_ads)                       AS total_kalau_dijumlahkan,
  round(d.biaya_ads)                                   AS biaya_ads,
  round(d.gmv_ads - d.biaya_ads)                       AS margin_ads
FROM s CROSS JOIN d;
