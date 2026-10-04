-- =====================================================================
-- ROLLBACK IMPOR PAYMENT HISTORIS (Feb - Sep 2026)
-- Tanggal: 4 Oktober 2026
--
-- KAPAN PAKAI FILE INI
--   Kalau finance complain: ada data yang tidak akurat. Tidak perlu
--   panicked, tidak perlu cari-cari per baris - semua baris impor punya
--   satu penanda: import_riwayat = 'payment-historis-2026'.
--
--   Dipakai kalau:
--     - salah mapping campaign ditemukan (mis. SALSA Baby Care)
--     - ada pembayaran yang ternyata dobel
--     - nominal salah untuk campaign tertentu
--   TIDAK dipakai kalau cuma satu nominal keliru - lebih baik UPDATE
--   satu baris daripada membatalkan 796.
--
-- PERTAMAKAN SEBELUM JALAN: LIHAT §1 (DIFF)
--   Jangan sampai membatalkan semua tanpa cek apa yang berubah.
--
-- CARA JALANKAN (dari mesin owner):
--   Get-Content docs\sql\74-rollback-payment-historis.sql -Raw |
--     wsl -e bash -c "docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1"
--
--   Kalau wsl tidak dipakai di mesin owner (4 Okt 2026: memang tidak):
--   cmd /c 'ssh vps "cat > /root/rollback.sql" < docs\sql\74-rollback-payment-historis.sql'
--   ssh vps "docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1 < /root/rollback.sql"
--
-- FILE INI TIDAK MENGANDUNG PII, jadi aman di-commit.
-- =====================================================================

\pset pager off
\pset footer off
\set ON_ERROR_STOP off

\echo ''
\echo '############################################################'
\echo '# 1. DIFF - APA YANG AKAN BERUBAH? BACA DULU, JANGAN LOMPAT'
\echo '############################################################'

\echo ''
\echo '--- 1a. Yang sekarang di sistem ---'
SELECT
    (SELECT count(*) FROM payment_items)  AS item_total,
    (SELECT sum(nominal) FROM payment_items) AS nominal_total,
    (SELECT count(*) FROM payment_batches) AS batch_total;

\echo ''
\echo '--- 1b. Impor historis (akan hilang kalau rollback) ---'
SELECT
    (SELECT count(*) FROM payment_items
      WHERE import_riwayat = 'payment-historis-2026')  AS item_impor,
    (SELECT sum(nominal) FROM payment_items
      WHERE import_riwayat = 'payment-historis-2026')  AS nominal_impor,
    (SELECT count(*) FROM payment_batches
      WHERE import_riwayat = 'payment-historis-2026')  AS batch_impor;

\echo ''
\echo '--- 1c. Backup tersedia? (harus 111 item / 71 batch) ---'
SELECT 'backup_payment_items_20261002' AS tabel,
       (SELECT count(*) FROM backup_payment_items_20261002) AS baris,
       (SELECT sum(nominal) FROM backup_payment_items_20261002) AS nominal
UNION ALL
SELECT 'backup_payment_batches_20261002',
       (SELECT count(*) FROM backup_payment_batches_20261002),
       NULL;

\echo ''
\echo '--- 1d. Data ASLI (tidak ikut rollback, selalu utuh) ---'
\echo '--- payment_import_staging: 826 baris, termasuk 17 baris DEFER'
SELECT status_import, count(*) AS baris, sum(nominal) AS nominal
FROM payment_import_staging GROUP BY 1 ORDER BY 1;

\echo ''
\echo '--- 1e. Per campaign yang akan kehilangan datanya ---'
SELECT c.nama AS campaign, count(*) AS item, sum(pi.nominal) AS nominal
FROM payment_items pi
JOIN payment_batches pb ON pb.id = pi.batch_id
JOIN campaigns c ON c.id = pb.campaign_id
WHERE pi.import_riwayat = 'payment-historis-2026'
GROUP BY 1 ORDER BY 3 DESC;


-- =====================================================================
-- 2. ROLLBACK
--
-- Menghapus HANYA baris yang ditandai. Data asli (import_riwayat IS NULL)
-- tidak tersentuh sama sekali.
--
-- Kolom import_riwayat sengaja DIJAGA setelah delete. Alasannya:
-- kalau someday diimpor ulang, kode bisa mendeteksi "sudah pernah
-- diimpor lalu di-rollback" dan tidak salah mengira data itu sudah ada.
-- data itu sudah ada. Menghapus kolomnya berarti kehilangan jejak.
--
-- UNCOMMENT blok di bawah untuk menjalankan.
-- =====================================================================

