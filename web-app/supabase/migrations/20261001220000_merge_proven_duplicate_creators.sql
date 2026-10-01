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

-- ---------------------------------------------------------------------
-- 1b. Resolusi rantai.
--
-- Rantai muncul karena kedua kelas memakai kriteria berbeda. Contoh dengan
-- tiga baris:
--   id 100 story_andine   (LOWER beda, normalisasi sama)
--   id 200 Storyandine    (LOWER sama dengan 300, normalisasi sama)
--   id 300 storyandine
-- Kelas A membuat 300 -> 200, kelas B membuat 200 -> 100, sehingga
-- keep_id 200 sekaligus jadi merge_id di baris lain. Menghapus berurutan
-- seperti itu tidak bisa dipercaya, karena baris bisa hilang sebelum
-- dipindahkan.
--
-- Solusinya: setiap keep_id yang ternyata juga jadi merge_id diarahkan
-- ulang ke keep_id milik baris yang consume dia. Diulang sampai tidak ada
-- perubahan, dengan batas iterasi supaya tidak berputar tanpa henti.
-- ---------------------------------------------------------------------
DO $$
DECLARE iterasi integer := 0; berubah integer;
BEGIN
    LOOP
        iterasi := iterasi + 1;
        IF iterasi > 20 THEN
            RAISE EXCEPTION 'Batal: rantai merge tidak selesai dalam 20 iterasi';
        END IF;

        UPDATE _merge_map m
        SET keep_id = a.keep_id
        FROM _merge_map a
        WHERE a.merge_id = m.keep_id
          AND a.keep_id <> m.keep_id;

        GET DIAGNOSTICS berubah = ROW_COUNT;
        EXIT WHEN berubah = 0;

        RAISE NOTICE 'Resolusi rantai iterasi %: % keep_id dialihkan', iterasi, berubah;
    END LOOP;
END $$;

\echo '--- setelah resolusi rantai ---'
SELECT count(*) AS pasangan_merge,
       count(*) FILTER (WHERE keep_id = merge_id) AS self_ref,
       (SELECT count(*) FROM _merge_map m
         WHERE EXISTS (SELECT 1 FROM _merge_map m2 WHERE m2.merge_id = m.keep_id)) AS sisa_rantai
FROM _merge_map;

-- Guard 1: scope tidak boleh di luar batas, dan tidak boleh membentuk rantai.
DO $$
DECLARE n int; self_ref integer; rantai integer;
BEGIN
  SELECT count(*) INTO n FROM _merge_map;
  SELECT count(*) INTO self_ref FROM _merge_map WHERE keep_id = merge_id;

  -- Rantai: keep_id yang juga jadi merge_id di baris lain. Kalau ada, urutan
  -- DELETE bisa salah dan hasil akhirnya tidak sesuai peta. Setelah resolusi
  -- di langkah 1b, ini harus nol. Kalau tidak nol berarti ada komponen yang
  -- tidak terselesaikan dan lebih aman membatalkan.
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
-- 2. TABEL YANG PUNYA CONSTRAINT DENGAN creator_id + KOLOM LAIN
--
--    Preflight docs/sql/40 membaca katalog PostgreSQL dan menemukan tepat 3
--    constraint yang bisa bentrok, tidak ada yang terlewat:
--      creator_niches          PRIMARY KEY (creator_id, niche_id)
--      creator_bank_accounts   UNIQUE (creator_id, bank_name, account_number)
--      campaign_creators       UNIQUE (campaign_id, creator_id)
--
--    PENTING: hitungan bentrok SEBELUM perubahan adalah 0 untuk
--    creator_niches dan creator_bank_accounts, tapi keduanya tetap gagal
--    dengan UPDATE biasa. Sebabnya beberapa merge_id bisa menuju keep_id
--    yang sama. Kalau 1643 -> 100 dan 1644 -> 100, keduanya punya niche 20,
--    maka UPDATE pertama membuat baris (100, 20) dan UPDATE kedua
--    menabraknya. Bentrok muncul DI TENGAH proses, bukan sebelumnya.
--
--    Solusi tanpa loop: salin baris ke keep_id dengan INSERT ... ON CONFLICT,
--    baru hapus baris lamanya. Beberapa baris yang menuju keep_id dan
--    niche_id sama tertangani dalam satu statement, tanpa bergantung urutan
--    UPDATE. Untuk niche, peringkat tidak hilang: diambil yang tertinggi.
-- ---------------------------------------------------------------------

-- 2a. creator_niches
--     DISTINCT ON wajib. PostgreSQL tidak mengizinkan satu perintah
--     ON CONFLICT DO UPDATE menyentuh baris konflik yang sama dua kali, dan
--     itu yang terjadi di percobaan sebelumnya dengan pesan
--       ON CONFLICT DO UPDATE command cannot affect row a second time
--     karena beberapa merge_id menuju keep_id yang sama dengan niche_id yang
--     sama juga. Baris sumber di-dedup dulu, ambil peringkat tertinggi.
INSERT INTO creator_niches (creator_id, niche_id, peringkat)
SELECT DISTINCT ON (m.keep_id, cn.niche_id)
       m.keep_id, cn.niche_id, cn.peringkat
