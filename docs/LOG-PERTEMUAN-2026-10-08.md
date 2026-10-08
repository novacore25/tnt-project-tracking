# Log Pertemuan & Audit Sistem — 8 Oktober 2026

> **Dokumen ini adalah sumber kebenaran (Source of Truth) untuk seluruh rangkaian kerja, audit performa, perbaikan sinkronisasi TikTok API, pembersihan data mentah, serta auto-generate video organik pada sesi 8 Oktober 2026.**

---

## 1. Ringkasan Eksekutif & Kejadian Penting Sesi Ini

1. **Auto-Sync TikTok API & Isolasi Data Staging:**
   - Masalah: Sinkronisasi otomatis TikTok API sempat memasukkan data dengan duplikasi dan penempatan field yang kurang tepat.
   - Solusi: Menambahkan staging table `tiktok_sync_staging` (`20261008030000_create_tiktok_sync_staging.sql`) untuk menampung data sebelum di-commit ke tabel utama, menyediakan modal review di Input Penjualan, serta mem-pause auto-sync sementara atas instruksi user.
2. **Validasi Keras Impor Spreadsheet Penjualan:**
   - Ditemukan baris data tanpa username kreator atau pesanan summary/total di file TikTok Partner Center.
   - Perbaikan: Filter verifikasi ketat pada `OrganicImport.tsx`. Baris tanpa username di-skip secara aman dengan peringatan pratinjau yang transparan, mencegah data tanpa identitas masuk ke performa kreator.
3. **Auto-Generate Video Organik & Sinkronisasi Total VT (`75dae60`):**
   - Kasus: Kreator `@kokmurah_yah` di Campaign Nutriflakes (ID: 49) memiliki data views (305) dan likes (3) di laporan organik TikTok, tetapi menu Video Campaign menampilkan 0 link video dan halaman Creator Pool menampilkan "Belum ada video/VT diunggah".
   - Akar Masalah:
     - Tabel `videos` hanya memuat inputan manual PIC. Jika belum diinput manual, video organik tidak tampil di tab Video.
     - Di `creator-pool/[id]/page.tsx`, perhitungan `totalVtCount` dan list `combinedVideos` hanya mengecek `campaignSales`, sehingga video awareness murni (GMV Rp 0) terabaikan.
     - Di `creator-pool/[id]/page.tsx`, pengelompokan `groupedVideos` mengalihkan video awareness ke grup `'lainnya'` karena ketiadaan relasi sales.
   - Solusi Diterapkan:
     - `videoActions.ts` (`getInternalVideoData`): Otomatis men-generate entri video `auto_${uid}` untuk video dari `organic_videos` dan `sales` yang belum terdaftar di `videos`.
     - URL video TikTok dibuat resmi: `https://www.tiktok.com/@username/video/${content_uid}`.
     - Livestream disaring ketat (`content_type NOT IN ('live', 'livestream')`) dan snowflake UID dipakai untuk fallback tanggal upload.
     - `campaignPageActions.ts` (`fetchSalesByCreatorUsernamesAction`) & `listing/page.tsx`: Pencarian video mencakup `sales` dan `organic_videos` dengan perbandingan username case-insensitive & kebal simbol `@`.
     - `creator-pool/[id]/page.tsx`: `totalVtCount`, `combinedVideos`, dan metrik views kini mengikutsertakan laporan organik non-live.

---

## 2. Rencana Pengembangan Lanjutan: Metrik Lengkap & Winning Concept

Atas arahan user untuk kebutuhan presentasi klien:
1. **Performance Metrics Tambahan**:
   - Menambahkan kartu & ringkasan: **Views (grafik tren)**, **Average Views/GMV**, **CTR**, **CTOR**, dan **ER (Engagement Rate)**.
2. **Top Creator Performance**:
   - Menambahkan kolom **Item Sold** (pcs terjual) untuk setiap kreator.
   - Menghadirkan widget **Top 10 Creator** berdasarkan 4 pilar: GMV, Views, ER, dan Items Sold/CTR.
3. **Winning Concept Performance**:
   - Menghubungkan master konsep brief (`campaign_concepts`) dengan performa riil video (`videos`, `sales`, `organic_videos`).
   - Menampilkan total produk terjual, GMV, Views, ER, dan tautan link TikTok VT relevan untuk setiap winning concept.
4. Rencana kerja lengkap telah didokumentasikan di `rencana_penambahan_metrik_performa_dan_winning_concept.md`.
