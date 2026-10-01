-- =====================================================================
-- 40 - PREFLIGHT: semua constraint yang bisa bentrok saat merge creator
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- KENAPA FILE INI
--   Migration merge sudah gagal 5 kali, setiap kali karena constraint yang
--   tidak terduga:
--     1. videos tanpa index -> sequential scan menggantung
--     2. WITH di branch UNION ALL -> syntax error
--     3. rantai merge 100 -> 200 -> 300
--     4. campaign_creators bentrok muncul SETELAH UPDATE
--     5. creator_niches punya PRIMARY KEY (creator_id, niche_id)
--   Penyebabnya sama: saya menulis migration tanpa tahu semua constraint
--   yang ada di database. File migration tidak bisa dijadikan acuan karena
--   beberapa tabel di sana tidak akurat, daily_performance dan
--   organic_videos sudah membuktikan itu.
--
--   Jadi constraint dibaca langsung dari katalog PostgreSQL, bukan dari file.
--
-- JALANKAN (pakai commit SHA, JANGAN "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/40-preflight-constraint.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. SEMUA TABEL YANG PUNYA KOLOM creator_id ==='
SELECT table_name,
       (SELECT count(*) FROM information_schema.columns c2
         WHERE c2.table_name = c1.table_name AND c2.column_name = 'creator_id') AS punya_creator_id
FROM information_schema.columns c1
WHERE column_name = 'creator_id'
ORDER BY table_name;

\echo ''
\echo '=== 2. SETIAP PRIMARY KEY DI TABEL ITU, BESERTA KOLOMNYA ==='
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       string_agg(kcu.column_name, ' + ' ORDER BY kcu.ordinal_position) AS kolom
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
 AND kcu.constraint_schema = tc.constraint_schema
WHERE tc.table_name IN (
        SELECT DISTINCT table_name FROM information_schema.columns WHERE column_name = 'creator_id'
      )
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
GROUP BY 1,2,3
ORDER BY 1,3;

\echo ''
\echo '=== 3. UNIQUE INDEX BUATAN SENDIRI (bukan constraint) ==='
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
        SELECT DISTINCT table_name FROM information_schema.columns WHERE column_name = 'creator_id'
      )
  AND indexdef ILIKE '%UNIQUE%'
ORDER BY 1,2;

\echo ''
\echo '=== 4. MANA YANG BISA BENTROK KALAU creator_id DI-UPDATE ==='
-- Kolom bertanda BENTROK kalau constraint-nya memuat creator_id DAN punya
-- kolom lain. Kalau constraint-nya cuma id, tidak ada masalah.
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE column_name = 'creator_id') AS tabel_dengan_creator_id,
  (SELECT count(*) FROM (
     SELECT tc.table_name, tc.constraint_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name
      AND kcu.constraint_schema = tc.constraint_schema
     WHERE tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
       AND tc.table_name IN (SELECT DISTINCT table_name FROM information_schema.columns WHERE column_name='creator_id')
     GROUP BY 1,2
     HAVING bool_or(kcu.column_name = 'creator_id') AND count(*) > 1
   ) a) AS constraint_yang_bisa_bentrok;

\echo ''
\echo '=== 5. SEMUA FK YANG MENUJUK creators (pastikan tidak ada yang terlewat) ==='
SELECT tc.table_name, kcu.column_name, tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'creators'
ORDER BY 1;

\echo ''
\echo '=== 6. PETA MERGE SAMA DENGAN YANG DIPAKAI MIGRATION ==='
-- Dibangun ulang persis seperti di migration, supaya angka bentrok di
-- bawah ini cocok dengan yang akan terjadi.
CREATE TEMP TABLE _norm AS
SELECT regexp_replace(LOWER(username),'[^a-z0-9]','','g') AS k,
       array_agg(id ORDER BY id) AS ids
FROM creators GROUP BY 1 HAVING count(*) > 1;

CREATE TEMP TABLE _kandidat AS
SELECT ids[1] AS id_a, ids[2] AS id_b FROM _norm WHERE array_length(ids,1) >= 2;

CREATE TEMP TABLE _bukti_campaign AS
SELECT DISTINCT k.id_a, k.id_b
FROM _kandidat k
JOIN campaign_creators ca ON ca.creator_id = k.id_a
JOIN campaign_creators cb ON cb.campaign_id = ca.campaign_id AND cb.creator_id = k.id_b;

CREATE TEMP TABLE _bukti_video AS
SELECT DISTINCT k.id_a, k.id_b
FROM _kandidat k
JOIN campaign_creators ca ON ca.creator_id = k.id_a
JOIN videos va ON va.campaign_creator_id = ca.id
JOIN videos vb ON vb.content_uid = va.content_uid
JOIN campaign_creators cb ON cb.id = vb.campaign_creator_id AND cb.creator_id = k.id_b
WHERE va.content_uid IS NOT NULL;

