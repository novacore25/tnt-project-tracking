-- =====================================================================
-- payment_import_staging + peta eksplisit PIC & campaign
-- Tanggal : 2 Oktober 2026
-- Fase   : 1 (impor data historis payment Feb - 11 Sep 2026)
-- Sifat  : ADDITIVE. Tidak ada INSERT ke tabel produksi di migration ini.
--
-- MENGAPA ADA TABEL INI
--   Data payment historis ada di spreadsheet, bukan di DB. Kita butuh tempat
--   untuk menampung hasil parse SEBELUM menyentuh tabel produksi, supaya:
--     1. bisa di-query untuk mencocokkan username ke campaign_creators
--     2. bisa di-review manusia sebelum di-INSERT ke payment_items
--     3. guard bisa membandingkan staging vs produksi tanpa menebak
--
--   Tabel ini DIBUANG setelah impor selesai. Kalau masih ada, berarti
--   impor belum tuntas - jangan dipakai untuk query Reporting.
--
-- CATATAN PII
--   Staging SENGAJA tidak memuat NIK, alamat, link KTP, nomor rekening,
--   dan nama penerima. Kolom-kolom itu disisihkan di mesin lokal dan
--   hanya ikut di SQL tahap INSERT (fase 2), bukan di sini.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Tabel staging: 1 baris = 1 pembayaran dari spreadsheet
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_import_staging (
    id             serial PRIMARY KEY,
    sheet          text NOT NULL,          -- nama sheet asal
    row            int  NOT NULL,          -- nomor baris asal di sheet
    tanggal        date NOT NULL,
    tanggal_asal   text,                   -- teks yang tertulis di spreadsheet
    tanggal_dari   text,                   -- 'tanggal_pembayaran' | 'tanggal_pengajuan'
    username       text,                   -- sudah dinormalisasi (lower/trim)
    username_mentah text,                  -- apa adanya, untuk audit
    -- true = satu sel spreadsheet memuat LEBIH DARI SATU username.
    -- Contoh nyata: Juli 2026 r61 berisi 4 username dalam 1 sel untuk 1
    -- pembayaran Rp 2.000.000. Baris seperti ini TIDAK BOLEH dicocokkan ke
    -- satu `creators.username`, dan tidak boleh dipecah jadi beberapa
    -- payment_items - mengpecahnya berarti mengarang nominal per akun yang
    -- tidak pernah ada di spreadsheet.
    username_multi boolean NOT NULL DEFAULT false,
    campaign_sheet text NOT NULL,          -- nama campaign di spreadsheet
    status_klaim   text,                   -- 100% AKHIR / 50% AWAL / ADS / ...
    kategori       text NOT NULL,          -- kreator | ads | lion | crm | operasional_lain
    nominal        bigint NOT NULL,
    ratecard_awal  bigint NOT NULL DEFAULT 0,
    pic            text,                   -- nama PIC apa adanya di spreadsheet
    catatan        text,                   -- catatan hasil parse, bukan kolom asli

    -- hasil mapping, diisi di fase berikutnya
    campaign_id    int,
    submitted_by   uuid,

    created_at     timestamptz NOT NULL DEFAULT now(),

    -- satu baris spreadsheet = satu baris staging. Mencegah parse ulang
    -- menumpuk data kalau skrip dijalankan dua kali.
    UNIQUE (sheet, row)
);

COMMENT ON TABLE payment_import_staging IS
  'Staging impor payment historis (Feb-Sep 2026). Buang setelah impor selesai.';

-- ---------------------------------------------------------------------
-- Peta eksplisit PIC -> profil
-- ATURAN: pemetaan ini DITULIS EKSPLISIT, bukan dicocokkan otomatis.
-- Setiap baris punya `alasan` yang menjelaskan dasar pemetaan.
-- Baris yang tidak bisa dipastikan sengaja bernilai NULL (submitted_by),
-- dengan nama PIC tetap ditulis ke payment_batches.batch_label / notes.
-- Jangan pernah "memperbaiki" peta ini dengan fuzzy match.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_import_map_pic (
    pic          text PRIMARY KEY,
    profile_nama text,                       -- nama persis di tabel profiles
    alasan       text NOT NULL
);

