-- UNIQUE(campaign_id, creator_id) untuk campaign_creators.
--
-- Latar belakang
-- --------------
-- Tabel campaign_creators hanya punya index biasa:
--   CREATE INDEX idx_cc_campaign ON campaign_creators(campaign_id);
--   CREATE INDEX idx_cc_creator  ON campaign_creators(creator_id);
-- keduanya BUKAN UNIQUE.
--
-- Aksi "Tarik ke Campaign" (addCampaignCreatorAction) tidak mengecek apakah
-- kreator sudah ada di campaign tersebut, sehingga satu kreator bisa punya
-- beberapa baris listing dalam campaign yang sama.
--
--(jobatan sudah dicek di sisi aplikasi. Migration ini menutup celah di level DB.)
--
-- Keamanan
-- --------
-- Migration ini TIDAK menghapus baris apa pun. Kalau masih ada duplikat,
-- migration BERHENTI dengan pesan jelas supaya tidak ada data yang hilang diam-diam.
--
-- Langkah Manual
-- --------------
-- 1. Jalankan docs/sql/16-audit-duplikat-listing.sql
-- 2. Kalau "pasangan_duplikat" > 0, periksa mana baris yang benar untuk disimpan
-- 3. Hapus baris excess secara eksplisit (per creator_id, manual, denganbackup)
-- 4. Jalankan ulang migration ini

DO $$
DECLARE
  dup_count integer;
  dup_sample text;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT campaign_id, creator_id
    FROM campaign_creators
    GROUP BY campaign_id, creator_id
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    SELECT string_agg(x, E'\n' ORDER BY x) INTO dup_sample
    FROM (
      SELECT '  campaign_id=' || campaign_id
             || ' creator_id=' || creator_id
             || ' jumlah=' || cnt AS x
      FROM (
        SELECT campaign_id, creator_id, count(*) AS cnt
        FROM campaign_creators
        GROUP BY campaign_id, creator_id
        HAVING count(*) > 1
      ) g
      LIMIT 20
    ) s;

    RAISE EXCEPTION E'
Migration dibatalkan: ada % pasangan duplikat di campaign_creators.

Contoh (maksimal 20):
%s

Tidak ada data yang dihapus. Bersihkan dulu:
  1. Jalankan docs/sql/16-audit-duplikat-listing.sql
  2. Hapus baris excess secara eksplisit per pasangan
  3. Jalankan ulang migration ini
', dup_count, dup_sample;
  END IF;
END $$;

-- Baru aman sekarang: tidak ada duplikat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_campaign_creator_unique
  ON campaign_creators(campaign_id, creator_id);