CREATE TEMP TABLE _terbukti AS
SELECT id_a, id_b FROM _bukti_campaign UNION SELECT id_a, id_b FROM _bukti_video;

CREATE TEMP TABLE _merge_map AS
SELECT c.id AS merge_id, m.min_id AS keep_id
FROM creators c
JOIN (SELECT LOWER(username) AS k, min(id) AS min_id FROM creators GROUP BY LOWER(username)) m
  ON m.k = LOWER(c.username)
WHERE c.id <> m.min_id
UNION ALL
SELECT t.id_b, t.id_a FROM _terbukti t
JOIN creators a ON a.id = t.id_a JOIN creators b ON b.id = t.id_b
WHERE LOWER(a.username) <> LOWER(b.username);

-- resolusi rantai, sama seperti migration
DO $$
DECLARE i integer := 0; c integer;
BEGIN
  LOOP
    i := i + 1;
    IF i > 20 THEN EXIT; END IF;
    UPDATE _merge_map m SET keep_id = a.keep_id FROM _merge_map a
    WHERE a.merge_id = m.keep_id AND a.keep_id <> m.keep_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    EXIT WHEN c = 0;
  END LOOP;
END $$;

\echo ''
\echo '=== 7. UKURAN PETA MERGE ==='
SELECT count(*) AS pasangan, count(DISTINCT merge_id) AS creator_dihapus,
       (SELECT count(*) FROM _merge_map m
         WHERE EXISTS (SELECT 1 FROM _merge_map m2 WHERE m2.merge_id = m.keep_id)) AS sisa_rantai
FROM _merge_map;

\echo ''
\echo '=== 8. BENTROK PER TABEL (angka yang harus ditangani migration) ==='
-- creator_niches: bentrok kalau (keep_id, niche_id) sama sudah ada
SELECT 'creator_niches' AS tabel, count(*) AS baris_bentrok FROM (
  SELECT cn.creator_id, cn.niche_id FROM creator_niches cn
  JOIN _merge_map m ON m.merge_id = cn.creator_id
  WHERE EXISTS (SELECT 1 FROM creator_niches c2
                WHERE c2.creator_id = m.keep_id AND c2.niche_id = cn.niche_id)
) a
UNION ALL
-- creator_bank_accounts: bentrok kalau (keep_id, bank_name, account_number) sama
SELECT 'creator_bank_accounts', count(*) FROM (
  SELECT ba.id FROM creator_bank_accounts ba
  JOIN _merge_map m ON m.merge_id = ba.creator_id
  WHERE EXISTS (SELECT 1 FROM creator_bank_accounts b2
                WHERE b2.creator_id = m.keep_id
                  AND b2.bank_name = ba.bank_name
                  AND b2.account_number = ba.account_number)
) b
UNION ALL
-- campaign_creators: sudah ditangani loop
SELECT 'campaign_creators', count(*) FROM (
  SELECT cc.id FROM campaign_creators cc
  JOIN _merge_map m ON m.merge_id = cc.creator_id
  WHERE EXISTS (SELECT 1 FROM campaign_creators c2
                WHERE c2.campaign_id = cc.campaign_id AND c2.creator_id = m.keep_id)
) c
UNION ALL
-- creator_address_book: tidak ada di migration, cek manual
SELECT 'creator_address_book', count(*) FROM (
  SELECT ab.id FROM creator_address_book ab
  JOIN _merge_map m ON m.merge_id = ab.creator_id
  WHERE EXISTS (SELECT 1 FROM creator_address_book a2
                WHERE a2.creator_id = m.keep_id AND a2.label = ab.label)
) d;

\echo ''
\echo '=== 9. KOLOM creator_address_book (tidak ada di migration) ==='
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'creator_address_book' ORDER BY ordinal_position;

\echo ''
\echo '=== 10. PAYMENT_ITEMS yang menunjuk bank_account yang akan hilang ==='
SELECT count(*) AS payment_items_terpengaruh
FROM payment_items pi
JOIN creator_bank_accounts ba ON ba.id = pi.bank_account_id
JOIN _merge_map m ON m.merge_id = ba.creator_id
WHERE EXISTS (SELECT 1 FROM creator_bank_accounts b2
              WHERE b2.creator_id = m.keep_id
                AND b2.bank_name = ba.bank_name
                AND b2.account_number = ba.account_number);

\echo ''
\echo '=== 11. TABEL LAIN YANG BISA MENGAMBIL creator_id SECARA TIDAK LANGSUNG ==='
-- Kolom yang isinya username tapiFK ke creators, atau kolom bernama
-- mirip yang bisa ikut bermasalah.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name ILIKE '%creator%'
  AND table_name NOT IN (SELECT DISTINCT table_name FROM information_schema.columns WHERE column_name = 'creator_id')
ORDER BY 1,2;