-- Dicari lewat NAMA, bukan UUID yang diketik manual, supaya migration ini
-- benar sendiri kalau UUID profil berubah. Kalau nama tidak ketemu,
-- NULL - bukan error diam-diam.
INSERT INTO payment_import_map_pic (pic, profile_nama, alasan)
VALUES
  ('Wahyu', 'Wahyu Prakoso',
   'Nama PIC di spreadsheet persis "Wahyu", profil ada dengan nama lengkap "Wahyu Prakoso" (status approved). Dipetakan atas instruksi owner 2 Okt 2026.'),

  ('Maria', 'Maria Alvita',
   'Nama PIC persis "Maria", profil ada "Maria Alvita" (status approved). Dipetakan atas instruksi owner 2 Okt 2026.'),

  ('Rija', 'Irsadur Rija',
   'Spreadsheet menulis PIC "Rija", profil berisi "Irsadur Rija". BUKAN fuzzy match: owner sendiri yang memutuskan pada 2 Okt 2026 bahwa PIC Rs adalah orang yang sama. 67 baris / Rp 44.200.000.'),

  ('Tiara', 'Tiara',
   'Nama PIC persis sama dengan nama profil. Profil berstatus inactive - PIC sudah resign, tapi submitted_by tetap menunjuk dia karena dialah yangOCsial unggah batch itu.'),

  ('Fira', 'Fira',
   'Nama PIC persis sama dengan nama profil. Profil berstatus inactive - sama seperti Tiara.'),

  -- ---- PIC tanpa profil: submitted_by harus NULL ----
  ('April', 'Aprilia',
   'Spreadsheet menulis PIC "April". Profil yang ada bernama "Aprilia" - owner memastikan pada 2 Okt 2026 bahwa itu nama orang yang sama, hanya dipendekkan di spreadsheet. 84 baris / Rp 105.932.000. CATATAN: ini bukan fuzzy match, ini konfirmasi eksplisit owner; jangan dibalik jadi NULL tanpa bertanya.'),

  ('Daffa', NULL,
   'Tidak ada profil bernama "Daffa". 31 baris / Rp 4.835.000.'),

  ('Natallia', NULL,
   'Tidak ada profil bernama "Natallia". 30 baris / Rp 106.300.000.'),

  ('Marini', NULL,
   'Tidak ada profil "Marini". profiles punya "Maria Alvita" - itu orang lain. 22 baris / Rp 17.200.000. Sesuai aturan #18.'),

  ('Riska', NULL,
   'Tidak ada profil bernama "Riska". profiles punya "Ririn Ivanti" dan "rizky" - keduanya orang lain. 6 baris / Rp 7.700.000.'),

  ('David', NULL,
   'Tidak ada profil "David". Keputusan terkunci 1 Okt 2026: perlakukan sama seperti 5 PIC tanpa akun - submitted_by NULL, nama ditulis di label + notes.')
ON CONFLICT (pic) DO UPDATE
  SET profile_nama = EXCLUDED.profile_nama,
      alasan       = EXCLUDED.alasan;

-- ---------------------------------------------------------------------
-- Peta eksplisit campaign -> campaign_id
--
-- Nama campaign di spreadsheet TIDAK SAMA dengan nama di DB:
--   KIMME vs KIME, SALSA COSMETICS vs SALSA Cosmetic,
--   MSGLOWBEAUTY vs MS Glow Beauty, MSGLOWFORMEN vs MS Glow For Men.
--
-- Peta ini DIISI di fase 2, setelah owner mengonfirmasi kandidatnya
-- (lihat docs/sql/66-petakan-campaign.sql dan view di bawah).
-- Sengaja kosong sekarang: belum ada yang terverifikasi.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_import_map_campaign (
    nama_sheet text PRIMARY KEY,
    campaign_id int,
    alasan     text NOT NULL
);

-- ---------------------------------------------------------------------
-- View bantu: kandidat campaign per nama di spreadsheet
-- BUKAN auto-map. Hanya menampilkan kemiripan karakter supaya owner
-- bisa menilai sendiri mana yang benar.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_payment_campaign_candidates AS
SELECT DISTINCT
       s.nama_sheet,
       c.id   AS kandidat_id,
       c.nama AS kandidat_nama,
       c.status AS kandidat_status
FROM payment_import_staging s
CROSS JOIN campaigns c
WHERE upper(replace(c.nama,' ','')) LIKE '%'
      || substring(upper(replace(s.nama_sheet,' ','')) from 1 for 4) || '%'
   OR upper(replace(s.nama_sheet,' ','')) LIKE '%'
      || substring(upper(replace(c.nama,' ','')) from 1 for 4) || '%'
ORDER BY 1,2;

-- ---------------------------------------------------------------------
-- View: campaign yang BELUM punya campaign_id -> destined DEFER
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_payment_campaign_unmapped AS
SELECT s.nama_sheet,
       count(*)                     AS baris,
       sum(s.nominal)               AS nominal
FROM payment_import_staging s
LEFT JOIN payment_import_map_campaign m
       ON m.nama_sheet = s.nama_sheet
WHERE m.campaign_id IS NULL
GROUP BY s.nama_sheet
ORDER BY nominal DESC;

COMMIT;

-- ---------------------------------------------------------------------
-- RINGKASAN YANG HARUS DICOCOKKAN SETELAH DIJALANKAN
--
--   SELECT count(*) AS baris, sum(nominal) AS nominal FROM payment_import_staging;
--   -- harusnya: 826 baris, Rp 507.736.562
--
--   SELECT * FROM v_payment_campaign_unmapped;
--
--   SELECT sum(nominal) FILTER (WHERE submitted_by IS NULL) AS tanpa_pic,
--          sum(nominal) FILTER (WHERE submitted_by IS NOT NULL) AS ada_pic
--   FROM payment_import_staging;
--
--   Rincian submitted_by (hasil dihitung dari 826 baris, bukan tebakan):
--     TIDAK NULL : 729 baris  Rp 356.181.562
--                  Wahyu 354 / Rp 62.180.000, Tiara 77 / Rp 84.909.162
--                  April 84 / Rp 105.932.000 -> profil "Aprilia" (konfirmasi owner)
--                  Maria 145 / Rp 51.960.400, Rija  67 / Rp 44.200.000
--                  Fira    2 / Rp  7.000.000
--     NULL       : 97 baris   Rp 151.555.000
--                  Natallia 30 / Rp 106.300.000
--                  Marini   22 / Rp  17.200.000, David  3 / Rp  14.220.000
--                  Riska    6 / Rp   7.700.000, Daffa  31 / Rp   4.835.000
--                  (kosong) 5 / Rp   1.300.000
--
--   NULL itu disengaja, bukan kelalaian: 6 dari 7 PIC di atas tidak punya
--   akun di `profiles`. Menempelkan submitted_by ke profil yang salah akan
--   menautkan batch historis ke orang yang keliru tanpa error sama sekali
--   (lihat AGENTS.md aturan #17).
-- ---------------------------------------------------------------------
