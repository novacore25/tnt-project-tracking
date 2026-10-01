-- =====================================================================
-- 43 - DAFTAR KERJA: 92 BARIS PAYMENT DENGAN PIC YANG TIDAK PUNYA AKUN
-- Tanggal : 2026-10-01
-- READ-ONLY. Hanya SELECT. Tidak menulis apa pun.
--
-- TUJUAN
--   92 baris `Paid Off` di spreadsheet Form Payment Campaign TNT.xlsx
--   di Demographic oleh 5 PIC yang tidak punya baris di tabel profiles:
--
--     Daffa     31 baris   -> SUDAH RESIGN sebelum sistem dibuat
--     Natallia  30 baris   -> SUDAH RESIGN sebelum sistem dibuat
--     Marini    22 baris   -> SUDAH RESIGN sebelum sistem dibuat
--     Riska      6 baris   -> SUDAH RESIGN sebelum sistem dibuat
--     David      3 baris   -> belum diketahui statusnya
--
--   Keputusan user: tetap dimigrasi, dengan `submitted_by = NULL`, dan
--   nama PIC ditulis di `batch_label` + `notes` supaya jejak auditnya jelas.
--
--   File ini BUKAN migration. Ini daftar kerja supaya user bisa melihat
--   isi daftar dan tahu 92 baris ini akan masuk dengan pengaju kosong.
--
-- CATATAN PENTING
--   Data spreadsheet tidak ada di database. Tabel di bawah hanya
--   sisi database: profil yang ada, dan batch yang sudah memakai
--   submitted_by. Daftar 92 baris aslinya ada di Excel, bukan di sini.
--
--   Kalau nanti email asli keempat orang resign ditemukan, akunnya bisa
--   dibuat dengan email itu dan tautan login akan otomatis nyambung
--   (lihat SKILL.md 3.55: submitted_by ditautkan lewat EMAIL).
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. SEMUA PROFIL YANG ADA (30 akun) ==='
SELECT
  p.nama,
  p.email,
  p.role,
  p.status,
  count(pb.id) AS sudah_submit_batch
FROM profiles p
LEFT JOIN payment_batches pb ON pb.submitted_by = p.id
GROUP BY p.nama, p.email, p.role, p.status
ORDER BY sudah_submit_batch DESC, p.nama;

\echo ''
\echo '=== 2. EMAIL YANG BISA DIPAKAI UNTUK PLACEHOLDER ==='
\echo '-- submitted_by ditautkan lewat LOWER(email), jadi email HARUS asli.'
\echo '-- Kalau email karangan, akun jadi orphan saat orang itu login.'
SELECT nama, email, status
FROM profiles
WHERE LOWER(nama) IN ('tiara', 'fira')
   OR email ILIKE '%tiara%' OR email ILIKE '%fira%';

\echo ''
\echo '=== 3. CEK: APAKAH SUDAH ADA PROFIL UNTUK 5 PIC TANPA AKUN? ==='
\echo '-- Harus semua FALSE. Kalau TRUE, peta di docs/KEPUTUSAN-PEMBAYARAN.md perlu diperbarui.'
SELECT
  EXISTS (SELECT 1 FROM profiles WHERE LOWER(nama) LIKE 'daffa%')    AS ada_daffa,
  EXISTS (SELECT 1 FROM profiles WHERE LOWER(nama) LIKE 'natallia%') AS ada_natallia,
  EXISTS (SELECT 1 FROM profiles WHERE LOWER(nama) LIKE 'marini%')   AS ada_marini,
  EXISTS (SELECT 1 FROM profiles WHERE LOWER(nama) LIKE 'riska%')    AS ada_riska,
  EXISTS (SELECT 1 FROM profiles WHERE LOWER(nama) LIKE 'david%')    AS ada_david;

\echo ''
\echo '=== 4. JANGAN SAMPAI TERLEWAT: Marini BUKAN Maria ==='
\echo '-- Kalau nanti ada yang frantically match nama, ini alasannya.'
SELECT 'marini' AS pic, 'TIDAK ADA - jangan match ke Maria Alvita' AS catatan
UNION ALL
SELECT 'maria', 'ada profil: ' || COALESCE(email, '(kosong)')
FROM profiles WHERE LOWER(nama) LIKE 'maria%';

\echo ''
\echo '=== 5. KONDISI SEKARANG (untuk dibandingkan sesudah migrasi) ==='
SELECT
  (SELECT count(*) FROM payment_items)                          AS total_item,
  (SELECT count(*) FROM payment_items WHERE final_status='paid') AS item_paid,
  (SELECT count(*) FROM payment_batches)                        AS total_batch,
  (SELECT COALESCE(sum(nominal),0) FROM payment_items WHERE final_status='paid') AS nominal_paid,
  (SELECT count(*) FROM payment_batches WHERE submitted_by IS NULL) AS batch_tanpa_pengaju,
  (SELECT COALESCE(sum(pi.nominal),0)
     FROM payment_items pi JOIN payment_batches pb ON pb.id = pi.batch_id
    WHERE pb.submitted_by IS NULL AND pi.final_status = 'paid')   AS nominal_tanpa_pengaju;

\echo ''
\echo '=== 6. CEK HASIL SESUDAH MIGRIASI (jalankan ulang file ini) ==='
\echo '-- Harus: 92 batch punya submitted_by IS NULL dan nominalnya wajar.'
\echo '-- Kalau batch_label-nya kosong -> PIC tidak tercatat, itu BUG.'
SELECT
  pb.batch_label,
  pb.submitted_by,
  p.nama  AS nama_pengaju,
  count(*) AS jml_item,
  sum(pi.nominal) AS total_nominal
FROM payment_batches pb
LEFT JOIN profiles p ON p.id = pb.submitted_by
LEFT JOIN payment_items pi ON pi.batch_id = pb.id
WHERE pb.submitted_by IS NULL
GROUP BY pb.id, pb.batch_label, pb.submitted_by, p.nama
ORDER BY pb.batch_label;
