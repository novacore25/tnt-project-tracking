-- ROLLBACK SCRIPT: rollback_company_lain.sql
-- Purpose: Menghapus seluruh data campaign "Company Lain" (company = 'OTHER') secara bersih.
--          Relasi cascade akan otomatis menghapus baris terkait di:
--          - campaign_creators
--          - videos
--          - sales
--          - ads_performance
--          - daily_performance
-- Aman: Data TNT (company = 'TNT') terisolasi dan tidak akan tersentuh sama sekali.

\echo '=== PRE-FLIGHT CHECK: JUMLAH CAMPAIGN SEBELUM ROLLBACK ==='
SELECT company, COUNT(*) as jumlah_campaign FROM campaigns GROUP BY company;

\echo '=== EXECUTING ROLLBACK FOR COMPANY = OTHER ==='
BEGIN;

-- Hapus seluruh campaign Company Lain
DELETE FROM campaigns WHERE company = 'OTHER';

COMMIT;

\echo '=== POST-FLIGHT CHECK: PASTIKAN HANYA TNT YANG TERSISA ==='
SELECT company, COUNT(*) as jumlah_campaign FROM campaigns GROUP BY company;
