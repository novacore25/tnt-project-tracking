-- =====================================================================
-- L5a - CEK 5 KANDIDAT USERNAME DARI "1 SEL = 4 USERNAME"
-- Tanggal: 2 Oktober 2026
-- Sifat : READ-ONLY.
--
-- KASUS: Juli 2026 r61, kolom Campaign = PWS, 1 pembayaran Rp 2.000.000
-- ke M FARHAN MAULANA (rek 8881127032), tapi 1 sel username berisi 4 baris:
--
--     hi.syah vv.vianaaa
--     eloraariyani
--     zaraaa.nh
--     beautyaul_
--
-- OwnersZOOM: kemungkinan kreator dari agency, jadi 1 rekening. Tapi:
--   - "hi.syah vv.vianaaa" MENGANDUNG SPASI -> TikTok tidak bisa pakai spasi,
--     jadi ini kemungkinan DUA username: hi.syah dan vv.vianaaa
--   - kalau 5 kreator, 2.000.000 / 5 = Rp 400.000, bukan Rp 500.000 (÷4)
--   - pemilik menyebut "1 kreator 250ribu", padahal 2 juta / 4 = 500 ribu
--
-- Script ini MENYIAPKAN DATA, tidak memutuskan. Yang diputuskan owner
-- setelah lihat hasil.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '################ §1. KANDIDAT USERNAME ADA DI creators? ################'
WITH kandidat(username) AS (
    VALUES ('hi.syah'),
           ('vv.vianaaa'),
           ('hi.syah vv.vianaaa'),
           ('eloraariyani'),
           ('zaraaa.nh'),
           ('beautyaul_')
)
SELECT k.username                        AS kandidat,
       cr.id                             AS creator_id,
       cr.nama_asli                      AS nama,
       'ADA'                             AS hasil
FROM kandidat k
JOIN creators cr ON lower(cr.username) = k.username
UNION ALL
SELECT k.username, NULL, NULL, 'TIDAK ADA'
FROM kandidat k
LEFT JOIN creators cr ON lower(cr.username) = k.username
WHERE cr.id IS NULL
ORDER BY hasil, kandidat;

\echo ''
\echo '-- pencarian longgar: username yang MIRIP (untuk kalau ada typo) --'
WITH kandidat(username) AS (
    VALUES ('hi.syah'), ('vv.vianaaa'), ('eloraariyani'), ('zaraaa.nh'), ('beautyaul_')
)
SELECT k.username AS kandidat, cr.username AS username_di_db, cr.id, cr.nama_asli
FROM kandidat k
JOIN creators cr
  ON cr.username ILIKE '%' || left(k.username, 6) || '%'
ORDER BY kandidat, cr.username;

\echo ''
\echo '################ §2. APAKAH MEREKA SUDAH DI CAMPAIGN PWS? ################'
\echo '-- PWS = campaign_id 38'
SELECT cr.username, cr.id AS creator_id, cc.id AS campaign_creator_id,
       cc.approval, cc.tier, cc.price, cc.rate_card, cc.status_bayar,
       cc.pelunasan, cc.tgl_bayar
FROM creators cr
JOIN campaign_creators cc ON cc.creator_id = cr.id AND cc.campaign_id = 38
WHERE lower(cr.username) IN ('hi.syah','vv.vianaaa','eloraariyani','zaraaa.nh','beautyaul_')
ORDER BY cr.username;

\echo ''
\echo '-- history campaign_creators mereka di campaign lain --'
SELECT cr.username, c.id AS campaign_id, c.nama AS campaign,
       cc.approval, cc.rate_card, cc.status_bayar
FROM creators cr
JOIN campaign_creators cc ON cc.creator_id = cr.id
JOIN campaigns c ON c.id = cc.campaign_id
WHERE lower(cr.username) IN ('hi.syah','vv.vianaaa','eloraariyani','zaraaa.nh','beautyaul_')
ORDER BY cr.username, c.id;

\echo ''
\echo '################ §3. RATE PWS UNTUK MEMBANTU MEMUTUSKAN NOMINAL ################'
\echo '-- Kalau rate PWS normal Rp 700.000, maka 5 kreator x 400.000 atau'
\echo '-- 4 kreator x 500.000 keduanya DI BAWAH rate. Ini bukan bukti,'
\echo '-- tapi membantu menilai. Tidak membuktikan apa pun.'
SELECT cc.rate_card,
       count(*) AS kreator,
       min(cc.price) AS price_min, max(cc.price) AS price_max
FROM campaign_creators cc
WHERE cc.campaign_id = 38
GROUP BY cc.rate_card
ORDER BY kreator DESC;

\echo ''
\echo '################ §4. PETAKAN KAMPANY YANG BELUM TERISI ################'
\echo '-- Nama-nama sheet; semua BELUM dipetakan. Jangan tebak.'
SELECT nama_sheet, count(*) AS baris, sum(nominal) AS nominal
FROM payment_import_staging
GROUP BY nama_sheet
ORDER BY nominal DESC;

\echo ''
\echo '-- semua campaign yang ada di DB (bandingkan manual) --'
SELECT id, nama, status FROM campaigns ORDER BY id;
