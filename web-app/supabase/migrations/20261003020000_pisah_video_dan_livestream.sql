\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

-- =====================================================================
-- 20261003010000 - Pisahkan video dan livestream di semua perhitungan
--
-- ATURAN PEMILIK (2 Okt 2026):
--   "kalo video ya harusnya menghitung video aja, kalo live ya menghitung
--    live aja, live juga bagian dari campaign juga kan ada menu live stream"
--
-- MASALAH (terbukti docs/sql/58 + 59):
--   654 dari 29.165 baris tabel `videos` adalah LIVESTREAM, tapi ikut
--   dihitung sebagai "video" di 5 tempat:
--     1. View `vw_campaign_summary.achievement_video`
--     2. `VideoClient.tsx` daftar video
--     3. `PerformaClient.tsx` "Pencapaian Target Video"
--     4. Portal `allApprovedVideoIds` -> "video approved"
--     5. (organic side sudah aman, hanya yang tabel `videos` yang salah)
--
--   Dampak per campaign (achievement_video):
--     KEMBANG 7 RUPA 571 -> 179  (68,7% sebenarnya live)
--     USMILE          585 -> 399  (31,8% sebenarnya live)
--     Sorae           156 -> 121
--     SYB             492 -> 482
--     Brasov            2 ->   1
--     MS Glow Beauty  795 -> 788
--     Campaign 52     3268 -> 3268  (tidak berubah, sudah benar)
--
--   Angka-angka ini SUDAH DILAPORKAN ke brand. Perubahan wajib dicatat.
--
-- CARA MEMBEDAKAN:
--   Sumber kebenaran = `organic_videos.content_type`.
--   - Impor awareness sudah benar: tab "Awareness Video" -> 'Video',
--     tab "Awareness Live" -> 'Livestream' (OrganicImport.tsx:448,469).
--     File `affiliate_orders` punya kolom Content Type, dua file CustomReport
--     tidak punya -- itu sebabnya tipe ikut dari tab.
--   - Link video TIDAK bisa jadi patokan: 0 link mengandung '/live/',
--     livestream pun ditulis sebagai '/video/<room_id>'.
--
-- YANG TIDAK BERUBAH:
--   - Tidak ada baris dihapus. Live tetap ada, tetap punya menu sendiri.
--   - `content_uid IS NULL` tetap dihitung (tidak bisa dibuktikan live).
--   - Organic video/live counting tidak tersentuh (sudah benar).
--
-- ROLLBACK
--   Hapus view `vw_video_klasifikasi`, lalu kembalikan achievement_video
--   ke definisi di `20261002000000_total_gmv_plus_ads.sql` (baris 141-146).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. VIEW KLASIFIKASI - satu sumber kebenaran untuk semuaAW hitungan video
-- ---------------------------------------------------------------------
-- Satu baris per baris tabel `videos`, dengan klasifikasi tipenya.
-- Dipakai oleh: achievement_video di view summary, Portal, Performa, dan
-- UI halaman Video. Kalau aturan ini berubah, cukup ubah view ini.
--
-- Kenapa LATERAL + agregasi, bukan JOIN biasa:
--   `organic_videos` unik per (content_uid, product_id). Satu video yang
--  qjual 3 produk = 3 baris. JOIN biasa akan menggandakan baris `videos`.
--   LATERAL + bool_or menyatukan jadi satu nilai per content_uid.
CREATE OR REPLACE VIEW vw_video_klasifikasi AS
SELECT
    v.id,
    v.campaign_creator_id,
    cc.campaign_id,
    v.content_uid,
    v.link_video,
    CASE WHEN LOWER(COALESCE(ov.is_live::text, '')) = 'true'
         THEN true ELSE false END          AS is_livestream,
    COALESCE(ov.tipe, 'Video')            AS content_type,
    (v.link_video IS NOT NULL)            AS punya_link
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
LEFT JOIN LATERAL (
    SELECT bool_or(LOWER(COALESCE(ovx.content_type,'')) IN ('livestream','live')) AS is_live,
           min(ovx.content_type)                                                AS tipe
    FROM organic_videos ovx
    WHERE ovx.content_uid = v.content_uid
) ov ON true;

