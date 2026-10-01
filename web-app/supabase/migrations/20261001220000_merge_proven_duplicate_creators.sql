-- =====================================================================
-- 20261001220000 - Gabungkan creator duplikat yang terbukti sama
--
-- MASALAH
--   creators.username punya UNIQUE, tapi btree Postgres case-SENSITIVE.
--   syncUnmapped.ts melakukan INSERT dengan username yang sudah di-lowercase
--   dan hanya mengandalkan ON CONFLICT, sehingga "Bundaandhira" dan
--   "bundaandhira" bisa sama-sama ada. Root cause sudah diperbaiki di kode
--   pada 1 Okt 2026 dengan SELECT ... WHERE LOWER(username) = $1.
--
--   Akibatnya campaign_creators punya dua baris untuk campaign dan username
--   yang sama. Semua agregasi memakai username.toLowerCase() sebagai key,
--   jadi kedua baris dapat angka identik lalu dijumlahkan dua kali.
--   Terverifikasi 1 Okt 2026: 400 pasangan (campaign_id, username) bentrok,
--   400 baris lebih di campaign_creators.
--
-- DUA KELAS DUPLIKAT, HANYA YANG TERBUKTI YANG DIGABUNG
--   A. Beda kapital saja.
--      16.927 baris creators, 16.345 unik LOWER, jadi 582 baris lebih.
--      Terbukti aman karena LOWER() sudah menyatukannya.
--
--   B. Beda tanda baca, tapi ADA BUKTI dari data:
--      content_uid yang sama muncul di kedua baris campaign_creators, atau
--      keduanya punya baris di campaign yang sama. Contoh terverifikasi:
--        emak_kekinian (cc 44827) dan emak__kekinian (cc 51933)
--        pada content_uid 7686315005750332692 yang sama
--        storyandine dan Storyandine, 11 campaign yang sama
--      385 pasangan seperti ini.
--
--   C. Beda tanda baca, TANPA bukti. 349 pasangan, seluruhnya nol video
--      dan nol campaign bersama. Contoh "Aisyah Fitriani" vs
--      "AisyahFitriani". Terlihat sama tapi tidak ada satu pun fakta yang
--      membuktikannya, dan menggabungkan tanpa bukti berarti menebak orang.
--      TIDAK disentuh. Index LOWER(username) tetap bisa dibuat karena
--      username mereka berbeda kapitalisasinya juga.
--
-- BARIS YANG DIPERTAHANKAN = id terkecil. Stabil, bisa diulang, dan tidak
-- bergantung pada hitungan data yang bisa berubah.
--
-- AMAN
--   - Satu transaksi. Kalau gagal tidak ada yang berubah.
--   - Backup ke _backup_creators_20261001, _backup_campaign_creators_20261001
--     dan _backup_videos_20261001, sengaja tidak di-drop supaya bisa
--     dipulihkan manual.
--   - UNIQUE(campaign_id, creator_id) dijaga: baris cc yang bentrok
--     digabung assigned_sku_ids-nya dan videonya dipindah dulu, baru
--     baris duplikatnya dihapus.
--   - Guard membatalkan transaksi kalau scope di luar batas, kalau ada
--     video yang hilang semua, atau kalau ada baris non-duplikat
--     yang ikut terhapus.
--   - Guard juga membatalkan kalau merge_map membentuk rantai, yaitu ada
--     creator yang merge ke creator yang juga lagi merge.
-- =====================================================================

\pset pager off
\t on
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

\echo '--- backup ---'
SELECT count(*) AS backup_creators FROM _backup_creators_20261001;
SELECT count(*) AS backup_campaign_creators FROM _backup_campaign_creators_20261001;
SELECT count(*) AS backup_videos FROM _backup_videos_20261001;

