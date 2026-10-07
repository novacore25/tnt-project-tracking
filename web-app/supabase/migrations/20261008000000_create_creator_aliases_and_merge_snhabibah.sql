-- =====================================================================
-- 20261008000000 - Buat tabel creator_aliases dan gabungkan snhabibah
--
-- LATAR BELAKANG:
--   Kreator sering mengganti handle / @username di TikTok (misal: snhabibah10 -> snhabibah_).
--   Laporan TikTok mengekspor creator_username sesuai nama saat transaksi terjadi.
--   Akibatnya data transaksi di masa lalu terputus jika sistem hanya mencocokkan 1 username teks.
--   Selain itu, tim PIC di lapangan sering mendaftarkan ulang kreator yang sama dengan handle baru,
--   menyebabkan baris campaign_creators duplikat atau terpecah status approval-nya.
--
-- SOLUSI:
--   1. Buat tabel creator_aliases (1 creator_id -> many alias_username).
--   2. Seed awal seluruh creators.username saat ini sebagai primary alias.
--   3. Gabungkan duplikat snhabibah10 (21835) dan snhabibah10_ (22814) ke snhabibah_ (12339).
--   4. Rasionalkan status approval dan video di Campaign 54 (MD Glow) dan 56 (Zeluxe).
-- =====================================================================

\pset pager off
\t on
\set ON_ERROR_STOP on

BEGIN;

-- 1. Buat tabel creator_aliases
CREATE TABLE IF NOT EXISTS creator_aliases (
    id serial PRIMARY KEY,
    creator_id integer NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    alias_username text NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_creator_alias_lower UNIQUE (alias_username)
);

CREATE INDEX IF NOT EXISTS idx_creator_aliases_creator_id ON creator_aliases(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_aliases_lower ON creator_aliases(LOWER(alias_username));

-- 2. Seed awal seluruh username aktif di tabel creators ke creator_aliases
INSERT INTO creator_aliases (creator_id, alias_username, is_primary, notes)
SELECT id, username, true, 'Primary username dari tabel creators'
FROM creators
ON CONFLICT (alias_username) DO NOTHING;

-- 3. Kasus nyata: snhabibah10 (21835) & snhabibah10_ (22814) -> snhabibah_ (12339)
-- Daftarkan kedua username lama sebagai alias dari 12339
INSERT INTO creator_aliases (creator_id, alias_username, is_primary, notes)
VALUES
  (12339, 'snhabibah10', false, 'Username lama sebelum ganti handle (merged 2026-10-07)'),
  (12339, 'snhabibah10_', false, 'Variasi handle lama (merged 2026-10-07)')
ON CONFLICT (alias_username) DO UPDATE
SET creator_id = EXCLUDED.creator_id, is_primary = EXCLUDED.is_primary, notes = EXCLUDED.notes;

-- 4. Sinkronisasi Campaign Creators untuk snhabibah
-- Campaign 54 (MD Glow): 53101 (snhabibah_, approved, 3 vids) vs 47465 (snhabibah10, approved, 0 vids)
DELETE FROM campaign_creators WHERE id = 47465 AND creator_id = 21835 AND campaign_id = 54;

-- Campaign 56 (Zeluxe): 44738 (snhabibah10, approved, 0 vids) vs 53110 (snhabibah_, not_approved, 3 vids)
-- Set 53110 menjadi approved, lalu hapus 44738
UPDATE campaign_creators SET approval = 'approved' WHERE id = 53110 AND creator_id = 12339 AND campaign_id = 56;
DELETE FROM campaign_creators WHERE id = 44738 AND creator_id = 21835 AND campaign_id = 56;

-- Campaign 57 (GHANISKIN): 49316 (snhabibah10_, not_approved) -> alihkan creator_id ke 12339
UPDATE campaign_creators SET creator_id = 12339 WHERE id = 49316 AND creator_id = 22814;

-- 5. Alihkan dependensi creator (contacts, snapshots, niches) ke 12339
UPDATE creator_contacts SET creator_id = 12339 WHERE creator_id IN (21835, 22814);
UPDATE creator_snapshots SET creator_id = 12339 WHERE creator_id IN (21835, 22814);
UPDATE creator_niches SET creator_id = 12339 WHERE creator_id IN (21835, 22814);

-- 6. Hapus master duplikat 21835 dan 22814
DELETE FROM creators WHERE id IN (21835, 22814);

-- Verifikasi hasil
SELECT count(*) as total_aliases FROM creator_aliases;
SELECT creator_id, alias_username, is_primary FROM creator_aliases WHERE creator_id = 12339;

COMMIT;
