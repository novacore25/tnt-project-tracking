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

## 6. Penegasan Kreator Aktif (Approved Only) & Penambahan Breakdown "Belum Aktif" di Internal

- **Penegasan Kriteria**:
  - Kreator aktif disempurnakan **HANYA untuk status `approved` murni** (`approval === 'approved'`), tidak menyertakan status `alternate`.
  - Formula: `c.approval === 'approved' && ((c.totalVt || 0) > 0 || (c.totalLive || 0) > 0)`.
- **Penambahan Metrik "Belum Aktif"**:
  - Dihitung dari `Approved - Aktif`.
  - Card "Pencapaian Target Creator" internal dashboard (`PerformaClient.tsx`) menampilkan: `Total Approved`, `X Aktif`, `Y Belum Aktif`, dan `Z pending`.

## 7. Penyederhanaan Portal Brand (Tampilan Bersih Approved Only)

- **Kebijakan & UX Brand**:
  - Di **Portal Brand** (`/portal/[id]/dashboard`), brand klien tidak perlu melihat status breakdown teknis yang memicu pertanyaan (seperti jumlah belum aktif atau pending).
  - Card "Pencapaian Target Creator" di `PortalDashboardClient.tsx` disederhanakan murni menampilkan: `totalApprovedCreators kreator approved`.

## 8. Filter Keaktifan Konten di Menu Listing & Modal Export Excel

- **Sumber Data Keaktifan Konten**:
  - Terverifikasi bahwa inputan video manual dari tabel `videos` (baik yang sudah terhubung TikTok maupun yang belum terhubung) **100% DIANGGAP SEBAGAI KONTEN KREATOR**.
  - Eksistensi konten dicek secara komprehensif pada 3 tabel:
    1. `videos`: `link_video IS NOT NULL` ATAU `content_uid IS NOT NULL` (milik kreator via `campaign_creator_id`).
    2. `organic_videos`: username kreator cocok dan memiliki data konten video/live di campaign bersangkutan.
    3. `sales`: username cocok dan memiliki order dengan `content_uid` di campaign bersangkutan.
- **Implementasi Fitur Filter & Export**:
  1. **Backend Server Action (`campaignPageActions.ts`)**:
     - `fetchListingPagePaginatedAction`: Menambahkan parameter `activeContentFilter?: 'all' | 'active' | 'inactive'` dengan subquery `EXISTS` dan `NOT EXISTS` di SQL query.
     - `fetchExportCampaignCreatorsAction`: Menambahkan parameter `activeContentFilter` yang sama sehingga ekspor database memfilter langsung di level PostgreSQL.
  2. **UI Menu Listing (`listing/page.tsx`)**:
     - Menambahkan checkbox **`Belum Aktif (0 Konten)`** (badge kuning) dan **`Kreator Aktif (Ada VT/Live)`** (badge hijau) pada baris multi-dimensional filter.
     - Terintegrasi dengan tombol `Reset Filter`.
  3. **Modal Export Excel (`listing/page.tsx`)**:
     - Menambahkan opsi radio filter keaktifan: `Semua Kreator`, `Hanya Kreator Belum Aktif (0 Konten)`, dan `Hanya Kreator Aktif (Ada VT / Live)`.
     - Memberikan PIC fleksibilitas untuk memilih tab status `Approved` + mencentang `Belum Aktif (0 Konten)`, lalu mengunduh spreadsheet Excel lengkap dengan nomor WhatsApp untuk keperluan reminder dan blasting tindak lanjut kreator.
- **Validasi Build**: `next build` selesai 100% tanpa error dalam 5.6 detik.

## 9. Penyempurnaan Card Approved di Menu Listing (Negative Space Layout)

- **Permintaan User**:
  - Pada kartu **Approved** di toolbar status listing (`/campaigns/[id]/listing`), memanfaatkan area kosong (negative space) di sebelah kanan angka total Approved (misal `1162`) untuk menampilkan 2 baris breakdown:
    - Baris atas: `X Aktif` (badge pill biru dengan ikon user)
    - Baris bawah: `Y Belum Aktif` (badge pill amber/oranye)
