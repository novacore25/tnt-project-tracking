
\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Simpan definisi & angka lama
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_view_vw_campaign_summary_20261002 AS
SELECT pg_get_viewdef('vw_campaign_summary'::regclass, true) AS definisi_lama,
       now() AS dicadangkan_pada;

\echo '--- definisi LAMA tersimpan di _backup_view_vw_campaign_summary_20261002 ---'

CREATE TABLE IF NOT EXISTS _backup_vw_campaign_summary_before_20261002 AS
SELECT campaign_id, nama, total_gmv, total_gmv_video, total_gmv_live,
       total_ads_gmv, total_ads_spend, budget_ads_terpakai, sisa_budget_ads
FROM vw_campaign_summary;

\echo ''
\echo '=== SEBELUM ==='
SELECT COALESCE(sum(total_gmv), 0)        AS total_gmv,
       COALESCE(sum(total_gmv_video), 0) AS gmv_video,
       COALESCE(sum(total_gmv_live), 0)  AS gmv_live,
       COALESCE(sum(total_ads_gmv), 0)   AS ads_gmv,
       COALESCE(sum(total_ads_spend), 0) AS total_ads_spend
FROM vw_campaign_summary;

-- ---------------------------------------------------------------------
-- 2. Bukti: MAX per ad vs TANGGAL TERAKHIR per ad
--    Kalau sama, tidak ada ad yang nilainya turun di kemudian hari.
-- ---------------------------------------------------------------------
\echo ''
\echo '=== BUKTI: MAX per ad vs TANGGAL TERAKHIR per ad ==='
WITH max_per_ad AS (
    SELECT campaign_id, ad_id, MAX(gross_revenue_usd * kurs) AS gmv
    FROM ads_performance GROUP BY campaign_id, ad_id
),
last_per_ad AS (
    SELECT DISTINCT ON (campaign_id, ad_id)
           campaign_id, ad_id, gross_revenue_usd * kurs AS gmv
    FROM ads_performance
    ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
)
SELECT
  (SELECT count(*) FROM max_per_ad)                                        AS jumlah_ad,
  round((SELECT sum(gmv) FROM max_per_ad))                                 AS total_max_per_ad,
  round((SELECT sum(gmv) FROM last_per_ad))                                AS total_tanggal_terakhir,
  round((SELECT sum(gmv) FROM max_per_ad)
        - (SELECT sum(gmv) FROM last_per_ad))                              AS selisih,
  (SELECT count(*) FROM max_per_ad m
     JOIN last_per_ad l ON l.ad_id = m.ad_id AND l.campaign_id = m.campaign_id
    WHERE m.gmv <> l.gmv)                                                  AS ad_yang_berbeda;

\echo ''
\echo '=== 20 AD YANG NILAINYA BEDA: MAX vs TANGGAL TERAKHIR ==='
\echo '-- Kalau nilai di tanggal terakhir LEBIH KECIL dari max, berarti ada'
\echo '-- baris yang nilainya turun (report-all-time TikTok biasanya reset'
\echo '-- atau refresh). Periksa 20 ini sebelum trusting angka.'
WITH max_per_ad AS (
    SELECT campaign_id,
           ad_id,
           MAX(gross_revenue_usd * kurs) AS gmv_max,
           MAX(cost_usd * kurs)          AS cost_max
    FROM ads_performance
    GROUP BY campaign_id, ad_id
),
last_per_ad AS (
    SELECT DISTINCT ON (campaign_id, ad_id)
           campaign_id,
           ad_id,
           tanggal,
           gross_revenue_usd * kurs AS gmv_terakhir,
           cost_usd * kurs          AS cost_terakhir
    FROM ads_performance
    ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
)
SELECT
  l.campaign_id,
  l.ad_id,
  l.tanggal                             AS tanggal_terakhir,
  round(m.gmv_max)                      AS gmv_max,
  round(l.gmv_terakhir)                 AS gmv_tanggal_terakhir,
  round(m.gmv_max - l.gmv_terakhir)     AS gmv_beda,
  round(m.cost_max - l.cost_terakhir)   AS spend_beda