\echo ''
\echo '=== KLASIFIKASI SEBELUM PERUBAHAN ==='
SELECT is_livestream,
       COUNT(*)                                            AS baris,
       COUNT(*) FILTER (WHERE punya_link)                  AS dengan_link,
       COUNT(DISTINCT campaign_id)                         AS campaign
FROM vw_video_klasifikasi
GROUP BY 1 ORDER BY 2 DESC;

-- ---------------------------------------------------------------------
-- 2. GUARD: klasifikasi tidak boleh salah membalik
--    Kalau view ini salah, semua angka di bawah ikut salah.
-- ---------------------------------------------------------------------
DO $$
DECLARE n_bad integer;
BEGIN
    -- Baris yang organic_videos menyebut 'Livestream' tapi view bilang video
    SELECT count(*) INTO n_bad
    FROM vw_video_klasifikasi k
    JOIN organic_videos ov ON ov.content_uid = k.content_uid
    WHERE LOWER(COALESCE(ov.content_type,'')) IN ('livestream','live')
      AND k.is_livestream IS NOT TRUE;

    IF n_bad > 0 THEN
        RAISE EXCEPTION 'Batal: % baris livestream tidak terklasifikasi live', n_bad;
    END IF;

    RAISE NOTICE 'Guard 1 OK: semua baris livestream terdeteksi benar';
END $$;

DO $$
DECLARE n_bad integer;
BEGIN
    -- Jugur: tidak boleh ada baris video biasa yang jadi live
    SELECT count(*) INTO n_bad
    FROM vw_video_klasifikasi k
    WHERE k.is_livestream IS TRUE
      AND k.content_uid IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM organic_videos ov
          WHERE ov.content_uid = k.content_uid
            AND LOWER(COALESCE(ov.content_type,'')) IN ('livestream','live')
      );

    IF n_bad > 0 THEN
        RAISE EXCEPTION 'Batal: % baris ditandai live padahal tidak ada bukti', n_bad;
    END IF;

    RAISE NOTICE 'Guard 2 OK: tidak ada baris live yang salah ditandai';
END $$;

-- ---------------------------------------------------------------------
-- 3. Backup angka lama
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_vw_campaign_summary_before_2026100301 AS
SELECT campaign_id, nama, achievement_video FROM vw_campaign_summary;

CREATE TABLE IF NOT EXISTS _backup_video_klasifikasi_20261003 AS
SELECT id, campaign_creator_id, content_uid, is_livestream, content_type
FROM vw_video_klasifikasi;

\echo ''
\echo '=== ACHIEVEMENT_VIDEO SEBELUM ==='
SELECT campaign_id, nama, achievement_video
FROM vw_campaign_summary ORDER BY achievement_video DESC LIMIT 15;

-- ---------------------------------------------------------------------
-- 4. View summary dengan achievement_video yang benar
--    Kolom & urutan WAJIB sama (CREATE OR REPLACE VIEW tidak bisa mengubah).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_campaign_summary AS
WITH organic_sales AS (
    SELECT
        campaign_id,
        SUM(gmv) AS total_organic_gmv,
        SUM(gmv) FILTER (
            WHERE content_type ILIKE '%live%' OR content_type ILIKE '%livestream%'
        ) AS total_gmv_live,
        SUM(gmv) FILTER (
            WHERE content_type IS NULL
               OR NOT (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
        ) AS total_gmv_video
    FROM sales
    WHERE campaign_id IS NOT NULL
    GROUP BY campaign_id
),
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
-- >>> PERUBAHAN: hanya video, bukan livestream <<<
videos_count AS (
    SELECT campaign_id, COUNT(id) as total_video_tayang
    FROM vw_video_klasifikasi
    WHERE punya_link IS TRUE
      AND is_livestream IS NOT TRUE
    GROUP BY campaign_id
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

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS total_gmv_achievement,
    COALESCE(vc.total_video_tayang, 0) as achievement_video,
    COALESCE(cr.total_creator_approved, 0) as achievement_creator,
    COALESCE(a.total_ads_cost_idr, 0) as budget_ads_terpakai,
    c.budget_ads_plafon - COALESCE(a.total_ads_cost_idr, 0) as sisa_budget_ads,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS tracked_creator_gmv,

    COALESCE(ds.total_daily_organic, 0) AS total_daily_organic,
    COALESCE(ds.total_daily_vsa, 0) AS total_daily_vsa,
    (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)) AS official_daily_gmv,

    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) AS total_gmv,
    COALESCE(ps.total_pembayaran_kreator, 0) AS total_pembayaran_kreator,
    COALESCE(a.total_ads_cost_idr, 0) AS total_ads_spend,

    COALESCE(o.total_gmv_video, 0) AS total_gmv_video,
    COALESCE(o.total_gmv_live, 0)  AS total_gmv_live,

    COALESCE(a.total_ads_gmv_idr, 0) AS total_ads_gmv
