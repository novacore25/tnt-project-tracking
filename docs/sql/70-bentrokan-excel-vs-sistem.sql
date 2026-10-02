-- =====================================================================
-- L6 - BENTROKAN: Excel "Paid Off" vs SUDAH ADA DI SISTEM
-- Tanggal: 2 Oktober 2026
-- Sifat : READ-ONLY.
--
-- MASALAH YANG DICARI (kekhawatiran owner):
--   "di PWS September ada pengajuan dan udah dibayar, sedangkan di Juli juga
--    udah dibayar yang di Excelnya - takutnya itu pengajuan yang sama"
--
-- INI BUKAN duplikasi baris (yang sudah terbukti 0 di dalam Excel).
-- Ini DUPLIKAT LOKASI: satu pembayaran yang sama tercatat di Excel DAN
-- di sistem. Kalau dibiarkan, uang dihitung 2 kali saat rekap.
--
-- Kenapa mungkin terjadi:
--   - Excel dipakai s/d Agustus. Sistem baru aktif 14 Sep 2026.
--   - Staff mungkin upload pembayaran LAGI ke sistem tanpa sadar bahwa
--     pembayaran itu sama persis dengan yang sudah dibayar dan dicatat di Excel.
--   - Status "Paid Off" di Excel itu per CAMPAIGN, bukan per batch, jadi
--     tidak ada yang mencegah input ulang.
--
-- Cara kerja:
--   Bandingkan payment_items yang SUDAH ADA dengan staging Excel lewat
--   campaign_creators. Kunci pembanding: username + campaign + nominal.
--   Tanggal TIDAK dipakai sebagai kunci, karena tanggal di Excel adalah
--   tanggal PENGAJUAN/transfer, sedangkan di sistem bisa berbeda 1-2 bulan.
--
-- WAJIB jalankan setelah:
--   1. migration 20261004000000_payment_import_staging.sql
--   2. docs/sql/67-isi-staging-payment.sql
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §0. PREFLIGHT - KOLOM YANG DIPAKAI BENAR? ################'
\echo '-- WAJIB dibaca lebih dulu. schema.ts TIDAK bisa dipercaya (skill §3.1).'
\echo '-- cc.rate_card sudah terbukti TIDAK ADA di DB padahal ada di schema.ts.'
\echo '-- Kalau nama kolom di §3 salah, ganti di sini lalu jalan ulang §3.'

\echo ''
\echo '--- campaign_creators: semua kolom ---'
\echo '--- cari: status_bayar, tgl_bayar, pelunasan, approval, price, tier ---'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaign_creators'
ORDER BY ordinal_position;

\echo ''
\echo '--- payment_items + payment_batches: kolom kunci ---'
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('payment_items','payment_batches')
  AND column_name IN ('actual_payment_date','actual_transfer','submitted_at',
                      'batch_label','campaign_id','campaign_creator_id','nominal')
ORDER BY table_name, column_name;

\echo ''
\echo '################ §1. PAYMENT YANG SUDAH ADA DI SISTEM ################'
\echo '-- 111 item per hasil L0. Bandingkan nominal + campaign + kreator.'
SELECT pi.id, pi.nominal, pi.payment_type,
       b.campaign_id, c.nama AS campaign,
       cr.username,
       pi.nama_penerima, pi.nomor_rekening,
       b.batch_label, b.submitted_at::date AS tgl_submit,
       b.actual_payment_date
FROM payment_items pi
JOIN payment_batches b ON b.id = pi.batch_id
LEFT JOIN campaigns c ON c.id = b.campaign_id
LEFT JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
LEFT JOIN creators cr ON cr.id = cc.creator_id
ORDER BY pi.id;

\echo ''
\echo '################ §2. RINGKASAN YANG SUDAH ADA DI SISTEM ################'
SELECT b.campaign_id, c.nama AS campaign,
       count(*) AS item, sum(pi.nominal) AS nominal,
       min(b.submitted_at)::date AS submit_pertama,
       max(b.submitted_at)::date AS submit_terakhir
FROM payment_items pi
JOIN payment_batches b ON b.id = pi.batch_id
LEFT JOIN campaigns c ON c.id = b.campaign_id
GROUP BY 1,2
ORDER BY nominal DESC;

\echo ''
\echo '################ §3. ⚠️ KEMUNGKINAN DUPLIKAT LOKASI ################'
\echo '-- Kunci: username + campaign + nominal.'
\echo '-- Tanggal sengaja TIDAK dipakai (lihat header).'
\echo '-- campaign_id di staging sengaja dipakai langsung supaya query ini'
\echo '-- jalan tanpa peta campaign terisi dulu.'
SELECT s.sheet, s.row, s.tanggal AS tgl_excel, s.username,
       s.campaign_sheet, s.nominal AS nominal_excel, s.status_klaim,
       pi.id AS id_sistem, pi.nominal AS nominal_sistem,
       b.batch_label, b.submitted_at::date AS tgl_submit,
       b.actual_payment_date
