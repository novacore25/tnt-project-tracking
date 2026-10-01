-- =====================================================================
-- 39 - DUPLIKAT CREATOR: beda kapital vs beda tanda baca
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- MASALAH
--   creators.username punya UNIQUE, tapi btree Postgres case-SENSITIVE.
--   syncUnmapped.ts melakukan INSERT dengan username yang sudah di-lowercase
--   dan hanya mengandalkan ON CONFLICT, sehingga "Bunaandshanum" dan
--   "bunaandshanum" bisa sama-sama ada. Root cause sudah diperbaiki di kode
--   pada 1 Okt 2026 dengan SELECT ... WHERE LOWER(username) = $1.
--
--   Tapi ada kelas kedua yang belum tertangkap: username yang berbeda tanda
--   baca, bukan kapital. Contoh terverifikasi:
--     7686315005750332692 -> cc 44827 emak_kekinian  (urutan 1)
--     7686315005750332692 -> cc 51953 emak__kekinian (urutan 2)
--   Dua underscore versus satu, LOWER() tidak menyamakan, jadi migration
--   20261001120000 tidak akan menangkap pasangan seperti ini.
--
-- TIGA KASUS, DAN HANYA KASUS PERTAMA YANG AMAN
--   A. Beda kapital saja            -> LOWER() menyamakan, aman digabung
--   B. Beda tanda baca, ada bukti   -> ada video atau campaign yang sama
--   C. Beda tanda baca, tanpa bukti -> BISA creators berbeda, jangan digabung
--
--   Bukti untuk kelas B: content_uid yang sama muncul di kedua baris, atau
--   keduanya punya campaign_creators di campaign yang sama. Itu tidak mungkin
--   terjadi kalau dua orang berbeda.
--
-- Jalankan (pakai commit SHA, JANGAN "main"):
-- curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/39-duplikat-creator.sql" | docker exec -i 6ve3f9qfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. RINGKASAN ==='
SELECT count(*) AS total_creators,
       count(DISTINCT LOWER(username)) AS unik_lowercase,
       count(DISTINCT regexp_replace(LOWER(username),'[^a-z0-9]','','g')) AS unik_normal,
       count(*) - count(DISTINCT LOWER(username)) AS kelompok_kapital,
       count(DISTINCT LOWER(username)) - count(DISTINCT regexp_replace(LOWER(username),'[^a-z0-9]','','g')) AS kelompok_tanda_baca
FROM creators;

\echo ''
\echo '=== 2. KELAS A: beda kapital saja (aman digabung) ==='
WITH d AS (
  SELECT LOWER(username) AS k, array_agg(username) AS namas, count(*) AS jml
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
SELECT CASE WHEN (SELECT count(DISTINCT n) FROM unnest(namas) AS n) = 1
            THEN 'BENAR-BENAR SAMA, beda kapital saja' ELSE 'ADA BEDA LAIN' END AS pola,
       count(*) AS kelompok, sum(jml) AS total_baris
FROM d GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== 3. KELAS B vs C: beda tanda baca, dengan dan tanpa bukti ==='
WITH norm AS (
  SELECT regexp_replace(LOWER(username),'[^a-z0-9]','','g') AS k,
         array_agg(id ORDER BY id) AS ids,
         array_agg(username ORDER BY id) AS namas
  FROM creators
  GROUP BY 1
  HAVING count(*) > 1
), evidence AS (
  SELECT n.k,
         n.ids, n.namas,
         -- video sama: content_uid yang muncul di kedua baris
         (SELECT count(*) FROM (
            SELECT v.content_uid FROM videos v
            WHERE v.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = ANY(n.ids))
            GROUP BY v.content_uid
            HAVING count(DISTINCT v.campaign_creator_id) > 1
         ) vx) AS video_sama,
         -- campaign sama: campaign_creators di campaign yang sama
         (SELECT count(*) FROM (
            SELECT cc.campaign_id FROM campaign_creators cc
            WHERE cc.creator_id = ANY(n.ids)
            GROUP BY cc.campaign_id
            HAVING count(DISTINCT cc.creator_id) > 1
         ) cx) AS campaign_sama
  FROM norm n
)
SELECT
  CASE WHEN video_sama > 0 OR campaign_sama > 0 THEN 'B (ADA BUKTI, aman gabung)'
       ELSE 'C (TANPA BUKTI, jangan gabung)' END AS kelas,
  count(*) AS pasangan,
  COALESCE(sum(video_sama),0) AS total_video_sama,
  COALESCE(sum(campaign_sama),0) AS total_campaign_sama
