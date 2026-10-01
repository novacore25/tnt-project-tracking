-- =====================================================================
-- 20261001120000 - Gabungkan creator yang username-nya duplikat (case-insensitive)
--
-- MASALAH
--   `creators.username` punya UNIQUE, tapi btree itu case-SENSITIVE.
--   `syncUnmapped.ts` melakukan INSERT dengan username yang sudah di-lowercase,
--   jadi baris `Bunaandshanum` dan `bunaandshanum` bisa sama-sama ada.
--   Akibatnya `campaign_creators` punya 2 baris untuk (campaign, username) yang
--   sama, dan semua agregasi memakai username.toLowerCase() sebagai key Map
--   sehingga kedua baris dapat angka identik lalu dijumlahkan dua kali.
--
--   Terverifikasi 1 Okt 2026: 16.927 baris creators, 16.345 unik lowercase,
--   582 kelompok duplikat, 2.521 baris campaign_creators terdampak.
--
-- KEPUTUSAN
--   Baris yang DIPERTAHANKAN = id terkecil (paling lama, biasanya yang asli
--   diinput manual). Baris lain digabung ke sana.
--   Alasan: id terkecil stabil, bisa diulang, dan tidak bergantung pada
--   hitungan data yang bisa berubah-ubah.
--
-- AMAN
--   - Semua dalam SATU transaksi. Kalau gagal, tidak ada yang berubah.
--   - Backup ke tabel _backup_* sebelum menyentuh apa pun.
--   - Tabel _backup_* sengaja TIDAK di-drop supaya bisa di-rollback manual.
--   - UNIQUE(campaign_id, creator_id) dijaga: baris cc yang bentrok
--     digabung assigned_sku_ids-nya, bukan dipindah.
--
-- JALANKAN
--   docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1 -f -
--
-- ROLLBACK (kalau perlu, sebelum tabel _backup_* dihapus)
--   Lihat docs/sql/21-rollback-merge-creator.sql
-- =====================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Backup
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_creators_20261001 AS
  SELECT * FROM creators
  WHERE LOWER(username) IN (
    SELECT LOWER(username) FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
  );

CREATE TABLE IF NOT EXISTS _backup_campaign_creators_20261001 AS
  SELECT cc.* FROM campaign_creators cc
  WHERE cc.creator_id IN (SELECT id FROM _backup_creators_20261001);

CREATE TABLE IF NOT EXISTS _backup_videos_20261001 AS
  SELECT v.* FROM videos v
  WHERE v.campaign_creator_id IN (SELECT id FROM _backup_campaign_creators_20261001);

\echo '--- backup dibuat ---'
SELECT count(*) AS backup_creators FROM _backup_creators_20261001;
SELECT count(*) AS backup_campaign_creators FROM _backup_campaign_creators_20261001;
SELECT count(*) AS backup_videos FROM _backup_videos_20261001;

-- ---------------------------------------------------------------------
-- 1. Peta keep -> merge
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _merge_map ON COMMIT DROP AS
SELECT
  c.id AS merge_id,
  (SELECT min(c2.id) FROM creators c2 WHERE LOWER(c2.username) = LOWER(c.username)) AS keep_id
FROM creators c
WHERE c.id <> (SELECT min(c2.id) FROM creators c2 WHERE LOWER(c2.username) = LOWER(c.username));

\echo '--- peta merge ---'
SELECT count(*) AS pasangan_merge FROM _merge_map;

-- Sanity: pastikan tidak ada yang merge ke dirinya sendiri / ke chain
DO $$
DECLARE SELF_REF integer;
BEGIN
  SELECT count(*) INTO SELF_REF FROM _merge_map WHERE merge_id = keep_id;
  IF SELF_REF > 0 THEN
    RAISE EXCEPTION 'Batal: ada % baris yang merge ke dirinya sendiri', SELF_REF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. campaign_creators yang BENTROK (campaign sama, username sama)
--    Gabung assigned_sku_ids, lalu hapus baris yang bendrok.
--    Videos harus dipindah dulu supaya tidak ikut terhapus.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _cc_bentrok ON COMMIT DROP AS
SELECT
  cc_jalan.id AS cc_merge,          -- baris yang akan dihapus
  cc_tahan.id AS cc_keep,           -- baris yang dipertahankan
  cc_jalan.campaign_id,
  cc_jalan.creator_id AS creator_merge,
  cc_tahan.creator_id AS creator_keep