\echo ''
\echo '############################################################'
\echo '# 2. ROLLBACK - TIDAK ADA YANG DIJALANKAN DARI FILE INI'
\echo '#'
\echo '# File ini 100% READ-ONLY. Semua DELETE ada di dalam \echo, jadi'
\echo '# menjalankannya tidak mengubah apa pun. Itu disengaja.'
\echo '############################################################'
\echo ''
\echo '>> JALANKAN PERINTAH INI kalau sudah yakin:'
\echo ''
\echo '   ssh vps "docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1"'
\echo '   lalu tempel SQL berikut:'
\echo ''
\echo '   BEGIN;'
\echo '     DELETE FROM payment_items   WHERE import_riwayat = ''payment-historis-2026'';'
\echo '     DELETE FROM payment_batches WHERE import_riwayat = ''payment-historis-2026'';'
\echo '   COMMIT;'
\echo ''
\echo '>> SETELAH ITU, WAJIB cek hasilnya:'
\echo ''
\echo '   SELECT count(*) AS item, sum(nominal) AS nominal FROM payment_items;'
\echo '   -- harus: 111 | 44270000'
\echo ''
\echo '   Kalau TIDAK 111 / Rp 44.270.000, ada yang salah - bilang, jangan'
\echo '   diteruskan. Backup masih ada di backup_payment_*_20261002.'
\echo ''
\echo '>> CATATAN: kolom import_riwayat sengaja TIDAK di-DROP. Kalau diimpor'
\echo '   ulang, penanda ini yang mencegah data dianggap sudah ada.'


-- =====================================================================
-- 3. PERBAIKI SATU BARIS SAJA (lebih baik dari rollback total)
--
-- Contoh: satu campaign ternyata salah mapping. Ubah campaign_id-nya
-- tanpa menyentuh baris lain.
--
-- Uncomment dan sesuaikan.
-- =====================================================================

\echo ''
\echo '############################################################'
\echo '# 3. CORRECT TERPILIH (opsional, belum dijalankan)'
\echo '############################################################'
\echo ''
\echo '-- Contoh: pindahkan semua item impor di satu campaign ke campaign lain.'
\echo '-- Ganti angka campaign_id dan yang salah.'
\echo '--'
\echo '-- BEGIN;'
\echo '--   UPDATE payment_items pi'
\echo '--      SET campaign_creator_id = NULL      -- atau id lain kalau perlu'
\echo '--    FROM payment_batches pb'
\echo '--   WHERE pi.batch_id = pb.id'
\echo '--     AND pb.campaign_id = 36              -- SALSA Mom & Baby (SALSA Baby Care)'
\echo '--     AND pi.import_riwayat = ''payment-historis-2026'';'
\echo '-- COMMIT;'
\echo '--'
\echo '-- WAJIH: catat di docs/payment/DEFER.md atau KEPUTUSAN-PEMBAYARAN.md'
\echo '-- apa yang dikoreksi dan kenapa. Perubahan data tanpa catatan ='
\echo '-- bug yang akan diulang orang berikutnya.'


-- =====================================================================
-- 4. IMPOR ULANG
--
-- Staging masih utuh, jadi tidak perlu parse ulang spreadsheet.
--tidak ada satu baris pun yang hilang.
-- =====================================================================

\echo ''
\echo '############################################################'
\echo '# 4. IMPOR ULANG (kalau rollback sudah dilakukan)'
\echo '############################################################'
\echo ''
\echo '1. Perbaiki sumbernya:'
\echo '   - SQL: web-app/supabase/migrations/20261005000000_payment_import_map.sql'
\echo '     (peta campaign + klasifikasi status_import)'
\echo '   - Skrip: docs/scripts/gen-staging-sql.ps1 + gen-insert-final.ps1'
\echo '   - Cache: docs/payment/parsed-826.csv  (TIDAK ada di git, ada di mesin owner)'
\echo ''
\echo '2. Jalankan ulang berurutan:'
\echo '   a. UPDATE payment_import_map_campaign ... (koreksi peta)'
\echo '   b. UPDATE payment_import_staging SET status_import = ''siap'' ...'
\echo '   c. docs/scripts/gen-staging-sql.ps1        -> docs/sql/67-...sql'
\echo '   d. docs/scripts/gen-insert-final.ps1       -> docs/sql/73-...sql'
\echo '   e. Jalankan 73 dari mesin owner (file ada PII, jangan di-commit)'
\echo ''
\echo 'Staging TIDAK PERLU parse ulang - isinya masih 826 baris.'
