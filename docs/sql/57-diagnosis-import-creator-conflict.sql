-- =====================================================================
-- DIAGNOSIS: Kenapa Import Penjualan GAGAL (idx_creators_username_lower_unique)
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- GEJALA (dari log UI "Input Penjualan"):
--   duplicate key value violates unique constraint
--   "idx_creators_username_lower_unique"
--   [Error | INSERT INTO creators (username, nama_asli, link_account, added_by)
--    <- VALUES ()]
--
--   Organik Sales : 0 tersimpan, 429 gagal (3 batch x ~150)
--   Awareness Vid : 3 tersimpan, 10.650 gagal
--   Awareness Live: 84 tersimpan, 300 gagal
--
-- HIPOTESIS:
--   `creators.username` punya DUA unique index:
--     1. creators_username_key            -> UNIQUE (username), case-SENSITIVE
--     2. idx_creators_username_lower_unique -> UNIQUE (LOWER(username)), baru
--   Kode import menulis `ON CONFLICT (username)` yang hanya cocok dengan (1).
--   Jadi bentrok KAPITAL (`Budi` vs `budi`) lolos dari (1) lalu ditolak (2).
--
--   Kode import sudah `toLowerCase()` username sebelum insert, jadi bentroknya
--   harus datang dari BARIS LAMA yang masih huruf besar.
--
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '################ §1. INDEX APA SAJA YANG ADA DI creators.username? ################'
SELECT indexname,
       indexdef,
       CASE WHEN indexdef ILIKE '%lower((username)::text)%' THEN 'EKSPRESI (LOWER)'
            WHEN indexdef ILIKE '%(username)%'            THEN 'PLAIN'
            ELSE 'lainnya' END AS jenis
FROM pg_indexes
WHERE tablename = 'creators'
ORDER BY indexname;

\echo ''
\echo '################ §2. APAKAH creators.username ADA YANG HURUF BESAR? ################'
SELECT COUNT(*)                                              AS total_creator,
       COUNT(*) FILTER (WHERE username <> LOWER(username))  AS username_ada_huruf_besar,
       COUNT(*) FILTER (WHERE username = LOWER(username))   AS username_sudah_lower,
       COUNT(DISTINCT LOWER(username))                      AS unik_setelah_lower
FROM creators;

\echo ''
\echo '################ §3. 30 CREATOR YANG MASIH HURUF BESAR ################'
SELECT id, username, LOWER(username) AS username_lower, added_by, created_at
FROM creators
WHERE username <> LOWER(username)
ORDER BY id
LIMIT 30;

\echo ''
\echo '################ §4. KOLOM APA YANG BEDA ANTARA HURUF BESAR / KECIL? ################'
SELECT COUNT(*) FILTER (WHERE username <> LOWER(username) AND nama_asli <> LOWER(username)) AS nama_asli_ikut_kapital,
       COUNT(*) FILTER (WHERE username <> LOWER(username) AND link_account ILIKE '%@%')  AS punya_link,
       COUNT(*) FILTER (WHERE username <> LOWER(username) AND status IS NOT NULL)       AS punya_status
FROM creators
WHERE username <> LOWER(username);

\echo ''
\echo '################ §5. APAKAH ADA YANG BENTROK SETELAH DI-LOWER? ################'
-- Kalau semua username di-lowercase, apakah masih ada duplikat?
SELECT COUNT(*) AS pasangan_bentrok
FROM (
  SELECT LOWER(username) AS u, COUNT(*) AS n
  FROM creators WHERE username IS NOT NULL
  GROUP BY LOWER(username) HAVING COUNT(*) > 1
) z;

\echo ''
\echo '################ §6. APAKAH MEMANG ADA 2 UNIQUE INDEX? ################'
-- Kalau iya, `ON CONFLICT (username)` tidak akan menangkap bentrok kapital.
SELECT conname, pg_get_constraintdef(oid) AS definisi
FROM pg_constraint
WHERE conrelid = 'creators'::regclass AND contype = 'u'
ORDER BY conname;

\echo ''
\echo '################ §7. SIMULASI: APA YANG AKAN GAGAL? ################'
-- Kitakan apa yang terjadi kalau nama huruf besar dari sales ikut diimpor.
-- Code import: `INSERT ... ON CONFLICT (username) DO NOTHING`.
-- Kalau username input = huruf besar dan versi lowercase-nya sudah ada,
-- ON CONFLICT(username) tidak kena -> LOWER index yang menolak.
SELECT c.id, c.username, c.LOWER(username) AS akan_ada_sebagai
FROM creators c
WHERE c.username <> LOWER(c.username)
ORDER BY c.id
LIMIT 15;

\echo ''
\echo '################ §8. DAMBAK JIKA DI-LOWER SEMUA ################'
--yonji Kalau kita normalize username ke huruf kecil semua:
--   - campaign_creators & sales & organic_videos memakai username sebagai key
--     dengan .toLowerCase() di JS, jadi tidak ikut berubah.
--   - TAPI kolom yang menyimpan username TIDAK berubah -> link jadi rusak.
--   Jadi harus careful: cek dulu apakah ada kolom username di tabel lain.
SELECT 'campaign_creators' AS tbl,
       COUNT(*) FILTER (WHERE creator_id IN (SELECT id FROM creators WHERE username <> LOWER(username))) AS baris_terhubung
FROM campaign_creators
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
WHERE LOWER(COALESCE(creator_username,'')) IN
      (SELECT LOWER(username) FROM creators WHERE username <> LOWER(username))
UNION ALL
SELECT 'organic_videos', COUNT(*) FROM organic_videos
WHERE LOWER(COALESCE(creator_username,'')) IN
      (SELECT LOWER(username) FROM creators WHERE username <> LOWER(username));

\echo ''
\echo '################ §9. RINGKASAN ################'
\echo ' §1  indexes di creators.username (inti masalah)'
\echo ' §2  berapa creator yang username-nya huruf besar'
\echo ' §3  daftar 30 pertama (jika ada)'
\echo ' §5  pasangan bentrok setelah di-lower'
\echo ' §8  berapa baris di tabel lain yang terhubung ke creator itu'
\echo ''
\echo ' KESIMPULAN yang diharapkan:'
\echo '   §1 ada 2 unique index -> `ON CONFLICT (username)` tidak cukup'
\echo '   §2 > 0 -> itu penyebab 429 baris gagal'
