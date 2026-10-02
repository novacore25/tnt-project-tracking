\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

-- =====================================================================
-- REFUND DIMASUKKAN KE total_gmv (keputusan owner, 2 Oktober 2026)
-- =====================================================================
--
-- KEADAAN SEBELUM:
--   View  : `WHERE is_refund = false`  -> refund DIKECILIKAN
--   Portal: tidak punya filter sama sekali -> refund DIJUMPLAHKAN
--   Performa: tidak punya filter sama sekali -> refund DIJUMPLAHKAN
--
--KEPUTUSAN PEMILIK (user, 2 Okt 2026):
--   "refund itu ga ngaruh semua data masuk termasuk refund"
--   -> Semua refund harus masuk, sama seperti portal & Performa.
--   -> Yang harus diubah adalah VIEW, supaya Harian ikut konsisten.
--
-- CATATAN PENTING SOAL TANDANYA:
--   `sales.gmv` untuk `is_refund = true` tersimpan sebagai ANGKA POSITIF,
--   bukan negatif. Jadi menjumlahkannya MENAMBAH pendapatan, bukan mengurangi.
--   Verifikasi 2 Okt 2026 (docs/sql/50, §13):
--     7.054 baris refund -> 6.985 positif, 0 negatif, 69 nol
--     SUM = Rp 310.173.535
--
--   Ini keputusan AKUNTANSI yang saya terima dan tidak saya ubah. Yang saya
--   lakukan hanya menyamakan view dengan portal supaya tidak ada lagi dua
--   angka yang berbeda untuk campaign yang sama.
--
--   Kalau nanti pemilik berubah pikiran, migration pembalik tinggal
--   `SET is_refund = false` kembali.
--
-- DAMPAK YANG DISENGaja:
--   total_gmv seluruh DB naik dari Rp 1.144.431.700 -> Rp 1.454.605.235 (+21,32%)
--   Harian, Rekap, Dashboard, Timeline SEMUA ikut naik, karena semuanya
--   membaca view ini. Ini bukan efek samping, ini memang akibat keputusan di atas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Simpan angka lama (tidak pernah dihapus)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_vw_campaign_summary_before_20261003 AS
SELECT campaign_id, nama, total_gmv, total_gmv_video, total_gmv_live,
       total_ads_gmv, total_ads_spend
FROM vw_campaign_summary;

\echo '--- definisi LAMA tersimpan di _backup_view_vw_campaign_summary_20261002 ---'
\echo '--- angka LAMA tersimpan di _backup_vw_campaign_summary_before_20261003 ---'

\echo ''
\echo '=== SEBELUM ==='
SELECT COALESCE(sum(total_gmv), 0)        AS total_gmv,
       COALESCE(sum(total_gmv_video), 0) AS gmv_video,
       COALESCE(sum(total_gmv_live), 0)  AS gmv_live,
       COALESCE(sum(total_ads_gmv), 0)   AS ads_gmv,
       COUNT(*)                           AS jumlah_campaign
FROM vw_campaign_summary;

\echo ''
\echo '=== SEBERAPA REFUND SEBENARNYA, PER CAMPAIGN (top 20) ==='
SELECT s.campaign_id,
       COALESCE(SUM(s.gmv::numeric) FILTER (WHERE s.is_refund IS TRUE), 0)  AS refund,
       COALESCE(SUM(s.gmv::numeric), 0)                                   AS total_dengan_refund,
       COALESCE(SUM(s.gmv::numeric) FILTER (WHERE s.is_refund IS NOT TRUE), 0) AS total_tanpa_refund
FROM sales s
GROUP BY 1
HAVING COALESCE(SUM(s.gmv::numeric) FILTER (WHERE s.is_refund IS TRUE), 0) > 0
ORDER BY 2 DESC LIMIT 20;

