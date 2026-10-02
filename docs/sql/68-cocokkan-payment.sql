-- =====================================================================
-- L4 - COCOKAN staging ke creators / campaign_creators
-- Tanggal: 2 Oktober 2026
-- Sifat : READ-ONLY. Tidak ada INSERT/UPDATE/DELETE.
--
-- TUJUAN: mengukur match rate SEBELUM ada yang di-INSERT ke payment_items.
-- Angka ini belum pernah diukur sebelumnya, jadi jangan diasumsikan.
--
-- Jalankan SETELAH docs/sql/67-isi-staging-payment.sql berhasil.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §1. STAGING ISI DENGAN BENAR? ################'
SELECT count(*) AS baris, sum(nominal) AS nominal,
       min(tanggal) AS dari, max(tanggal) AS sampai
FROM payment_import_staging;

\echo ''
\echo '################ §2. PETA PIC SUDAH KE profiles? ################'
SELECT m.pic, m.profile_nama, p.nama AS nama_di_profiles,
       p.status,
       count(s.id) AS baris, COALESCE(sum(s.nominal),0) AS nominal
FROM payment_import_map_pic m
LEFT JOIN profiles p ON p.nama = m.profile_nama
LEFT JOIN payment_import_staging s ON s.pic = m.pic
GROUP BY m.pic, m.profile_nama, p.nama, p.status
ORDER BY 4 NULLS FIRST, nominal DESC;

\echo ''
\echo '--- PIC di staging yang TIDAK ada di peta (harus cuma kosong) ---'
SELECT s.pic, count(*) AS baris, COALESCE(sum(s.nominal),0) AS nominal
FROM payment_import_staging s
LEFT JOIN payment_import_map_pic m ON m.pic = s.pic
WHERE m.pic IS NULL
GROUP BY s.pic;

\echo ''
\echo '################ §3. KAMPANY: YANG SUDAH TERMAPA vs BELUM ################'
\echo '-- Lihat view. Semua di sini BELUM dipetakan - owner yang memutuskan.'
SELECT * FROM v_payment_campaign_unmapped;

\echo ''
\echo '################ §4. KANDIDAT CAMPAIGN (BUKAN auto-map) ################'
\echo '-- Bandingkan sendiri dengan SELECT id,nama FROM campaigns;'
SELECT nama_sheet, kandidat_id, kandidat_nama, kandidat_status
FROM v_payment_campaign_candidates
ORDER BY nama_sheet, kandidat_id;

\echo ''
\echo '################ §5. MATCH RATE username -> creators ################'
\echo '-- creatives.username UNIQUE, jadi ini pencocokan eksak (lower/trim).'
SELECT
    count(*)                                                   AS total_baris,
    count(*) FILTER (WHERE NOT username_multi)                 AS baris_normal,
    count(*) FILTER (WHERE NOT username_multi AND cr.id IS NOT NULL) AS ketemu_creator,
    count(*) FILTER (WHERE NOT username_multi AND cr.id IS NULL)     AS GAGAL_cari_creator,
    count(*) FILTER (WHERE username_multi)                     AS multi_username,
    round(100.0 * count(*) FILTER (WHERE NOT username_multi AND cr.id IS NOT NULL)
          / NULLIF(count(*) FILTER (WHERE NOT username_multi),0), 1) AS persen_cocok,
    COALESCE(sum(s.nominal) FILTER (WHERE NOT username_multi AND cr.id IS NULL),0) AS nominal_gagal
FROM payment_import_staging s
LEFT JOIN creators cr
       ON NOT s.username_multi
      AND lower(cr.username) = s.username;

\echo ''
\echo '---username yang TIDAK ada di creators (top 40 by nominal) ---'
\echo '-- Penting: creator belum terdaftar BUKAN berarti pembayaran tidak sah.'
\echo '--/history-nya tetap masuk; hanya campaign_creator_id yang kosong.'
SELECT s.username, count(*) AS baris, COALESCE(sum(s.nominal),0) AS nominal,
       min(s.tanggal) AS pertama, max(s.tanggal) AS terakhir
FROM payment_import_staging s
LEFT JOIN creators cr
       ON NOT s.username_multi AND lower(cr.username) = s.username
WHERE cr.id IS NULL AND NOT s.username_multi
GROUP BY s.username
ORDER BY nominal DESC
LIMIT 40;

