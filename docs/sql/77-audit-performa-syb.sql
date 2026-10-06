-- =====================================================================
-- Audit 3 angka performa SYB (campaign 46) + temuan content_type
-- 6 Okt 2026
--
-- User: "kreator yang udh ada di listing jangan diapa-apain ... cukup cek
-- aja performa penjualan, performa awareness video, dan performa
-- awareness live udah sesuai dengan sistem atau engga, dan harus sesuai"
--
-- Pemetaan ke kode:
--   performa penjualan      -> OrganicImport mode="sales"
--   performa awareness video -> OrganicImport mode="video"
--   performa awareness live  -> OrganicImport mode="live"
--
-- HASIL SYB (campaign 46) - SEMUA BERSIH:
--   live                     547 content_id
--   video                    496 content_id
--   sales                2.302 item / Rp 58.798.433
--   product_id di luar campaign       0 item / Rp 0
--   creator tanpa slot di campaign    0 item / Rp 0
--   content_uid ke campaign lain      0 item / Rp 0
--   sales tanpa content_uid           0 item / Rp 0
--
-- TEMUAN LAIN:
--   1. Tiga definisi "performa" berbeda tapi ANGKANYA SAMA SEKARANG
--      (0 campaign beda). Cabang OR di videoActions.ts:52,67 adalah
--      risiko LATENT, bukan bug aktif - karena tidak ada product_id
--      yang dipakai >1 campaign (terverifikasi 0).
--   2. sales.content_type punya 6 nilai, 2 di antaranya TIDAK masuk
--      hitungan live maupun video:
--        Showcase                  96 item / Rp  4.919.285
--        External Traffic Program 653 item / Rp 29.988.918
--      ILIKE '%live%' tidak cocok untuk keduanya.
--   3. organic_videos.content_type hanya 4 nilai (Video/Livestream/
--      livestream/video) - bersih, tidak ada tipe asing.
--   4. campaign_creators.added_by bertipe UUID, jadi tidak bisa diisi
--      string 'auto'. Tag AUTO sudah ada di CreatorRow.tsx:232:
--      (!cc.added_by || cc.tier === 'Auto-Detect')
--   5. gmv_30d / gmv_30d_video / gmv_30d_live di halaman listing BUKAN
--      performa campaign. Datanya dari creator_snapshots = data
--      screening TikTok seluruh brand (bersama followers/tier/ratecard).
--      Selisihnya 1.000-5.000x terhadap sales campaign. Contoh:
--        _karisma__01     snapshot Rp 3.000.000.000 | sales SYB Rp 603.145
--        mei_arifin180899 snapshot Rp 2.700.000.000 | sales SYB Rp 454.669
--
-- File ini READ-ONLY. Tidak ada UPDATE/DELETE.
-- =====================================================================

\pset pager off
\pset footer off

\echo '=== 1. tiga angka utama SYB ==='
SELECT
  (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
    WHERE o.campaign_id=46 AND lower(o.content_type)='livestream') AS live,
  (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
    WHERE o.campaign_id=46 AND lower(o.content_type)='video') AS video,
  (SELECT count(*) FROM sales s WHERE s.campaign_id=46) AS item_sales,
  (SELECT COALESCE(sum(s.gmv),0) FROM sales s
    WHERE s.campaign_id=46 AND s.is_refund=false) AS gmv_sales;

\echo ''
\echo '=== 2. konsistensi sales SYB (harus semua 0) ==='
SELECT 'product_id di luar campaign' AS cek, count(*) AS item, COALESCE(sum(s.gmv),0) AS gmv
FROM sales s WHERE s.campaign_id=46 AND s.is_refund=false
  AND (s.product_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM skus sk WHERE sk.campaign_id=46 AND sk.product_id=s.product_id))
UNION ALL
SELECT 'creator tanpa slot di campaign', count(*), COALESCE(sum(s.gmv),0)
FROM sales s WHERE s.campaign_id=46 AND s.is_refund=false
  AND NOT EXISTS (SELECT 1 FROM campaign_creators cc JOIN creators c ON c.id=cc.creator_id
                  WHERE cc.campaign_id=46 AND lower(c.username)=lower(s.creator_username))