FROM payment_import_staging s
JOIN payment_batches b
  ON b.campaign_id = CASE s.campaign_sheet
       WHEN 'KIMME' THEN 44 WHEN 'PWS' THEN 38 WHEN 'DIOLY' THEN 40
       WHEN 'OMG Makeup' THEN 33 WHEN 'SALSA COSMETICS' THEN 35
       WHEN 'SALSA Baby Care' THEN 36 WHEN 'WARDAH' THEN 37
       WHEN 'NAISDAY' THEN 39 WHEN 'OMG Skincare' THEN 34
       WHEN 'MSGLOWBEAUTY' THEN 41 WHEN 'QAHIRA' THEN 45
       WHEN 'SYB' THEN 46 WHEN 'ISWHITE' THEN 47
       WHEN 'SKINMOLOGY' THEN 43 WHEN 'GLOWIES' THEN 51
       WHEN 'Nutriflakes' THEN 49 WHEN 'MSGLOWFORMEN' THEN 42
       WHEN 'Votre Peu' THEN 53 WHEN 'MILKYBOOST' THEN 52
       ELSE -1 END
JOIN payment_items pi ON pi.batch_id = b.id
JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
JOIN creators cr ON cr.id = cc.creator_id
WHERE lower(cr.username) = s.username
  AND NOT s.username_multi
ORDER BY s.campaign_sheet, s.username, s.tanggal;

\echo ''
\echo '--- username SAMA, campaign SAMA, nominal BEDA (masih perlu ditinjau) ---'
SELECT s.sheet, s.row, s.tanggal, s.username, s.campaign_sheet,
       s.nominal AS nominal_excel, pi.nominal AS nominal_sistem,
       b.batch_label
FROM payment_import_staging s
JOIN payment_batches b
  ON b.campaign_id = CASE s.campaign_sheet
       WHEN 'KIMME' THEN 44 WHEN 'PWS' THEN 38 WHEN 'DIOLY' THEN 40
       WHEN 'OMG Makeup' THEN 33 WHEN 'SALSA COSMETICS' THEN 35
       WHEN 'SALSA Baby Care' THEN 36 WHEN 'WARDAH' THEN 37
       WHEN 'NAISDAY' THEN 39 WHEN 'OMG Skincare' THEN 34
       WHEN 'MSGLOWBEAUTY' THEN 41 WHEN 'QAHIRA' THEN 45
       WHEN 'SYB' THEN 46 WHEN 'ISWHITE' THEN 47
       WHEN 'SKINMOLOGY' THEN 43 WHEN 'GLOWIES' THEN 51
       WHEN 'Nutriflakes' THEN 49 WHEN 'MSGLOWFORMEN' THEN 42
       WHEN 'Votre Peu' THEN 53 WHEN 'MILKYBOOST' THEN 52
       ELSE -1 END
JOIN payment_items pi ON pi.batch_id = b.id
JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
JOIN creators cr ON cr.id = cc.creator_id
WHERE lower(cr.username) = s.username
  AND NOT s.username_multi
  AND pi.nominal IS DISTINCT FROM s.nominal
ORDER BY s.campaign_sheet, s.username;

\echo ''
\echo '--- username SAMA, campaign BEDA (wajar: 1 kreator di banyak campaign) ---'
\echo '-- Hanya perlu dilihat kalau status_bayar di sistem masih "Not Yet"'
\echo '-- padahal Excel bilang Paid Off -> artinya BELUM ada yang bayar di sistem.'
SELECT s.username, s.campaign_sheet, s.nominal, s.tanggal,
       c.nama AS campaign_sistem, cc.status_bayar, cc.tgl_bayar,
       cc.pelunasan
FROM payment_import_staging s
JOIN creators cr ON lower(cr.username) = s.username AND NOT s.username_multi
JOIN campaign_creators cc ON cc.creator_id = cr.id
JOIN campaigns c ON c.id = cc.campaign_id
WHERE cc.status_bayar IS DISTINCT FROM 'Paid Off'
ORDER BY s.username, c.nama
LIMIT 60;

\echo ''
\echo '################ §4. YANG MEMANG HARUS DI-IMPORT ################'
\echo '-- Excel Paid Off tapi di sistem TIDAK ADA sama sekali = ini yang kita migrasi.'
\echo '-- Kalau jumlahnya nol, berarti semua sudah tercatat di sistem.'
SELECT count(*) AS staging_total,
       count(*) FILTER (WHERE NOT EXISTS (
         SELECT 1
         FROM creators cr2
         JOIN campaign_creators cc2 ON cc2.creator_id = cr2.id
         JOIN payment_batches b2 ON b2.campaign_id = cc2.campaign_id
         JOIN payment_items pi2 ON pi2.batch_id = b2.id
           AND pi2.campaign_creator_id = cc2.id
         WHERE lower(cr2.username) = s.username
           AND NOT s.username_multi
       )) AS belum_ada_di_sistem
FROM payment_import_staging s;