\echo ''
\echo '################ §6. MATCH RATE (username + campaign) -> campaign_creators ################'
\echo '-- Inilah yang dibutuhkan payment_items.campaign_creator_id.'
\echo '-- T awhile campaign_id belum dipetakan, kolomnya NULL -> match 0%.'
SELECT
    count(*) AS total_kreator_rows,
    count(*) FILTER (WHERE cc.id IS NOT NULL) AS ketemu,
    count(*) FILTER (WHERE cc.id IS NULL)     AS tidak_ketemu,
    round(100.0 * count(*) FILTER (WHERE cc.id IS NOT NULL) / NULLIF(count(*),0), 1) AS persen
FROM payment_import_staging s
LEFT JOIN payment_import_map_campaign mc ON mc.nama_sheet = s.campaign_sheet
LEFT JOIN creators cr ON NOT s.username_multi AND lower(cr.username) = s.username
LEFT JOIN campaign_creators cc
       ON cc.creator_id = cr.id AND cc.campaign_id = mc.campaign_id
WHERE s.kategori = 'kreator';

\echo ''
\echo '################ §7. SATU USERNAME BISA DI BEBERAPA CAMPAIGN? ################'
\echo '-- Normalnya iya. Kalau tidak, berarti spreadsheet <> campaign_creators.'
\echo '-- Jalankan SETELAH peta campaign diisi.'
SELECT cr.id AS creator_id, cr.username,
       count(DISTINCT cc.campaign_id) AS jumlah_campaign,
       string_agg(DISTINCT c.nama, ' | ') AS campaign
FROM creators cr
JOIN campaign_creators cc ON cc.creator_id = cr.id
JOIN campaigns c ON c.id = cc.campaign_id
WHERE lower(cr.username) IN (SELECT username FROM payment_import_staging
                              WHERE NOT username_multi AND kategori = 'kreator')
GROUP BY cr.id, cr.username
HAVING count(DISTINCT cc.campaign_id) > 1
ORDER BY jumlah_campaign DESC, cr.username
LIMIT 25;

\echo ''
\echo '################ §8. BARIS OPERASIONAL ################'
\echo '-- 57 baris tanpa kreator. campaign_id tetap wajib (batches.campaign_id NOT NULL).'
SELECT s.kategori, s.campaign_sheet, s.status_klaim,
       count(*) AS baris, COALESCE(sum(s.nominal),0) AS nominal
FROM payment_import_staging s
WHERE s.kategori <> 'kreator'
GROUP BY 1,2,3
ORDER BY 1, nominal DESC;

\echo ''
\echo '################ §9. PETAKAN status_klaim -> payment_type ################'
\echo '-- Ada yang tidak punya padanan di CHECK constraint payment_items.'
SELECT s.status_klaim,
       count(*) AS baris, COALESCE(sum(s.nominal),0) AS nominal,
       CASE
         WHEN s.status_klaim = '100% AKHIR' THEN '100_akhir'
         WHEN s.status_klaim = '50% AWAL'   THEN '50_awal'
         WHEN s.status_klaim = '50% AKHIR'  THEN '50_akhir'
         WHEN s.status_klaim = '100% AWAL'  THEN '100_awal  <-- BELUM ADA di CHECK'
         WHEN s.status_klaim = 'ADS'        THEN 'ads'
         WHEN s.status_klaim = 'LION'       THEN 'lion'
         WHEN s.status_klaim = 'CRM'        THEN 'crm'
         ELSE 'PERLU KEPUTUSAN MANUAL'
       END AS payment_type_usulan
FROM payment_import_staging s
GROUP BY 1
ORDER BY nominal DESC;

\echo ''
\echo '--- payment_type yang ada di CHECK tapi TIDAK boleh dipakai ---'
\echo '100_akhir, 50_awal, 50_akhir, ads, crm, lion, reward_affiliate,'
\echo 'boost_views, boost_comment'

\echo ''
\echo '################ §10. RATE CARD AWAL UNTUK PEMBAGIAN 50% ################'
SELECT s.status_klaim,
       count(*) AS baris,
       count(*) FILTER (WHERE s.ratecard_awal > 0) AS punya_ratecard_awal,
       count(*) FILTER (WHERE s.ratecard_awal = 0) AS tanpa_ratecard_awal
FROM payment_import_staging s
WHERE s.status_klaim IN ('50% AWAL','50% AKHIR','100% AWAL','100% AKHIR')
GROUP BY 1
ORDER BY 1;

\echo ''
\echo '---_ratecard_awal > nominal (aneh, harus dicek) ---'
SELECT sheet, row, username, campaign_sheet, status_klaim, ratecard_awal, nominal
FROM payment_import_staging
WHERE ratecard_awal > nominal;