FROM last_per_ad l
JOIN max_per_ad m ON m.ad_id = l.ad_id AND m.campaign_id = l.campaign_id
WHERE m.gmv_max <> l.gmv_terakhir
ORDER BY abs(m.gmv_max - l.gmv_terakhir) DESC
LIMIT 20;

-- ---------------------------------------------------------------------
-- 3. View baru
--    Urutan & nama kolom WAJIB sama persis. CREATE OR REPLACE VIEW tidak
--    bisa mengubah nama atau memindahkan kolom.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_campaign_summary AS
WITH organic_sales AS (
    SELECT
        campaign_id,
        SUM(gmv) AS total_organic_gmv,
        SUM(gmv) FILTER (
            WHERE content_type ILIKE '%live%' OR content_type ILIKE '%livestream%'
        ) AS total_gmv_live,
        -- Video DAN live harus selalu berjumlah sama dengan organic, jadi
        -- content_type NULL harus masuk ke video. Kalau tidak, `NOT (NULL
        -- ILIKE ...)` jadi NULL dan barisnya hilang dari KEDUA pecahan,
        -- sehingga video + live tidak akan sama dengan total_gmv dan
        -- guard 1 akan membatalkan migration ini.
        SUM(gmv) FILTER (
            WHERE content_type IS NULL
               OR NOT (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
        ) AS total_gmv_video
    FROM sales
    WHERE is_refund = false
      AND campaign_id IS NOT NULL
    GROUP BY campaign_id
),
-- Video Shopping Ads. Laporan Ads mengambil data ALL TIME setiap tanggal,
-- jadi tiap ad_id punya banyak baris kumulatif yang nilainya monoton
-- naik. Yang dipakai adalah NILAI PADA TANGGAL TERAKHIR untuk tiap ad_id,
-- sesuai aturan pemilik sistem.
ads_per_ad AS (
    SELECT DISTINCT ON (campaign_id, ad_id)
           campaign_id,
           ad_id,
           gross_revenue_usd * kurs AS ads_gmv_idr,
           cost_usd * kurs          AS ads_cost_idr
    FROM ads_performance
    ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
),
ads_sales AS (
    SELECT campaign_id,
           SUM(ads_gmv_idr)  AS total_ads_gmv_idr,
           SUM(ads_cost_idr) AS total_ads_cost_idr
    FROM ads_per_ad
    GROUP BY campaign_id
),
videos_count AS (
    SELECT cc.campaign_id, COUNT(v.id) as total_video_tayang
    FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    WHERE v.link_video IS NOT NULL
    GROUP BY cc.campaign_id
),
creators_count AS (
    SELECT campaign_id, COUNT(id) as total_creator_approved
    FROM campaign_creators WHERE approval = 'approved'
    GROUP BY campaign_id
),
payment_stats AS (
    SELECT campaign_id, COALESCE(SUM(nominal_pelunasan), 0) AS total_pembayaran_kreator
    FROM campaign_creators GROUP BY campaign_id
),
-- Field mati, selalu 0. Dipertahankan supaya tipe & urutan kolom tidak berubah.
daily_stats AS (
    SELECT campaign_id,
           COALESCE(SUM(organic_sales), 0) as total_daily_organic,
           COALESCE(SUM(vsa_sales), 0) as total_daily_vsa
    FROM daily_performance GROUP BY campaign_id
)
SELECT
    c.id as campaign_id,
    c.nama,
    c.tipe_campaign,
    c.status,
    c.start_date,
    c.end_date,
    c.target_gmv,
    c.target_video,
    c.target_creator,
    c.budget_creator_plafon,
    c.budget_ads_plafon,

    -- Total resmi sekarang: sales + Video Shopping Ads.
    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS total_gmv_achievement,
    COALESCE(vc.total_video_tayang, 0) as achievement_video,
    COALESCE(cr.total_creator_approved, 0) as achievement_creator,
    COALESCE(a.total_ads_cost_idr, 0) as budget_ads_terpakai,
    c.budget_ads_plafon - COALESCE(a.total_ads_cost_idr, 0) as sisa_budget_ads,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS tracked_creator_gmv,

    -- Field mati, selalu 0.
    COALESCE(ds.total_daily_organic, 0) AS total_daily_organic,
    COALESCE(ds.total_daily_vsa, 0) AS total_daily_vsa,
    (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)) AS official_daily_gmv,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS total_gmv,
    COALESCE(ps.total_pembayaran_kreator, 0) AS total_pembayaran_kreator,
    COALESCE(a.total_ads_cost_idr, 0) AS total_ads_spend,

    -- Pemecahan live vs video HANYA dari sales. Ads tidak punya
    -- pemecahan itu, jadi angka video + live tidak akan sama dengan
    -- total -- itu benar, bukan bug. Yang dijaga identity-nya adalah
    -- video + live + ads = total, dicek di guard di bawah.
    COALESCE(o.total_gmv_video, 0) AS total_gmv_video,
    COALESCE(o.total_gmv_live, 0)  AS total_gmv_live,

    -- Video Shopping Ads. Sekarang jadi KOMPONEN total_gmv.
    COALESCE(a.total_ads_gmv_idr, 0) AS total_ads_gmv
