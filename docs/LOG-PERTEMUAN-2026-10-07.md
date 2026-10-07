# Log Pertemuan & Audit Sistem — 7 Oktober 2026

> **Dokumen ini adalah sumber kebenaran (Source of Truth) untuk seluruh rangkaian kerja, audit performa, dan pembersihan data pada sesi 7 Oktober 2026.**
> Menjelaskan pemetaan file TikTok Partner Center, eksekusi reset data mentah, verifikasi integritas data internal vs portal brand, serta pembuktian akurasi data Live SYB.

---

## 1. Ringkasan Eksekutif & Keputusan Utama User

Pada sesi ini, user mengambil keputusan strategis terkait integritas dan kebersihan data TikTok Partner Center:
1. **Keputusan Reset Data Mentah:**
   Data mentah dari TikTok Partner Center (`sales` dan `organic_videos`) direset/dikosongkan total agar user dapat mengunggah ulang data yang bersih dan segar (*fresh start*) dari Januari hingga Oktober 2026.
2. **Perlindungan 100% Data PIC & Ads:**
   Tabel **`videos`** (31.179 baris slot link video kerjaan tim PIC) dan tabel **`ads_performance`** (1.130 baris data iklan VSA) **TIDAK BOLEH DISENTUH ATAU HILANG 1 BARIS PUN**.
3. **Backup Penuh Sebelum Eksekusi:**
   Seluruh data mentah sebelum dihapus diduplikasi ke tabel backup permanen di PostgreSQL: `_backup_sales_20261007` dan `_backup_organic_videos_20261007`.

---

## 2. Pemetaan File Excel vs Tabel Database

Berdasarkan arsitektur data sistem TNT (`OrganicImport.tsx`, `importActions.ts`, dan `KEPUTUSAN-ARSITEKTUR-DATA.md`):

| File Input | Menu & Tab UI | Tabel Tujuan di DB | Kolom Kunci & Logika Pemrosesan |
|---|---|---|---|
| `affiliate_orders_*.xlsx`<br>(Januari – Oktober) | **Input Penjualan** &rarr;<br>**Organik Sales** | **`sales`** | • `order_id` (Primary Key/Unique)<br>• `gmv` (Nilai omzet IDR)<br>• `is_refund` (Status retur)<br>• `product_id` (Kunci relasi ke katalog SKU campaign)<br>• `content_type` (`video` vs `livestream`)<br>• `content_uid` (Video ID atau Live Room ID) |
| `CustomReport_*_Video_*.xlsx`<br>(Januari – Oktober) | **Input Penjualan** &rarr;<br>**Awareness Video** | **`organic_videos`** | • `content_type = 'Video'`<br>• `content_uid` (Video ID 19-digit)<br>• `product_id` (SKU produk terkait)<br>• `video_views`, `video_likes`, `video_product_rpm` |
| `CustomReport_*_Live_*.xlsx`<br>(Januari – Oktober) | **Input Penjualan** &rarr;<br>**Awareness Live** | **`organic_videos`** | • `content_type = 'Livestream'`<br>• `content_uid` (Livestream Room ID)<br>• `product_id` (SKU produk terkait)<br>• `video_views` (Live views), `video_likes` (Live likes) |
| **Input Manual / Bulk Link PIC** | **Campaign > Video & VT** &rarr;<br>**+ Bulk Import Link** | **`videos`** | • `campaign_creator_id` (Relasi ke kreator campaign)<br>• `link_video`, `content_uid`<br>• `vt_approval` (`pending`, `approved`, `revisi`, `reject`)<br>• `added_by` (Nama/ID PIC internal) |

> **Catatan Arsitektur Penting:**
> Tabel `videos` (milik PIC) dan `organic_videos` (data raw TikTok) adalah **dua tabel terpisah**. Status **"Terkoneksi"** pada halaman Video adalah hasil pencocokan dinamis: jika `content_uid` di tabel `videos` memiliki views/likes/sales di `organic_videos`/`sales`, statusnya otomatis menjadi *Terkoneksi*.

---

## 3. Eksekusi Reset Data Raw TikTok (Script SQL 79)

Eksekusi dijalankan langsung pada database PostgreSQL produksi VPS Coolify menggunakan transaksi atomik (`BEGIN ... COMMIT`) berpengaman penuh:
* File script: `docs/sql/79-reset-raw-tiktok-data.sql`
* Commit Git: `4f69cd9`

