-- =====================================================================
-- AUDIT PORTAL BRAND vs INTERNAL - CAMPAIGN 52
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- Tujuan: hitung ulang angka yang ditampilkan portal
-- (web-app/src/app/portal/actions/portalActions.ts) dan bandingkan
-- dengan versi internal (web-app/src/app/campaigns/[id]/performa/PerformaClient.tsx)
-- dan dengan view `total_gmv` (sumber angka Harian).
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §0. IDENTITAS CAMPAIGN ################'
SELECT id, nama, status,
       target_gmv,
       COALESCE(require_client_approval, false) AS need_client_approval,
       CASE WHEN pin IS NULL OR pin = '' THEN 'TIDAK ADA PIN'
            WHEN pin = '1234' THEN 'PIN DEFAULT 1234 (BERBAHAYA)'
            ELSE 'pinTerpasang' END AS status_pin
FROM campaigns WHERE id = 52;

\echo ''
\echo '################ §1. IS_REFUND ################'
-- Tidak ada filter is_refund di portalActions ATAU PerformaClient.
-- Tapi view total_gmv MEMAKAI is_refund = false.
-- Kalau refund > 0, maka Harian dan Performa/Portal tidak akan pernah sama.
SELECT COALESCE(is_refund::text,'NULL') AS is_refund,
       COUNT(*)                     AS baris,
       COUNT(DISTINCT creator_username) AS kreator,
       SUM(gmv::numeric)            AS gmv_idr,
       SUM(quantity::numeric)       AS item
FROM sales WHERE campaign_id = 52
GROUP BY 1 ORDER BY 1;

\echo '-- Selisih = yang dihitung portal/internal MINUS yang dihitung view'
SELECT
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE campaign_id=52) AS semua_baris,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE campaign_id=52 AND is_refund IS NOT TRUE) AS non_refund,
  (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE campaign_id=52)
  - (SELECT COALESCE(SUM(gmv::numeric),0) FROM sales WHERE campaign_id=52 AND is_refund IS NOT TRUE) AS selisih_refund;

\echo ''
\echo '################ §2. FILTER SKU ################'
-- Portal: sales DIBUANG kalau product_id tidak ada di skus campaign.
-- Menghitung berapa yang hilang.
WITH sk AS (
  SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid
  FROM skus WHERE campaign_id = 52 AND COALESCE(BTRIM(product_id),'') <> ''
)
SELECT
  COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM sk WHERE sk.pid = BTRIM(COALESCE(s.product_id,'')))) AS baris_kena_filter,
  COALESCE(SUM(s.gmv::numeric) FILTER (WHERE NOT EXISTS (SELECT 1 FROM sk WHERE sk.pid = BTRIM(COALESCE(s.product_id,'')))),0) AS gmv_kena_filter,
  COUNT(*) AS baris_total,
  COALESCE(SUM(s.gmv::numeric),0) AS gmv_total
FROM sales s WHERE s.campaign_id = 52;

\echo '-- 15 product_id terbesar yang TERBUANG oleh filter SKU'
WITH sk AS (
  SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid
  FROM skus WHERE campaign_id = 52 AND COALESCE(BTRIM(product_id),'') <> ''
)
SELECT BTRIM(COALESCE(s.product_id,'(kosong)')) AS product_id,
       COUNT(*) AS baris, SUM(s.gmv::numeric) AS gmv_idr
FROM sales s
WHERE s.campaign_id = 52
  AND NOT EXISTS (SELECT 1 FROM sk WHERE sk.pid = BTRIM(COALESCE(s.product_id,'')))
GROUP BY 1 ORDER BY gmv_idr DESC LIMIT 15;

\echo '-- Daftar SKU yang terdaftar (acuan filter)'
SELECT COUNT(*) AS jumlah_sku, COUNT(DISTINCT BTRIM(COALESCE(product_id,''))) AS product_id_unik
FROM skus WHERE campaign_id = 52;