FROM campaigns c
LEFT JOIN organic_sales o ON c.id = o.campaign_id
LEFT JOIN ads_sales a ON c.id = a.campaign_id
LEFT JOIN videos_count vc ON c.id = vc.campaign_id
LEFT JOIN creators_count cr ON c.id = cr.campaign_id
LEFT JOIN payment_stats ps ON c.id = ps.campaign_id
LEFT JOIN daily_stats ds ON c.id = ds.campaign_id;

-- ---------------------------------------------------------------------
-- 5. GUARD: identitas total_gmv tidak boleh berubah
--    Refund sudah ikut (migration 20261003000000), jadi angkanya harus sama.
-- ---------------------------------------------------------------------
DO $$
DECLARE selisih numeric;
BEGIN
    SELECT COALESCE(sum(ABS(
        COALESCE(total_gmv_video,0) + COALESCE(total_gmv_live,0)
        + COALESCE(total_ads_gmv,0) - COALESCE(total_gmv,0)
    )), 0) INTO selisih
    FROM vw_campaign_summary;

    IF selisih <> 0 THEN
        RAISE EXCEPTION 'Batal: identitas total_gmv rusak, selisih %', selisih;
    END IF;

    RAISE NOTICE 'Guard 3 OK: video + live + ads = total_gmv';
END $$;

DO $$
DECLARE n_rusak integer;
BEGIN
    SELECT count(*) INTO n_rusak
    FROM vw_campaign_summary v
    JOIN _backup_vw_campaign_summary_before_2026100301 b ON b.campaign_id = v.campaign_id
    WHERE v.total_gmv IS DISTINCT FROM (
        SELECT COALESCE(sum(gmv::numeric), 0) FROM sales s WHERE s.campaign_id = v.campaign_id
    );

    IF n_rusak > 0 THEN
        RAISE EXCEPTION 'Batal: % campaign total_gmv tidak sama dengan sales mentah', n_rusak;
    END IF;

    RAISE NOTICE 'Guard 4 OK: total_gmv tetap = sales mentah + ads';
END $$;

\echo ''
\echo '=== ACHIEVEMENT_VIDEO SESUDAH ==='
SELECT campaign_id, nama, achievement_video
FROM vw_campaign_summary ORDER BY achievement_video DESC LIMIT 15;

\echo ''
\echo '=== YANG BERUBAH ==='
SELECT b.nama,
       b.achievement_video AS sebelum,
       v.achievement_video AS sesudah,
       b.achievement_video - v.achievement_video AS dicoret
FROM _backup_vw_campaign_summary_before_2026100301 b
JOIN vw_campaign_summary v ON v.campaign_id = b.campaign_id
WHERE v.achievement_video IS DISTINCT FROM b.achievement_video
ORDER BY 4 DESC;

\echo ''
\echo '=== TOTAL BERUBAH ==='
SELECT COUNT(*) AS campaign_berubah,
       COALESCE(SUM(b.achievement_video - v.achievement_video), 0) AS total_video_dicoret
FROM _backup_vw_campaign_summary_before_2026100301 b
JOIN vw_campaign_summary v ON v.campaign_id = b.campaign_id
WHERE v.achievement_video IS DISTINCT FROM b.achievement_video;

COMMIT;

\echo ''
\echo '=== SELESAI. Video dan livestream sudah terpisah. ==='
\echo '=== Menu Live Stream tetap menghitung live seperti sebelumnya. ==='
