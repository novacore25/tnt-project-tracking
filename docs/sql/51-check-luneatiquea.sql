\pset pager off
\x on

-- 1. Cek tabel creators untuk luneatiquea
SELECT id, username, nama_lengkap, nama_asli, no_whatsapp, nik_ktp, alamat_ktp
FROM creators 
WHERE username ILIKE '%luneatiquea%' OR id = 20995;

-- 2. Cek campaign_creators untuk luneatiquea
SELECT cc.id, cc.campaign_id, cc.creator_id, cc.approval, cc.price, cc.qty_vt, c.nama_lengkap, c.username
FROM campaign_creators cc
JOIN creators c ON cc.creator_id = c.id
WHERE c.username ILIKE '%luneatiquea%' OR c.id = 20995;

-- 3. Cek campaign Nutriflakes id
SELECT id, nama, status FROM campaigns WHERE nama ILIKE '%Nutriflakes%';

-- 4. Cek identitas KTP & bank
SELECT * FROM creator_identities WHERE creator_id = 20995;
SELECT * FROM creator_bank_accounts WHERE creator_id = 20995;

-- 5. Cek tabel payment/keuangan tempat data BCA 8416132262 Sagita Zahra tersimpan
SELECT * FROM creator_payments WHERE creator_id = 20995 LIMIT 5;
