-- =====================================================================
-- 20261001200000 - Total GMV campaign hanya dari sales (order affiliate)
--
-- MASALAH
--   vw_campaign_summary menjumlahkan tiga sumber:
--     total_gmv = GREATEST(daily_performance, sales + ads_performance + legacy)
--
--   1. ads_performance TIDAK bisa dijumlahkan dengan sales.
--      Kolom gross_revenue_usd dan purchases naik monoton per tanggal, jadi
--      isinya akumulasi sejak awal per ad, bukan nilai harian. Untuk OMG
--      Makeup, max per tanggal datar di ~74 juta selama tiga minggu sementara
--      SUM merangkak ke 786 juta. Menjumlahkan nilai kumulatif menghitung ulang
--      revenue yang sama. Terbukti juga dari nilainya: dengan ambil MAX per ad,
--      total ads = Rp 1.086.274.665, sedangkan sales = Rp 1.110.174.161.
--      Selisih 2,2 persen, jadi itu revenue yang sama dari dua sumber.
--      Ditambah, purchases 16.200 berbanding 31 order sales di hari yang sama
--      pada 15 Juni 2026, jadi kolom itu juga bukan attributable ke iklan.
--
--   2. daily_performance kosong total, 0 baris, dan tidak ada satu pun INSERT
--      ke sana di seluruh codebase. official_daily_gmv dan total_daily_organic
--      selalu 0, itu field mati.
--
--   3. gmv_organic_legacy dan gmv_ads_legacy di campaign_creators bernilai nol
--      di semua campaign, jadi tidak menambah apa pun.
--
--   Akibatnya dashboard melaporkan Rp 12.539.258.703 sementara order yang
--   tercatat hanya Rp 1.110.174.161.
--
-- KEPUTUSAN DOMAIN (dari pemilik sistem, 1 Okt 2026)
--   Total GMV dihitung dari order_id saja. Order dengan content_type live
--   dihitung sebagai GMV live, selain itu GMV video. Custom report hanya
--   untuk awareness dan menghitung jumlah video, bukan untuk sales, jadi
--   live_session_products dan organic_videos tidak masuk total GMV.
--   Ads Manager juga bukan revenue tambahan, karena order sudah tercatat di
--   sales. Data ads tetap ditampilkan sebagai informasi terpisah, bukan
--   dijumlahkan ke total.
--
-- PERUBAHAN
--   total_gmv            = SUM(sales.gmv) non-refund
--   total_gmv_achievement= SUM(sales.gmv) non-refund
--   tracked_creator_gmv  = SUM(sales.gmv) non-refund
--   Ditambah dua kolom baru: total_gmv_video dan total_gmv_live, dipecah
--   dari content_type memakai pola ILIKE yang sama seperti paymentActions.ts.
--
--   total_ads_spend dan budget_ads_terpakai sekarang memakai MAX per ad
--   menggantikan SUM. Ini memperbaiki klaim over budget pada 5 campaign:
--   OMG Makeup tercatat 204 juta dari plafon 60 juta, padahal setelah
--   dihitung per ad nilainya 15,4 juta. sisa_budget_ads ikut terkoreksi.
--
--   Kolom dead total_daily_organic, total_daily_vsa dan official_daily_gmv
--   tetap dipertahankan bernilai 0 supaya tidak ada kolom yang hilang dan
--   types/database.ts tetap cocok, tapi tidak lagi dipakai di mana pun.
--
-- AMAN
--   Tidak ada INSERT, UPDATE, atau DELETE. Hanya definisi view.
--   Definisi lama disimpan di _backup_view_vw_campaign_summary sebelum
--   ditimpa, dan dicetak lewat \echo supaya bisa disalin kembali.
--   sales tidak disentuh, jadi GMV per order dan seluruh angka existing
--   tidak berubah.
-- =====================================================================

\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Simpan definisi lama
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_view_vw_campaign_summary_20261001 AS
SELECT pg_get_viewdef('vw_campaign_summary'::regclass, true) AS definisi_lama,
       now() AS dicadangkan_pada;

\echo '--- definisi LAMA tersimpan di _backup_view_vw_campaign_summary_20261001 ---'