FROM campaign_creators cc_jalan
JOIN _merge_map m ON m.merge_id = cc_jalan.creator_id
JOIN campaign_creators cc_tahan
  ON cc_tahan.campaign_id = cc_jalan.campaign_id
  AND cc_tahan.creator_id = m.keep_id
  AND cc_tahan.id <> cc_jalan.id;

\echo '--- campaign_creators yang bentrok (akan digabung) ---'
SELECT count(*) AS cc_bentrok FROM _cc_bentrok;

-- 2a. Pindahkan videos ke cc_keep lebih dulu
UPDATE videos v
SET campaign_creator_id = b.cc_keep
FROM _cc_bentrok b
WHERE v.campaign_creator_id = b.cc_merge;

-- 2b. Gabung assigned_sku_ids dari kedua baris cc
UPDATE campaign_creators cc_tahan
SET assigned_sku_ids = (
      SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::int[])
      FROM (
        SELECT unnest(COALESCE(cc_tahan.assigned_sku_ids, '{}'::int[])) AS x
        UNION
        SELECT unnest(COALESCE(
          (SELECT cc_jalan.assigned_sku_ids FROM campaign_creators cc_jalan
            WHERE cc_jalan.id = b.cc_merge),
          '{}'::int[])) AS x
      ) s
    )
FROM _cc_bentrok b
WHERE cc_tahan.id = b.cc_keep;

-- 2c. Hapus cc yang bendrok (videos sudah dipindah di 2a)
DELETE FROM campaign_creators cc
USING _cc_bentrok b
WHERE cc.id = b.cc_merge;

-- ---------------------------------------------------------------------
-- 3. Repoint sisa tabel yang FK ke creators.id
--    (yang campaign_creators sudah handled di atas)
-- ---------------------------------------------------------------------
UPDATE campaign_creators cc SET creator_id = m.keep_id FROM _merge_map m WHERE cc.creator_id = m.merge_id;
UPDATE creator_snapshots cs SET creator_id = m.keep_id FROM _merge_map m WHERE cs.creator_id = m.merge_id;
UPDATE creator_contacts ct SET creator_id = m.keep_id FROM _merge_map m WHERE ct.creator_id = m.merge_id;
UPDATE creator_niches cn SET creator_id = m.keep_id FROM _merge_map m WHERE cn.creator_id = m.merge_id;
UPDATE creator_notes cn SET creator_id = m.keep_id FROM _merge_map m WHERE cn.creator_id = m.merge_id;
UPDATE creator_address_book ab SET creator_id = m.keep_id FROM _merge_map m WHERE ab.creator_id = m.merge_id;
UPDATE creator_bank_accounts ba SET creator_id = m.keep_id FROM _merge_map m WHERE ba.creator_id = m.merge_id;
UPDATE ads_performance ap SET creator_id = m.keep_id FROM _merge_map m WHERE ap.creator_id = m.merge_id;

-- ---------------------------------------------------------------------
-- 4. Hapus baris creators yang sudah digabung
-- ---------------------------------------------------------------------
DELETE FROM creators c USING _merge_map m WHERE c.id = m.merge_id;

\echo '--- selesai merge ---'
SELECT count(*) AS sisa_duplikat FROM (
  SELECT 1 FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
) x;

-- ---------------------------------------------------------------------
-- 5. Jaring pengaman: UNIQUE case-insensitive
--    Tanpa ini, 11 titik INSERT INTO creators bisa bikin duplikat lagi.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_username_lower_unique
  ON creators (LOWER(username));

\echo '--- index LOWER(username) dibuat ---'

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Verifikasi setelah commit
-- ---------------------------------------------------------------------
\echo ''
\echo '=== HASIL AKHIR ==='
SELECT count(*) AS total_creators,
       count(DISTINCT LOWER(username)) AS unik_lowercase
FROM creators;

\echo ''
\echo '=== Sisa campaign_creators yang (campaign, username) sama ==='
SELECT cc.campaign_id, LOWER(c.username) AS username_lower, count(*) AS jml
FROM campaign_creators cc
JOIN creators c ON c.id = cc.creator_id
GROUP BY cc.campaign_id, LOWER(c.username)
HAVING count(*) > 1
ORDER BY jml DESC
LIMIT 20;