FROM campaigns c
LEFT JOIN organic_sales o ON c.id = o.campaign_id
LEFT JOIN ads_sales a ON c.id = a.campaign_id
LEFT JOIN videos_count vc ON c.id = vc.campaign_id
LEFT JOIN creators_count cr ON c.id = cr.campaign_id
LEFT JOIN payment_stats ps ON c.id = ps.campaign_id
LEFT JOIN daily_stats ds ON c.id = ds.campaign_id;

-- ---------------------------------------------------------------------
-- 4. GUARD 1: video + live + ads harus sama dengan total_gmv
-- ---------------------------------------------------------------------
DO $$
DECLARE selisih numeric;
BEGIN
    SELECT COALESCE(sum(ABS(
        COALESCE(total_gmv_video,0) + COALESCE(total_gmv_live,0)
        + COALESCE(total_ads_gmv,0) - COALESCE(total_gmv,0)
    )), 0)
    INTO selisih
    FROM vw_campaign_summary;

    IF selisih <> 0 THEN
        RAISE EXCEPTION 'Batal: video + live + ads tidak sama dengan total_gmv, selisih %', selisih;
    END IF;

    RAISE NOTICE 'Guard 1 OK: video + live + ads = total_gmv di semua campaign';
END $$;

-- ---------------------------------------------------------------------
-- 5. GUARD 2: TIDAK BOLEH ADA campaign yang total_gmv-nya turun
--
--    BUG YANG PERNAH ADA DI SINI (2 Okt 2026, sudah diperbaiki):
--      SELECT sum(GREATEST(b.total_gmv,0) - v.total_gmv)
--    Itu menjumlahkan SELISIH, jadi kenaikan di satu campaign meniadakan
--    penurunan di campaign lain. Semua campaign naik -> hasilnya negatif ->
--    guard membatalkan padahal tidak ada yang salah. Dan lebih berbahaya:
--    satu campaign yang turun bisa tertutup oleh kenaikan campaign lain dan
--    guard tetap lolos.
--
--    Yang benar: hitung campaign yang turun. Satu pun = batal.
-- ---------------------------------------------------------------------
DO $$
DECLARE jumlah_turun integer;
DECLARE contoh text;
BEGIN
    SELECT count(*),
           string_agg(x.nama, ' | ')
    INTO jumlah_turun, contoh
    FROM (
        SELECT b.nama
        FROM _backup_vw_campaign_summary_before_20261002 b
        JOIN vw_campaign_summary v ON v.campaign_id = b.campaign_id
        WHERE COALESCE(v.total_gmv, 0) < COALESCE(b.total_gmv, 0)
    ) x;

    IF jumlah_turun > 0 THEN
        RAISE EXCEPTION 'Batal: % campaign punya total_gmv turun: %',
              jumlah_turun, left(COALESCE(contoh, ''), 400);
    END IF;

    RAISE NOTICE 'Guard 2 OK: tidak ada campaign yang total_gmv turun';
