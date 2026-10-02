-- =====================================================================
-- L7 - DAFTAR EXCLUDE PRESISI: baris Excel yang SUDAH ada di sistem
-- Tanggal: 2 Oktober 2026
-- Sifat : READ-ONLY. Hanya SELECT, tidak mengubah apa pun.
--
-- TEMUAN (2 Okt 2026):
--   docs/sql/70 §4 -> 826 baris staging, hanya 760 yang benar-benar belum
--   ada di sistem. Artinya sudah ada 66 baris yang tercatat di sistem.
--   Setelah ditelusuri manual, 17 di antaranya TERBUKTI duplikat lokasi
--   (nominal persis sama), sisanya belum bisa dipastikan.
--
--   YANG TERBUKTI DUPLIKAT: 17 baris / Rp 4.250.000
--     - 11 dari 11 baris sheet "September 2026"  (Rp 3.150.000)
--     -  6 baris sheet "Agustus 2026"            (Rp 1.100.000)
--     Semuanya punya username + campaign + nominal yang PERSIS SAMA dengan
--     payment_items yang sudah ada.
--
--   PWS: 61 baris Excel vs 30 item sistem, TIDAK ADA username yang sama.
--     PWS aman, tidak perlu dikecualikan.
--
-- CATATAN PENTING SOAL BATAS TANGGAL:
--   Cakupan impor dibatasi tanggal < 2026-09-14 dengan alasan
--   MIN(submitted_at) = 2026-09-14. Itu SALAH untuk tujuan anti-duplikat.
--   Data benar-benar mulai masuk sistem pada 16-17 Sep 2026 (lihat §1
--   batch 19 dst submitted_at). 14 Sep cuma batch PWS pertama.
--   -> Batas tanggal TIDAK menjamin baris belum ada di sistem.
--      Yang dipakai untuk anti-duplikat adalah daftar di file ini.
--
-- Jalankan SETELAH staging terisi.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §0. PETA CAMPAIGN (hardcoded, sesuai §4 sql/70) ################'
\echo '-- Hanya untuk pencocokan. Peta resmi ada di payment_import_map_campaign.'
CREATE TEMP VIEW peta AS
SELECT * FROM (VALUES
    ('KIMME',44),('PWS',38),('DIOLY',40),('OMG Makeup',33),('SALSA COSMETICS',35),
    ('SALSA Baby Care',36),('WARDAH',37),('NAISDAY',39),('OMG Skincare',34),
    ('MSGLOWBEAUTY',41),('QAHIRA',45),('SYB',46),('ISWHITE',47),('SKINMOLOGY',43),
    ('GLOWIES',51),('Nutriflakes',49),('MSGLOWFORMEN',42),('Votre Peu',53),
    ('MILKYBOOST',52)
) AS t(nama_sheet, campaign_id);

\echo ''
\echo '################ §1. KATEGORI A - DUPLIKAT TERBUKTI (EXCLUDE) ################'
\echo '-- username + campaign + nominal PERSIS SAMA dengan item di sistem.'
\echo '-- Ini pembayaran yang sama, tercatat 2 kali. Mengimpornya = 2x hitung.'
\echo ''
\echo '-- 1a. RINCIAN PER BARIS'
SELECT s.sheet, s.row, s.tanggal AS tgl_excel, s.username,
       s.campaign_sheet, s.nominal AS nominal_excel, s.status_klaim,
       pi.id AS id_sistem, pi.nominal AS nominal_sistem,
       b.batch_label, b.submitted_at::date AS tgl_submit_sistem,
       s.sheet || ':' || s.row AS kunci_excel
FROM payment_import_staging s
JOIN peta p       ON p.nama_sheet = s.campaign_sheet
JOIN payment_batches b   ON b.campaign_id = p.campaign_id
JOIN payment_items pi    ON pi.batch_id = b.id
JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
JOIN creators cr         ON cr.id = cc.creator_id
WHERE lower(cr.username) = s.username
  AND NOT s.username_multi
  AND pi.nominal = s.nominal
ORDER BY s.sheet, s.row;

\echo ''
\echo '-- 1b. TOTAL YANG HARUS DIEXCLUDE'
SELECT count(*) AS baris_exclude, sum(s.nominal) AS nominal_exclude
FROM payment_import_staging s
JOIN peta p       ON p.nama_sheet = s.campaign_sheet
JOIN payment_batches b   ON b.campaign_id = p.campaign_id
JOIN payment_items pi    ON pi.batch_id = b.id
JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
JOIN creators cr         ON cr.id = cc.creator_id
WHERE lower(cr.username) = s.username
  AND NOT s.username_multi
  AND pi.nominal = s.nominal;