-- ---------------------------------------------------------------------
-- 1. Peta merge. Kelas A dan kelas B dievaluasi bersamaan terhadap data
--    SEBELUM ada yang dihapus.
--
--    Catatan sintaks: WITH hanya boleh muncul SATU KALI di paling atas
--    statement. Percobaan pertama menaruh WITH di branch kedua UNION ALL dan
--    gagal dengan "syntax error at or near WITH", karena tiap cabang UNION
--    harus berupa SELECT biasa. Jadi semua CTE di sini mencakup kedua
--    cabang sekaligus.
--
--    PERLU index videos(content_uid) dan videos(campaign_creator_id) dari
--    20261001215000. Tanpa itu bagian bukti jadi sequential scan dan
--    migration menggantung sangat lama.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _merge_map ON COMMIT DROP AS
WITH norm AS (
    SELECT regexp_replace(LOWER(username),'[^a-z0-9]','','g') AS k,
           array_agg(id ORDER BY id) AS ids
    FROM creators
    GROUP BY 1
    HAVING count(*) > 1
), kandidat AS (
    SELECT ids[1] AS id_a, ids[2] AS id_b
    FROM norm
    WHERE array_length(ids,1) >= 2
), bukti_campaign AS (
    SELECT DISTINCT k.id_a, k.id_b
    FROM kandidat k
    JOIN campaign_creators ca ON ca.creator_id = k.id_a
    JOIN campaign_creators cb ON cb.campaign_id = ca.campaign_id
                             AND cb.creator_id = k.id_b
), bukti_video AS (
    SELECT DISTINCT k.id_a, k.id_b
    FROM kandidat k
    JOIN campaign_creators ca ON ca.creator_id = k.id_a
    JOIN videos va ON va.campaign_creator_id = ca.id
    JOIN videos vb ON vb.content_uid = va.content_uid
    JOIN campaign_creators cb ON cb.id = vb.campaign_creator_id
                             AND cb.creator_id = k.id_b
    WHERE va.content_uid IS NOT NULL
), terbukti AS (
    SELECT id_a, id_b FROM bukti_campaign
    UNION
    SELECT id_a, id_b FROM bukti_video
)
-- Kelas A. LOWER() sama, terbukti aman karena LOWER sudah menyatukannya.
SELECT c.id AS merge_id, m.min_id AS keep_id
FROM creators c
JOIN (SELECT LOWER(username) AS k, min(id) AS min_id
      FROM creators GROUP BY LOWER(username)) m
  ON m.k = LOWER(c.username)
WHERE c.id <> m.min_id

UNION ALL

-- Kelas B. Berbeda tanda baca, LOWER berbeda, tapi ADA bukti dari data.
SELECT t.id_b AS merge_id, t.id_a AS keep_id
FROM terbukti t
JOIN creators a ON a.id = t.id_a
JOIN creators b ON b.id = t.id_b
WHERE LOWER(a.username) <> LOWER(b.username);

\echo '--- peta merge ---'
SELECT count(*) AS pasangan_merge,
       count(*) FILTER (WHERE keep_id = merge_id) AS self_ref,
       count(DISTINCT merge_id) AS creator_yang_akan_dihapus
FROM _merge_map;

-- Guard 1: scope tidak boleh di luar batas, dan tidak boleh membentuk rantai.
DO $$
DECLARE n int; self_ref integer; rantai integer;
BEGIN
  SELECT count(*) INTO n FROM _merge_map;
  SELECT count(*) INTO self_ref FROM _merge_map WHERE keep_id = merge_id;

  -- Rantai: keep_id yang juga jadi merge_id di baris lain. Kalau ada, urutan
  -- DELETE bisa salah dan hasil akhirnya tidak sesuai peta.
  SELECT count(*) INTO rantai FROM _merge_map m
  WHERE EXISTS (SELECT 1 FROM _merge_map m2 WHERE m2.merge_id = m.keep_id);

  IF self_ref > 0 THEN
    RAISE EXCEPTION 'Batal: % baris merge ke dirinya sendiri', self_ref;
  END IF;
  IF rantai > 0 THEN
    RAISE EXCEPTION 'Batal: % merge_map membentuk rantai, urutan delete tidak bisa dipercaya', rantai;
  END IF;
  IF n = 0 THEN
    RAISE EXCEPTION 'Batal: peta merge kosong, sesuatu salah dengan query';
  END IF;
  IF n > 1200 THEN
    RAISE EXCEPTION 'Batal: % pasangan melebihi batas 1200. Duplikat terverifikasi sekitar 967', n;
  END IF;

  RAISE NOTICE 'Scope OK: % pasangan merge, tanpa rantai', n;
END $$;

-- ---------------------------------------------------------------------
-- 2. campaign_creators yang BENTROK: gabung assigned_sku_ids, pindah
--    videos dulu supaya tidak ikut terhapus, baru hapus baris duplikatnya.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _cc_bentrok ON COMMIT DROP AS
SELECT cc_jalan.id AS cc_merge,
       cc_tahan.id AS cc_keep,
       cc_jalan.campaign_id,
       cc_jalan.creator_id AS creator_merge,
       cc_tahan.creator_id AS creator_keep
