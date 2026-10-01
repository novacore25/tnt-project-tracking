-- =====================================================================
-- 20 - DRY RUN: apa yang akan dilakukan merge creator duplikat
-- Tanggal : 2026-10-01
-- Read-only. TIDAK mengubah data apa pun.
--
-- Jalankan INI DULUAN, periksa hasilnya, baru jalankan migration
-- 20261001120000_merge_duplicate_creators.sql
--
-- curl -s https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/20-dry-run-merge-creator.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on

\echo ''
\echo '=== 1. RINGKASAN ==='
SELECT
  (SELECT count(*) FROM creators) AS total_baris,
  (SELECT count(DISTINCT LOWER(username)) FROM creators) AS unik_lowercase,
  (SELECT count(*) FROM (SELECT 1 FROM creators GROUP BY LOWER(username) HAVING count(*)>1) x) AS kelompok_duplikat,
  (SELECT count(*) - count(DISTINCT LOWER(username)) FROM creators) AS baris_akan_dihapus;

\echo ''
\echo '=== 2. POLA: murni beda kapitalisasi, atau ada karakter lain? ==='
-- SAMA  = aman digabung (cuma beda kapitalisasi)
-- BEDA  = ada spasi/typo/simbol lain, JANGAN otomatis gabung
WITH d AS (
  SELECT LOWER(username) AS k, array_agg(username) AS namas, count(*) AS jml
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
SELECT
  CASE WHEN (SELECT count(DISTINCT n) FROM unnest(namas) AS n) = 1
       THEN 'SAMA (beda kapitalisasi saja)'
       ELSE 'BEDA (ada karakter lain)' END AS pola,
  count(*) AS jumlah_kelompok,
  sum(jml) AS total_baris
FROM d
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== 3. Yang BEDA karakter lain (butuh keputusan manual) ==='
WITH d AS (
  SELECT LOWER(username) AS k, array_agg(username) AS namas, count(*) AS jml
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
SELECT k AS username_lower, string_agg(n, ' / ' ORDER BY n) AS username_variasinya, jml
FROM d, unnest(namas) AS n
WHERE (SELECT count(DISTINCT n2) FROM unnest(namas) AS n2) > 1
GROUP BY k, jml
ORDER BY jml DESC
LIMIT 30;

\echo ''
\echo '=== 4. APAKAH ADA (campaign, username) YANG BENTROK DI campaign_creators ==='
-- Kalau nol, merge aman: tidak ada campaign_creators yang harus digabung.
SELECT count(*) AS pasangan_cc_bentrok,
       COALESCE(sum(jml), 0) AS baris_cc_yang_akan_dihapus
FROM (
  SELECT cc.campaign_id, count(*) AS jml
  FROM campaign_creators cc
  JOIN creators c ON c.id = cc.creator_id
  GROUP BY cc.campaign_id, LOWER(c.username)
  HAVING count(*) > 1
) x;

\echo ''
\echo '=== 5. Videos yang akan dipindah ==='
SELECT count(*) AS videos_akan_dipindah
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
WHERE cc.creator_id IN (
  SELECT id FROM creators
  WHERE LOWER(username) IN (SELECT LOWER(username) FROM creators GROUP BY LOWER(username) HAVING count(*)>1)
    AND id <> (SELECT min(c2.id) FROM creators c2 WHERE LOWER(c2.username) = LOWER(creators.username))
);

\echo ''
\echo '=== 6. Berapa creator yang punya data di >1 baris (jadi nyata digabung) ==='
WITH d AS (
  SELECT LOWER(username) AS k, array_agg(id ORDER BY id) AS ids
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
SELECT
  count(*) AS kelompok,
  count(*) FILTER (WHERE total_relasi > 1) AS kelompok_yang_ada_data_di_lebih_dari_satu_baris,
  sum(total_relasi) AS total_baris_relasi
FROM (
  SELECT d.k,
    (SELECT count(*) FROM campaign_creators cc WHERE cc.creator_id = ANY(d.ids))
  + (SELECT count(*) FROM creator_snapshots cs WHERE cs.creator_id = ANY(d.ids))
  + (SELECT count(*) FROM creator_contacts ct WHERE ct.creator_id = ANY(d.ids))
  + (SELECT count(*) FROM ads_performance ap WHERE ap.creator_id = ANY(d.ids))
  + (SELECT count(*) FROM creator_bank_accounts ba WHERE ba.creator_id = ANY(d.ids)) AS total_relasi
  FROM d
) y;

\echo ''
\echo '=== 7. 15 kelompok terbesar (yang paling banyak data) ==='
WITH d AS (
  SELECT LOWER(username) AS k, array_agg(id ORDER BY id) AS ids,
         string_agg(username, ' / ' ORDER BY id) AS nama
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
SELECT d.k AS username_lower, d.nama AS baris,
  array_length(d.ids,1) AS jml_baris,
  (SELECT count(*) FROM campaign_creators cc WHERE cc.creator_id = ANY(d.ids)) AS jml_campaign,
  (SELECT count(*) FROM videos v JOIN campaign_creators cc ON cc.id=v.campaign_creator_id WHERE cc.creator_id = ANY(d.ids)) AS jml_video,
  (SELECT count(*) FROM creator_snapshots cs WHERE cs.creator_id = ANY(d.ids)) AS jml_snapshot,
  (SELECT count(*) FROM ads_performance ap WHERE ap.creator_id = ANY(d.ids)) AS jml_ads
FROM d
ORDER BY jml_campaign DESC, jml_video DESC
LIMIT 15;