FROM creator_niches cn
JOIN _merge_map m ON m.merge_id = cn.creator_id
ORDER BY m.keep_id, cn.niche_id, cn.peringkat DESC, cn.creator_id DESC
ON CONFLICT (creator_id, niche_id) DO UPDATE
  SET peringkat = GREATEST(creator_niches.peringkat, EXCLUDED.peringkat);

DELETE FROM creator_niches cn USING _merge_map m WHERE m.merge_id = cn.creator_id;

-- 2b. creator_bank_accounts. payment_items.bank_account_id mereferensiasi
--     baris ini, jadi rujukan dipindahkan dulu sebelum baris lama dihapus.
--     DISTINCT ON dipakai dengan alasan yang sama seperti 2a: beberapa
--     merge_id bisa menuju keep_id dan rekening yang sama.
INSERT INTO creator_bank_accounts
  (creator_id, bank_name, account_number, account_holder, is_primary, added_by, created_at)
SELECT DISTINCT ON (m.keep_id, ba.bank_name, ba.account_number)
       m.keep_id, ba.bank_name, ba.account_number, ba.account_holder,
       ba.is_primary, ba.added_by, ba.created_at
FROM creator_bank_accounts ba
JOIN _merge_map m ON m.merge_id = ba.creator_id
ORDER BY m.keep_id, ba.bank_name, ba.account_number, ba.id DESC
ON CONFLICT (creator_id, bank_name, account_number) DO NOTHING;

UPDATE payment_items pi
SET bank_account_id = kb.id
FROM creator_bank_accounts ba
JOIN _merge_map m ON m.merge_id = ba.creator_id
JOIN creator_bank_accounts kb
  ON kb.creator_id = m.keep_id
 AND kb.bank_name = ba.bank_name
 AND kb.account_number = ba.account_number
WHERE pi.bank_account_id = ba.id
  AND kb.id <> ba.id;

DELETE FROM creator_bank_accounts ba USING _merge_map m WHERE m.merge_id = ba.creator_id;

-- 2c. Tabel yang HANYA punya PRIMARY KEY id, jadi UPDATE biasa aman.
--     FK: CASCADE untuk creator_address_book, NO ACTION untuk yang lain.
--     ad_name_mapping dan ads_name_mappings juga punya creator_id dan
--     keduanya PK-nya hanya ad_name, jadi tidak ikut bentrok.
UPDATE creator_snapshots     cs SET creator_id = m.keep_id FROM _merge_map m WHERE cs.creator_id = m.merge_id;
UPDATE creator_contacts      ct SET creator_id = m.keep_id FROM _merge_map m WHERE ct.creator_id = m.merge_id;
UPDATE creator_notes         cn SET creator_id = m.keep_id FROM _merge_map m WHERE cn.creator_id = m.merge_id;
UPDATE creator_address_book  ab SET creator_id = m.keep_id FROM _merge_map m WHERE ab.creator_id = m.merge_id;
UPDATE ads_performance       ap SET creator_id = m.keep_id FROM _merge_map m WHERE ap.creator_id = m.merge_id;
UPDATE ads_name_mappings     am SET creator_id = m.keep_id FROM _merge_map m WHERE am.creator_id = m.merge_id;
UPDATE ad_name_mapping       am SET creator_id = m.keep_id FROM _merge_map m WHERE am.creator_id = m.merge_id;

-- ---------------------------------------------------------------------
-- 3a. Peta semua creator ke root akhirnya.
--
--     WAJIB dipakai, bukan JOIN langsung ke _merge_map. Kalau satu creator
--     jadi keep_id untuk dua merge_id, misal 200 -> 100 dan 300 -> 100,
--     maka
--       JOIN _merge_map m ON cc.creator_id IN (m.merge_id, m.keep_id)
--     memasukkan baris cc itu DUA KALI ke array_agg. count(*) jadi 2 padahal
--     hanya ada satu baris sungguhan, sehingga kelompok itu tidak pernah
--     menyusut dan loop berputar tanpa henti. Itu yang terjadi di percobaan
--     sebelumnya: 443 kelompok di iterasi 1, lalu 8 kelompok yang tidak
--     berubah sampai iterasi 50.
--
--     Di sini satu baris per creator, jadi join tidak pernah menggandakan.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _root ON COMMIT DROP AS
SELECT c.id AS creator_id,
       COALESCE(m.keep_id, c.id) AS root_id
FROM creators c
LEFT JOIN _merge_map m ON m.merge_id = c.id;