### Hasil Audit Sebelum vs Sesudah Eksekusi:

| Nama Tabel | Sebelum Eksekusi | Sesudah Eksekusi | Status & Keterangan |
|---|---|---|---|
| **`sales`** | 34.869 baris | **0 baris** | 🗑️ Berhasil dikosongkan total |
| **`organic_videos`** | 62.881 baris | **0 baris** | 🗑️ Berhasil dikosongkan total |
| **`videos` (Kerjaan PIC)** | 31.179 baris | **31.179 baris** | 🛡️ **100% UTUH** (0 baris disentuh) |
| **`ads_performance` (Ads)** | 1.130 baris | **1.130 baris** | 🛡️ **100% UTUH** (0 baris disentuh) |
| **`campaign_creators`** | 9.876 baris | **9.876 baris** | 🛡️ **100% UTUH** (0 baris disentuh) |
| **`_backup_sales_20261007`** | 0 baris | **34.869 baris** | 💾 Backup internal tersimpan di Postgres |
| **`_backup_organic_videos_20261007`** | 0 baris | **62.881 baris** | 💾 Backup internal tersimpan di Postgres |

---

## 4. Hasil Audit Akurasi Menu Performa Internal (Campaign 46 SYB)

Sebelum data direset, seluruh angka di halaman internal `campaigns/46/performa` telah diaudit langsung ke katalog database:

1. **Akurasi Metrik Utama:**
   * **GMV Organik:** Rp 75.368.880 (dari 2.336 order non-refund).
   * **GMV Ads:** Rp 86.435.855,63 (dari data kumulatif ad tanggal terakhir per `ad_id`).
   * **Total Achievement (All):** Rp 161.804.735,63.
   * **Total Keseluruhan Views:** 1.597.236 (dari 496 video unik, sesi Live dipisah ketat).
   * **Pencapaian Target Creator:** 561 approved, 7 pending, 50 alternate.
   * **Pencapaian Target Video:** 496 video approved, 548 livestream.
2. **Uji Integritas Data:**
   * **0 Produk Bocor:** Seluruh pesanan dan konten yang terhitung 100% cocok dengan katalog SKU SYB.
   * **0 Kreator Unmapped:** Tidak ada penjualan dari kreator di luar listingan approved (`Unattributed GMV = Rp 0`).
   * **0 Duplikat Order ID se-DB:** Total 34.869 order = 34.869 ID unik.
   * **0 Duplikat Video ID SYB:** 506 slot video PIC di SYB memiliki ID unik.

---

## 5. Hasil Audit Akurasi Portal Brand Klien (`/portal/46/dashboard`)

Setelah user mulai mengunggah ulang data historis, audit dilakukan terhadap halaman Portal Brand SYB. Semua angka yang tampil di layar klien terbukti **100% identik dengan database nyata**:

* **GMV Organik:** Rp 56.201.371 (Tepat hingga satuan rupiah).
* **GMV Ads:** Rp 86.435.855,63.
* **Total Achievement:** Rp 142.637.226,63.
* **Total Item Sold:** 1.733 pcs (Identik dengan `sum(quantity)` di DB).
* **Top 5 Product by GMV:**
  1. Netto 130ml Glowing Peeling Gel: 1.063 pcs | Rp 30.530.725
  2. Glowing Peeling Gel: 493 pcs | Rp 17.615.517
  3. Red Jelly Serum: 71 pcs | Rp 2.928.466
  4. Body Toner: 35 pcs | Rp 1.956.207
  5. Body Toner Jumbo: 29 pcs | Rp 1.523.296
* **Performa Bulanan:**
  * Oktober 2026: Sales Rp 6.2M (`Rp 6.204.706`)
  * September 2026: Sales Rp 22.8M (`Rp 22.796.296`)
  * Agustus 2026: Sales Rp 13.2M (`Rp 13.203.016`) + Ads Rp 1.8M
  * Juli 2026: Sales Rp 7.0M (`Rp 6.986.098`) + Ads Rp 84.6M
  * Juni 2026: Sales Rp 5.6M (`Rp 5.584.595`)
  * Mei 2026: Sales Rp 1.4M (`Rp 1.426.660`)
