\pset pager off
\x on

SELECT 
  id, username, nama_asli, nama_lengkap, no_whatsapp, nik, alamat_ktp
FROM creators 
WHERE id = 20995;

SELECT 
  creator_id, nik, nama_ktp, alamat_ktp, is_primary
FROM creator_identities 
WHERE creator_id = 20995;

SELECT 
  creator_id, bank_name, account_number, account_holder, is_primary
FROM creator_bank_accounts 
WHERE creator_id = 20995;
