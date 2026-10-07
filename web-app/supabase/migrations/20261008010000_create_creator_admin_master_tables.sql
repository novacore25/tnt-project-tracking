-- Migration: Create Creator Admin Master Tables (PIC Contacts, Identities, Contracts)
-- Monotonic timestamp: 20261008010000

-- 1. Master Kontak WA PIC (Satu Kesatuan: Nama PIC + No WA)
CREATE TABLE IF NOT EXISTS creator_pic_contacts (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  nama_pic TEXT NOT NULL,
  nomor_wa TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creator_id, nama_pic, nomor_wa)
);
CREATE INDEX IF NOT EXISTS idx_creator_pic_contacts_creator ON creator_pic_contacts(creator_id);

-- 2. Master Identitas KTP (Satu Kesatuan: NIK, Link GDrive KTP, Alamat KTP)
CREATE TABLE IF NOT EXISTS creator_identities (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  nik TEXT NOT NULL,
  nama_ktp TEXT,
  alamat_ktp TEXT,
  link_ktp TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creator_id, nik)
);
CREATE INDEX IF NOT EXISTS idx_creator_identities_creator ON creator_identities(creator_id);

-- 3. Master Dokumen Kontrak Kreator
CREATE TABLE IF NOT EXISTS creator_contracts (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  campaign_id INT REFERENCES campaigns(id) ON DELETE SET NULL,
  judul_kontrak TEXT,
  link_kontrak TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creator_contracts_creator ON creator_contracts(creator_id);

-- 4. Backfill Otomatis Data Historis dari tabel creators & payment_items

-- Backfill Kontak PIC dari creators
INSERT INTO creator_pic_contacts (creator_id, nama_pic, nomor_wa, is_primary)
SELECT id, TRIM(nama_wa_pic), TRIM(nomor_wa_dealing), true
FROM creators
WHERE nama_wa_pic IS NOT NULL AND nomor_wa_dealing IS NOT NULL 
  AND TRIM(nama_wa_pic) != '' AND TRIM(nomor_wa_dealing) != ''
ON CONFLICT (creator_id, nama_pic, nomor_wa) DO NOTHING;

-- Backfill Kontak PIC dari payment_items
INSERT INTO creator_pic_contacts (creator_id, nama_pic, nomor_wa, is_primary)
SELECT DISTINCT cc.creator_id, TRIM(pi.nama_wa_pic), TRIM(pi.nomor_wa_dealing), false
FROM payment_items pi
JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
WHERE pi.nama_wa_pic IS NOT NULL AND pi.nomor_wa_dealing IS NOT NULL 
  AND TRIM(pi.nama_wa_pic) != '' AND TRIM(pi.nomor_wa_dealing) != ''
ON CONFLICT (creator_id, nama_pic, nomor_wa) DO NOTHING;

-- Backfill KTP dari creators
INSERT INTO creator_identities (creator_id, nik, alamat_ktp, link_ktp, is_primary)
SELECT id, TRIM(nik), alamat_ktp, link_ktp, true
FROM creators
WHERE nik IS NOT NULL AND TRIM(nik) != ''
ON CONFLICT (creator_id, nik) DO NOTHING;

-- Backfill KTP dari payment_items
INSERT INTO creator_identities (creator_id, nik, alamat_ktp, link_ktp, is_primary)
SELECT DISTINCT cc.creator_id, TRIM(pi.nik), pi.alamat_ktp, pi.link_ktp, false
FROM payment_items pi
JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
WHERE pi.nik IS NOT NULL AND TRIM(pi.nik) != ''
ON CONFLICT (creator_id, nik) DO NOTHING;

-- Backfill Kontrak dari payment_items
INSERT INTO creator_contracts (creator_id, campaign_id, judul_kontrak, link_kontrak, created_at)
SELECT cc.creator_id, pb.campaign_id, 'Kontrak Pengajuan Pembayaran', pi.link_kontrak, MIN(pi.created_at)
FROM payment_items pi
JOIN payment_batches pb ON pi.batch_id = pb.id
JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
WHERE pi.link_kontrak IS NOT NULL AND TRIM(pi.link_kontrak) != ''
GROUP BY cc.creator_id, pb.campaign_id, pi.link_kontrak
ON CONFLICT DO NOTHING;