\echo ''
\echo '################ §3. GMV ORGANIC (portal & internal) ################'
-- Keduanya identik: filter SKU + username approved/alternate, TANPA is_refund.
WITH ap AS (
  SELECT DISTINCT LOWER(BTRIM(COALESCE(c.username,''))) AS u
  FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
  WHERE cc.campaign_id = 52 AND cc.approval IN ('approved','alternate')
),
sk AS (
  SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid
  FROM skus WHERE campaign_id = 52 AND COALESCE(BTRIM(product_id),'') <> ''
)
SELECT
  COALESCE(SUM(s.gmv::numeric) FILTER (WHERE LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (SELECT u FROM ap)
                                             AND BTRIM(COALESCE(s.product_id,'')) IN (SELECT pid FROM sk)),0) AS gmv_organic_portal,
  COALESCE(SUM(s.gmv::numeric) FILTER (WHERE LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (SELECT u FROM ap)),0)  AS gmv_organic_tanpa_filter_sku,
  COALESCE(SUM(s.gmv::numeric),0) AS gmv_semua_baris,
  COALESCE(SUM(s.quantity::numeric) FILTER (WHERE LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (SELECT u FROM ap)
                                             AND BTRIM(COALESCE(s.product_id,'')) IN (SELECT pid FROM sk)),0) AS item_sold_portal
FROM sales s WHERE s.campaign_id = 52;

\echo ''
\echo '################ §4. GMV ADS (portal & view) ################'
-- Portal: dedup di JS pakai new Date(tanggal) > new Date(existing.tanggal).
-- View  : DISTINCT ON (campaign_id, ad_id) ORDER BY tanggal DESC, id DESC.
-- Bandingkan keduanya, plus cek tie (tanggal sama).
WITH last_row AS (
  SELECT DISTINCT ON (ad_id) ad_id, campaign_id, tanggal, gross_revenue_usd, cost_usd, kurs, purchases
  FROM ads_performance WHERE campaign_id = 52
  ORDER BY ad_id, tanggal DESC, id DESC
),
portal_style AS (
  -- meniru JS: ambil row pertama yang menang saat tanggal lebih besar
  SELECT DISTINCT ON (ad_id) ad_id, tanggal, gross_revenue_usd, cost_usd, kurs, purchases
  FROM ads_performance WHERE campaign_id = 52
  ORDER BY ad_id, tanggal DESC, id ASC
)
SELECT
  (SELECT COUNT(*) FROM last_row)  AS jumlah_ad,
  (SELECT COUNT(DISTINCT ad_id) FROM ads_performance WHERE campaign_id=52) AS ad_unik,
  (SELECT COUNT(*) FROM (SELECT tanggal FROM ads_performance WHERE campaign_id=52 GROUP BY ad_id, tanggal HAVING COUNT(*)>1) z) AS ad_tanggal_ganda,
  (SELECT COALESCE(SUM(gross_revenue_usd::numeric * kurs::numeric),0) FROM last_row)    AS ads_gmv_view,
  (SELECT COALESCE(SUM(gross_revenue_usd::numeric * kurs::numeric),0) FROM portal_style) AS ads_gmv_portal,
  (SELECT COALESCE(SUM(cost_usd::numeric * kurs::numeric),0) FROM last_row)              AS ads_spend_idr_view,
  (SELECT COALESCE(SUM(cost_usd::numeric),0) FROM last_row)                              AS ads_spend_usd_portal_bug;

\echo '-- ad yang punya >1 baris pada tanggal sama (penyebab tie-break)'
SELECT ad_id, tanggal, COUNT(*) AS baris,
       COUNT(DISTINCT gross_revenue_usd::text) AS nilai_usd_berbeda,
       COUNT(DISTINCT kurs::text) AS kurs_berbeda
FROM ads_performance WHERE campaign_id = 52
GROUP BY ad_id, tanggal HAVING COUNT(*) > 1 ORDER BY baris DESC LIMIT 20;