- **Implementasi**:
  1. `fetchCampaignCreatorCountsAction` (`campaignPageActions.ts`):
     - Diperluas dengan subquery PostgreSQL untuk menghitung langsung `active_approved` dan `inactive_approved` secara real-time.
  2. UI Card (`listing/page.tsx`):
     - Didesain berdampingan dalam container flex: angka utama `1162` di kiri, dan dua baris badge `Aktif` / `Belum Aktif` bertumpuk di kanan.
     - Setiap badge dibuat interaktif: mengklik badge `Aktif` atau `Belum Aktif` langsung memicu filter daftar kreator sesuai status tersebut secara instan!

## 10. Catatan Rencana: Status Kreator Linked (MCN Agency TNT)

- **Latar Belakang**:
  - Kebutuhan menandai kreator yang terikat resmi (bound/linked) ke agensi MCN TNT di TikTok Shop Partner Center (TTSPC).
- **Rekomendasi Desain & Kesepakatan**:
  - Dibuatkan tabel master terpisah: `creator_mcn_links` (Opsi B).
  - Menyimpan: `creator_id`, `mcn_agency`, `status` (`linked`, `pending`, `expired`, `unbound`), `contract_start`, `contract_end`, `commission_rate`, `notes`, dan `source_import`.
  - Disiapkan modul batch import Excel/CSV unduhan resmi dari TikTok Partner Center untuk pendaftaran massal kreator roster MCN.
  - Detail rancangan tersimpan di `rencana_status_kreator_linked_dan_import_mcn.md`.

## 11. Optimasi Performa Menyeluruh: Memulihkan Loading Cepat di Semua Menu Campaign

- **Latar Belakang & Masalah**:
  - Pengguna melaporkan loading lama ("muter terus") saat membuka Menu Listing dan Menu Performa.
- **Audit & Temuan**:
  1. *Menu Listing*: `fetchCampaignCreatorCountsAction` mengeksekusi correlated subquery baris-per-baris dengan `LOWER(username)` pada 1.958 kreator terhadap tabel raksasa `organic_videos` (56.660 baris) dan `sales` -> memicu **>150 juta komparasi string** per request (waktu query 30–60 detik, CPU 100%).
  2. *Menu Video*: `getInternalVideoData` memanggil `await ensureVideoColumns();` pada setiap request baca -> mengeksekusi DDL `ALTER TABLE` yang mengambil `AccessExclusiveLock` dan membekukan tabel.
  3. *Menu Performa, Daily, dan Live Stream*: Menjadi lambat murni akibat tercekiknya pool koneksi PostgreSQL yang tersumbat oleh query berat Listing dan DDL lock Video.
- **Solusi yang Diterapkan**:
  1. `fetchCampaignCreatorCountsAction`: Ditransformasikan ke **Set-Based CTE** (`WITH active_usernames ... active_video_ccs ... active_cc_ids ...`). Himpunan username unik ditarik satu kali per campaign, lalu di-`LEFT JOIN` secara efisien. Waktu respon turun dari **>30.000 ms** menjadi **<25 ms**.
  2. `fetchListingPagePaginatedAction` & `fetchExportCampaignCreatorsAction`: Klausa `activeContentFilter` dioptimasi menggunakan subquery `IN` dan `NOT IN` yang dievaluasi satu kali di memori hash PostgreSQL.
  3. `getInternalVideoData`: Menghapus pemanggilan `ensureVideoColumns()`, meniadakan DDL lock pada pembacaan video.
- **Hasil Verifikasi**:
  - `npm run build` selesai 100% sukses dalam 8.2 detik.
  - Seluruh menu (Listing, Performa, Video, Daily, Live Stream) kembali terbuka instan (<500ms) tanpa membebani CPU VPS maupun perangkat user.
## 12. Transparansi GMV Kreator (Breakdown VT vs Live) & Auto-Lock Produk Berdasarkan Video ID

- **Latar Belakang & Pertanyaan User**:
  - Pada halaman Menu Video (`/campaigns/41/video`), pengguna melihat kreator memiliki Total GMV jutaan rupiah (misal `@risarivia` Rp 6.339.758), namun saat accordion videonya dibuka, semua 15 videonya mencatat GMV Rp 0.