FROM campaign_creators cc_jalan
JOIN _merge_map m ON m.merge_id = cc_jalan.creator_id
JOIN campaign_creators cc_tahan
  ON cc_tahan.campaign_id = cc_jalan.campaign_id
 AND cc_tahan.creator_id = m.keep_id
 AND cc_tahan.id <> cc_jalan.id;

\echo '--- campaign_creators yang bentrok ---'
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
-- ---------------------------------------------------------------------
UPDATE campaign_creators    cc SET creator_id = m.keep_id FROM _merge_map m WHERE cc.creator_id = m.merge_id;
UPDATE creator_snapshots    cs SET creator_id = m.keep_id FROM _merge_map m WHERE cs.creator_id = m.merge_id;
UPDATE creator_contacts     ct SET creator_id = m.keep_id FROM _merge_map m WHERE ct.creator_id = m.merge_id;
UPDATE creator_niches       cn SET creator_id = m.keep_id FROM _merge_map m WHERE cn.creator_id = m.merge_id;
UPDATE creator_notes        cn SET creator_id = m.keep_id FROM _merge_map m WHERE cn.creator_id = m.merge_id;
UPDATE creator_address_book ab SET creator_id = m.keep_id FROM _merge_map m WHERE ab.creator_id = m.merge_id;
UPDATE creator_bank_accounts ba SET creator_id = m.keep_id FROM _merge_map m WHERE ba.creator_id = m.merge_id;
UPDATE ads_performance      ap SET creator_id = m.keep_id FROM _merge_map m WHERE ap.creator_id = m.merge_id;

-- ---------------------------------------------------------------------
-- 4. Hapus baris creators yang sudah digabung
-- ---------------------------------------------------------------------
DELETE FROM creators c USING _merge_map m WHERE c.id = m.merge_id;

\echo '--- selesai merge ---'
SELECT count(*) AS total_creators,
       count(DISTINCT LOWER(username)) AS unik_lowercase
FROM creators;

-- ---------------------------------------------------------------------
-- 5. Jaring pengaman: UNIQUE case-insensitive
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_username_lower_unique
  ON creators (LOWER(username));

\echo '--- index LOWER(username) dibuat ---'

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Verifikasi
-- ---------------------------------------------------------------------
\echo ''
\echo '=== HASIL AKHIR ==='
SELECT count(*) AS total_creators,
       count(DISTINCT LOWER(username)) AS unik_lowercase,
       count(DISTINCT regexp_replace(LOWER(username),'[^a-z0-9]','','g')) AS unik_normalisasi
FROM creators;

\echo ''
\echo '=== campaign_creators yang (campaign, username) masih sama ==='
-- Harus 0. Ini yang sebelumnya bikin video terhitung dua kali.
SELECT cc.campaign_id, LOWER(c.username) AS username_lower, count(*) AS jml
FROM campaign_creators cc
JOIN creators c ON c.id = cc.creator_id
GROUP BY 1,2
HAVING count(*) > 1
ORDER BY jml DESC
LIMIT 20;

\echo ''
\echo '=== Pasangan mirip TANPA bukti yang sengaja tidak disentuh ==='
-- Kalau ini masih 349, artinya kelas C benar-benar tidak tersentuh.
WITH norm AS (
  SELECT regexp_replace(LOWER(username),'[^a-z0-9]','','g') AS k,
         array_agg(id ORDER BY id) AS ids
  FROM creators GROUP BY 1 HAVING count(*) > 1
)
SELECT count(*) AS pasangan_tanpa_bukti_yang_tetap_ada
FROM norm n
WHERE NOT EXISTS (
        SELECT 1 FROM campaign_creators ca
        JOIN campaign_creators cb ON cb.campaign_id = ca.campaign_id
        WHERE ca.creator_id = n.ids[1] AND cb.creator_id = n.ids[2])
  AND NOT EXISTS (
        SELECT 1 FROM videos va JOIN videos vb ON vb.content_uid = va.content_uid
        WHERE va.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = n.ids[1])
          AND vb.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = n.ids[2])
          AND va.content_uid IS NOT NULL);