\echo ''
\echo '################ §2. KATEGORI B - PERLU DITINJAU (JANGAN EXCLUDE) ################'
\echo '-- username + campaign sama, tapi nominal SAMA-SEBAGINYA beda.'
\echo '-- Kalau nominal sistem LEBIH BESAR, mungkin sistem yang mencatat'
\echo '-- ratecard penuh sementara Excel mencatat cicilan. Itu keputusan'
\echo '-- manusia, bukan keputusan teknis.'
SELECT s.sheet, s.row, s.tanggal, s.username, s.campaign_sheet,
       s.nominal AS nominal_excel, s.status_klaim,
       pi.id AS id_sistem, pi.nominal AS nominal_sistem,
       pi.nominal - s.nominal AS selisih,
       s.sheet || ':' || s.row AS kunci_excel
FROM payment_import_staging s
JOIN peta p       ON p.nama_sheet = s.campaign_sheet
JOIN payment_batches b   ON b.campaign_id = p.campaign_id
JOIN payment_items pi    ON pi.batch_id = b.id
JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
JOIN creators cr         ON cr.id = cc.creator_id
WHERE lower(cr.username) = s.username
  AND NOT s.username_multi
  AND pi.nominal IS DISTINCT FROM s.nominal
ORDER BY s.sheet, s.row;

\echo ''
\echo '-- 2b. Nominal Excel di creatives mana pun (tanpa filter campaign) --'
\echo '-- Ini lebih ketat: "user ini di sistem SUDAH DIBAYAR nominal X"'
\echo '-- di campaign APAPUN. Kalau cocok, kemungkinan besar sudah dibayar.'
SELECT s.sheet, s.row, s.tanggal, s.username, s.campaign_sheet,
       s.nominal AS nominal_excel, s.status_klaim,
       pi.id AS id_sistem, c.nama AS campaign_sistem, pi.nominal AS nominal_sistem,
       s.sheet || ':' || s.row AS kunci_excel
FROM payment_import_staging s
JOIN creators cr ON lower(cr.username) = s.username AND NOT s.username_multi
JOIN campaign_creators cc ON cc.creator_id = cr.id
JOIN payment_items pi ON pi.campaign_creator_id = cc.id
JOIN payment_batches b ON b.id = pi.batch_id
JOIN campaigns c ON c.id = b.campaign_id
WHERE pi.nominal = s.nominal
  AND c.id IS DISTINCT FROM (SELECT p.campaign_id FROM peta p
                             WHERE p.nama_sheet = s.campaign_sheet)
ORDER BY s.sheet, s.row;

\echo ''
\echo '################ §3. TOTAL AKHIR YANG AMAN DI-IMPORT ################'
\echo '-- staging dikurangi Kategori A. Kategori B TIDAK dikurangi.'
WITH dup AS (
    SELECT s.id
    FROM payment_import_staging s
    JOIN peta p       ON p.nama_sheet = s.campaign_sheet
    JOIN payment_batches b   ON b.campaign_id = p.campaign_id
    JOIN payment_items pi    ON pi.batch_id = b.id
    JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
    JOIN creators cr         ON cr.id = cc.creator_id
    WHERE lower(cr.username) = s.username
      AND NOT s.username_multi
      AND pi.nominal = s.nominal
)
SELECT
    (SELECT count(*) FROM payment_import_staging)                AS staging_total,
    (SELECT sum(nominal) FROM payment_import_staging)            AS staging_nominal,
    (SELECT count(*) FROM dup)                                  AS kategori_a,
    (SELECT COALESCE(sum(s.nominal),0)
       FROM payment_import_staging s JOIN dup d ON d.id = s.id)  AS kategori_a_nominal,
    (SELECT count(*) FROM payment_import_staging s
      WHERE NOT EXISTS (SELECT 1 FROM dup d WHERE d.id = s.id))  AS final_import,
    (SELECT COALESCE(sum(s.nominal),0)
       FROM payment_import_staging s
      WHERE NOT EXISTS (SELECT 1 FROM dup d WHERE d.id = s.id))  AS final_nominal;

\echo ''
\echo '-- GUARD angka yang diharapkan:'
\echo '--   staging_total    826'
\echo '--   staging_nominal  507736562'
\echo '--   kategori_a         17'
\echo '--   kategori_a_nominal 4250000'
\echo '--   final_import      809'
\echo '--   final_nominal   503486562'