\echo ''
\echo '################ §5. TOTAL GMV GABUNGAN ################'
WITH ap AS (
  SELECT DISTINCT LOWER(BTRIM(COALESCE(c.username,''))) AS u
  FROM campaign_creators cc JOIN creators c ON cc.creator_id = c.id
  WHERE cc.campaign_id = 52 AND cc.approval IN ('approved','alternate')
),
sk AS (
  SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid
  FROM skus WHERE campaign_id = 52 AND COALESCE(BTRIM(product_id),'') <> ''
),
org AS (
  SELECT COALESCE(SUM(s.gmv::numeric),0) AS v
  FROM sales s
  WHERE s.campaign_id=52
    AND LOWER(BTRIM(COALESCE(s.creator_username,''))) IN (SELECT u FROM ap)
    AND BTRIM(COALESCE(s.product_id,'')) IN (SELECT pid FROM sk)
),
lastad AS (
  SELECT COALESCE(SUM(gross_revenue_usd::numeric * kurs::numeric),0) AS v
  FROM (SELECT DISTINCT ON (ad_id) gross_revenue_usd, kurs FROM ads_performance
        WHERE campaign_id=52 ORDER BY ad_id, tanggal DESC, id DESC) z
),
viewrow AS (SELECT total_gmv, total_sales, total_ads_gmv FROM total_gmv WHERE campaign_id = 52)
SELECT
  (SELECT v FROM org)                                        AS organic_portal,
  (SELECT v FROM lastad)                                      AS ads_portal,
  (SELECT v FROM org) + (SELECT v FROM lastad)                 AS total_portal,
  (SELECT total_gmv FROM viewrow)                             AS total_view,
  (SELECT v FROM org) + (SELECT v FROM lastad) - (SELECT total_gmv FROM viewrow) AS selisih,
  (SELECT total_gmv FROM viewrow) - ((SELECT v FROM org) + (SELECT v FROM lastad)) AS selisih_tanda;

\echo ''
\echo '################ §6. VIEWS & LIKES ################'
-- TEMUAN: portal menjumlahkan views/likes untuk VIDEO + LIVESTREAM.
-- Internal (PerformaClient:180-198) hanya menjumlahkan VIDEO.
-- Kalau content_type livestream punya views besar, portal jauh lebih tinggi.
WITH sk AS (
  SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid
  FROM skus WHERE campaign_id = 52 AND COALESCE(BTRIM(product_id),'') <> ''
)
SELECT
  COALESCE(SUM(COALESCE(video_views,0)),0) AS views_portal,
  COALESCE(SUM(COALESCE(video_views,0)) FILTER (
      WHERE LOWER(COALESCE(content_type,'video')) NOT IN ('livestream','live')),0) AS views_internal,
  COALESCE(SUM(COALESCE(video_likes,0)),0) AS likes_portal,
  COALESCE(SUM(COALESCE(video_likes,0)) FILTER (
      WHERE LOWER(COALESCE(content_type,'video')) NOT IN ('livestream','live')),0) AS likes_internal
FROM organic_videos
WHERE campaign_id = 52 AND BTRIM(COALESCE(product_id,'')) IN (SELECT pid FROM sk);

\echo '-- views dari livestream saja (penyebab selisih)'
SELECT COUNT(*) AS baris,
       SUM(COALESCE(video_views,0))  AS views,
       SUM(COALESCE(video_likes,0))  AS likes
FROM organic_videos
WHERE campaign_id = 52
  AND LOWER(COALESCE(content_type,'')) IN ('livestream','live')
  AND BTRIM(COALESCE(product_id,'')) IN (SELECT pid FROM (SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid FROM skus WHERE campaign_id=52) q);

\echo '-- cek: views > 0 tapi likes > views (data korup)'
SELECT COUNT(*) AS baris, SUM(COALESCE(video_views,0)) AS views, SUM(COALESCE(video_likes,0)) AS likes
FROM organic_videos
WHERE campaign_id = 52 AND COALESCE(video_likes,0) > COALESCE(video_views,0);

