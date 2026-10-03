-- =====================================================================
-- Peta campaign + payment_type '100_awal' + klasifikasi staging
-- Tanggal : 2 Oktober 2026
-- Sifat  : Murni metadata. TIDAK menyentuh payment_items / payment_batches.
-- Syarat : sudah jalan 20261004000000 (tabel staging) dan 67 (826 baris).
--
-- ISI FILE INI
--   1. CHECK payment_type ditambah '100_awal' (16 baris / Rp 18.250.000 butuh)
--   2. payment_import_map_campaign diisi dengan yang SUDAH dikonfirmasi owner
--   3. Staging diperkaya: campaign_id, submitted_by, payment_type, status_import
--
-- YANG SENGAJA TIDAK DIISI
--   Map campaign untuk METOO / TOP UP LION / TOP UP QONTAK / MCN* /
--   Referal MCN / BOA. Baris-baris itu di-DEFER (status_import='defer'),
--   NOMINALNYA TIDAK PERNAH HILANG, dan rinciannya ada di
--   docs/payment/DEFER.md.
--
--   Aturan owner 3 Okt 2026: "atasannya pengen balance aja semua data
--   pembayaran dan akurat untuk campaign campaign yang saat ini ada di sistem."
--   Kalau nama campaign di sheet tidak ada di `campaigns`, jangan dipaksa masuk.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. payment_type '100_awal'
--
-- CHECK sekarang: 100_akhir, 50_awal, 50_akhir, ads, crm, lion,
--                  reward_affiliate, boost_views, boost_comment
-- Tidak ada '100_awal', padahal 16 baris / Rp 18.250.000 memakainya
-- (keputusan #2 owner 1 Okt: 100% awal = bayar dulu, baru bikin video).
--
-- Nilai lama tidak dihapus, hanya ditambah - tidak ada data jadi rusak.
-- ---------------------------------------------------------------------
ALTER TABLE payment_items DROP CONSTRAINT IF EXISTS payment_items_payment_type_check;

ALTER TABLE payment_items ADD CONSTRAINT payment_items_payment_type_check
    CHECK (payment_type = ANY (ARRAY[
        '100_akhir'::text,
        '50_awal'::text,
        '50_akhir'::text,
        '100_awal'::text,      -- <-- ditambah 2 Okt 2026
        'ads'::text,
        'crm'::text,
        'lion'::text,
        'reward_affiliate'::text,
        'boost_views'::text,
        'boost_comment'::text
    ]));

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------
-- 2. Peta campaign - HANYA YANG DICONFIRMASIKAN OWNER
--
-- Kolom `nama_sheet` = nilai di kolom Campaign spreadsheet.
-- Kolom `campaign_id` = id di tabel campaigns (dibuktikan dari output §4).
--
-- Peta ini dipakai untuk pencocokan; TIDAK dipakai untuk auto-membuat batch.
-- ---------------------------------------------------------------------
INSERT INTO payment_import_map_campaign (nama_sheet, campaign_id, alasan) VALUES
  ('PWS',             38, 'Nama sama persis. 61 baris.'),
  ('DIOLY',           40, 'Nama sama persis. 54 baris.'),
  ('SYB',             46, 'Nama sama persis. 19 baris.'),
  ('GLOWIES',         51, 'Nama sama persis. 19 baris.'),
  ('ISWHITE',         47, 'Nama sama persis. 23 baris.'),
  ('SKINMOLOGY',      43, 'Nama sama persis. 12 baris.'),
  ('WARDAH',          37, 'Nama sama persis. 11 baris.'),
  ('NAISDAY',         39, 'Nama sama persis. 34 baris.'),
  ('OMG Makeup',      33, 'Nama sama persis. 45 baris.'),
  ('OMG Skincare',    34, 'Nama sama persis. 31 baris.'),
  ('QAHIRA',          45, 'Nama sama persis. 36 baris.'),
  ('MILKYBOOST',      52, 'Nama sama persis. 1 baris.'),

  ('KIMME',           44, 'Selisih ketik: sheet "KIMME", DB "KIME". 325 baris - baris terbanyak. Kandidat tunggal yang masuk akal (KIME aktif, tidak ada KIMME).'),
  ('MSGLOWBEAUTY',    41, 'Sheet tanpa spasi, DB "MS Glow Beauty".'),
  ('MSGLOWFORMEN',    42, 'Sheet tanpa spasi, DB "MS Glow For Men".'),
  ('Nutriflakes',     49, 'Selisih kapitalisasi, DB "NUTRIFLAKES".'),
  ('SALSA COSMETICS', 35, 'Jamak vs tunggal, DB "SALSA Cosmetic".'),
  ('Votre Peu',       53, 'Konfirmasi owner 2 Okt 2026. DB "VOTRE PEAU" - sheet menulis "Votre Peu".'),

  ('SALSA Baby Care', 36, 'Konfirmasi owner 2 Okt 2026: "salsa baby care itu sama dengan salsa mom & baby bro, beda dengan salsa cosmetic". 24 baris / Rp 22.450.000.'),

  -- 3 Okt 2026: hanya "Sampel Kime" yang Dimahankan dari daftar DEFER.
  ('Sampel Kime',     44, 'Konfirmasi owner 3 Okt 2026: "gapapa masukin asal ada nama campaignnya jelas". Label sheet "Sampel Kime" jelas arahnya, dan keputusan #5 (1 Okt 2026) sudah menetapkan: operasional campaign KIME (44). 1 baris / Rp 10.000.000, penerima David Sukanto.')
ON CONFLICT (nama_sheet) DO UPDATE
  SET campaign_id = EXCLUDED.campaign_id,
      alasan      = EXCLUDED.alasan;

-- ---------------------------------------------------------------------
-- 3. Perkaya staging
-- ---------------------------------------------------------------------
ALTER TABLE payment_import_staging ADD COLUMN IF NOT EXISTS payment_type text;
ALTER TABLE payment_import_staging ADD COLUMN IF NOT EXISTS status_import text;

-- 3a. campaign_id dari peta
UPDATE payment_import_staging s
   SET campaign_id = m.campaign_id
  FROM payment_import_map_campaign m
 WHERE m.nama_sheet = s.campaign_sheet
   AND m.campaign_id IS NOT NULL;

-- 3b. submitted_by dari peta PIC (dicari lewat NAMA, bukan UUID yang diketik)
UPDATE payment_import_staging s
   SET submitted_by = p.id
  FROM payment_import_map_pic m
  JOIN profiles p ON p.nama = m.profile_nama
 WHERE s.pic = m.pic;

-- 3c. payment_type dari status_klaim di spreadsheet
--
--   'kekurangan dikit' dan kosong -> '100_akhir' atas keputusan owner
--   2 Okt 2026. Alasannya: Rp100.000/Rp50.000 di campaign PWS jauh di bawah
--   rate PWS normal Rp700.000, jadi itu biaya kecil yang SUDAH dibayar, bukan
--   siklus bayar kreator. Teks aslinya tetap disimpan di kolom `catatan`.
UPDATE payment_import_staging
   SET payment_type = CASE status_klaim
        WHEN '100% AKHIR' THEN '100_akhir'
        WHEN '50% AWAL'   THEN '50_awal'
        WHEN '50% AKHIR'  THEN '50_akhir'
        WHEN '100% AWAL'  THEN '100_awal'
        WHEN 'ADS'        THEN 'ads'
        WHEN 'LION'       THEN 'lion'
        WHEN 'CRM'        THEN 'crm'
        ELSE '100_akhir'   -- kosong + "kekurangan dikit"
     END;

-- 3d. klasifikasi: duplikat lokasi / defer / siap
--
--   'duplikat' : username + campaign + nominal PERSIS SAMA dengan item yang
--                sudah ada di sistem (17 baris / Rp 4.250.000). Terbukti via
--                docs/sql/71 §1b.
--   'defer'    : tidak ada campaign_id -> Rp 128.460.000. Dicatat di notes,
--                tidak hilang, tidak diimpor sekarang.
--   'siap'     : sisanya, 795 baris / Rp 375.026.562.
UPDATE payment_import_staging s
   SET status_import = CASE
        WHEN s.campaign_id IS NULL THEN 'defer'
        WHEN EXISTS (
            SELECT 1
            FROM payment_batches b
            JOIN payment_items pi      ON pi.batch_id = b.id
            JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
            JOIN creators cr          ON cr.id = cc.creator_id
            WHERE b.campaign_id = s.campaign_id
              AND lower(cr.username) = s.username
              AND NOT s.username_multi
              AND pi.nominal = s.nominal
        ) THEN 'duplikat'
        ELSE 'siap'
     END;

-- 3e. catatan untuk baris yang payment_type-nya perlu keputusan manusia
UPDATE payment_import_staging
   SET catatan = concat_ws(' | ',
         catatan,
         'kolom Status kosong atau berisi "kekurangan dikit" - ditetapkan '
         || 'payment_type 100_akhir atas keputusan owner 2 Okt 2026')
 WHERE status_klaim IS NULL OR status_klaim = 'kekurangan dikit';

COMMIT;

-- =====================================================================
-- LAPORAN SETELAH DIJALANKAN
--
--   SELECT status_import, count(*) AS baris, sum(nominal) AS nominal
--     FROM payment_import_staging GROUP BY 1 ORDER BY 1;
--
--   -- harus PERSIS begini (sudah dihitung dari cache lokal):
--   --   defer      18 baris   Rp 128.460.000   9 campaign tanpa padanan
--   --   duplikat   17 baris   Rp   4.250.000   sudah ada di sistem
--   --   siap      791 baris   Rp 375.026.562   <-- yang diimpor
--   --   (total    826 baris   Rp 507.736.562)
--
--   Kategori 'duplikat' dan 'defer' TIDAK tumpang tindih: semua 17 campaign
--   duplikat punya campaign_id, dan semua 18 campaign defer tidak punya
--   item pembanding di sistem. Sudah diverifikasi, overlap = 0 baris.
--
--   Catatan: 791 baris 'siap' akan jadi 795 payment_items. Baris
--   "Juli 2026 r61" (1 item Rp 2.000.000 ke rekening agency, 5 username
--   dalam 1 sel) dipecah jadi 5 item x Rp 400.000 atas keputusan owner
--   2 Okt 2026. Nominal total tidak berubah.
--
--   SELECT * FROM v_payment_campaign_unmapped;
--   -- harus: 9 campaign, total Rp 128.460.000
--
--   SELECT count(*) FROM payment_import_staging
--    WHERE status_import = 'siap' AND campaign_id IS NULL;
--   -- harus: 0
-- =====================================================================