UNION ALL
SELECT 'content_uid -> campaign lain', count(*), COALESCE(sum(s.gmv),0)
FROM sales s WHERE s.campaign_id=46 AND s.is_refund=false AND s.content_uid IS NOT NULL
  AND EXISTS (SELECT 1 FROM organic_videos o WHERE o.content_uid=s.content_uid AND o.campaign_id<>46)
  AND NOT EXISTS (SELECT 1 FROM organic_videos o WHERE o.content_uid=s.content_uid AND o.campaign_id=46)
UNION ALL
SELECT 'tanpa content_uid', count(*), COALESCE(sum(s.gmv),0)
FROM sales s WHERE s.campaign_id=46 AND s.is_refund=false
  AND (s.content_uid IS NULL OR s.content_uid='');

\echo ''
\echo '=== 3. content_type di sales se-DB - 2 nilai TIDAK masuk live/video ==='
\echo '--- ILIKE ''%live%'' tidak cocok untuk Showcase & External Traffic Program ---'
SELECT coalesce(content_type,'(NULL)') AS content_type,
       count(*) AS item, count(DISTINCT campaign_id) AS campaign,
       COALESCE(sum(gmv),0) AS gmv,
       count(*) FILTER (WHERE content_type ILIKE '%live%') AS kena_live,
       count(*) FILTER (WHERE lower(content_type)='video') AS kena_video
FROM sales GROUP BY 1 ORDER BY 4 DESC;

\echo ''
\echo '=== 4. organic_videos content_type - hanya 4 nilai, bersih ==='
SELECT coalesce(content_type,'(NULL)') AS content_type,
       count(*) AS baris, count(DISTINCT campaign_id) AS campaign
FROM organic_videos GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== 5. definisi ketat vs longgar (0 campaign beda = risiko latent) ==='
WITH angka AS (
  SELECT c.id, c.nama,
    (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
      WHERE o.campaign_id=c.id AND lower(o.content_type)='livestream') AS live_ketat,
    (SELECT count(DISTINCT o.content_uid) FROM organic_videos o
      WHERE (o.campaign_id=c.id OR (o.product_id IS NOT NULL AND o.product_id IN
             (SELECT product_id FROM skus WHERE campaign_id=c.id AND product_id IS NOT NULL)))
        AND lower(o.content_type)='livestream') AS live_longgar,
    (SELECT COALESCE(sum(s.gmv),0) FROM sales s
      WHERE s.campaign_id=c.id AND s.is_refund=false) AS gmv_ketat,
    (SELECT COALESCE(sum(s.gmv),0) FROM sales s
      WHERE (s.campaign_id=c.id OR (s.product_id IS NOT NULL AND s.product_id IN
             (SELECT product_id FROM skus WHERE campaign_id=c.id AND product_id IS NOT NULL)))
        AND s.is_refund=false) AS gmv_longgar
  FROM campaigns c WHERE c.status='aktif'
)
SELECT count(*) FILTER (WHERE live_ketat <> live_longgar) AS beda_live,
       count(*) FILTER (WHERE gmv_ketat <> gmv_longgar) AS beda_gmv,
       count(*) AS total_campaign
FROM angka;

\echo ''
\echo '=== 6. bukti gmv_30d BUKAN performa campaign ==='
SELECT c.username,
       (SELECT MAX(sn.gmv_30d) FROM creator_snapshots sn WHERE sn.creator_id=c.id) AS snapshot_gmv30d,
       (SELECT COALESCE(sum(s.gmv),0) FROM sales s
        WHERE s.campaign_id=46 AND lower(s.creator_username)=lower(c.username)
          AND s.is_refund=false) AS sales_syb_sebenarnya
FROM campaign_creators cc JOIN creators c ON c.id=cc.creator_id
WHERE cc.campaign_id=46
  AND (SELECT COALESCE(sum(s.gmv),0) FROM sales s
       WHERE s.campaign_id=46 AND lower(s.creator_username)=lower(c.username)
         AND s.is_refund=false) > 0
ORDER BY 3 DESC LIMIT 10;