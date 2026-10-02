-- =====================================================================
-- L4a: PETAKAN CAMPAIGN DARI SPREADSHEET KE campaign_id
-- Tanggal: 2 Oktober 2026
-- Sifat: READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- MASALAH:
--   Nama campaign di spreadsheet TIDAK SAMA dengan nama di DB.
--     KIMME          vs KIME
--     SALSA COSMETICS vs SALSA Cosmetic
--     MSGLOWBEAUTY   vs MS Glow Beauty
--     MSGLOWFORMEN   vs MS Glow For Men
--     Nutriflakes    vs NUTRIFLAKES
--     Votre Peu      vs VOTRE PEAU / VOTRE PEU
--     SALSA Baby Care vs SALSA Mom & Baby   <- tidak jelas
--
-- ATURAN (AGENTS.md §18):
--   "Jangan fuzzy-match nama orang." Berlaku juga untuk campaign.
--   Tidak ada auto-mapping. Kandidat ditampilkan, orang yang memutuskan.
--
-- Cara pakai: jalankan, lihat bagian §2, lalu isi PETAKAN di §4.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §1. SEMUA CAMPAIGN DI DB ################'
SELECT id, nama, status, tipe_campaign,
       start_date, end_date
FROM campaigns
ORDER BY id;

\echo ''
\echo '################ §2. KANDIDAT BERDASARKAN KECOCOKAN KARAKTER ################'
\echo '-- Ini BUKAN auto-map. Cuma membantu melihat mana yang mirip.'
\echo '-- Bandingkan sendiri dengan daftar §1 di atas.'
WITH daftar AS (
    VALUES
      ('KIMME'),('PWS'),('DIOLY'),('OMG Makeup'),('SALSA COSMETICS'),
      ('MSGLOWBEAUTY'),('QAHIRA'),('NAISDAY'),('OMG Skincare'),('Nutriflakes'),
      ('SALSA Baby Care'),('GLOWIES'),('ISWHITE'),('SYB'),('MSGLOWFORMEN'),
      ('SKINMOLOGY'),('WARDAH'),('METOO'),('Referal MCN'),('TOP UP LION'),
      ('TOP UP QONTAK'),('Votre Peu'),('BOA'),('MCN Zoicy'),('MCN CLOGENT'),
      ('Sampel Kime'),('MCN'),('MILKYBOOST')
)
SELECT d.nama AS nama_sheet,
       c.id   AS kandidat_id,
       c.nama AS kandidat_db,
       -- berapa karakter yang sama (bukan untuk auto-map, cuma petunjuk)
       length(replace(replace(upper(d.nama),' ',''),c.nama,'') ) AS sisa
FROM daftar d
JOIN campaigns c
  ON upper(replace(c.nama,' ','')) LIKE '%' ||
     substring(upper(replace(d.nama,' ','')) from 1 for 4) || '%'
    OR upper(replace(d.nama,' ','')) LIKE '%' ||
     substring(upper(replace(c.nama,' ','')) from 1 for 4) || '%'
ORDER BY d.nama, c.id;

\echo ''
\echo '################ §3. NAMA CAMPAIGN YANG TIDAK ADA PADANAN ################'
\echo '-- Label operasional & campaign MCN tidak punya campaign_id sendiri.'
WITH daftar AS (
    VALUES ('KIMME'),('PWS'),('DIOLY'),('OMG Makeup'),('SALSA COSMETICS'),
      ('MSGLOWBEAUTY'),('QAHIRA'),('NAISDAY'),('OMG Skincare'),('Nutriflakes'),
      ('SALSA Baby Care'),('GLOWIES'),('ISWHITE'),('SYB'),('MSGLOWFORMEN'),
      ('SKINMOLOGY'),('WARDAH'),('METOO'),('Referal MCN'),('TOP UP LION'),
      ('TOP UP QONTAK'),('Votre Peu'),('BOA'),('MCN Zoicy'),('MCN CLOGENT'),
      ('Sampel Kime'),('MCN'),('MILKYBOOST')
)
SELECT d.nama AS nama_tanpa_padanan
FROM daftar d
WHERE NOT EXISTS (
    SELECT 1 FROM campaigns c
    WHERE upper(replace(c.nama,' ','')) LIKE '%' ||
          substring(upper(replace(d.nama,' ','')) from 1 for 4) || '%'
       OR upper(replace(d.nama,' ','')) LIKE '%' ||
          substring(upper(replace(c.nama,' ','')) from 1 for 4) || '%'
)
ORDER BY 1;

\echo ''
\echo '################ §4. PETAKAN AKHIR (ISI SETELAH KONFIRMASI) ################'
\echo '-- Ganti NULL dengan campaign_id yang benar.'
\echo '-- Kalau tidak ada campaign_id yang benar, biarkan NULL -> baris DEFER.'
\echo ''
\echo "CREATE TEMP TABLE petakan_campaign(nama_sheet text, campaign_id int);"
\echo "INSERT INTO petakan_campaign VALUES"
\echo "  ('KIMME',           44),   -- KIME"
\echo "  ('PWS',             38),"
\echo "  ('DIOLY',           40),"
\echo "  ('OMG Makeup',      33),"
\echo "  ('SALSA COSMETICS', 35),   -- cek: SALSA Cosmetic vs SALSA Mom & Baby"
\echo "  ('MSGLOWBEAUTY',    41),"
\echo "  ('QAHIRA',          45),"
\echo "  ('NAISDAY',         39),"
\echo "  ('OMG Skincare',    34),"
\echo "  ('Nutriflakes',     49),"
\echo "  ('SALSA Baby Care', 36),   -- cek: czyeba Mom & Baby?"
\echo "  ('GLOWIES',         51),"
\echo "  ('ISWHITE',         47),"
\echo "  ('SYB',             46),"
\echo "  ('MSGLOWFORMEN',    42),"
\echo "  ('SKINMOLOGY',      43),"
\echo "  ('WARDAH',          37),"
\echo "  ('Votre Peu',       53),   -- cek: VOTRE PEAU atau VOTRE PEU?"
\echo "  ('MILKYBOOST',      52),"
\echo "  ('Sampel Kime',     44),   -- keputusan #5: operasional KIME"
\echo "  ('TOP UP LION',     58),   -- cek: LION PARCEL?"
\echo "  ('METOO',        NULL),   -- tidak ada padanan -> DEFER"
\echo "  ('Referal MCN',  NULL),"
\echo "  ('TOP UP QONTAK',NULL),"
\echo "  ('BOA',         NULL),"
\echo "  ('MCN Zoicy',   NULL),"
\echo "  ('MCN CLOGENT', NULL),"
\echo "  ('MCN',         NULL);"
\echo ''
\echo '-- ones NOT listed above (kalau ada) = tidak punya campaign_id -> DEFER.'
\echo ''
\echo '################ §5. SETELAH PETAKAN ISI: SAMAKAN DENGAN CACHE ################'
\echo '-- Menempelkan cache parsed-826.csv ke DB perlu COPY.刚好:'
\echo ''
\echo '\copy parsed_payment(tanggal,username,nama_penerima,nomor_rekening,campaign_sheet,status_klaim,nominal,ratecard_awal,pic,note,jenis,nomor_gambar) FROM ''docs/payment/parsed-826.csv'' WITH (FORMAT csv, HEADER true, NULL '''');'