-- ---------------------------------------------------------------------
-- 3b. campaign_creators, dikelompokkan per (root_id, campaign_id).
--
--     KESALAHAN SEBELUMNYA: bentrok yang ada diperiksa, dihapus, lalu UPDATE
--     dilakukan di LUAR loop. Padahal UPDATE itulah yang MEMBUAT bentrok.
--     Kalau 1643 -> 100 dan 1644 -> 100, keduanya punya baris di campaign 52,
--     UPDATE pertama membuat (52, 100) dan UPDATE kedua menabraknya.
--
--     ALGORITMA YANG BENAR, per GRUP bukan per baris. Untuk setiap
--     (root_id, campaign_id) yang punya lebih dari satu baris:
--       1. pilih SATU selamat: baris milik root_id kalau ada, kalau tidak
--          baris dengan id terkecil
--       2. pindahkan semua video ke baris selamat
--       3. union assigned_sku_ids dari seluruh baris di grup
--       4. set creator_id baris selamat ke root_id
--       5. hapus baris lain di grup
--     Baris root_id selalu menjadi selamat sehingga tidak pernah perlu
--     di-update, dan hanya satu baris per grup yang diubah, jadi bentrok
--     tidak mungkin terjadi.
-- ---------------------------------------------------------------------
DO $$
DECLARE iterasi integer := 0; jml integer;
BEGIN
    LOOP
        iterasi := iterasi + 1;
        IF iterasi > 50 THEN
            RAISE EXCEPTION 'Batal: campaign_creators tidak selesai dalam 50 iterasi';
        END IF;

        CREATE TEMP TABLE _grup ON COMMIT DROP AS
        SELECT
            r.root_id,
            cc.campaign_id,
            COALESCE(
                (SELECT min(cc2.id) FROM campaign_creators cc2
                 WHERE cc2.campaign_id = cc.campaign_id
                   AND cc2.creator_id = r.root_id),
                min(cc.id)
            ) AS survivor_id,
            array_agg(cc.id) AS semua_id
        FROM campaign_creators cc
        JOIN _root r ON r.creator_id = cc.creator_id
        GROUP BY r.root_id, cc.campaign_id
        HAVING count(*) > 1;

        SELECT count(*) INTO jml FROM _grup;

        IF jml = 0 THEN
            DROP TABLE _grup;
            RAISE NOTICE 'campaign_creators bersih di iterasi %', iterasi;
            EXIT;
        END IF;

        -- Karena _root tidak menggandakan baris, setiap kelompok di sini
        -- berisi minimal dua baris sungguhan, dan langkah 4 di bawah
        -- menghapus minimal satu. Jadi loop pasti menyusut dan berhenti.
        RAISE NOTICE 'Iterasi %: % kelompok digabung', iterasi, jml;

        UPDATE videos v
        SET campaign_creator_id = g.survivor_id
        FROM _grup g
        WHERE v.campaign_creator_id = ANY(g.semua_id)
          AND v.campaign_creator_id <> g.survivor_id;

        UPDATE campaign_creators survivor
        SET assigned_sku_ids = (
              SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::int[])
              FROM (
                SELECT unnest(COALESCE(o.assigned_sku_ids, '{}'::int[])) AS x
                FROM campaign_creators o
                WHERE o.id = ANY(g.semua_id)
              ) s)
        FROM _grup g
        WHERE survivor.id = g.survivor_id;

        UPDATE campaign_creators survivor
        SET creator_id = g.root_id
        FROM _grup g
        WHERE survivor.id = g.survivor_id
          AND survivor.creator_id <> g.root_id;

        DELETE FROM campaign_creators cc
        USING _grup g
        WHERE cc.id = ANY(g.semua_id)
          AND cc.id <> g.survivor_id;

        DROP TABLE _grup;
    END LOOP;

    -- Guard 1: tidak boleh tersisa pasangan kembar.
    SELECT count(*) INTO jml FROM (
        SELECT campaign_id, creator_id FROM campaign_creators
        GROUP BY 1,2 HAVING count(*) > 1
    ) z;
    IF jml > 0 THEN
        RAISE EXCEPTION 'Batal: masih ada % pasangan campaign_creators kembar', jml;
    END IF;

    -- Guard 2: setiap baris harus menunjuk root-nya sendiri. Kalau ada yang
    -- masih menunjuk merge_id, penghapusan creator akan melanggar foreign key.
    SELECT count(*) INTO jml
    FROM campaign_creators cc
    JOIN _root r ON r.creator_id = cc.creator_id
    WHERE cc.creator_id <> r.root_id;
    IF jml > 0 THEN
        RAISE EXCEPTION 'Batal: masih ada % baris campaign_creators yang belum menunjuk root-nya', jml;
    END IF;

    RAISE NOTICE 'campaign_creators bersih: tidak ada pasangan kembar dan semua baris menunjuk root';
END $$;

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