-- ---------------------------------------------------------------------
-- 2. View baru
--    HANYA satu perubahan: `WHERE is_refund = false` dihapus.
--    Urutan & nama kolom WAJIB sama persis (CREATE OR REPLACE VIEW tidak
--    bisa mengubah nama atau memindahkan kolom).
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
    WHERE campaign_id IS NOT NULL
    GROUP BY campaign_id
),
-- Video Shopping Ads. Laporan Ads mengambil data ALL TIME setiap tanggal,
-- jadi tiap ad_id punya banyak baris kumulatif yang nilainya monoton
-- naik. Yang dipakai adalah NILAI PADA TANGGAL TERAKHIR untuk tiap ad_id,
-- sesuai aturan pemilik sistem. Kurs memakai kurs pada baris itu sendiri.
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

    -- Total resmi: sales (REFUND IKUT DIHITUNG) + Video Shopping Ads.
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
    -- video + live + ads = total, dicek di guard 1 di bawah.
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
-- 3. GUARD 1: video + live + ads harus sama dengan total_gmv
--    Sama seperti migration 20261002000000.
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
-- 4. GUARD 2: tidak boleh ada campaign yang total_gmv-nya TURUN
--
--    Hitung JUMLAH campaign yang turun, bukan jumlah selisihnya. Guard
--    berbasis `sum(before - after)` bisa lolos meski satu campaign turun
--    ditutup oleh kenaikan campaign lain (sudah pernah terjadi).
--
--    Kalau refund positif, tidak ada campaign yang seharusnya turun.
--    Guard ini menangkap filter yang terbalik atau salah tempel.
-- ---------------------------------------------------------------------
DO $$
DECLARE jumlah_turun integer;
DECLARE contoh text;
BEGIN
    SELECT count(*), string_agg(x.nama, ' | ')
    INTO jumlah_turun, contoh
    FROM (
        SELECT b.nama
        FROM _backup_vw_campaign_summary_before_20261003 b
        JOIN vw_campaign_summary v ON v.campaign_id = b.campaign_id
        WHERE COALESCE(v.total_gmv, 0) < COALESCE(b.total_gmv, 0)
    ) x;

    IF jumlah_turun > 0 THEN
        RAISE EXCEPTION 'Batal: % campaign punya total_gmv turun: %',
              jumlah_turun, left(COALESCE(contoh, ''), 400);
    END IF;

    RAISE NOTICE '--    Guard 2 OK: tidak ada campaign yang total_gmv turun';
END $$;

-- ---------------------------------------------------------------------
-- 5. GUARD 3: refund HARUS ikut terhitung
--
--    Ini guard yang paling penting untuk migration ini. Kalau filter
--    `is_refund = false` somehow masih ada di view, guard 1 dan 2 tetap
--    lolos karena keduanya cuma membandingkan bagian view dengan bagian
--    view. Guard 3 membandingkan view dengan TABEL ASLI, jadi hanya bisa
--    lolos kalau refund benar-benar ikut terhitung.
--
--    Per campaign: total_gmv view harus sama dengan
--    SUM(sales.gmv SEMUA baris, tanpa filter) + ads.
-- ---------------------------------------------------------------------
DO $$
DECLARE jumlah_berbeda integer;
DECLARE contoh text;
BEGIN
    SELECT count(*), string_agg(x.nama, ' | ')
    INTO jumlah_berbeda, contoh
    FROM (
        SELECT c.nama
        FROM campaigns c
        LEFT JOIN (
            SELECT campaign_id, SUM(gmv::numeric) AS org
            FROM sales WHERE campaign_id IS NOT NULL GROUP BY campaign_id
        ) s ON s.campaign_id = c.id
        LEFT JOIN (
            SELECT campaign_id, SUM(ads_gmv_idr) AS ads
            FROM (
                SELECT DISTINCT ON (campaign_id, ad_id)
                       campaign_id, gross_revenue_usd * kurs AS ads_gmv_idr
                FROM ads_performance
                ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
            ) z GROUP BY campaign_id
        ) a ON a.campaign_id = c.id
        JOIN vw_campaign_summary v ON v.campaign_id = c.id
        WHERE COALESCE(v.total_gmv, 0)
              <> COALESCE(s.org, 0) + COALESCE(a.ads, 0)
    ) x;

    IF jumlah_berbeda > 0 THEN
        RAISE EXCEPTION
            'Batal: % campaign total_gmv-nya tidak sama dengan sales mentah + ads. Kemungkinan filter is_refund masih aktif di view: %',
            jumlah_berbeda, left(COALESCE(contoh, ''), 400);
    END IF;

    RAISE NOTICE 'Guard 3 OK: total_gmv = sales semua baris (refund ikut) + ads, di semua campaign';
END $$;

\echo ''
\echo '=== SESUDAH ==='
SELECT COALESCE(sum(total_gmv), 0)        AS total_gmv,
       COALESCE(sum(total_gmv_video), 0) AS gmv_video,
       COALESCE(sum(total_gmv_live), 0)  AS gmv_live,
       COALESCE(sum(total_ads_gmv), 0)   AS ads_gmv,
       COUNT(*)                           AS jumlah_campaign
FROM vw_campaign_summary;

\echo ''
\echo '=== SELISIH PER CAMPAIGN (naik = refund masuk) ==='
SELECT b.nama,
       b.total_gmv AS sebelum,
       v.total_gmv AS sesudah,
       v.total_gmv - b.total_gmv AS naik
FROM _backup_vw_campaign_summary_before_20261003 b
JOIN vw_campaign_summary v ON v.campaign_id = b.campaign_id
WHERE v.total_gmv <> b.total_gmv
ORDER BY 4 DESC;

COMMIT;

\echo ''
\echo '=== SELESAI. Refund sekarang ikut terhitung di semua halaman. ==='
\echo '=== Rollback: CREATE OR REPLACE VIEW dengan WHERE is_refund = false ==='