\echo ''
\echo '################ §7. JUMLAH VIDEO ################'
-- Portal: fastVideoCountsData.total_approved = calcUniqueVideos (organik saja).
-- Internal: allApprovedVideoIds = organik + video manual dari tabel videos.
WITH sk AS (
  SELECT DISTINCT BTRIM(COALESCE(product_id,'')) AS pid
  FROM skus WHERE campaign_id = 52 AND COALESCE(BTRIM(product_id,'')) <> ''
),
org_vid AS (
  SELECT DISTINCT content_uid FROM organic_videos
  WHERE campaign_id=52 AND BTRIM(COALESCE(product_id,'')) IN (SELECT pid FROM sk)
    AND LOWER(COALESCE(content_type,'video')) NOT IN ('livestream','live')
    AND content_uid IS NOT NULL
),
manual_vid AS (
  SELECT v.id, v.content_uid, v.link_video, cc.approval
  FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
  WHERE cc.campaign_id = 52
)
SELECT
  (SELECT COUNT(*) FROM org_vid) AS video_organik,
  (SELECT COUNT(*) FROM manual_vid) AS video_manual,
  (SELECT COUNT(*) FROM manual_vid WHERE content_uid IS NOT NULL AND content_uid <> '') AS manual_punya_uid,
  (SELECT COUNT(*) FROM manual_vid WHERE approval IN ('approved','alternate')) AS manual_approved,
  (SELECT COUNT(DISTINCT content_uid) FROM manual_vid WHERE content_uid IS NOT NULL AND content_uid <> '') AS manual_uid_unik,
  (SELECT COUNT(*) FROM (SELECT content_uid FROM manual_vid WHERE content_uid IS NOT NULL AND content_uid <> ''
       INTERSECT SELECT content_uid FROM org_vid) z) AS uid_sudah_double;

\echo ''
\echo '################ §8. STATUS CREATOR ################'
-- Portal: TIDAK filter approval, ambil semua campaign_creators.
-- Internal: hanya ('approved','pending','alternate').
SELECT COALESCE(approval,'(NULL)') AS approval, COUNT(*) AS kreator
FROM campaign_creators WHERE campaign_id = 52
GROUP BY 1 ORDER BY 2 DESC;

\echo '-- Yang TAMPIL di portal tapi TIDAK di internal'
SELECT cc.id, cc.creator_id, c.username, cc.approval, cc.created_at
FROM campaign_creators cc LEFT JOIN creators c ON cc.creator_id=c.id
WHERE cc.campaign_id = 52
  AND LOWER(COALESCE(cc.approval,'')) NOT IN ('approved','pending','alternate')
ORDER BY cc.id;

\echo ''
\echo '################ §9. LIVE SESSIONS ################'
-- Portal: WHERE tt_campaign_id = '52' OR creator_username IN (kreator campaign 52)
-- OR itu bisa menarik live session dari campaign LAIN.
SELECT ls.tt_campaign_id,
       COUNT(*) AS live_session,
       SUM(COALESCE(ls.live_views,0)) AS views
FROM live_sessions ls
WHERE ls.tt_campaign_id = '52'
   OR ls.creator_username IN (
        SELECT c.username FROM campaign_creators cc JOIN creators c ON cc.creator_id=c.id
        WHERE cc.campaign_id = 52)
GROUP BY 1 ORDER BY 2 DESC;

\echo '-- live session yang terbawa oleh OR tapi BUKAN campaign 52'
SELECT ls.livestream_room_id, ls.creator_username, ls.tt_campaign_id, ls.start_time, ls.live_views
FROM live_sessions ls
WHERE (ls.tt_campaign_id = '52'
   OR ls.creator_username IN (
        SELECT c.username FROM campaign_creators cc JOIN creators c ON cc.creator_id=c.id
        WHERE cc.campaign_id = 52))
  AND COALESCE(ls.tt_campaign_id,'') <> '52'
ORDER BY ls.start_time LIMIT 25;

\echo ''
\echo '################ §10. TARGET & PERSENTASE ################'
SELECT target_gmv,
       ROUND(100 * (SELECT total_gmv FROM total_gmv WHERE campaign_id=52)
             / NULLIF(target_gmv,0), 2) AS persen_vs_view
FROM campaigns WHERE id = 52;

\echo ''
\echo '################ §11. RINGKASAN ANGKA UNTUK DIBANDINGKAN ################'
\echo 'Isi tabel ini yang akan dipakai untuk membandingkan portal vs internal vs view.'