* **Pencapaian Target Creator (611 approved):**
  Portal menghitung seluruh kreator yang sah diajukan ke brand = `approved` (561) + `alternate` (50) = **611 kreator**.

---

## 6. Logika Fitur Listing & Seleksi

### A. Checkbox Filter: `Sisa ber-Video (Belum Approved)`
* **Logika:** Memfilter kreator yang statusnya `cc.approval != 'approved'` (`pending`, `not_approved`, `alternate`), **TETAPI sudah memiliki video di sistem** (baik dari tabel `videos` PIC maupun terdeteksi dari TikTok `organic_videos` / `sales.content_uid`).
* **Fungsi:** Alat audit bagi tim PIC/Manager untuk segera meng-approve kreator yang videonya sudah tayang tapi statusnya belum di-approve.
* **Kondisi SYB:** Saat ini terdapat **14 kreator** yang terdeteksi memiliki video tapi belum berstatus approved (contoh: `@cici.cillin`, `@bungadinihari`, `@muiimuiis`, dll).

### B. Checkbox Filter: `Unattributed (Sisa + GMV)`
* **Logika:** Memfilter kreator yang statusnya `cc.approval != 'approved'`, **TETAPI sudah menghasilkan penjualan (GMV > 0)**.
* **Fungsi:** Menemukan kreator yang omzetnya "nyangkut" di kartu *Unattributed GMV (Gap)* agar bisa segera di-approve sehingga omzetnya masuk ke *Tracked GMV*.
* **Kondisi SYB:** Bernilai 0 (karena semua kreator penghasil sales di SYB sudah di-approve).

### C. Lencana Kuning `AUTO` pada Kreator
* **Logika:** Diberikan kepada baris `campaign_creators` di mana `added_by IS NULL` atau `tier = 'Auto-Detect'`.
* **Artinya:** Kreator tersebut masuk ke dalam campaign **secara otomatis oleh sistem** saat import laporan penjualan/awareness TikTok, bukan hasil input manual oleh PIC internal.
* **Status Sistem:** Fitur ini **sangat normal dan sehat**, membantu tim membedakan kreator hasil scouting PIC vs kreator afiliator luar yang ikut mempromosikan produk brand secara organik.

---

## 7. Pembuktian Khusus: Data Live SYB (8 April – 4 Oktober 2026)

User menguji file spesifik:
`SYB 8 Oktober - 4 Oktober 7643606629893670677_7631140567631972112 CustomReport_Campaign_Creator_Product_Shop_Live_Product Category 2026-04-08_2026-10-04.xlsx`

### Hasil Perbandingan Langsung Excel vs Database:
1. **Jumlah Sesi Live:**
   * Di file Excel: **847 Livestream Room ID unik** (dari 1.763 baris data multi-produk).
   * Di database sistem (SYB): **850 Livestream Room ID unik**.
   * **Hasil:** **847 dari 847 sesi live (100%)** yang ada di Excel tersebut **SUDAH LENGKAP ADA DI DATABASE (0 terlewat)**.
   * Selisih +3 sesi live di sistem (`7654925795814050580`, `7654947371742350087`, `7654983384434592532`) adalah sesi live sah tanggal 24 Juni 2026 dari file laporan bulanan lain di folder Downloads.
2. **Kecocokan Metrik Views & Likes:**
   * **846 dari 847 sesi live (99,9%)** memiliki angka Views dan Likes yang **100% IDENTIK PERSIS**.
   * Hanya 1 sesi live (`7654970616267868948`) yang di database memiliki views lebih tinggi (3.525 views vs 1 view di Excel ini) karena sistem memakai aturan `Math.max()` untuk mempertahankan angka tertinggi dari laporan bulanan lainnya.
3. **Pemisahan Tipe Konten:**
   * Angka **850 livestream** di kartu Performa murni berasal dari data `organic_videos` (Awareness Live), dan **sama sekali tidak tercampur** dengan data pesanan di tabel `sales`.

---

## 8. Status Deployment & Commit Git

Terdapat 2 commit penting di lokal yang merangkum seluruh pembaruan sistem sesi ini:
1. `41d3ef0`:
   * `OrganicImport.tsx`: Auto-detect format file dari header Excel (mencegah file Live tertukar dengan Video).
   * `importActions.ts`: Normalisasi nilai `content_type` menjadi `'Livestream'` dan `'Video'`.
   * `campaignPageActions.ts` & `VideoClient.tsx`: Penguatan validasi status approval dan kepemilikan.
