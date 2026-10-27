-- ROLLBACK SCRIPT: rollback_company_lain.sql
-- Purpose: Menghapus seluruh data campaign "Company Lain" dari tabel archive_* secara bersih.
--          Relasi cascade akan otomatis membersihkan:
--          - archive_campaign_creators
--          - archive_videos
--          - archive_sales
--          - archive_ads_performance
-- Aman: Data TNT (tabel campaigns, sales, videos, ads_performance) terisolasi secara fisik dan tidak tersentuh sama sekali.

\echo '=== PRE-FLIGHT CHECK: JUMLAH DATA ARCHIVE SEBELUM ROLLBACK ==='
SELECT 
  (SELECT COUNT(*) FROM archive_campaigns) as archive_campaigns,
  (SELECT COUNT(*) FROM archive_campaign_creators) as archive_creators,
  (SELECT COUNT(*) FROM archive_videos) as archive_videos,
  (SELECT COUNT(*) FROM archive_sales) as archive_sales,
  (SELECT COUNT(*) FROM archive_ads_performance) as archive_ads;

\echo '=== EXECUTING ROLLBACK FOR ARCHIVE TABLES ==='
BEGIN;

TRUNCATE archive_sales, archive_videos, archive_ads_performance, archive_campaign_creators, archive_campaigns CASCADE;
DELETE FROM campaigns WHERE company = 'OTHER';

COMMIT;

\echo '=== POST-FLIGHT CHECK: PASTIKAN DATA ARCHIVE TELAH BERSIH ==='
SELECT 
  (SELECT COUNT(*) FROM archive_campaigns) as archive_campaigns,
  (SELECT COUNT(*) FROM archive_campaign_creators) as archive_creators,
  (SELECT COUNT(*) FROM archive_videos) as archive_videos,
  (SELECT COUNT(*) FROM archive_sales) as archive_sales,
  (SELECT COUNT(*) FROM archive_ads_performance) as archive_ads;