END $$;

\echo ''
\echo '=== SESUDAH ==='
SELECT COALESCE(sum(total_gmv), 0)        AS total_gmv,
       COALESCE(sum(total_gmv_video), 0) AS gmv_video,
       COALESCE(sum(total_gmv_live), 0)  AS gmv_live,
       COALESCE(sum(total_ads_gmv), 0)   AS ads_gmv,
       COALESCE(sum(total_ads_spend), 0) AS total_ads_spend
FROM vw_campaign_summary;

\echo ''
\echo '=== PERBANDINGAN PER CAMPAIGN (yang berubah) ==='
SELECT b.campaign_id, b.nama,
       b.total_gmv                       AS gmv_sebelum,
       v.total_gmv                       AS gmv_sesudah,
       v.total_gmv - b.total_gmv         AS selisih,
       v.total_gmv_video                 AS gmv_video,
       v.total_gmv_live                  AS gmv_live,
       v.total_ads_gmv                   AS ads_gmv,
       v.total_ads_spend                 AS ads_spend,
       v.budget_ads_plafon,
       v.sisa_budget_ads
FROM _backup_vw_campaign_summary_before_20261002 b
JOIN vw_campaign_summary v ON v.campaign_id = b.campaign_id
WHERE b.total_gmv <> v.total_gmv
ORDER BY abs(v.total_gmv - b.total_gmv) DESC
LIMIT 40;

\echo ''
\echo '=== CEK: video + live + ads harus sama dengan total ==='
SELECT count(*) AS campaign_tidak_konsisten
FROM vw_campaign_summary
WHERE COALESCE(total_gmv_video,0) + COALESCE(total_gmv_live,0)
    + COALESCE(total_ads_gmv,0) <> COALESCE(total_gmv,0);

\echo ''
\echo '=== BULANAN: kenapa Agustus-Oktober terlihat turun (ads berhenti 20 Jul) ==='
WITH s AS (SELECT date_trunc('month', tanggal)::date AS bulan, round(sum(gmv)) AS gmv
           FROM sales WHERE NOT is_refund AND campaign_id IS NOT NULL GROUP BY 1),
per_ad AS (SELECT DISTINCT ON (campaign_id, ad_id) campaign_id, ad_id,
                  tanggal, gross_revenue_usd * kurs AS gmv
           FROM ads_performance ORDER BY campaign_id, ad_id, tanggal DESC, id DESC),
d AS (SELECT date_trunc('month', tanggal)::date AS bulan, round(sum(gmv)) AS gmv
      FROM per_ad GROUP BY 1)
SELECT COALESCE(s.bulan, d.bulan) AS bulan,
       COALESCE(s.gmv, 0) AS gmv_sales,
       COALESCE(d.gmv, 0) AS ads_gmv,
       COALESCE(s.gmv, 0) + COALESCE(d.gmv, 0) AS total,
       CASE WHEN COALESCE(d.gmv,0) = 0 AND COALESCE(s.gmv,0) > 0
            THEN 'TIDAK ADA DATA ADS bulan ini' ELSE '' END AS catatan
FROM s FULL OUTER JOIN d ON s.bulan = d.bulan
ORDER BY 1;

\echo ''
\echo '=== GMV order yang tidak masuk campaign mana pun ==='
SELECT count(*) AS jml_order, round(COALESCE(sum(gmv),0)) AS gmv
FROM sales WHERE NOT is_refund AND campaign_id IS NULL;

COMMIT;