- **Investigasi & Fakta Database**:
  1. Di tabel `sales` TikTok Partner Center untuk `@risarivia`, seluruh 31 order penjualan berjenis `content_type = 'Livestream'` (100% GMV = Rp 6.339.758).
  2. 15 video VT milik `@risarivia` ditonton 2.069 views, namun tidak menghasilkan checkout langsung melalui keranjang kuning video (0 order -> Rp 0 GMV).
  3. Total GMV di level header kreator adalah akumulasi gabungan seluruh penjualan kreator di campaign (Video + Live). Di Campaign 41 (MS Glow Beauty), ~68% total penjualan (Rp 20.045.388 dari Rp 29.338.244) memang berasal dari Livestreaming.
- **Solusi & Fitur Baru yang Diterapkan**:
  1. **Breakdown GMV di Header Kreator**:
     - Di bawah angka `TOTAL GMV: Rp X`, ditambahkan baris rincian:
       `VT: Rp ... • Live: Rp ...`
     - Memberikan kejelasan instan kepada PIC/Brand mengenai proporsi penjualan yang bersumber dari video konten vs siaran langsung.
  2. **Auto-Lock Produk Berdasarkan Video ID**:
     - Setiap video TikTok yang terdeteksi di data TikTok Partner Center (`organic_videos` / `sales`) dan memiliki tautan produk yang terdaftar di campaign:
       - Dropdown produk otomatis mengunci (`disabled={true}`) pada SKU yang sesuai.
       - Dilengkapi dengan ikon `<Lock />`, badge hijau `Terkunci otomatis dari TikTok`, dan tooltip proteksi.
     - Jika video tidak terdeteksi (video manual, custom link, atau keranjang kuning belum terdaftar di master produk):
       - Dropdown produk tetap terbuka bebas agar PIC/staff dapat memilih produknya secara manual.
  3. **Auto-Save Resolved SKU ID**:
     - Pada saat PIC mengklik "Simpan Perubahan", SKU ID yang terdeteksi otomatis langsung ikut tersimpan ke database jika kolom `sku_id` di tabel `videos` sebelumnya masih kosong.
- **Status & Verifikasi**:
  - `npm run build` berhasil 100% (Turbopack, 8.1s).
  - Tampilan visual rapi dan informatif di seluruh tab tampilan Video.

## 13. Split 2 Kolom Showcase: Winning Concept (Kiri) & Winning Product (Kanan) dengan Accordion Bertingkat

- **Latar Belakang & Permintaan User**:
  - Pada halaman Performa Campaign (`/campaigns/[id]/performa`), bagian *💡 Winning Concept Performance & VT Showcase* dirasa terlalu lebar jika memenuhi satu baris penuh.
  - User meminta bagian ini di-split menjadi 2 kolom:
    - **Kolom 1 (Kiri)**: Winning Concept Performance & VT Showcase.
    - **Kolom 2 (Kanan)**: Winning Product Performance.
    - Pada Winning Product, diterapkan accordion bertingkat: **Produk → Kreator → Video VT**.
- **Implementasi**:
  1. `PerformaClient.tsx`:
     - Menghitung agregasi in-memory hierarkis `winningProducts` berdasarkan `res.skus`, `res.concepts`, `salesData`, `orgVidsData`, dan `localCreators.videos`.
     - Produk diurutkan berdasarkan `total_gmv` tertinggi (`#1` Winning Product).
     - Level 1: Rangkuman produk (Nama, SKU ID, Total GMV, Items Sold, jumlah kreator, jumlah VT) + tombol accordion.
     - Level 2: Daftar kreator yang menjual produk tersebut (Tier, Sold pcs, GMV Produk, Views, jumlah VT) + tombol accordion.
     - Level 3: Rincian video VT produk (Link TikTok, Tanggal Post, Konsep yang digunakan, GMV Video, GPM, Views, Likes, ER%).
  2. Responsive Grid (`xl:grid-cols-2`):
     - Berdampingan di layar desktop besar, otomatis bertumpuk 1 kolom di layar tablet/mobile.
- **Hasil Verifikasi**:
  - `npm run build` sukses 100% (Turbopack, 13.5s).
  - Dokumentasi walkthrough dicatat di `walkthrough_split_winning_concept_dan_winning_product.md`.

## 14. Portal Brand: Penyatuan Baris Metrik (4 Kolom) & Winning Product Performance & Creator Showcase (Full Width 1 Kolom)