2. `4f69cd9`:
---

## 9. Kebijakan Edit/Hapus Pengajuan Payment (Opsi A)

Berdasarkan diskusi dan keputusan owner terkait alur review pembayaran kreator:
* **Latar Belakang:** Di lapangan, jika ada kesalahan nominal, rekening, atau data kreator pada batch yang sudah diajukan ke Manager (`pending_manager`), Manager sering kali tidak menolak secara eksplisit di sistem ("didiemin di sistem"), melainkan langsung menegur/memerintahkan PIC secara verbal/WhatsApp untuk merevisi data.
* **Keputusan (Opsi A):**
  1. **PIC diizinkan mengedit atau menghapus item tagihan** saat batch berada di tahap diajukan / funnel pertama (`batch.status === 'pending_manager'`).
  2. **Penguncian Permanen (Lock):** Jika item tagihan **SUDAH disetujui oleh Manager** (`manager_status === 'approved'` atau `final_status === 'manager_approved'`), item tersebut **TERKUNCI PERMANEN** dan tidak dapat diubah maupun dihapus oleh PIC.
  3. **Proteksi Ganda (Server & Client):**
     * **UI (`BatchDetail.tsx`):** Tombol Edit (pensil) dan Hapus (tong sampah) hanya muncul jika `canEditItem(item)` bernilai true (belum disetujui Manager). Item yang sudah disetujui menampilkan ikon gembok `Terkunci`.
     * **Server Action (`paymentActions.ts`):** `updatePaymentItem` dan `deletePaymentItem` memvalidasi status batch dan item secara ketat di database. Jika item sudah berstatus disetujui atau batch telah melaju ke tahap Executive/Finance/Paid, request ditolak dengan pesan error yang jelas.


---

## 5. Solusi Multi-Handle Kreator (Pergantian Username TikTok) & Kasus Nyata `snhabibah`

### A. Masalah & Latar Belakang
* Tim operasional melaporkan ketidakcocokan data kreator: `@snhabibah10` dan `@snhabibah_` adalah kreator yang sama yang berganti username TikTok.
* Akibat pergantian handle ini:
  1. Di **Campaign 56 (Zeluxe)**: PIC meng-approve `@snhabibah10` (0 video), sementara 3 video terupload masuk di baris `@snhabibah_` yang statusnya `not_approved`. Dampaknya: 3 video tersebut tertahan di section *Sisa ber-Video (Belum Approved)* dan GMV-nya dianggap Unattributed.
  2. Di **Campaign 54 (MD Glow)**: Muncul 2 baris terpisah untuk satu kreator yang sama (`snhabibah10` dan `snhabibah_`), keduanya berstatus `approved`.
  3. Data cadangan manual Januari–Maret mencatat username lama, sedangkan data API/impor terbaru mencatat username baru.

### B. Solusi Arsitektur
1. **Tabel Master `creator_aliases`:**
   * Menyimpan mapping `creator_id` ke seluruh `alias_username` yang pernah dipakai (baik username aktif `is_primary = true` maupun username historis `is_primary = false`).
   * Unique constraint pada `LOWER(alias_username)`.
2. **Integritas Raw Data TikTok:**
   * Tabel `sales`, `organic_videos`, dan `live_sessions` **TIDAK diubah** demi menjaga integritas data audit trail TikTok asli.
3. **Penyatuan Logika di Frontend & Backend:**
   * `campaignPageActions.ts`: Mengambil relasi `creator_aliases` saat memuat data halaman performa.
   * `PerformaClient.tsx`: Memetakan seluruh alias ke username utama (`aliasToPrimaryMap`). Otomatis menyatukan sales, GMV, dan views video organik/live dari username lama ke baris kreator username baru.
   * `creatorActions.ts` (`fetchCreatorProfile`): Query performa kreator membaca semua varian alias melalui `WHERE LOWER(creator_username) IN (aliasList)`.
   * `databaseActions.ts` (`updateCreatorAction`): Jika PIC/admin mengedit username kreator di profil, sistem otomatis mencatat username lama ke tabel `creator_aliases` sebagai alias non-primary.
   * `/creator-pool/[id]`: Menampilkan username aktif di judul profil, disertai badge "Username Sebelumnya" untuk seluruh alias historis.

