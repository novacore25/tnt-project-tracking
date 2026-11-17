-- Migration: 20261117153000_create_campaign_weekly_milestones.sql
-- Description: Tabel monitoring & controlling progress PIC mingguan (Roadmap, Target, How To Achieve, Kendala & Problem Solving)

CREATE TABLE IF NOT EXISTS campaign_weekly_milestones (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    pic_name TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    week_label TEXT NOT NULL,
    month_label TEXT DEFAULT 'November 2026',
    start_date DATE,
    end_date DATE,
    target_creator INTEGER DEFAULT 0,
    target_creator_delta INTEGER DEFAULT 0,
    target_video INTEGER DEFAULT 0,
    target_video_delta INTEGER DEFAULT 0,
    target_gmv BIGINT DEFAULT 0,
    target_gmv_delta BIGINT DEFAULT 0,
    target_live_session INTEGER DEFAULT 0,
    how_to_achieve TEXT,
    action_plan TEXT,
    kendala TEXT,
    problem_solving TEXT,
    status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'need_attention', 'at_risk', 'completed')),
    notes TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cwm_campaign_id ON campaign_weekly_milestones(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cwm_pic_name ON campaign_weekly_milestones(pic_name);
CREATE INDEX IF NOT EXISTS idx_cwm_week_number ON campaign_weekly_milestones(week_number);


-- Update targets from Blueprint Campaign PDF
UPDATE campaigns SET target_creator = 500, target_video = 1500 WHERE id = 50;
UPDATE campaigns SET target_creator = 600, target_video = 1600 WHERE id = 54;
UPDATE campaigns SET target_creator = 600, target_video = 1600 WHERE id = 56;
UPDATE campaigns SET target_creator = 600, target_video = 1600 WHERE id = 45;
UPDATE campaigns SET target_creator = 365, target_video = 2100 WHERE id = 42;
UPDATE campaigns SET target_creator = 600, target_video = 1600 WHERE id = 41;
UPDATE campaigns SET target_creator = 300, target_video = 600 WHERE id = 35;
UPDATE campaigns SET target_creator = 1100, target_video = 2100 WHERE id = 36;
UPDATE campaigns SET target_creator = 1541, target_video = 1000 WHERE id = 46;
UPDATE campaigns SET target_creator = 300, target_video = 600 WHERE id = 48;

-- Update PIC mapping pada tabel campaigns
UPDATE campaigns SET pic = 'Rija' WHERE id IN (57, 50, 74, 75, 141);
UPDATE campaigns SET pic = 'April' WHERE id IN (54, 142, 56, 33);
UPDATE campaigns SET pic = 'Maria' WHERE id IN (59, 177, 40, 138, 139);
UPDATE campaigns SET pic = 'Wahyu' WHERE id IN (49, 44);
UPDATE campaigns SET pic = 'Jerry / Samara' WHERE id IN (45, 42, 41, 46, 48);
UPDATE campaigns SET pic = 'Samara' WHERE id IN (35, 36);

-- Seed Data Weekly Milestones
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    57, 'Rija', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    431, 30, 600, 150,
    0, 0, 0,
    'Fullfill 30 Creator Alternate, 600 Posting VT (+150 VT), Pararel Request Sample', 'Aktivasi kreator cadangan (alternate) untuk menjaga ritme posting awal bulan', 'Sebagian kreator lambat konfirmasi nomor resi pengiriman sampel', 'Kirim reminder personal via WhatsApp dan konfirmasi ketersediaan stok produk alternatif', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    57, 'Rija', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    481, 50, 1000, 400,
    0, 0, 0,
    'Fullfill 50 Creator Alternate, 1000 Posting VT (+400 VT), Pararel Kirim Sample', 'Fokus kirim paket sampel massal jelang 11.11 promo spike', 'Stok sample bundle utama sempat habis di warehouse brand', 'Koordinasi cepat dengan PIC brand untuk alokasi batch pengganti dalam 1x24 jam', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    57, 'Rija', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    500, 19, 1300, 300,
    0, 0, 0,
    'Fullfill 50 Creator (Mencapai 500 Creator), 1300 Posting VT (+300 VT), Pararel Req Sample', 'Dorong approval draft video kreator agar segera live di feed TikTok', 'Draft video beberapa kreator tidak mencantumkan hashtag resmi atau keranjang kuning belum aktif', 'Briefing ulang PIC kreator dan sediakan checklist panduan upload mandiri', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    57, 'Rija', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    500, 0, 1500, 200,
    0, 0, 0,
    '1500 Posting VT (+200 VT), Push posting serentak Payday', 'Manfaatkan momen payday dan voucher brand untuk mendongkrak views dan konversi', 'Potensi saturasi konten jika template video terlalu seragam antar kreator', 'Variasikan hook 3 detik awal (POV, review jujur, unboxing estetis)', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    57, 'Rija', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    500, 0, 1600, 100,
    0, 0, 0,
    '1600 Posting VT (+100 VT), Report keseluruhan hasil campaign & closing audit', 'Rekapitulasi all-time performance, periksa ketercapaian target 1600 VT', 'Waktu closing sangat ketat di akhir bulan', 'Siapkan draft laporan mingguan sejak H-3 penutupan', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    50, 'Rija', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    250, 0, 200, 0,
    0, 0, 0,
    'Pararel Request Sample, Filter kreator niche family & hygiene', 'Penyusunan pool kreator baru dengan fokus audiens ibu & keluarga muda', 'Respons kreator niche family lebih selektif terhadap fee & produk', 'Tingkatkan penawaran nilai tambah dan tekankan keunggulan formula produk Biodef', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    50, 'Rija', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    350, 100, 500, 300,
    0, 0, 0,
    'Pararel Req Sample & Pengiriman paket secara teratur', 'Distribusi sample massal untuk mengejar momentum pertengahan bulan', 'Kendala kurir logistik saat lonjakan pesanan belanja nasional', 'Pilih opsi kurir prioritas / same-day untuk area Jabodetabek', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    50, 'Rija', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    450, 100, 900, 400,
    0, 0, 0,
    'Pararel Request Sample, Evaluasi performa views video tier Nano', 'Identifikasi VT yang fyp dan dorong video susulan dengan format serupa', 'Beberapa video view di bawah standar karena hook kurang kuat', 'Audit script video dan bantu revisi opening hook kreator', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    50, 'Rija', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    500, 50, 1300, 400,
    0, 0, 0,
    'Mencapai 500 Creator, Push posting 1300 VT', 'Aktivasi seluruh kreator yang telah menerima produk untuk segera upload', 'Kreator menunda posting dengan alasan kesibukan pribadi', 'Beri batas waktu tegas (SOP 7 hari setelah barang diterima)', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    50, 'Rija', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    500, 0, 1500, 200,
    0, 0, 0,
    '1500 Posting VT, Report keseluruhan hasil campaign Biodef', 'Closing campaign dan penyusunan executive summary untuk brand', 'Penyesuaian final video approval', 'Verifikasi link video yang valid dan tidak di-private oleh kreator', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    74, 'Rija', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    300, 98, 300, 112,
    15000000, 15000000, 0,
    'Fullfill 300 Creator, 300 Posting VT (+112 VT), Pararel Req Sample', 'Inisiasi campaign skincaring sales & awareness serentak', 'Akun kreator baru butuh penyesuaian approval produk', 'Bantu proses otorisasi produk di Partner Center', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    74, 'Rija', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    400, 100, 700, 400,
    60000000, 45000000, 0,
    'Fullfill 400 Creator (+100 Creator), 700 Posting VT (+400 VT), Pararel Kirim Sample', 'Optimalkan momen 11.11 untuk mengangkat GMV Sales', 'Kompetisi live streaming padat di kategori skincare saat double date', 'Fokuskan ke video affiliate evergreen dengan call to action jelas', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    74, 'Rija', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    500, 100, 1200, 500,
    120000000, 60000000, 0,
    'Fullfill 500 Creator (+100 Creator), 1200 Posting VT (+500 VT), Pararel Req Sample', 'Skalasi kreator mikro yang memiliki engagement rate di atas rata-rata', 'Banyak creator mengajukan sample produk tambahan', 'Pilih kreator dengan performa conversion terbaik untuk bonus sample', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    74, 'Rija', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    500, 0, 1500, 300,
    240000000, 120000000, 0,
    '1500 Posting VT (+300 VT), Payday Ramp-up Promo', 'Dorong video edukasi bahan aktif jelang gajian', 'Kreator kehabisan ide sudut pandang video', 'Sediakan template hook & copy audio viral mingguan', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    74, 'Rija', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    500, 0, 1500, 0,
    480000000, 240000000, 0,
    'Evaluasi Hasil Campaign Felaufee, Rekap GMV & VT', 'Evaluasi konversi penjualan dan siapkan target bulan Desember', 'Target sales perlu ditingkatkan untuk mencapai plafon target', 'Siapkan penambahan budget ads spark untuk video dengan ROAS tinggi', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    141, 'Rija', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    250, 50, 100, 75,
    0, 0, 0,
    'Fullfill 250 Creator (+50 creator), 100 Posting VT (+75 VT), Pararel Request Sample', 'Rekrutmen creator tier Nano & Micro untuk produk The Face', 'Kreator lambat request sample di TikTok Shop', 'Sediakan tutorial singkat step-by-step klaim sampel gratis', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    141, 'Rija', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    350, 100, 450, 350,
    0, 0, 0,
    'Fullfill 350 Creator (+100 creator), 450 Posting VT (+350 VT), Pararel Request Sample', 'Percepat review draft script dan approval produk', 'Antrean verifikasi konten di tim review', 'Alokasikan PIC reviewer tambahan untuk mempercepat SLA approval', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    141, 'Rija', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    500, 150, 800, 350,
    0, 0, 0,
    'Fullfill 500 Creator (+150 creator), 800 Posting VT (+350 VT), Pararel Request Sample', 'Penuhi kuota 500 kreator aktif sebelum minggu keempat', 'Target kreator bertambah pesat, risiko penurunan kualitas video', 'Gunakan sistem sampling acak untuk kontrol kualitas konten', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    141, 'Rija', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    500, 0, 1150, 350,
    0, 0, 0,
    '1150 Posting VT (+350 VT), Push posting serentak', 'Manfaatkan Payday spike traffic untuk meningkatkan views', 'Algoritma TikTok menahan distribusi beberapa video berdurasi terlalu pendek', 'Anjurkan durasi optimal 25-45 detik dengan visual dinamis', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    141, 'Rija', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    500, 0, 1500, 350,
    0, 0, 0,
    '1500 Posting VT (+350 VT), Report keseluruhan hasil campaign', 'Closing report komprehensif, evaluasi ROI dan performa VT', 'Penutupan data akhir bulan', 'Sinkronisasi akhir data Partner Center tepat waktu', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    54, 'April', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    423, 20, 271, 100,
    0, 0, 0,
    'Fullfill 423 Creator (+20 creator), 271 Posting VT (+100 VT), Pararel Req Sample', 'Re-engagement database kreator lama untuk campaign renewal', 'Kreator menanyakan kejelasan reward tambahan', 'Umumkan program creator bonus bagi yang posting tepat waktu', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    54, 'April', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    461, 38, 671, 400,
    0, 0, 0,
    'Fullfill 461 Creator (+38 creator), 671 Posting VT (+400 VT), Pararel Kirim Sample', 'Pengiriman sample serentak untuk memaksimalkan konten 11.11', 'Keterlambatan input resi oleh pihak logistik', 'Integrasi pengecekan resi via dashboard internal', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    54, 'April', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    500, 39, 1121, 450,
    0, 0, 0,
    'Fullfill 500 Creator (+39 creator), 1121 Posting VT (+450 VT), Pararel Req Sample', 'Mencapai kuota 500 kreator approved dan ramp-up 1100+ posting', 'Beberapa video terkena pembatasan usia atau sensor produk', 'Sampaikan panduan Do & Don''t penayangan produk kosmetik TikTok', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    54, 'April', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    600, 100, 1500, 379,
    0, 0, 0,
    '1500 Posting VT (+379 VT), Pararel Kirim Sample gelombang terakhir', 'Aktivasi 100 kreator tambahan untuk mencapai target 600 kreator', 'Waktu produksi video semakin mepet dengan batas akhir bulan', 'Gunakan format quick-review dan tutorial praktis 15 detik', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    54, 'April', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    600, 0, 1800, 300,
    0, 0, 0,
    '1800 Posting VT (+300 VT), Evaluasi hasil campaign MD Glow', 'Closing campaign dan presentasi performa ke klien', 'Rekonsiliasi data view dan engagement', 'Ekspor laporan analitik komprehensif', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    56, 'April', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    500, 50, 250, 64,
    0, 0, 0,
    'Fullfill 500 Creator (+50), 250 Posting VT (+64 VT), Pararel Kirim Sample', 'Peluncuran konsep video unboxing parfum luxury', 'Kemasan kaca parfum memerlukan packing ekstra aman', 'Gunakan bubble wrap tebal dan asuransi pengiriman', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    56, 'April', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    600, 100, 638, 388,
    0, 0, 0,
    'Fullfill 600 Creator (+100), 638 Posting VT (+388 VT), Pararel Req Sample', 'Penuhi target total 600 kreator Zeluxe dan dorong posting massal', 'Deskripsi aroma parfum sulit dijelaskan secara visual', 'Sediakan panduan deskripsi scent notes (top, middle, base notes)', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    56, 'April', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    600, 0, 1038, 400,
    0, 0, 0,
    '1038 Posting VT (+400 VT), Pararel Kirim Sample', 'Tembus 1000 video posting di pertengahan November', 'Sebagian kreator menunda posting hingga akhir pekan', 'Kirim reminder posting di hari Jumat pagi', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    56, 'April', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    600, 0, 1450, 412,
    0, 0, 0,
    '1450 Posting VT (+412 VT), Push posting payday promo', 'Eksploitasi momen payday dengan tema hadiah parfum akhir tahun', 'Kreator yang belum posting dihubungi intensif', 'Direct call bagi kreator dengan sampel yang sudah diterima > 10 hari', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    56, 'April', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    600, 0, 1600, 150,
    0, 0, 0,
    '1600 Posting VT, Evaluasi hasil campaign Zeluxe', 'Target total 1600 VT terpenuhi 100%, finalisasi laporan', 'Audit link posting', 'Verifikasi status video aktif dan publik', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    142, 'April', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    1000, 0, 2100, 0,
    0, 0, 0,
    'Fulfill 1000 Creator & 2100 Posting VT, Pararel Request Sample', 'Distribusi lip tint dan makeup remaja', 'Volume kreator sangat besar membutuhkan tracking teliti', 'Gunakan dashboard internal dan filter batch per tanggal', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    142, 'April', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    1100, 100, 2800, 700,
    0, 0, 0,
    'Peningkatan posting VT harian dan pemantauan FYP', 'Aktivasi tren transisi makeup sebelum dan sesudah', 'Kreator sering memakai lagu yang terkena copyright mute', 'Berikan rekomendasi daftar backsound komersial yang aman di TikTok', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    142, 'April', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    1100, 0, 3400, 600,
    0, 0, 0,
    'Monitoring engagement dan share rate video', 'Dorong interaksi komentar di akun kreator', 'Engagement rate bervariasi', 'Instruksikan kreator untuk membalas 10 komentar pertama', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    142, 'April', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    1100, 0, 3900, 500,
    0, 0, 0,
    'Push posting akhir bulan menuju target 4000 VT', 'Promo bundling akhir bulan di etalase TikTok Shop', 'Kreator yang sibuk ujian sekolah/kuliah', 'Toleransi jadwal posting maksimal H+3 dari timeline', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    142, 'April', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    1100, 0, 4000, 100,
    0, 0, 0,
    'Target 4000 VT tercapai, Report keseluruhan hasil campaign', 'Closing campaign Implora Urban & audit data', 'Penyusunan report akhir', 'Automasi rekonsiliasi data Partner Center', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    33, 'April', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    265, 0, 500, 0,
    1779000000, 0, 0,
    'Persiapan Campaign 11.11, Gunakan Ads untuk optimalisasi VT', 'Pemberian boost ads spark ke video organik terbaik', 'Biaya ads per klik berfluktuasi saat pekan promo besar', 'Set target cap cost dan optimalkan audience lookalike', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    33, 'April', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    265, 0, 650, 150,
    1929000000, 150000000, 0,
    'GMV Gain Rp 150.000.000 (Total GMV Rp 1.929.000.000), Gunakan Ads untuk optimalisasi VT', 'Kombinasi live streaming afiliasi dan video shopping ads', 'Stok lip cream shade favorit menipis', 'Arahkan konten kreator ke shade alternatif yang stoknya melimpah', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    33, 'April', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    265, 0, 750, 100,
    2179000000, 250000000, 0,
    'GMV Gain Rp 250.000.000 (Total GMV Rp 2.179.000.000), Gunakan Ads untuk optimalisasi VT', 'Scale up budget ads pada video dengan conversion rate > 5%', 'Creative fatigue pada video yang sudah berjalan 2 minggu', 'Refresh materi video baru dari kreator batch 2', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    33, 'April', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    265, 0, 800, 50,
    2429000000, 250000000, 0,
    'GMV Gain Rp 250.000.000 (Total GMV Rp 2.429.000.000), Push Penjualan Payday', 'Optimasi diskon payday dan live shopping maraton', 'Trafik padat pada jam 19.00-22.00', 'Jadwalkan slot live di peak hours dan boost traffic', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    33, 'April', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    265, 0, 850, 50,
    2500000000, 71000000, 0,
    'GMV Gain Rp 71.033.000, TOTAL GMV Rp 2.500.000.000 TERCAPAI 100%!', 'Pencapaian target GMV 2.5 Miliar, evaluasi dan selebrasi campaign', 'Rekonsiliasi transaksi cancel dan return', 'Validasi final GMV netto pasca return window', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    59, 'Maria', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    442, 0, 279, 196,
    0, 0, 0,
    '279 Posting VT (+196 VT), Pararel Request Sample', 'Aktivasi kreator parfum dan nail polish Brasov', 'Resi sample terlambat diinput oleh warehouse', 'Minta list resi harian dan langsung input ke sistem tracking', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    59, 'Maria', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    442, 0, 606, 327,
    0, 0, 0,
    '606 Posting VT (+327 VT), Pararel Request Sample', 'Fokus posting bertema parfum tahan lama untuk sekolah/kuliah', 'Banyak kreator pemula belum paham cara menaruh tautan produk', 'Buat video tutorial 30 detik cara pasang link produk affiliate', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    59, 'Maria', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    442, 0, 933, 327,
    0, 0, 0,
    '933 Posting VT (+327 VT), Pararel Request Sample', 'Ramp-up menuju 1000 video posting', 'Konten repetitif dengan konsep serupa', 'Dorong variasi konsep: battle parfum vs blind test aroma', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    59, 'Maria', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    442, 0, 1326, 393,
    0, 0, 0,
    '1326 Posting VT (+393 VT), Target 1326 VT tercapai penuh!', 'Push seluruh sisa kreator untuk mengunggah video sebelum cut-off', 'Beberapa kreator akunnya kena shadowban', 'Sarankan kreator gunakan audio trending dan perbaiki metadata teks', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    59, 'Maria', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    442, 0, 1326, 0,
    0, 0, 0,
    'Evaluasi Hasil Campaign Brasov & Final Recap', 'Penyusunan laporan penutupan campaign', 'Audit video aktif', 'Pastikan seluruh 1326 video tidak terhapus atau privat', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    177, 'Maria', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    2100, 100, 4100, 100,
    0, 0, 0,
    'Fullfill 2100 Creator & 4100 Video Posting, Closing Campaign Sprint (6 Nov Deadline)', 'Selesaikan seluruh target kreator sunscreen sebelum batas waktu 6 November', 'Batas deadline sangat singkat di awal November', 'Pengerahan seluruh tim outreach untuk follow-up kreator serentak', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    138, 'Maria', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    50, 0, 20, 20,
    0, 0, 0,
    '20 VT Posting (+20 VT), Pararel Request Sample', 'Inisiasi campaign Beliora eksklusif 50 creator', 'Kreator selektif terhadap formula baru', 'Kirimkan press kit dan sertifikasi BPOM produk lengkap', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    138, 'Maria', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    50, 0, 140, 120,
    0, 0, 0,
    '140 VT Posting (+120 VT), Pararel Request Sample', 'Fokus review tekstur no-whitecast dan kenyamanan pemakaian', 'Pencahayaan video kreator kurang memperlihatkan tekstur', 'Briefing teknik close-up swatch produk di bawah sinar matahari alami', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    138, 'Maria', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    50, 0, 295, 155,
    0, 0, 0,
    '295 VT Posting (+155 VT), Pararel Request Sample', 'Peningkatan frekuensi posting dari kreator tier micro', 'Kreator meminta izin repost video ke platform lain', 'Berikan izin sesuai klausul kontrak untuk memperluas jangkauan', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    138, 'Maria', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    50, 0, 460, 165,
    0, 0, 0,
    '460 VT Posting (+165 VT), Pararel Request Sample', 'Aktivasi posting menjelang penutupan campaign', 'Kreator yang belum posting video kedua', 'Kirim pengingat komitmen 2x posting per kreator', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    138, 'Maria', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    50, 0, 500, 40,
    0, 0, 0,
    'Evaluasi Hasil Campaign Beliora & Rekapitulasi', 'Closing dan pelaporan ke brand', 'Verifikasi engagement akhir', 'Laporan analitik akhir disusun', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    40, 'Maria', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    250, 0, 313, 30,
    0, 0, 0,
    'Posting 313 VT (+30 VT), Pararel Request Sample', 'Penyebaran konten perawatan tubuh harian', 'Kreator terlambat mengunggah link tracking', 'Cek manual via pencarian username kreator di TikTok', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    40, 'Maria', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    250, 0, 378, 65,
    0, 0, 0,
    'Posting 378 VT (+65 VT), Pararel Request Sample', 'Manfaatkan promo 11.11 untuk mengangkat exposure Dioly', 'Trafik padat pada hari H 11.11', 'Pastikan keranjang kuning tertaut dengan benar di setiap VT', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    40, 'Maria', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    250, 0, 458, 80,
    0, 0, 0,
    'Posting 458 VT (+80 VT), Menuju target 500 VT', 'Dorong video edukasi tips kulit sehat', 'Kreator membutuhkan contoh sudut pandang baru', 'Bagikan referensi video berkinerja tinggi dari brand sejenis', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    40, 'Maria', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    250, 0, 500, 42,
    0, 0, 0,
    'Posting 500 VT (+42 VT), Target 500 VT TERCAPAI LENGKAP!', 'Penyelesaian seluruh target video sebelum penutupan', 'Pastikan seluruh konten lolos standar brand', 'Kaji ulang video yang berstatus pending approval', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    40, 'Maria', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    250, 0, 500, 0,
    0, 0, 0,
    'Evaluasi Hasil Campaign Dioly & Final Report', 'Laporan pencapaian 500 VT dan evaluasi metrik', 'Dokumentasi akhir', 'Simpan bukti posting dan statistik views', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    139, 'Maria', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    418, 2, 314, 327,
    0, 0, 0,
    'Fullfill 418 Creator (+2), Posting 314 VT (+327 VT), Pararel Req Sample', 'Briefing dermatologis dan klaim medis yang sesuai standar BPOM', 'Brand sangat ketat terkait klaim penyembuhan jerawat (overclaim)', 'Sediakan daftar kata-kata terlarang dan anjurkan fokus pada pengalaman sensori', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    139, 'Maria', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    418, 0, 634, 320,
    0, 0, 0,
    'Posting 634 VT (+320 VT), Pararel Request Sample', 'Skalasi konten edukasi skin barrier untuk audiens sensitif', 'Waktu approval script dari tim medis brand memakan waktu 2-3 hari', 'Submit batch script lebih awal secara terkoordinasi', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    139, 'Maria', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    418, 0, 948, 314,
    0, 0, 0,
    'Posting 948 VT (+314 VT), Pararel Request Sample', 'Menjangkau audiens pria dan wanita dengan masalah barrier', 'Kreator yang kurang pede tanpa makeup', 'Dorong konsep raw footage dan real skin texture yang lebih dipercaya audiens', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    139, 'Maria', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    418, 0, 1262, 314,
    0, 0, 0,
    'Posting 1262 VT (+314 VT), Pararel Request Sample', 'Pencapaian target 1254+ VT dan persiapan closing', 'Kreator yang terlambat posting karena menunggu jerawat sembuh', 'Jelaskan bahwa konten bisa fokus pada tekstur menenangkan saat jerawat aktif', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    139, 'Maria', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    418, 0, 1262, 0,
    0, 0, 0,
    'Evaluasi Hasil Campaign La Roche-Posay', 'Closing report komprehensif untuk brand prinsipal', 'Audit kepatuhan klaim pada video final', 'Arsipkan seluruh link video yang memenuhi guideline', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    49, 'Wahyu', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    2679, 400, 2399, 500,
    0, 0, 0,
    '2679 Creator (+400), Posting 2399 (+500 VT), Pararel Request Sample', 'Inisiasi gelombang 1 kampanye kesehatan lambung & sarapan sehat', 'Penyusunan target 5000 kreator sangat masif', 'Gunakan automasi scraping kreator untuk mempercepat profiling calon afiliator', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    49, 'Wahyu', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    3279, 600, 5199, 2800,
    0, 0, 0,
    '3279 Creator (+600 Creator), Posting 5199 (+2800 VT), Pararel Req Sample Massive', 'Eskalasi pengiriman sampel skala besar dan persiapan lonjakan 11.11', 'Kapasitas packing gudang memerlukan lembur', 'Koordinasikan jadwal pickup ekspedisi terjadwal 2x sehari', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    49, 'Wahyu', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    3979, 700, 9199, 4000,
    0, 0, 0,
    '3979 (+700 Creator), Posting 9199 (+4000 VT), Pararel Request Sample', 'Lonjakan posting 4000 VT dalam sepekan menuju target 9000+ VT', 'Banyak akun kreator baru yang perlu panduan keranjang kuning', 'Sebarkan panduan video tutorial singkat di grup broadcast Telegram/WA kreator', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    49, 'Wahyu', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    5000, 1021, 14900, 5801,
    0, 0, 0,
    'Total 5000 (+1021 Creator), 14.900 (+5801 VT), Pararel Request Sample', 'Puncak lonjakan posting Payday November menembus 14.900 video', 'Trafik posting serentak rawan duplikasi konten', 'Ingatkan kreator untuk membuat sudut pandang otentik sesuai rutinitas harian', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    49, 'Wahyu', 5, 'Week 5 (30 Nov)', 'November 2026', '2026-11-30', '2026-11-30',
    5000, 0, 15000, 100,
    0, 0, 0,
    '15.000 Posting VT, Evaluasi Hasil Campaign Nutriflakes', 'Mencapai milestone luar biasa 15.000 VT & 5000 Creator, closing audit', 'Verifikasi ribuan data link video', 'Gunakan query script otomatis untuk audit ketercapaian link dan status publik', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    44, 'Wahyu', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    3666, 0, 11272, 0,
    0, 0, 0,
    'Current 3666 Creator & 11.272 VT, Persiapan sprint akhir tahun (Target 3750 Creator & 15.000 VT)', 'Maintenance performa kreator existing dan rekrutmen sisa kuota 84 kreator', 'Sebagian kreator lama mulai pasif mengunggah video', 'Jalankan program aktivasi ulang dengan insentif komisi tambahan', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    44, 'Wahyu', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    3700, 34, 12000, 728,
    0, 0, 0,
    'Posting 12.000 VT, Optimasi penjualan 11.11', 'Dorong video bundle sabun KIME dengan promo flash sale', 'Stok paket bundle menipis di pertengahan minggu', 'Segera alihkan promosi ke single pack yang ready', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    44, 'Wahyu', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    3750, 50, 13000, 1000,
    0, 0, 0,
    'Target 3750 Creator TERPENUHI, Posting 13.000 VT', 'Fokus eksklusif pada volume video posting hingga akhir tahun', 'Kreator jenuh dengan format review kamar mandi', 'Berikan ide konsep daily skincare routine dan travel vlog', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    44, 'Wahyu', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    3750, 0, 14000, 1000,
    0, 0, 0,
    'Posting 14.000 VT, Payday Activation', 'Dorong posting massal di pekan gajian', 'Beberapa video terkena filter spam karena upload berulang', 'Atur interval posting minimal 4-6 jam antar video', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    44, 'Wahyu', 5, 'Week 5 (30 Nov - 4 Des)', 'Desember 2026', '2026-11-30', '2026-12-04',
    3750, 0, 14500, 500,
    0, 0, 0,
    'Persiapan Campaign 12.12 Harbolnas', 'Briefing kreator untuk penawaran diskon terbesar tahun ini', 'Banyak kreator berebut kuota sampel promo', 'Prioritaskan kreator dengan tingkat konversi tertinggi', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    44, 'Wahyu', 6, 'Week 6-9 (Desember)', 'Desember 2026', '2026-12-07', '2026-12-31',
    3750, 0, 15000, 500,
    0, 0, 0,
    'Mencapai 15.000 VT, Closing Campaign Akhir Tahun', 'Penutupan campaign akhir tahun dengan total 15.000 video', 'Rekapitulasi tahunan', 'Penyusunan laporan tahunan brand KIME', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    45, 'Jerry / Samara', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    554, 0, 250, 64,
    250000000, 200000000, 50,
    'Fulfill 100 VT/LS, Pararel Req Sample, Target GMV Gain Rp 200.000.000 (Total GMV Rp 250.000.000)', 'Aktivasi kreator live streaming dan affiliate video bertema kesehatan pria/herbal', 'Akun live streaming baru rawan terkena pelanggaran kata-kata sensitif', 'Briefing host live mengenai terminologi herbal yang aman dari sensor TikTok', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    45, 'Jerry / Samara', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    570, 16, 350, 100,
    275000000, 25000000, 50,
    'Focus Creator Activation for 11.11 Campaign, Target GMV Gain Rp 25.000.000 (Total Rp 275.000.000)', 'Optimalkan flash voucher dan free ongkir saat puncak promo 11.11', 'Traffic live tinggi namun konversi keranjang tertunda', 'Gunakan teknik scarcity (stok terbatas per sesi live) untuk memicu pembelian instan', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    45, 'Jerry / Samara', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    600, 30, 450, 100,
    300000000, 25000000, 50,
    'Target 600 Creator, 100 Posting VT, Target GMV Gain Rp 25.000.000 (Total Rp 300.000.000)', 'Penuhi kuota 600 kreator aktif dan genjot tayangan video edukasi produk', 'Host live mengalami kelelahan pita suara saat maraton live', 'Bagi shift streaming menjadi maksimal 2 jam per sesi dengan 2 host bergantian', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    45, 'Jerry / Samara', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    600, 0, 550, 100,
    400000000, 100000000, 100,
    'Payday Periode, GMV Gain Rp 100.000.000 (Total Rp 400.000.000), 100 Sesi Live', 'Maraton 100 sesi live selama pekan gajian untuk mengejar lonjakan GMV', 'Kompetisi antar brand herbal di jam gajian sangat ketat', 'Berikan bundle spesial bonus merchandise untuk pembelian minimal 2 botol', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    45, 'Jerry / Samara', 5, 'Week 5 (30 Nov - 4 Des)', 'Desember 2026', '2026-11-30', '2026-12-04',
    600, 0, 650, 100,
    500000000, 100000000, 50,
    'Early Month Shopping, TARGET TOTAL GMV Rp 500.000.000 TERCAPAI PENUH!', 'Pencapaian target GMV 500 Juta, evaluasi dan maintain penjualan akhir tahun', 'Retur barang akibat COD gagal bayar', 'Terapkan konfirmasi pesanan via bot WA sebelum paket dikirim gudang', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    41, 'Jerry / Samara', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    456, 0, 250, 64,
    100000000, 30000000, 50,
    'Fullfill 100 VT, Drafting & Request Sample, Target GMV Gain Rp 30.000.000', 'Kurasi kreator kecantikan tier macro dan influencer potensial', 'Kreator tier macro meminta kompensasi flat fee tambahan', 'Negosiasikan model hybrid (komisi afiliasi lebih tinggi + bonus target penjualan)', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    41, 'Jerry / Samara', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    500, 44, 400, 150,
    175000000, 75000000, 50,
    'Listing 5 Creator Influencer 100JT+, Target GMV Gain Rp 75.000.000, Double Date 11.11', 'Kolaborasi dengan mega influencer untuk memicu viralitas produk di TikTok', 'Jadwal posting influencer berbenturan dengan agenda endorsement lain', 'Kunci jadwal tayang H-2 sebelum periode double date', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    41, 'Jerry / Samara', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    550, 50, 600, 200,
    250000000, 75000000, 50,
    'Posting 100 VT, Target GMV Gain Rp 75.000.000, Listing 10 Creator 500JT+', 'Aktivasi kreator berpenjualan tinggi (creator 500JT+) untuk live maraton', 'Tingkat persaingan live streaming kategori skincare sangat agresif', 'Gunakan gimmick bundling eksklusif dan voucher potongan harga langsung', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    41, 'Jerry / Samara', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    600, 50, 800, 200,
    720000000, 320000000, 100,
    'Payday Periode, GMV Gain Rp 320.000.000 (Total GMV Rp 720.000.000), 100 Sesi Live', 'Scale up sesi live dan video shopping ads secara serentak di hari gajian', 'Server etalase toko terkadang lambat memproses checkout masal', 'Koordinasikan kapasitas toko online dengan tim operasional pusat', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    41, 'Jerry / Samara', 5, 'Week 5-12 (Desember - Januari)', 'Desember 2026', '2026-11-30', '2027-01-22',
    600, 0, 1600, 800,
    4000000000, 3280000000, 100,
    'Scale Up Desember - Harbolnas 12.12 & Tahun Baru menuju TARGET TOTAL GMV Rp 4.000.000.000', 'Roadmap jangka panjang hingga 22 Januari untuk mencapai total plafon 4 Miliar', 'Kenaikan biaya iklan digital jelang akhir tahun', 'Tingkatkan porsi traffic organik dari affiliator mikro untuk menyeimbangkan ROAS', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    42, 'Jerry / Samara', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    200, 0, 150, 0,
    37000000, 25000000, 50,
    'Listing 100 VT/Live, Target GMV Gain Rp 25.000.000, Fokus Grooming Pria', 'Rekrutmen kreator pria dan komunitas otomotif/lifestyle', 'Minat pria menonton live shopping produk perawatan wajah lebih rendah dari wanita', 'Gunakan konten video singkat to-the-point tentang mengatasi wajah kusam & berminyak', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    42, 'Jerry / Samara', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    250, 50, 250, 100,
    52000000, 15000000, 50,
    'Double Date 11.11, Target GMV Rp 15.000.000, Listing 5 Creator Influencer', 'Penetrasi pasar melalui kolaborasi kreator gym/fitness', 'Stok sunscreen spray pria menipis', 'Dorong bundling facial wash + moisturizer yang stoknya aman', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    42, 'Jerry / Samara', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    300, 50, 350, 100,
    72000000, 20000000, 50,
    'Posting 100 VT, Target GMV Gain Rp 20.000.000, Listing 10 Creator Influencer 100JT+', 'Peningkatan frekuensi review jujur pemakaian 7 hari', 'Beberapa video terkena komentar skeptis dari penonton', 'Instruksikan kreator untuk menyematkan ulasan hasil nyata tanpa filter berlebihan', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    42, 'Jerry / Samara', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    365, 65, 500, 150,
    172000000, 100000000, 100,
    'Payday Periode, Target GMV Gain Rp 100.000.000, 100 Sesi Live', 'Target kreator terpenuhi 365 orang, optimalkan penjualan hari gajian', 'Host pria yang cakap jualan live masih terbatas', 'Lakukan workshop intensif teknik closing bagi host live streaming', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    42, 'Jerry / Samara', 5, 'Week 5-12 (Desember - Januari)', 'Desember 2026', '2026-11-30', '2027-01-22',
    365, 0, 1200, 700,
    1200000000, 1028000000, 100,
    'Scale Up Harbolnas 12.12 hingga Januari menuju TARGET TOTAL GMV Rp 1.200.000.000', 'Maintain tren penjualan perawatan pria hingga promo tahun baru', 'Fluktuasi pembelian setelah masa gajian selesai', 'Pertahankan kampanye affiliate cashback dan gratis ongkir reguler', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    35, 'Samara', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    300, 0, 200, 0,
    30000000, 30000000, 50,
    'Target GMV Periode Double Date Rp 30.000.000, Paralel Request Sample', 'Aktivasi kreator makeup viral untuk produk lip tint & serum kosmetik Salsa', 'Banyak kreator request shade nomor yang sama sehingga terjadi ketimpangan stok', 'Atur distribusi varian shade secara merata ke seluruh kreator', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    35, 'Samara', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    300, 0, 300, 100,
    80000000, 50000000, 50,
    'Target GMV Gain Rp 50.000.000, 50 Sesi Live, Listing 10 Creator Influencer 100JT+', 'Kolaborasi kreator top untuk live shopping interaktif', 'Jam tayang live bersamaan dengan promo brand besar lainnya', 'Cari celah live di pagi hari (07.00-10.00) dan siang istirahat kerja', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    35, 'Samara', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    300, 0, 400, 100,
    105000000, 25000000, 50,
    'Hari Kesehatan Nasional & Gimmick Konsep, Target GMV Gain Rp 25.000.000', 'Konsep konten makeup aman ber-BPOM ramah kulit sehari-hari', 'Kreator kehabisan ide transisi visual', 'Bagikan sound template viral yang sedang trending di for you page', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    35, 'Samara', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    300, 0, 500, 100,
    167500000, 62500000, 100,
    'Payday Periode, GMV Gain Rp 62.500.000 (Total GMV Rp 615.000.000), 100 Sesi Live', 'Sprint menuju target akhir, push affiliate sales besar-besaran', 'Pesanan membludak di hari pertama gajian', 'Pastikan integrasi resi otomatis ke Partner Center tidak mengalami lag', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    35, 'Samara', 5, 'Week 5-8 (Desember)', 'Desember 2026', '2026-11-30', '2026-12-18',
    300, 0, 600, 100,
    750000000, 135000000, 100,
    'Closing 18 Desember, TARGET TOTAL GMV Rp 750.000.000 TERCAPAI PENUH!', 'Penutupan campaign Salsa Cosmetic dengan pencapaian 750 Juta GMV', 'Penyelesaian sisa payout komisi affiliator', 'Verifikasi status transfer komisi selesai tanpa ada dispute', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    36, 'Samara', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    341, 0, 200, 0,
    8000000, 8000000, 50,
    'Fulfill 50 Creator Live Streaming, Target GMV Rp 8.000.000, Paralel Request Sample', 'Perekrutan mom influencer dan kreator parenting', 'Kreator ibu-ibu memiliki jadwal yang sangat fleksibel karena mengurus anak', 'Beri ruang jadwal rekaman yang tidak kaku namun tetap terikat batas akhir', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    36, 'Samara', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    380, 39, 300, 100,
    16000000, 8000000, 50,
    '50 Sesi Live, Target GMV Rp 8.000.000, Double Date 11.11', 'Tema perawatan lembut kulit bayi bebas iritasi', 'Ketakutan orang tua terhadap bahan kimia', 'Tonjolkan uji klinis dermatologis dan keunggulan bahan alami di setiap konten', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    36, 'Samara', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    419, 39, 400, 100,
    24000000, 8000000, 50,
    'Mencapai 419 Creator Approved, 50 Sesi Live, Target GMV Rp 8.000.000', 'Konsistensi penayangan live sore hari saat anak sudah tidur', 'Kerap terjadi interupsi saat live streaming dengan anak', 'Jadikan momen natural tersebut sebagai nilai kedekatan emosional konten', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    36, 'Samara', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    419, 0, 500, 100,
    34000000, 10000000, 100,
    'Payday Periode, GMV Gain Rp 10.000.000 (Total GMV Rp 133.000.000), 100 Sesi Live', 'Bundling sabun & lotion bayi dengan diskon paket hemat keluarga', 'Kreator ingin mendapatkan sampel produk varian baru', 'Sediakan insentif sampel baru untuk kreator yang capai kuota penjualan', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    36, 'Samara', 5, 'Week 5-8 (Desember)', 'Desember 2026', '2026-11-30', '2026-12-18',
    419, 0, 600, 100,
    200000000, 67000000, 100,
    'Closing 18 Desember, TARGET TOTAL GMV Rp 200.000.000 TERCAPAI PENUH!', 'Closing campaign Salsa Mom & Baby per 18 Desember', 'Audit laporan final', 'Rekapitulasi pencapaian 419 kreator dan 200 Juta GMV selesai', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    46, 'Jerry / Samara', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    582, 0, 400, 0,
    347800000, 100000000, 50,
    'Focus Creator Activation for 11.11 Campaign, Target GMV Gain Rp 100.000.000 (Total Rp 347.800.000)', 'Penyebaran penawaran komisi tinggi untuk produk lulur dan pemutih badan SYB', 'Produk berat di ongkos kirim karena volume botol besar', 'Aktifkan voucher subsidi ongkos kirim dari program TikTok Partner', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    46, 'Jerry / Samara', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    600, 18, 500, 100,
    447800000, 100000000, 50,
    'Double Date Periode, Posting 100 VT, Target GMV Gain Rp 100.000.000 (Total Rp 447.800.000)', 'Lonjakan penjualan saat event flash sale 11.11', 'Keterlambatan pemenuhan order di gudang karena volume tinggi', 'Prioritaskan pengiriman paket yang masuk dalam 24 jam pertama', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    46, 'Jerry / Samara', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    650, 50, 600, 100,
    472800000, 25000000, 50,
    'Posting 100 VT, Target GMV Gain Rp 25.000.000 (Total Rp 472.800.000), Focus Recruitment Payday', 'Perekrutan affiliator baru untuk persiapan ledakan penjualan payday', 'Kreator pemula bingung cara mengemas review produk lulur', 'Berikan panduan visual: demo pemakaian sebelum dan setelah dibilas air', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    46, 'Jerry / Samara', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    700, 50, 700, 100,
    497800000, 25000000, 50,
    'Payday Activation, Target GMV Gain Rp 25.000.000 (Total Rp 497.800.000), 50 Sesi Live', 'Aktivasi 50 sesi live terpusat di hari puncak payday', 'Persaingan diskon di kategori body care', 'Tawarkan paket bundle 3 item hemat 30%', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    46, 'Jerry / Samara', 5, 'Week 5-9 (Desember)', 'Desember 2026', '2026-11-30', '2026-12-31',
    800, 100, 900, 200,
    1500000000, 1002200000, 100,
    'Promo Akhir Tahun Menuju TARGET TOTAL GMV Rp 1.500.000.000', 'Rangkaian promo Natal dan Tahun Baru untuk mencapai plafon 1.5 Miliar', 'Kapasitas ekspedisi menjelang libur natal', 'Batas checkout dipercepat H-3 sebelum libur nasional', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    48, 'Jerry / Samara', 1, 'Week 1 (4-6 Nov)', 'November 2026', '2026-11-04', '2026-11-06',
    158, 0, 50, 0,
    25000000, 25000000, 50,
    'Target GMV Gain Rp 25.000.000, Posting 100 VT, Focus Creator Activation 11.11', 'Aktivasi kreator pria, komunitas outdoor dan wewangian Kahf', 'Format video pria seringkali kaku dan kurang variatif', 'Arahkan ke konten POV bersiap-siap jalan (Get Ready With Me Men)', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    48, 'Jerry / Samara', 2, 'Week 2 (9-13 Nov)', 'November 2026', '2026-11-09', '2026-11-13',
    200, 42, 100, 50,
    50000000, 25000000, 50,
    'Posting 100 VT, Double Date 11.11, Focus Recruitment for Payday Activation', 'Tingkatkan keterlibatan kreator micro untuk mereview parfum Kahf Humbling Forest & True Brotherhood', 'Sampel varian parfum favorit cepat habis', 'Minta penambahan alokasi stok tester khusus affiliator dari brand', 'completed'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    48, 'Jerry / Samara', 3, 'Week 3 (16-20 Nov)', 'November 2026', '2026-11-16', '2026-11-20',
    250, 50, 150, 50,
    75000000, 25000000, 50,
    'Target 300 Creator Goal, 50 Sesi Live, Target GMV Gain Rp 25.000.000', 'Perluas jangkauan ke audiens pekerja kantoran muda', 'Harga Kahf di marketplace lain terkadang lebih murah dibanding etalase TikTok', 'Sertakan kupon eksklusif live stream agar harga paling bersaing', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    48, 'Jerry / Samara', 4, 'Week 4 (23-27 Nov)', 'November 2026', '2026-11-23', '2026-11-27',
    300, 50, 200, 50,
    100000000, 25000000, 50,
    'Payday Activation, Target GMV Gain Rp 25.000.000, Sesi Live 50', 'Eksploitasi belanja gajian untuk produk body wash & deodorant Kahf', 'Waktu tonton live malam hari lebih dominan', 'Fokuskan slot live streaming antara pukul 20.00 - 23.00 WIB', 'on_track'
);
INSERT INTO campaign_weekly_milestones (
    campaign_id, pic_name, week_number, week_label, month_label, start_date, end_date,
    target_creator, target_creator_delta, target_video, target_video_delta,
    target_gmv, target_gmv_delta, target_live_session,
    how_to_achieve, action_plan, kendala, problem_solving, status
) VALUES (
    48, 'Jerry / Samara', 5, 'Week 5-12 (Desember - Januari)', 'Desember 2026', '2026-11-30', '2027-01-22',
    300, 0, 600, 400,
    1200000000, 1100000000, 100,
    'Scale Up Akhir Tahun Menuju TARGET TOTAL GMV Rp 1.200.000.000', 'Kampanye berkelanjutan hingga 22 Januari untuk menembus target 1.2 Miliar', 'Libur akhir tahun kreator', 'Jadwalkan rekaman video cadangan sebelum memasuki pekan liburan', 'on_track'
);