FROM evidence
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== 4. 25 PASANGAN DENGAN BUKTI TERKUAT ==='
WITH norm AS (
  SELECT regexp_replace(LOWER(username),'[^a-z0-9]','','g') AS k,
         array_agg(id ORDER BY id) AS ids,
         array_agg(username ORDER BY id) AS namas
  FROM creators
  GROUP BY 1 HAVING count(*) > 1
), evidence AS (
  SELECT n.k, n.namas,
         (SELECT count(*) FROM (
            SELECT v.content_uid FROM videos v
            WHERE v.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = ANY(n.ids))
            GROUP BY v.content_uid HAVING count(DISTINCT v.campaign_creator_id) > 1
         ) vx) AS video_sama,
         (SELECT count(*) FROM (
            SELECT cc.campaign_id FROM campaign_creators cc
            WHERE cc.creator_id = ANY(n.ids)
            GROUP BY cc.campaign_id HAVING count(DISTINCT cc.creator_id) > 1
         ) cx) AS campaign_sama
  FROM norm n
)
SELECT namas[1] AS username_a, namas[2] AS username_b, video_sama, campaign_sama
FROM evidence
WHERE video_sama > 0 OR campaign_sama > 0
ORDER BY video_sama DESC, campaign_sama DESC LIMIT 25;

\echo ''
\echo '=== 5. 25 PASANGAN TANPA BUKTI (jangan digabung) ==='
WITH norm AS (
  SELECT regexp_replace(LOWER(username),'[^a-z0-9]','','g') AS k,
         array_agg(id ORDER BY id) AS ids,
         array_agg(username ORDER BY id) AS namas
  FROM creators
  GROUP BY 1 HAVING count(*) > 1
), evidence AS (
  SELECT n.k, n.namas,
         (SELECT count(*) FROM (
            SELECT v.content_uid FROM videos v
            WHERE v.campaign_creator_id IN (SELECT id FROM campaign_creators WHERE creator_id = ANY(n.ids))
            GROUP BY v.content_uid HAVING count(DISTINCT v.campaign_creator_id) > 1
         ) vx) AS video_sama,
         (SELECT count(*) FROM (
            SELECT cc.campaign_id FROM campaign_creators cc
            WHERE cc.creator_id = ANY(n.ids)
            GROUP BY cc.campaign_id HAVING count(DISTINCT cc.creator_id) > 1
         ) cx) AS campaign_sama
  FROM norm n
)
SELECT namas[1] AS username_a, namas[2] AS username_b, video_sama, campaign_sama
FROM evidence
WHERE video_sama = 0 AND campaign_sama = 0
ORDER BY 1 LIMIT 25;

\echo ''
\echo '=== 6. DAMPAK KELAS A + B ke campaign_creators ==='
-- Berapa baris campaign_creators yang akan hilang dan berapa GMV yang
-- saat ini terhitung dua kali.
SELECT count(*) AS baris_cc_total,
       count(DISTINCT cc.creator_id) AS creator_id_unik
FROM campaign_creators cc;

\echo ''
\echo '=== 7. GMV YANG TERHITUNG DUA KALI sekarang ==='
-- sales dihitung per campaign_creators? Tidak, tapi campaign_creators dobel
-- membuat video terhitung dua kali di halaman Performa.
SELECT
  (SELECT count(*) FROM campaign_creators) AS cc_total,
  (SELECT count(*) FROM (
     SELECT cc.campaign_id, LOWER(c.username) AS uname
     FROM campaign_creators cc JOIN creators c ON c.id = cc.creator_id
     GROUP BY 1,2 HAVING count(*) > 1
   ) z) AS pasangan_cc_bentrok,
  (SELECT COALESCE(sum(jml-1),0) FROM (
     SELECT count(*) AS jml FROM campaign_creators cc JOIN creators c ON c.id = cc.creator_id
     GROUP BY cc.campaign_id, LOWER(c.username) HAVING count(*) > 1
   ) y) AS baris_cc_lebih;

\echo ''
\echo '=== 8. VIDEO TERDUPLEKIKASI DI TABEL videos ==='
SELECT
  (SELECT count(*) FROM videos WHERE content_uid IS NOT NULL) AS video_total,
  (SELECT count(DISTINCT content_uid) FROM videos WHERE content_uid IS NOT NULL) AS video_unik,
  (SELECT count(*) FROM videos WHERE content_uid IS NOT NULL)
    - (SELECT count(DISTINCT content_uid) FROM videos WHERE content_uid IS NOT NULL) AS baris_lebih;

\echo ''
\echo '=== 9. APAKAH ADA creators YANG MIRIP TANPA PUNYA campaign_creators? ==='
-- Kalau tidak punya relasi sama sekali,.merge tidak punya efek apa pun dan
-- tidak perlu diganggu.
WITH norm AS (
  SELECT regexp_replace(LOWER(username),'[^a-z0-9]','','g') AS k,
         array_agg(id ORDER BY id) AS ids
  FROM creators GROUP BY 1 HAVING count(*) > 1
)
SELECT count(*) AS pasangan,
       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM campaign_creators cc WHERE cc.creator_id = ANY(n.ids))) AS tanpa_relasi,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM campaign_creators cc WHERE cc.creator_id = ANY(n.ids)))    AS ada_relasi
FROM norm n;