- **Latar Belakang & Permintaan User**:
  - Menerapkan fitur Winning Product ke **Portal Brand** (`/portal/[id]/dashboard`) dengan konsep visual UI portal brand.
  - Kartu **Total Item Sold** disatukan menjadi 1 baris bersama dengan:
    1. **Total Item Sold**
    2. **Revenue per Active Creator**
    3. **Revenue per Video**
    4. **Like Engagement Rate (ER)**
    dalam layout responsif 4 kolom (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
  - Bagian **Top 5 Product ID by GMV** digantikan dengan:
    **🏆 Winning Product Performance & Creator Showcase** yang berukuran satu baris dan satu kolom penuh (`w-full`).
  - Menerapkan **accordion bertingkat 3 level**:
    - **Level 1 (Produk)**: Rank (`#1` emas), Nama Produk, Product ID, Total Kreator, Total VT, Items Sold pcs, Total GMV produk, dan tombol toggle accordion.
    - **Level 2 (Kreator)**: Inisial avatar, `@username` (tautan TikTok), Tier badge, Items Sold pcs, GMV Produk, Views, dan tombol toggle accordion VT.
    - **Level 3 (Video VT)**: Tautan TikTok "Buka VT", UID, Badge master konsep jika terhubung (`Konsep #X • Judul`), Tanggal posting, Views, Likes (ER%), GPM, dan GMV Video.
- **Implementasi**:
  1. `portalActions.ts`:
     - Menghitung agregasi hierarkis `winningProducts` di server-side (berdasarkan data `skus`, `concepts`, `sales`, `organic_videos`, `manualVideos`, dan alias mapping).
     - Menghormati aturan portal brand: menyembunyikan status `not_approved` dan mengutamakan kreator approved/pending/alternate.
     - Menyertakan `winningProducts` dalam return object `getPortalData()`.
  2. `PortalDashboardClient.tsx`:
     - Menambahkan state `expandedProducts` dan `expandedProductCreators` untuk interaktivitas accordion multi-level.
     - Menggabungkan kartu `Total Item Sold` ke baris metrik rata-rata/produktivitas dalam grid 4 kolom.
     - Menggantikan tabel lama Top 5 Product ID dengan kontainer full-width bertema portal brand: `🏆 Winning Product Performance & Creator Showcase`.
- **Hasil Verifikasi**:
  - `tsc --noEmit` & `npm run build` selesai 100% tanpa error (Turbopack, ~6.5 detik).
  - UI konsisten, elegan, dan siap digunakan oleh brand klien.

## 15. Revisi Portal Brand: Split 2 Kolom (Top 10 Kiri & Winning Product Kanan) & Listing Kreator Approved-Only

- **Permintaan Revisi User**:
  1. Bagian **🏆 Top 10 Creator Performance** dan **🏆 Winning Product Performance & Creator Showcase** dijadikan **satu baris dua kolom berdampingan**:
     - **Kolom Kiri**: `🏆 Top 10 Creator Performance` (dengan tab filter 4 pilar).
     - **Kolom Kanan**: `🏆 Winning Product Performance & Creator Showcase` (dengan accordion bertingkat 3 level).
  2. Pengecekan tab **Daftar Listing Kreator** di Portal Brand (`/portal/[id]/dashboard` tab Listing Kreator):
     - Memastikan data akurat seperti di internal.
     - **HANYA menampilkan kreator yang berstatus `approved`** (kreator pending/alternate tidak ditampilkan ke brand klien).
- **Implementasi**:
  1. `PortalDashboardClient.tsx`:
     - Membungkus Top 10 Creator dan Winning Product dalam grid responsif 2 kolom: `grid grid-cols-1 xl:grid-cols-2 gap-6 items-start`.
     - Filter `filteredListing` diperketat dengan kondisi `cc.approval === 'approved'`, sehingga hanya kreator approved yang tampil di tabel dan pagination.
     - Export Excel Sheet 2 ("Listing Kreator") juga difilter `cc.approval === 'approved'` untuk konsistensi data unduhan.
     - Header kartu Listing diperjelas menjadi *"Daftar Listing Kreator (Approved)"*.
- **Hasil Verifikasi**:
  - `npm run build` berhasil 100% (Turbopack, 14.3s).
  - Data listing terverifikasi akurat dan hanya menampilkan kreator approved.