### C. Eksekusi Migration VPS & Pembersihan Data `snhabibah`
* Migration file: `20261008000000_create_creator_aliases_and_merge_snhabibah.sql` telah dijalankan di PostgreSQL VPS (`db_tnt_project_system`).
* **Hasil Penggabungan:**
  * ID master `12339` (`snhabibah_`) kini memiliki 3 alias terdaftar: `snhabibah_` (primary), `snhabibah10`, dan `snhabibah10_`.
  * Duplikat master kreator ID `21835` dan `22814` dihapus bersih.
  * Campaign 56 (Zeluxe): Baris duplikat kosong dihapus, status `snhabibah_` di-upgrade menjadi `approved`. 3 video (128 views) kini resmi terhitung ke kreator dan tidak lagi berstatus "Belum Approved".
  * Campaign 54 (MD Glow): Baris duplikat dihapus, menyisakan 1 baris resmi `snhabibah_` dengan 3 video.
  * Campaign 57 (GHANISKIN): Ditautkan secara benar ke master `12339`.

### D. Fitur UI: Manajemen Alias & Auto-Merge di Profil Kreator (`/creator-pool/[id]`)
* **Tombol "Kelola Alias":** Ditambahkan di header profil kreator, berdampingan dengan badge "Username Sebelumnya".
* **Modal Dialog Interaktif:**
  1. **Daftar Alias Aktif:** Menampilkan username master (badge `Utama (Aktif)`) dan seluruh alias historis lengkap dengan catatan.
  2. **Jadikan Utama (`setPrimaryCreatorAliasAction`):** Mengizinkan PIC mengubah username master TikTok tanpa kehilangan riwayat lama (username lama otomatis turun menjadi alias).
  3. **Hapus Alias (`removeCreatorAliasAction`):** Menghapus alias jika terjadi salah ketik (username utama diproteksi dari penghapusan).
  4. **Tambah Alias & Auto-Merge (`addCreatorAliasAction`):** Form input username baru/lama. Jika username tersebut sudah ada di sistem sebagai akun kreator tersendiri (misal hasil impor lama), sistem secara cerdas **menggabungkan (merge)** data `campaign_creators`, video, kontak, snapshot, dan penjualannya ke akun ini lalu menghapus akun master duplikatnya.
  5. **Perbaikan Client Render Crash:** Menambahkan memo `nonPrimaryAliases` yang aman dari null pointer (`?.filter().map()` sebelumnya rawan `TypeError: Cannot read properties of undefined (reading 'map')` jika `localData.aliases` undefined). Menambahkan juga file error boundary `web-app/src/app/creator-pool/[id]/error.tsx` untuk menangkap runtime exception dengan tampilan informatif.
  6. **Perbaikan React Error #310 ("Rendered more hooks than during the previous render"):** Memindahkan 4 hook `useState` modal alias (`aliasModalOpen`, `newAliasInput`, `newAliasNotes`, `aliasBusy`) ke bagian paling atas komponen sebelum early return `if (isLoading) return ...`. Sebelumnya hook tersebut dideklarasikan setelah baris return awal sehingga jumlah hook berubah saat render kedua selesai memuat data.

---

## 7. Peningkatan Fitur Keuangan: Auto-Save Local Storage Anti-Hilang & Master Legalitas Kreator

### A. Latar Belakang Masalah
1. **Risiko Kehilangan Data saat Input Batch Massal:**
   PIC sering kali memilih 50–100 kreator di tab *Kreator Belum Dibayar* lalu mengisi data administrasi (kontak WA, link KTP, link kontrak GDrive, rekening). Jika tab browser tidak sengaja ter-refresh atau tertutup, seluruh input yang sudah diisi hilang karena guard `initialItems` membypass sistem draft.
2. **Kebutuhan Relasional untuk Data Legalitas & PIC Dealing:**
   - Satu kreator dapat memiliki lebih dari satu kontak PIC/admin dealing, lebih dari satu KTP, beberapa rekening bank, dan berbagai riwayat kontrak di campaign berbeda.
   - Kontak WA PIC harus berupa satu kesatuan yang sinkron antara **Nama PIC** dan **Nomor WhatsApp Dealing**.
   - PIC membutuhkan dropdown untuk memilih data yang sudah pernah diisi sebelumnya, baik di form pengajuan batch maupun di profil kreator.

