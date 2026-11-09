-- Migration: 20261109104500_update_campaign_budget_plafon.sql
-- Description: Penyesuaian plafon budget creator berdasarkan audit rekonsiliasi 18 campaign (Excel vs DB).
-- 1. SALSA Mom & Baby (ID: 36) - Plafon creator dinaikkan dari 10.000.000 ke 25.000.000 (Plafon total menjadi 40.000.000, klop 100% dengan Excel).
-- 2. VOTRE PEAU (ID: 53) - Plafon creator dikoreksi dari typo 4.000.000 ke 40.000.000 (klop 100% dengan Excel).
-- 3. PWS (ID: 38) - Plafon creator disinkronkan dari 65.000.000 ke 70.000.000 (klop 100% dengan Excel).

UPDATE campaigns
SET budget_creator_plafon = 25000000
WHERE id = 36 AND nama = 'SALSA Mom & Baby';

UPDATE campaigns
SET budget_creator_plafon = 40000000
WHERE id = 53 AND nama = 'VOTRE PEAU';

UPDATE campaigns
SET budget_creator_plafon = 70000000
WHERE id = 38 AND nama = 'PWS';
