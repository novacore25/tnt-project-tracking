-- =====================================================================
-- 20261001230000 - Koreksi kurs USD/IDR di ads_performance
--
-- MASALAH
--   ads_performance.kurs menyimpan nilai tukar USD -> IDR per baris, dan
--   memang BERBEDA per tanggal. Itu benar, bukan bug. Kursor riil terverifikasi
--   di kisaran 16.993 sampai 18.045, dan setiap tanggal punya satu kurs:
--     17.313 -> 2026-06-22, 17.826 -> 2026-06-22, 17.953 -> 2026-07-20, dll.
--
--   Yang rusak HANYA baris yang tersimpan dengan satu titik desimal, yaitu
--   17.313 yang dimaksudkan 17313. Itu 1000x terlalu kecil, sehingga revenue
--   DAN cost baris tersebut ikut 1000x keliru.
--
--   Penyebabnya: campaignPageActions.ts:231 updateAdsPerformanceKursAction
--   menulis nilai apa adanya tanpa heuristik, sedangkan importActions.ts:475
--   sudah punya guard `if (kurs < 1000) kurs *= 1000`. Fungsi tanpa guard itu
--   yang menulis 313 baris. Sudah diperbaiki di kode pada 1 Okt 2026.
--
--   816 baris memakai 18000 dan TIDAK DISENTUH. Angka itu 5 digit dan berada
--   di dalam rentang kurs riil, jadi bukan rusak. Dulu saya sebut "default
--   bulat", itu tebakan yang salah.
--
-- KEPUTUSAN UNTUK BARIS kurs = 1000
--   Ada 1 baris dengan kurs persis 1000, hasil heuristik dari input "1". Baris
--   ini tidak bisa dikoreksi dengan x1000 karena 1000 bukan kurs. Pemilik
--   sistem memutuskan untuk di-nol-kan dulu, dan nanti tim Ads memperbaikinya
--   dari sumber aslinya.
--
--   Baris itu juga termasuk 12 baris korup yang sudah teridentifikasi
--   (purchases > clicks dengan clicks = 0). Laporan lengkapnya dicetak di
--   akhir migration supaya bisa diteruskan ke tim Ads.
--
-- DAMPAK KE BUDGET (diukur 1 Okt 2026, read-only, docs/sql/41)
--   313 baris dikoreksi menambah recorded ad spend, TIDAK ada campaign yang
--   berubah dari dalam budget jadi over budget. Total GMV campaign tidak
--   tersentuh sama sekali karena ads tidak masuk ke total_gmv, hanya ke kolom
--   informasi total_ads_spend dan total_ads_gmv.
--
-- AMAN
--   - Satu transaksi, batal otomatis kalau guard gagal.
--   - Backup ke _backup_ads_performance_20261001, tidak di-drop.
--   - Hanya meng-update kolom kurs. cost_usd dan gross_revenue_usd tidak
--     disentuh, jadi data sumber tetap utuh dan bisa dihitung ulang.
--   - Guard membatalkan kalau setelah koreksi masih ada kurs di luar rentang.
-- =====================================================================

\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Backup
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_ads_performance_20261001 AS
SELECT * FROM ads_performance;

\echo '--- backup ---'
SELECT count(*) AS baris_backup FROM _backup_ads_performance_20261001;

-- ---------------------------------------------------------------------
-- 1. Dokumentasikan baris yang akan di-nol-kan SEBELUM diubah
-- ---------------------------------------------------------------------
\echo ''
\echo '=== BARIS YANG DI-NOL-KAN (kurs = 1000, datanya korup) ==='
SELECT id, campaign_id, ad_id, ad_name, campaign_ads_name, tanggal,
       cost_usd, gross_revenue_usd, purchases, clicks, impressions
FROM ads_performance
WHERE kurs = 1000;

-- ---------------------------------------------------------------------
-- 2. Ringkasan sebelum
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _sebelum ON COMMIT DROP AS
SELECT
  COALESCE(SUM(cost_usd * kurs), 0) AS total_cost_idr,
  COALESCE(SUM(gross_revenue_usd * kurs), 0) AS total_gmv_idr,
  count(*) AS baris
FROM ads_performance;

\echo ''
\echo '=== SEBELUM ==='
SELECT baris,
       round(total_cost_idr) AS biaya_ads_idr,
       round(total_gmv_idr)  AS gmv_ads_idr,
       (SELECT round(COALESCE(sum(total_ads_spend),0)) FROM vw_campaign_summary) AS total_ads_spend_di_view
FROM _sebelum;

-- ---------------------------------------------------------------------
-- 3. Baris korup: kurs = 1000 -> 0
--    Nol berarti "tidak diketahui", dan kolom ini tidak NOT NULL tapi 0 valid.
-- ---------------------------------------------------------------------
UPDATE ads_performance SET kurs = 0 WHERE kurs = 1000;
\echo ''
\echo '--- baris kurs=1000 diset 0 ---'

