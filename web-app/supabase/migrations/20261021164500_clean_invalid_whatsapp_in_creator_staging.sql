-- Migration: Membersihkan nomor telepon palsu/acak dari DOM TikTok (1624253435) di tabel creator_staging dan creators
-- Dibuat: 2026-10-21 16:45:00

UPDATE creator_staging
SET no_whatsapp = NULL
WHERE no_whatsapp IN ('1624253435', '621624253435');

UPDATE creators
SET no_whatsapp = NULL
WHERE no_whatsapp IN ('1624253435', '621624253435');