-- ---------------------------------------------------------------------
-- 2. Angka sebelum perubahan
--    Tabel biasa, bukan TEMP, karena perbandingan dicetak sebelum COMMIT.
--    Percobaan pertama memakai TEMP ON COMMIT DROP dan errornya
--    "relation _sebelum does not exist" sesudah COMMIT.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_vw_campaign_summary_before_20261001 AS
SELECT campaign_id, nama, total_gmv, total_gmv_achievement,
       budget_ads_terpakai, sisa_budget_ads
FROM vw_campaign_summary;

\echo ''
\echo '=== SEBELUM: total dashboard ==='
SELECT COALESCE(sum(total_gmv),0) AS total_gmv,
       COALESCE(sum(budget_ads_terpakai),0) AS total_ads_spend
FROM _backup_vw_campaign_summary_before_20261001;

-- ---------------------------------------------------------------------
-- 3. View baru
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_campaign_summary AS
WITH organic_sales AS (
    SELECT
        campaign_id,
        SUM(gmv) AS total_organic_gmv,
        -- Pemecahan live vs video memakai ILIKE yang sama dengan
        -- paymentActions.ts:206 dan livestreamActions.ts:59, supaya konsisten
        -- dengan halaman lain.
        SUM(gmv) FILTER (
            WHERE content_type ILIKE '%live%' OR content_type ILIKE '%livestream%'
        ) AS total_gmv_live,
        SUM(gmv) FILTER (
            WHERE NOT (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
        ) AS total_gmv_video
    FROM sales
    WHERE is_refund = false
      AND campaign_id IS NOT NULL
    GROUP BY campaign_id
),
-- Kolom ads PerManager kumulatif per ad, bukan harian. MAX per ad
-- mengambil nilai terbesar yang pernah tercatat untuk ad tersebut, jadi
-- tidak berlaku ganda dan tetap aman kalau baris terakhir tidak lengkap.
-- MAX sama dengan nilai terakhir untuk ad yang nilainya naik monoton.
ads_per_ad AS (
    SELECT
        campaign_id,
        ad_id,
        MAX(gross_revenue_usd * kurs) AS ads_gmv_idr,
        MAX(cost_usd * kurs)          AS ads_cost_idr
    FROM ads_performance
    GROUP BY campaign_id, ad_id
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
-- Dipertahankan apa adanya, bukan diganti 0::bigint, supaya tipe kolom
-- total_daily_organic, total_daily_vsa dan official_daily_gmv dijamin sama
-- dengan definisi sebelumnya. CREATE OR REPLACE VIEW menolak perubahan tipe
-- maupun urutan kolom. Tabelnya kosong, jadi hasilnya tetap 0.
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

    -- PENTING: urutan dan nama kolom di bawah WAJIB sama persis dengan
    -- definisi sebelumnya. CREATE OR REPLACE VIEW tidak bisa mengubah nama
    -- atau memindahkan kolom, hanya boleh menambah kolom baru di paling akhir.
    -- Percobaan pertama gagal dengan:
    --   cannot change name of view column "tracked_creator_gmv" to
    --   "total_gmv_video"
    -- karena kolom baru disisipkan di tengah.
    COALESCE(o.total_organic_gmv, 0) AS total_gmv_achievement,
    COALESCE(vc.total_video_tayang, 0) as achievement_video,
    COALESCE(cr.total_creator_approved, 0) as achievement_creator,
    COALESCE(a.total_ads_cost_idr, 0) as budget_ads_terpakai,
    c.budget_ads_plafon - COALESCE(a.total_ads_cost_idr, 0) as sisa_budget_ads,

    -- Sama dengan total GMV. Dipertahankan karena masih dipakai dashboard.
    COALESCE(o.total_organic_gmv, 0) AS tracked_creator_gmv,

    -- Field mati, selalu 0. daily_performance tidak pernah diisi siapa pun.
    -- Dipertahankan agar tidak ada kolom yang hilang, tapi jangan dipakai.
    COALESCE(ds.total_daily_organic, 0) AS total_daily_organic,
    COALESCE(ds.total_daily_vsa, 0) AS total_daily_vsa,
    (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)) AS official_daily_gmv,

    COALESCE(o.total_organic_gmv, 0) AS total_gmv,
    COALESCE(ps.total_pembayaran_kreator, 0) AS total_pembayaran_kreator,
    COALESCE(a.total_ads_cost_idr, 0) AS total_ads_spend,

    -- Kolom baru, ditambahkan di akhir. Pecahan live vs video supaya total
    -- bisa ditelusuri ke order_id.
    COALESCE(o.total_gmv_video, 0) AS total_gmv_video,
    COALESCE(o.total_gmv_live, 0)  AS total_gmv_live,

    -- Informasi iklan. TIDAK ikut dijumlahkan ke total_gmv, karena
    -- gross_revenue_usd mengukur revenue shop yang sama dengan sales.
    COALESCE(a.total_ads_gmv_idr, 0) AS total_ads_gmv
FROM campaigns c
LEFT JOIN organic_sales o ON c.id = o.campaign_id
LEFT JOIN ads_sales a ON c.id = a.campaign_id
LEFT JOIN videos_count vc ON c.id = vc.campaign_id
LEFT JOIN creators_count cr ON c.id = cr.campaign_id
LEFT JOIN payment_stats ps ON c.id = ps.campaign_id
LEFT JOIN daily_stats ds ON c.id = ds.campaign_id;

-- ---------------------------------------------------------------------
-- 4. Verifikasi: total GMV harus PERSIS sama dengan SUM(sales.gmv)
--    per campaign. Kalau berbeda, ada yang tidak sesuai maksud.
-- ---------------------------------------------------------------------
DO $$
DECLARE selisih numeric;
BEGIN
    SELECT COALESCE(sum(ABS(COALESCE(v.total_gmv,0) - COALESCE(s.gmv_campaign,0))), 0)
    INTO selisih
    FROM vw_campaign_summary v
    LEFT JOIN (SELECT campaign_id, SUM(gmv) AS gmv_campaign
               FROM sales WHERE is_refund = false AND campaign_id IS NOT NULL
               GROUP BY campaign_id) s ON s.campaign_id = v.campaign_id;

    IF selisih <> 0 THEN
        RAISE EXCEPTION 'Batal: total_gmv tidak sama dengan SUM(sales.gmv), selisih %', selisih;
    END IF;

    RAISE NOTICE 'Verifikasi OK: total_gmv per campaign identik dengan SUM(sales.gmv)';
END $$;

\echo ''
\echo '=== SESUDAH: total dashboard ==='
SELECT COALESCE(sum(total_gmv),0)              AS total_gmv,
       COALESCE(sum(total_gmv_video),0)       AS gmv_video,
       COALESCE(sum(total_gmv_live),0)        AS gmv_live,
       COALESCE(sum(total_ads_gmv),0)         AS info_ads_gmv,
       COALESCE(sum(total_ads_spend),0)       AS total_ads_spend
FROM vw_campaign_summary;

-- ---------------------------------------------------------------------
-- 5. Perbandingan per campaign, dicetak SEBELUM COMMIT
-- ---------------------------------------------------------------------
\echo ''
\echo '=== PERBANDINGAN PER CAMPAIGN ==='
SELECT s.campaign_id, s.nama,
       s.total_gmv               AS gmv_sebelum,
       v.total_gmv               AS gmv_sesudah,
       s.total_gmv - v.total_gmv AS selisih,
       v.total_gmv_video         AS gmv_video,
       v.total_gmv_live          AS gmv_live,
       v.total_ads_gmv           AS info_ads_gmv,
       s.budget_ads_terpakai     AS ads_spend_sebelum,
       v.budget_ads_terpakai     AS ads_spend_sesudah,
       v.sisa_budget_ads         AS sisa_budget
FROM _backup_vw_campaign_summary_before_20261001 s
JOIN vw_campaign_summary v ON v.campaign_id = s.campaign_id
WHERE s.total_gmv <> v.total_gmv OR s.budget_ads_terpakai <> v.budget_ads_terpakai
ORDER BY abs(s.total_gmv - v.total_gmv) DESC NULLS LAST
LIMIT 40;

\echo ''
\echo '=== CEK: video + live harus sama dengan total ==='
SELECT count(*) AS campaign_tidak_konsisten
FROM vw_campaign_summary
WHERE total_gmv_video + total_gmv_live <> total_gmv;

\echo ''
\echo '=== CATATAN: GMV yang tidak masuk campaign manapun ==='
-- Order dengan campaign_id NULL tidak dihitung di total_gmv mana pun.
SELECT count(*) FILTER (WHERE NOT is_refund) AS order_tanpa_campaign,
       COALESCE(sum(gmv) FILTER (WHERE NOT is_refund),0) AS gmv_tanpa_campaign
FROM sales
WHERE campaign_id IS NULL;

COMMIT;
