-- =====================================================================
-- 79 - RESET RAW TIKTOK DATA (sales & organic_videos)
-- Tanggal : 2026-10-07
--
-- TUJUAN:
--   Mereset/mengosongkan data raw TikTok Partner Center:
--   - sales (affiliate orders raw)
--   - organic_videos (custom report live & video)
--   Sesuai keputusan user agar data diupload ulang secara bersih dan fresh.
--
-- JAMINAN KEAMANAN:
--   1. Backup tabel dibuat sebelum delete:
--      _backup_sales_20261007
--      _backup_organic_videos_20261007
--   2. Tabel 'videos' (slot link video manual PIC) TIDAK DISENTUH (0 baris diubah).
--   3. Tabel 'ads_performance' (iklan VSA) TIDAK DISENTUH (0 baris diubah).
--   4. Master campaign, skus, creators, campaign_creators, payment_* UTUH.
--   5. Guard assertion di dalam transaksi: jika terjadi anomali, otomatis ROLLBACK.
-- =====================================================================

\pset pager off
\set ON_ERROR_STOP on

BEGIN;

-- 1. Buat Tabel Backup Lengkap
CREATE TABLE IF NOT EXISTS _backup_sales_20261007 AS SELECT * FROM sales;
CREATE TABLE IF NOT EXISTS _backup_organic_videos_20261007 AS SELECT * FROM organic_videos;

-- 2. Guard: Verifikasi Backup Berhasil Sempurna
DO $$
DECLARE
  v_sales_orig bigint;
  v_sales_bk bigint;
  v_org_orig bigint;
  v_org_bk bigint;
BEGIN
  SELECT count(*) INTO v_sales_orig FROM sales;
  SELECT count(*) INTO v_sales_bk FROM _backup_sales_20261007;
  SELECT count(*) INTO v_org_orig FROM organic_videos;
  SELECT count(*) INTO v_org_bk FROM _backup_organic_videos_20261007;

  IF v_sales_orig <> v_sales_bk THEN
    RAISE EXCEPTION 'GUARD GAGAL: Baris sales (%) tidak sama dengan backup (%)', v_sales_orig, v_sales_bk;
  END IF;

  IF v_org_orig <> v_org_bk THEN
    RAISE EXCEPTION 'GUARD GAGAL: Baris organic_videos (%) tidak sama dengan backup (%)', v_org_orig, v_org_bk;
  END IF;

  RAISE NOTICE 'Backup terverifikasi: sales = % baris, organic_videos = % baris', v_sales_bk, v_org_bk;
END $$;

-- 3. Pre-deletion Baseline: Catat Jumlah Baris Data PIC & Ads
CREATE TEMP TABLE _baseline_counts AS
SELECT 
  (SELECT count(*) FROM videos) AS vid_count,
  (SELECT count(*) FROM ads_performance) AS ads_count,
  (SELECT count(*) FROM campaign_creators) AS cc_count;

-- 4. Hapus Data Raw TikTok
DELETE FROM sales;
DELETE FROM organic_videos;

-- 5. Guard: Pastikan Data PIC & Ads Sama Sekali Tidak Berubah
DO $$
DECLARE
  v_vid_now bigint;
  v_ads_now bigint;
  v_cc_now bigint;
  v_vid_base bigint;
  v_ads_base bigint;
  v_cc_base bigint;
BEGIN
  SELECT count(*) INTO v_vid_now FROM videos;
  SELECT count(*) INTO v_ads_now FROM ads_performance;
  SELECT count(*) INTO v_cc_now FROM campaign_creators;

  SELECT vid_count, ads_count, cc_count INTO v_vid_base, v_ads_base, v_cc_base FROM _baseline_counts;

  IF v_vid_now <> v_vid_base THEN
    RAISE EXCEPTION 'GUARD GAGAL: Tabel videos PIC berubah dari % menjadi %!', v_vid_base, v_vid_now;
  END IF;

  IF v_ads_now <> v_ads_base THEN
    RAISE EXCEPTION 'GUARD GAGAL: Tabel ads_performance berubah dari % menjadi %!', v_ads_base, v_ads_now;
  END IF;

  IF v_cc_now <> v_cc_base THEN
    RAISE EXCEPTION 'GUARD GAGAL: Tabel campaign_creators berubah dari % menjadi %!', v_cc_base, v_cc_now;
  END IF;

  RAISE NOTICE 'Guard PIC & Ads lolos: videos = % (tetap), ads_performance = % (tetap)', v_vid_now, v_ads_now;
END $$;

COMMIT;

-- 6. Verifikasi Final Pasca-Commit
SELECT 'sales' AS tabel, count(*) AS sisa_baris FROM sales
UNION ALL
SELECT 'organic_videos', count(*) FROM organic_videos
UNION ALL
SELECT 'videos (PIC)', count(*) FROM videos
UNION ALL
SELECT 'ads_performance (Ads)', count(*) FROM ads_performance
UNION ALL
SELECT '_backup_sales_20261007', count(*) FROM _backup_sales_20261007
UNION ALL
SELECT '_backup_organic_videos_20261007', count(*) FROM _backup_organic_videos_20261007;
