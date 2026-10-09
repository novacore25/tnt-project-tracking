-- Migration: Idempotent Backfill Creator Profile from Payment Items & Identities
-- Timestamp: 20261009183000

BEGIN;

-- 1. Backfill nama_asli & nama_lengkap di tabel creators dari payment_items terbaru
WITH latest_payment_names AS (
  SELECT DISTINCT ON (cc.creator_id)
    cc.creator_id,
    TRIM(pi.nama_penerima) as nama_penerima
  FROM payment_items pi
  JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
  WHERE pi.nama_penerima IS NOT NULL 
    AND TRIM(pi.nama_penerima) != ''
  ORDER BY cc.creator_id, pi.id DESC
)
UPDATE creators c
SET 
  nama_asli = COALESCE(NULLIF(c.nama_asli, ''), lpn.nama_penerima),
  nama_lengkap = COALESCE(NULLIF(c.nama_lengkap, ''), lpn.nama_penerima)
FROM latest_payment_names lpn
WHERE c.id = lpn.creator_id
  AND (c.nama_asli IS NULL OR TRIM(c.nama_asli) = '' OR c.nama_lengkap IS NULL OR TRIM(c.nama_lengkap) = '');

-- 2. Backfill NIK & Alamat KTP di tabel creators dari payment_items terbaru
WITH latest_payment_identities AS (
  SELECT DISTINCT ON (cc.creator_id)
    cc.creator_id,
    TRIM(pi.nik) as nik,
    TRIM(pi.alamat_ktp) as alamat_ktp
  FROM payment_items pi
  JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
  WHERE (pi.nik IS NOT NULL AND TRIM(pi.nik) != '')
     OR (pi.alamat_ktp IS NOT NULL AND TRIM(pi.alamat_ktp) != '')
  ORDER BY cc.creator_id, pi.id DESC
)
UPDATE creators c
SET 
  nik = COALESCE(NULLIF(c.nik, ''), NULLIF(lpi.nik, '')),
  alamat_ktp = COALESCE(NULLIF(c.alamat_ktp, ''), NULLIF(lpi.alamat_ktp, ''))
FROM latest_payment_identities lpi
WHERE c.id = lpi.creator_id
  AND ((c.nik IS NULL OR TRIM(c.nik) = '') OR (c.alamat_ktp IS NULL OR TRIM(c.alamat_ktp) = ''));

-- 3. Backfill nomor_wa / no_whatsapp di tabel creators dari payment_items terbaru
WITH latest_payment_contacts AS (
  SELECT DISTINCT ON (cc.creator_id)
    cc.creator_id,
    TRIM(pi.nomor_wa_dealing) as nomor_wa
  FROM payment_items pi
  JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
  WHERE pi.nomor_wa_dealing IS NOT NULL AND TRIM(pi.nomor_wa_dealing) != ''
  ORDER BY cc.creator_id, pi.id DESC
)
UPDATE creators c
SET 
  nomor_wa_dealing = COALESCE(NULLIF(c.nomor_wa_dealing, ''), lpc.nomor_wa),
  no_whatsapp = COALESCE(NULLIF(c.no_whatsapp, ''), lpc.nomor_wa)
FROM latest_payment_contacts lpc
WHERE c.id = lpc.creator_id
  AND (c.no_whatsapp IS NULL OR TRIM(c.no_whatsapp) = '' OR c.nomor_wa_dealing IS NULL OR TRIM(c.nomor_wa_dealing) = '');

-- 4. Sinkronkan juga ke tabel relasional creator_identities (idempoten via ON CONFLICT)
WITH latest_identities AS (
  SELECT DISTINCT ON (cc.creator_id)
    cc.creator_id,
    TRIM(pi.nik) as nik,
    TRIM(pi.nama_penerima) as nama_ktp,
    TRIM(pi.alamat_ktp) as alamat_ktp
  FROM payment_items pi
  JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
  WHERE pi.nik IS NOT NULL AND TRIM(pi.nik) != ''
  ORDER BY cc.creator_id, pi.id DESC
)
INSERT INTO creator_identities (creator_id, nik, nama_ktp, alamat_ktp, is_primary)
SELECT 
  li.creator_id,
  li.nik,
  li.nama_ktp,
  li.alamat_ktp,
  true
FROM latest_identities li
ON CONFLICT (creator_id, nik) DO UPDATE
SET 
  nama_ktp = COALESCE(EXCLUDED.nama_ktp, creator_identities.nama_ktp),
  alamat_ktp = COALESCE(EXCLUDED.alamat_ktp, creator_identities.alamat_ktp),
  is_primary = true;

-- 5. Sinkronkan ke tabel relasional creator_bank_accounts (idempoten via ON CONFLICT)
WITH latest_bank_accounts AS (
  SELECT DISTINCT ON (cc.creator_id)
    cc.creator_id,
    TRIM(pi.metode_pembayaran) as bank_name,
    TRIM(pi.nomor_rekening) as account_number,
    TRIM(pi.nama_penerima) as account_holder
  FROM payment_items pi
  JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
  WHERE pi.metode_pembayaran IS NOT NULL AND TRIM(pi.metode_pembayaran) != ''
    AND pi.nomor_rekening IS NOT NULL AND TRIM(pi.nomor_rekening) != ''
    AND pi.nama_penerima IS NOT NULL AND TRIM(pi.nama_penerima) != ''
  ORDER BY cc.creator_id, pi.id DESC
)
INSERT INTO creator_bank_accounts (creator_id, bank_name, account_number, account_holder, is_primary)
SELECT 
  lba.creator_id,
  lba.bank_name,
  lba.account_number,
  lba.account_holder,
  true
FROM latest_bank_accounts lba
ON CONFLICT (creator_id, bank_name, account_number) DO UPDATE
SET 
  account_holder = COALESCE(EXCLUDED.account_holder, creator_bank_accounts.account_holder),
  is_primary = true;

COMMIT;
