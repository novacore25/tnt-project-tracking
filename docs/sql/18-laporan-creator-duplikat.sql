-- =====================================================================
-- 18 - Laporan pasangan creator duplikat (case-insensitive)
-- Tanggal : 2026-10-01
-- Alasan  : 16.927 baris creators tapi hanya 16.345 username unik
--           (lowercase). 582 kelompok duplikat, 2.521 campaign_creators
--           baris terdampak.
--
-- DAMPAK: semua agregasi server memakai username.toLowerCase() sebagai key
-- Map (videoActions.ts:144/159/179, PerformaClient.tsx:84). Kedua baris
-- creator dapat data yang IDENTIK, lalu dijumlahkan dua kali.
--
-- FILE INI READ-ONLY. Tidak mengubah data apa pun.
-- Jalankan di psql, lalu paste hasilnya ke chat.
-- =====================================================================

\echo ''
\echo '=== 1. RINGKASAN ==='
SELECT
  (SELECT count(*) FROM creators) AS total_baris,
  (SELECT count(DISTINCT LOWER(username)) FROM creators) AS unik_lowercase,
  (SELECT count(*) FROM (SELECT 1 FROM creators GROUP BY LOWER(username) HAVING count(*)>1) x) AS kelompok_duplikat,
  (SELECT count(*) FROM campaign_creators cc JOIN creators c ON c.id=cc.creator_id
     WHERE LOWER(c.username) IN (SELECT LOWER(username) FROM creators GROUP BY LOWER(username) HAVING count(*)>1)
  ) AS cc_terdampak;

\echo ''
\echo '=== 2. POLA DUPLIKAT: bedanya hanya kapitalisasi, atau ada karakter lain? ==='
-- Kalau mostly 'SAMA' berarti murni beda kapitalisasi (gampang: pakai yang mana saja).
-- Kalau banyak 'BEDA' berarti ada typo/spasi/nama beda -> jangan otomatis gabung.
WITH d AS (
  SELECT LOWER(username) AS k,
         count(*) AS jml,
         count(DISTINCT LOWER(username)) AS uniq_lower,
         array_agg(username) AS namas
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
SELECT
  CASE
    WHEN max(array_length(namas,1)) = 2
     AND (SELECT count(DISTINCT uname) FROM unnest(namas) AS uname) = 1
      THEN 'SAMA (beda kapitalisasi saja)'
    ELSE 'BEDA (ada karakter lain)'
  END AS pola,
  count(*) AS jumlah_kelompok
FROM d
GROUP BY 1
ORDER BY 2 DESC;

\echo ''
\echo '=== 3. DAFTAR LENGKAP (582 kelompok) ==='
-- Kolom "saran":
--   PINDAH   = baris dengan id lebih besar, biasanya hasil import bulk baru
--              (lihat pola id 16xxx vs id xxx di data)
--   TETAPKAN = baris pertama (id terkecil)
-- Tdecided manual per kelompok? Mulai dari yang jml datanya beda jauh.
WITH d AS (
  SELECT LOWER(username) AS k, array_agg(id ORDER BY id) AS ids
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
)
SELECT
  c.id,
  c.username,
  c.nama_asli,
  c.status,
  CASE WHEN c.id = d.ids[1] THEN 'TETAPKAN (id terkecil)' ELSE 'PINDAH (hapus, gabung ke id terkecil)' END AS saran,
  (SELECT count(*) FROM campaign_creators cc WHERE cc.creator_id = c.id) AS jml_campaign,
  (SELECT count(*) FROM videos v JOIN campaign_creators cc ON cc.id=v.campaign_creator_id WHERE cc.creator_id=c.id) AS jml_video,
  (SELECT count(*) FROM ads_performance a WHERE a.creator_id = c.id) AS jml_ads,
  (SELECT count(*) FROM creator_snapshots s WHERE s.creator_id = c.id) AS jml_snapshot,
  (SELECT count(*) FROM sales s WHERE LOWER(s.creator_username) = LOWER(c.username)) AS jml_sales_username,
  (SELECT COALESCE(sum(s.gmv),0) FROM sales s WHERE LOWER(s.creator_username) = LOWER(c.username)) AS gmv_username,
  (SELECT count(*) FROM creator_contacts ct WHERE ct.creator_id = c.id) AS jml_kontak,
  (SELECT count(*) FROM creator_address_book ab WHERE ab.creator_id = c.id) AS jml_alamat
FROM d
JOIN creators c ON LOWER(c.username) = d.k
ORDER BY LOWER(c.username), c.id;

\echo ''
\echo '=== 4. KELOMPOK BERISIKO TINGGI (kedua baris punya campaign/video beda) ==='
-- Kalau dua baris sama-sama punya campaign, ini BUKAN sekadar duplikat kapitalisasi.
-- Berarti ada campaign yang sama terdaftar ke dua creators.id berbeda.
--_merge harus pakai memilih baris per campaign, bukan gabung total.
WITH d AS (
--_merge harus pakai memilih baris per campaign, bukan gabung total.
  FROM creators GROUP BY LOWER(username) HAVING count(*) > 1
),
per_creator AS (
  SELECT c.id, LOWER(c.username) AS k,
         (SELECT count(*) FROM campaign_creators cc WHERE cc.creator_id=c.id) AS n_cc,
         (SELECT count(*) FROM campaign_creators cc
           WHERE cc.creator_id=c.id
             AND cc.campaign_id IN (SELECT campaign_id FROM campaign_creators WHERE creator_id = d.ids[1])
         ) AS n_cc_bersama
  FROM d JOIN creators c ON LOWER(c.username)=d.k
)
SELECT k,
       array_agg(id ORDER BY id) AS ids,
       sum(n_cc) AS total_campaign,
       sum(n_cc_bersama) AS campaign_yang_sama
FROM per_creator
GROUP BY k
HAVING sum(n_cc) > 0
ORDER BY campaign_yang_sama DESC, total_campaign DESC
LIMIT 50;

\echo ''
\echo '=== 5. campaign_creators yang sama persis (creator berbeda, campaign sama) ==='
-- Ini yang bikin GMV terhitung 2x di halaman Performa.
SELECT cc.campaign_id, cam.nama AS campaign, LOWER(c.username) AS username_lower,
       count(*) AS jml_baris, string_agg(cc.id::text, ' | ' ORDER BY cc.id) AS cc_ids
FROM campaign_creators cc
JOIN creators c ON c.id = cc.creator_id
LEFT JOIN campaigns cam ON cam.id = cc.campaign_id
GROUP BY cc.campaign_id, cam.nama, LOWER(c.username)
HAVING count(*) > 1
ORDER BY jml_baris DESC, cc.campaign_id
LIMIT 50;
