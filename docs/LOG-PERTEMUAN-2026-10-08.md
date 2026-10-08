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

## 3. Status Penyelesaian Implementasi (8 Okt 2026)
- Integrasi metrik performa (Items Sold, Revenue per Active Creator, Revenue per Video, Like ER, Conversion Rate, Sales-to-Likes Ratio).
- Leaderboard Top 10 Creator interaktif 4 pilar di Portal Brand dan Internal Dashboard.
- Winning Concept Showcase dengan link TikTok VT asli.
- Validasi build: npm run build sukses 100% tanpa error.

## 4. Penyelarasan Metrik Portal Brand vs Internal Dashboard (Pemisahan Livestream & Resolusi Alias Kreator)

- **Audit Discrepancy Metrik Campaign 41 (MS GLOW):**
  1. **Like Engagement Rate (409.92% vs 2.25%)**:
     - *Akar Masalah*: Di `portalActions.ts`, akumulasi `calcTotalViews` & `calcTotalLikes` dieksekusi untuk semua jenis konten termasuk livestream. Campaign 41 memiliki 1 sesi live dengan 5,2 juta likes, sehingga likes di portal melonjak ke 5.238.148 likes dan Like ER menjadi 409.92%. Sedangkan di internal, likes live tidak dimasukkan ke total likes awareness video (12.758 likes / 566K views = 2.25%).
     - *Solusi*: Akumulasi views dan likes video di `portalActions.ts` diisolasi hanya untuk konten non-livestream (`!isLive`).
  2. **Revenue per Active Creator (Rp 172.578 vs Rp 176.736 | 170 vs 166 kreator)**:
     - *Akar Masalah*: Di internal, alias kreator dipetakan lewat tabel `creator_aliases`. Di portal brand sebelumnya belum ada lookup alias, sehingga 4 alias username dihitung sebagai kreator terpisah (170 kreator vs 166 kreator di internal).
     - *Solusi*: Ditambahkan query `creator_aliases` di `portalActions.ts` dan pemetaan `aliasToPrimaryMap` pada data penjualan dan video organik.
  3. **Penyempurnaan Subtitle Card UI**:
     - Subtitle kartu "Revenue per Active Creator" di Portal Brand (`PortalDashboardClient.tsx`) dan Internal (`PerformaClient.tsx`) diubah menjadi *"Rata-rata performa omzet per kreator aktif"* (menghilangkan penyebutan eksplisit jumlah kreator yang sudah upload video).
- **Validasi Teknis**: `next build` lolos 100% dalam 10.2 detik tanpa error.

## 5. Standardisasi Kreator Aktif (Video & Live) & Penambahan di Pencapaian Target Creator

- **Latar Belakang & Realitas Operasional**:
  - Di lapangan, model kerja kreator terbagi menjadi tiga: kreator *video-only*, *live-only*, dan yang menjalankan *keduanya* (hybrid). Menghitung kreator aktif hanya dari yang upload video menyebabkan kreator live-only tidak diakui kontribusinya.
- **Implementasi**:
  1. **Perhitungan Revenue per Active Creator**:
     - Formula pembagi kini: kreator approved/alternate dengan `total_vt > 0 || total_live > 0`.
     - Diterapkan konsisten di `PerformaClient.tsx` dan `portalActions.ts`.
  2. **Card Pencapaian Target Creator**:
     - Ditambahkan informasi badge **`X Kreator Aktif (VT / Live)`** berdampingan dengan jumlah approved dan pending.
     - Diterapkan pada Internal Dashboard (`/campaigns/[id]/performa`) dan Brand Portal (`/portal/[id]/dashboard`).
- **Validasi Build**: `next build` selesai 100% dalam 6.9 detik tanpa error.