-- ---------------------------------------------------------------------
-- 4. Koreksi 313 baris: satu titik desimal -> 1000x
--    Batas bawah 16000 dipakai karena kurs riil terverifikasi minimal 16993.
--    Batas atas 20000 supaya nilai di luarANGE tidak ikut dikali.
-- ---------------------------------------------------------------------
UPDATE ads_performance
SET kurs = kurs * 1000
WHERE kurs > 1 AND kurs < 16000;

\echo '--- baris kurs satu-titik dikali 1000 ---'

-- ---------------------------------------------------------------------
-- 5. Guard: setelah koreksi semua kurs harus 0 atau dalam rentang riil
-- ---------------------------------------------------------------------
DO $$
DECLAREomina integer;
BEGIN
  SELECT count(*) INTO omina FROM ads_performance
  WHERE kurs <> 0 AND (kurs < 15000 OR kurs > 25000);

  IF omina > 0 THEN
    RAISE EXCEPTION 'Batal: masih ada % baris dengan kurs di luar 15000-25000', omina;
  END IF;

  RAISE NOTICE 'Verifikasi OK: semua kurs Either 0 atau dalam rentang riil';
END $$;

\echo ''
\echo '=== SESUDAH ==='
SELECT count(*) AS baris,
       count(*) FILTER (WHERE kurs = 0)  AS kurs_nol,
       count(*) FILTER (WHERE kurs > 0) AS kurs_terisi,
       min(kurs) FILTER (WHERE kurs > 0) AS kurs_min,
       max(kurs) AS kurs_max,
       string_agg(DISTINCT kurs::text, ', ' ORDER BY kurs::text) AS semua_nilai
FROM ads_performance;

-- ---------------------------------------------------------------------
-- 6. Biaya ads per campaign vs plafon, setelah dikoreksi
-- ---------------------------------------------------------------------
\echo ''
\echo '=== BIAYA ADS per CAMPAIGN (MAX per ad, sama seperti view) ==='
WITH per_ad AS (
  SELECT campaign_id, ad_id, MAX(cost_usd * kurs) AS biaya
  FROM ads_performance GROUP BY campaign_id, ad_id
), per AS (
  SELECT campaign_id, SUM(biaya) AS biaya FROM per_ad GROUP BY campaign_id
)
SELECT c.id, c.nama,
       c.budget_ads_plafon                                AS plafon,
       round(COALESCE(p.biaya, 0))                        AS biaya_ads,
       round(c.budget_ads_plafon - COALESCE(p.biaya, 0))  AS sisa_budget,
       CASE
         WHEN c.budget_ads_plafon = 0 THEN 'tidak ada plafon'
         WHEN COALESCE(p.biaya, 0) > c.budget_ads_plafon THEN 'OVER BUDGET'
         ELSE 'dalam budget'
       END AS status
FROM campaigns c
LEFT JOIN per p ON p.campaign_id = c.id
WHERE p.campaign_id IS NOT NULL
ORDER BY c.budget_ads_plafon DESC, c.id;

-- ---------------------------------------------------------------------
-- 7. Total GMV campaign HARUS tetap sama
-- ---------------------------------------------------------------------
\echo ''
\echo '=== CEK: total GMV campaign tidak boleh berubah ==='
-- Nilai yang diharapkan dari sebelum migration ini: 920.211.710
SELECT round(COALESCE(sum(total_gmv), 0))        AS total_gmv,
       round(COALESCE(sum(total_gmv_video), 0)) AS gmv_video,
       round(COALESCE(sum(total_gmv_live), 0))  AS gmv_live,
       round(COALESCE(sum(total_ads_spend), 0))  AS total_ads_spend
FROM vw_campaign_summary;

COMMIT;

-- ---------------------------------------------------------------------
-- 8. Laporan untuk tim Ads: 12 baris korup yang perlu diperbaiki di sumber
-- ---------------------------------------------------------------------
\echo ''
\echo '=== LAPORAN UNTUK TIM ADS: baris dengan clicks = 0 tapi purchases > 0 ==='
-- Tidak mungkin secara fisik. Data ini harus diperbaiki dari ekspor TikTok
-- aslinya, bukan dari aplikasi.
SELECT
  id                  AS baris_id,
  campaign_id,
  ad_id,
  ad_name,
  campaign_ads_name,
  tanggal,
  cost_usd,
  gross_revenue_usd,
  kurs,
  purchases,
  clicks,
  impressions
FROM ads_performance
WHERE (purchases > clicks) OR (clicks = 0 AND purchases > 0)
ORDER BY campaign_id, tanggal;