### B. Eksekusi Skema Database & Backfill (Migration `20261008010000`)
* File migration: `web-app/supabase/migrations/20261008010000_create_creator_admin_master_tables.sql`
* Dijalankan di PostgreSQL VPS Coolify (`db_tnt_project_system`).
* **Tabel Baru:**
  1. `creator_pic_contacts` (id, creator_id, nama_pic, nomor_wa, is_primary, created_at, UNIQUE(creator_id, nama_pic, nomor_wa))
  2. `creator_identities` (id, creator_id, nik, nama_ktp, alamat_ktp, link_ktp, is_primary, created_at, UNIQUE(creator_id, nik))
  3. `creator_contracts` (id, creator_id, campaign_id, judul_kontrak, link_kontrak, created_at)
* **Hasil Backfill Otomatis Data Historis:**
  - **154 baris** kontak PIC terisi dari master `creators` dan riwayat `payment_items`.
  - **401 baris** data identitas KTP terisi dari master `creators` dan riwayat `payment_items`.
  - **503 baris** dokumen kontrak GDrive terisi dari riwayat pengajuan `payment_items`.

### C. Implementasi Auto-Save Anti-Hilang (`BatchForm.tsx` & `page.tsx`)
1. **Auto-Save Kontinu ke Local Storage:**
   - Menyimpan seluruh field yang diisi (`batchLabel`, `selectedCreatorIds`, `forms` per creator ID, dan `operationalItems`) secara instan ke kunci `tnt_batch_draft_${campaignId}`.
   - Menghapus guard lama yang membypass penyimpanan saat batch dibuka via `initialItems`.
   - Draft otomatis terhapus hanya saat batch berhasil disubmit ke server (`localStorage.removeItem`).
2. **Deteksi & Notifikasi Draft di Halaman Keuangan:**
   - Tombol tab "Buat Pengajuan (Manual)" kini memiliki badge `Draft (X item)`.
   - Banner peringatan di atas daftar batch: *"Tersimpan draft pengajuan pembayaran yang belum disubmit (X item)"* lengkap dengan tombol **"Lanjutkan Pengisian"** dan **"Hapus"**.

### D. UI Dropdown Relasional di Form Pengajuan Batch (`BatchForm.tsx`)
1. **Dropdown Kontak WA PIC (Dealing):** Menampilkan opsi kontak tersimpan `Nama PIC - No WA (★ Utama)` atau `+ Tambah Kontak PIC Baru (Ketik Manual)`. Nilai otomatis sinkron antara Nama PIC dan No WA.
2. **Dropdown Identitas KTP:** Menampilkan opsi `NIK (Nama KTP) (★ Utama)` atau `+ Tambah KTP Baru (Ketik Manual)`. Otomatis mengisi NIK, Link KTP GDrive, dan Alamat KTP.
3. **Dropdown Saran Kontrak GDrive:** Memberikan rekomendasi link kontrak terdahulu kreator bersangkutan dengan tombol test klik langsung (`ExternalLink`) untuk membuka file GDrive di tab baru.
4. **Auto-Fetch Relasi Cerdas:** `useEffect` otomatis memuat data rekening, kontak PIC, KTP, dan kontrak untuk setiap kreator yang dipilih/dipulihkan dari local storage.

### E. Card "Data Legalitas & Administrasi" di Profil Kreator (`/creator-pool/[id]`)
* Menambahkan card interaktif di sidebar kiri profil kreator:
  - **Kontak WA PIC (Dealing):** Daftar nomor dealing + Dialog modal tambah kontak baru & tombol hapus.
  - **Identitas KTP:** Daftar KTP + NIK + Alamat + Link GDrive + Dialog modal tambah KTP & tombol hapus.
  - **Rekening Transfer Bank:** Daftar bank/e-wallet + No rekening + Nama pemilik + Dialog modal tambah rekening & tombol hapus.
  - **Dokumen Kontrak Kerjasama:** Daftar judul kontrak + label campaign + link GDrive + Dialog modal tambah kontrak & tombol hapus.
* Seluruh aksi terhubung langsung ke Server Actions di `creatorActions.ts` dan otomatis memperbarui tampilan tanpa reload halaman.
