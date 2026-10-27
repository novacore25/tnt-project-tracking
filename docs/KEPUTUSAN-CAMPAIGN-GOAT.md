# KEPUTUSAN-CAMPAIGN-GOAT.md — Arsip Multi-Entity "Company Lain" (Eks-GOAT)

> **Dokumentasi resmi hasil audit, forensic parsing 25 spreadsheet, isolasi multi-entity database, dan SOP rollback.**  
> Tanggal audit & implementasi: 27 Oktober 2026

---

## 1. Latar Belakang & Prinsip Utama

Owner TNT sebelumnya memiliki riwayat campaign dari perusahaan terdahulu (**GOAT**). Sistem Project Tracking System TNT difungsikan untuk mengarsipkan seluruh riwayat performa, campaign, kreator, video, dan ads dari masa lalu tersebut agar tersimpan rapi, permanen, dan dapat diakses untuk portofolio tanpa mencemari metrik operasional TNT.

### Prinsip Utama (Guard & Isolasi):
1. **Khusus Role `executive`:** Switcher entitas `[ TNT | Company Lain ]` di sidebar serta seluruh data arsip **hanya boleh tampil dan diakses oleh akun dengan role `executive`**. Role `admin`, `manager`, `finance`, `leader`, `creator` terkunci 100% pada TNT baik di antarmuka UI maupun Server Actions (`storeActions.ts`, `ads-report/actions.ts`).
2. **Tanpa Nama "GOAT" di Antarmuka:** Sesuai arahan owner, tidak boleh ada penamaan "GOAT" atau "x GOAT" pada antarmuka sistem. Switcher dinamai netral **`Company Lain`** dan seluruh campaign menggunakan penomoran netral (contoh: `Wardah 1`, `Wardah 2`, `OMG 2`, `BDL`, `Ellips`, dst).
3. **Kesesuaian Tampilan Dashboard:** Tampilan sub-menu campaign dibuat sama persis dengan sistem TNT (`/performa`, `/listing`, `/video`, `/ads-report`) dan terhubung langsung ke database.
4. **Video Berbasis Link Publik:** Video disimpan langsung menggunakan link TikTok publik asli tanpa memerlukan deteksi scraping `product_id` atau `content_uid` Partner Center.
5. **Mekanisme Rollback Bersih & Terisolasi:** Disediakan tombol satu-klik "Rollback Data Company Lain" di header campaign (khusus role `executive`) dan script SQL rollback berbasis `DELETE FROM campaigns WHERE company = 'OTHER'`. Seluruh relasi (`campaign_creators`, `videos`, `sales`, `ads_performance`) terhapus secara `CASCADE` otomatis tanpa menyentuh data TNT sedikit pun.

---

## 2. Temuan Audit: Analisis Duplikasi & Hubungan Antar-Sheet / Antar-File

Hasil analisis forensik terhadap 25 file di folder `C:\Users\Banzilla\Downloads\campaign goat\` dan 5 file di `C:\Users\Banzilla\Downloads\` menghasilkan aturan penanganan tumpang tindih (*overlap*) sebagai berikut:

### 2.1 Hubungan Antar-File (Cross-File)
- **`Wardah 4 (Downloads)` vs `Wardah 4 (campaign goat)`:** 100% data kreator & link video identik (MD5 beda metadata). Diambil satu kali sebagai `Wardah 4 (Glasting Lip Matte)`.
- **`Rose All Day (Internal)` vs `Rose All Day (External)`:** 103 link video identik. File External menyimpan data report VT & sales final, file Internal menyimpan database kerja harian dan spend ads. Digabungkan menjadi 1 campaign: `Rose All Day`.
- **`LIGHT+ (External)` vs `Light+ x GOAT Agency`:** File Agency berisi 995 baris katalog master SKU/produk, sedangkan file External berisi data kreator & video. Digabungkan menjadi 1 campaign: `Light+`.
- **Silsilah Wardah:** 0 overlap video antar 4 file. Diakomodasi sebagai 4 campaign berurutan: `Wardah 1`, `Wardah 2`, `Wardah 3 (Cushion & Dew Tint)`, dan `Wardah 4 (Glasting Lip Matte)`.
- **Silsilah OMG:** 0 overlap video. Diakomodasi sebagai 2 campaign: `OMG 2` dan `OMG 3`.
- **BDL Skincare:** Brand independen baru dengan 110 kreator dan 250 VT. Dimasukkan sebagai `BDL`.
- **`Mooi x JARInhouse` vs `Mooi 2`:** 0 video overlap. `Mooi JAR Inhouse` merupakan talent pool awal (53 talent), sedangkan `Mooi 2` adalah campaign eksekusi aktif (824 video).

### 2.2 Duplikasi Antar-Sheet dalam 1 File (Intra-File Overlap)
- **SALSA 2 (`SALSA 2 (External).xlsx`):** Sheet `R` (draft interim) vs `Report Campaign` (final) overlap 86% kreator dan 154 video. **Gunakan `Report Campaign`** sebagai kebenaran final.
- **PWS 2 (`PWS 2 (External) GOAT.xlsx`):** Sheet `Report` (interim) vs `Report Campaign` (final) overlap 93% kreator. **Gunakan `Report Campaign`**. GMV Max ads diambil dari sheet `'GMV MAX '` (Rp 380.233.440).
- **DLF (`DLF X GOAT MANAGEMENT (EXTERNAL).xlsx`):** Sheet `R` vs `Report Campaign` overlap 71%. Gunakan `Report Campaign` dan deduplikasi video via `DISTINCT link_video`.
- **PrettyMe (`PRETTYME X GOAT MANAGEMENT.xlsx`):** Terdiri dari 2 sheet dengan 0% overlap: `Exposure Creator List` (awareness) dan `Report Campaign Sale 2` (sales). Dipecah menjadi 2 campaign: `PrettyMe 1 (Exposure)` dan `PrettyMe 2 (Sale)`.
- **Deto Life (`GOAT X DETO LIFE (External).xlsx`):** Terdiri dari 5 sheet produk: `Detobets`, `Gerd Zero`, `Diabetolac`, `Warung Herba`, dan `Stevia`. Digabungkan dalam payung campaign `Deto Life`.

### 2.3 Pencegahan Kesalahan Konversi Data (Nomor HP & Satuan Kalodata)
1. **Nomor HP Indonesia vs GMV:** Pada `Animate (Internal).xlsx`, sheet `List Creator` memiliki pergeseran kolom di mana nomor HP (`0812...`, `0856...`) berpotensi terbaca sebagai nilai GMV Rp 85 Miliar. Dipasang filter regex ketat untuk mendeteksi digit 10–13 yang diawali `8` atau `628` agar tidak pernah terkonversi menjadi nominal rupiah.
2. **Satuan Kalodata (`m` vs `b`):** Huruf `m` pada metrik TikTok/Kalodata berarti **Million** ($10^6$ / Juta), sedangkan `b` berarti **Billion** ($10^9$ / Miliar), dan `k` berarti **Thousand** ($10^3$ / Ribu).

---

## 3. Matriks Rekapitulasi Lengkap 27 Campaign Company Lain (Terverifikasi di Database)

Berikut adalah data riil yang telah terverifikasi di PostgreSQL VPS (`db_tnt_project_system`) melalui view `vw_campaign_summary` dengan filter `company = 'OTHER'`:

| ID | Nama Campaign | GMV Organik | GMV Ads | GMV Live | Total Video | Total Creator | Total GMV |
|:--:|---|---:|---:|---:|:---:|:---:|---:|
| 281 | **Animate** | Rp 2.426.310.000 | Rp 0 | Rp 2.426.310.000 | 197 | 281 | **Rp 2.426.310.000** |
| 260 | **OMG 2** | Rp 79.724.057 | Rp 1.217.839.520 | Rp 0 | 298 | 155 | **Rp 1.297.563.577** |
| 265 | **Wardah 4 (Glasting Lip Matte)** | Rp 517.377 | Rp 624.550.720 | Rp 0 | 127 | 86 | **Rp 625.068.097** |
| 263 | **Wardah 2** | Rp 4.238.135 | Rp 610.705.440 | Rp 0 | 93 | 99 | **Rp 614.943.575** |
| 266 | **BDL** | Rp 393.401.644 | Rp 214.596.480 | Rp 0 | 250 | 109 | **Rp 607.998.124** |
| 264 | **Wardah 3 (Cushion & Dew Tint)** | Rp 2.891.050 | Rp 603.503.840 | Rp 0 | 544 | 145 | **Rp 606.394.890** |
| 269 | **PWS 2** | Rp 132.392.153 | Rp 380.233.440 | Rp 0 | 274 | 274 | **Rp 512.625.593** |
| 268 | **SALSA 2** | Rp 154.346.978 | Rp 202.015.360 | Rp 0 | 362 | 286 | **Rp 356.362.338** |
| 262 | **Wardah 1** | Rp 336.872.439 | Rp 0 | Rp 0 | 107 | 88 | **Rp 336.872.439** |
| 261 | **OMG 3** | Rp 10.690.668 | Rp 304.699.680 | Rp 0 | 558 | 245 | **Rp 315.390.348** |
| 270 | **Rose All Day** | Rp 9.710.748 | Rp 234.504.800 | Rp 0 | 187 | 222 | **Rp 244.215.548** |
| 272 | **Lea Gloria** | Rp 34.793.504 | Rp 103.284.000 | Rp 0 | 239 | 171 | **Rp 138.077.504** |
| 271 | **DLF** | Rp 95.760.000 | Rp 21.631.200 | Rp 0 | 259 | 223 | **Rp 117.391.200** |
| 273 | **Skin Game** | Rp 8.811.142 | Rp 52.210.560 | Rp 0 | 108 | 97 | **Rp 61.021.702** |
| 274 | **Mooi 2** | Rp 27.805.409 | Rp 13.352.000 | Rp 0 | 824 | 293 | **Rp 41.157.409** |
| 276 | **Deto Life** | Rp 9.949.057 | Rp 24.642.240 | Rp 0 | 136 | 97 | **Rp 34.591.297** |
| 267 | **Ellips** | Rp 1.546.753 | Rp 30.255.680 | Rp 0 | 248 | 193 | **Rp 31.802.433** |
| 278 | **PrettyMe 2 (Sale)** | Rp 24.889.528 | Rp 0 | Rp 0 | 72 | 57 | **Rp 24.889.528** |
| 279 | **Light+** | Rp 7.364.685 | Rp 16.649.920 | Rp 0 | 422 | 155 | **Rp 24.014.605** |
| 280 | **FlimColla** | Rp 12.013.448 | Rp 11.448.320 | Rp 0 | 252 | 117 | **Rp 23.461.768** |
| 275 | **Mooi JAR Inhouse** | Rp 0 | Rp 0 | Rp 0 | 0 | 0 | **Rp 0** |
| 285 | **Magic Box** | Rp 0 | Rp 0 | Rp 0 | 0 | 54 | **Rp 0** |
| 277 | **PrettyMe 1 (Exposure)** | Rp 0 | Rp 0 | Rp 0 | 79 | 41 | **Rp 0** |
| 282 | **AHW Skin Lab** | Rp 0 | Rp 0 | Rp 0 | 139 | 387 | **Rp 0** |
| 286 | **LUX** | Rp 0 | Rp 0 | Rp 0 | 4 | 7 | **Rp 0** |
| 284 | **Ebelin** | Rp 0 | Rp 0 | Rp 0 | 0 | 0 | **Rp 0** |
| 283 | **Fameux** | Rp 0 | Rp 0 | Rp 0 | 0 | 59 | **Rp 0** |
|--|---|---:|---:|---:|:---:|:---:|---:|
| **TOTAL** | **REKAPITULASI 27 CAMPAIGN** | **Rp 3.774.028.775** | **Rp 4.666.123.200** | **Rp 2.426.310.000** | **5.779 VT** | **3.941** | **Rp 8.440.151.975** |

> **Catatan Ekosistem Paragon Group:**
> Dari total di atas, kontribusi brand Paragon Group (`OMG 2`, `OMG 3`, `Wardah 1`, `Wardah 2`, `Wardah 3`, `Wardah 4`) mencapai **Rp 3.796.232.926** (~Rp 3,80 Miliar).

---

## 4. Arsitektur Teknis Tabel Terpisah Fisik & Mekanisme Rollback

### 4.1 Pemisahan Fisik Tabel (`web-app/supabase/migrations/20261027220000_create_archive_tables_and_isolate_tnt.sql`)
Sesuai arahan owner agar data Company Lain tidak bercampur sama sekali dengan operasional TNT maupun integrasi TikTok Partner Center, dibuat tabel-tabel fisik khusus arsip:
1. `archive_campaigns` — Master 27 campaign arsip.
2. `archive_campaign_creators` — 3.941 data kreator per campaign dengan username, nama asli, dan link akun tersimpan mandiri.
3. `archive_videos` — 5.779 link video TikTok publik yang terasosiasi ke kreator arsip.
4. `archive_sales` — 678 baris transaksi penjualan organik dengan relasi langsung ke `campaign_id`.
5. `archive_ads_performance` — 17 baris performa ads Video Shopping Ads.
6. `vw_archive_campaign_summary` — View ringkasan agregasi metrik arsip (GMV, video, kreator).

**Status Tabel Utama TNT:**
Seluruh baris Company Lain telah dihapus total dari tabel `campaigns`, `campaign_creators`, `videos`, `sales`, dan `ads_performance`. Tabel operasional TNT kini **100% murni data TNT**, sehingga sinkronisasi otomatis TikTok Partner Center, audit keuangan, dan pelaporan internal TNT terbebas mutlak dari risiko percampuran data.

### 4.2 Isolasi Server & Otorisasi
- **`AuthProvider.tsx`:** Hook `useAuth()` mengelola state `selectedCompany: 'TNT' | 'OTHER'`. Jika `profile?.role !== 'executive'`, nilai selalu dipaksa ke `'TNT'`.
- **`storeActions.ts:getInitialStoreData`:** Jika sesi user adalah `executive`, query mengambil gabungan data TNT (`campaigns`) dan arsip (`archive_campaigns`). Jika bukan `executive`, sistem HANYA membaca tabel `campaigns` dan sama sekali tidak mengeksekusi query ke tabel `archive_*`.
- **`campaignPageActions.ts:fetchPerformaPageFullDataAction`:** Memeriksa apakah `campaignId` berada di `archive_campaigns`. Jika iya, seluruh query diarahkan secara eksklusif ke tabel-tabel `archive_*`.
- **`ads-report/actions.ts:getAdsReportData`:** Jika mode `Company Lain`, query dialihkan membaca tabel `archive_ads_performance` dan `archive_campaigns`.

### 4.3 SOP & Prosedur Rollback Data Company Lain
Jika data Company Lain perlu dibersihkan atau diganti dengan data baru, terdapat 2 mekanisme aman:

#### Opsi 1: Melalui UI Web App (Satu Klik Khusus Executive)
1. Login dengan akun berekskutif (`role = 'executive'`).
2. Aktifkan mode `Company Lain` via switcher di Sidebar.
3. Di bagian atas halaman `/campaigns`, muncul banner amber berlabel **Mode Arsip: Company Lain**.
4. Klik tombol merah **Rollback Data Company Lain**.
5. Konfirmasi dua kali prompt peringatan. Server Action `rollbackCompanyLainAction()` akan menjalankan perintah `TRUNCATE archive_sales, archive_videos, archive_ads_performance, archive_campaign_creators, archive_campaigns CASCADE;`.

#### Opsi 2: Melalui Terminal VPS / SQL Script
Jalankan file rollback resmi `web-app/supabase/rollback_company_lain.sql` atau perintah SQL langsung:
```sql
BEGIN;
TRUNCATE archive_sales, archive_videos, archive_ads_performance, archive_campaign_creators, archive_campaigns CASCADE;
DELETE FROM campaigns WHERE company = 'OTHER';
COMMIT;
```
Data TNT pada tabel utama terisolasi secara fisik dan tidak akan tersentuh sama sekali.

---

### 7. Excel Sync Multi-Sheet & Portal Publik Brand Arsip (Update 27 Okt 2026)

#### A. Isolasi Fitur Excel Sync (Multi-Sheet Export & Import)
- **Tombol `Excel Sync (Arsip)` & Modal `<CampaignExcelSyncModal>`:**
  Hanya tampil pada detail campaign Company Lain (`company === 'OTHER'`), tersembunyi 100% pada campaign operasional TNT.
- **Server Action `campaignExcelSyncActions.ts`:**
  Memvalidasi `campaignId` hanya terhadap tabel `archive_campaigns`. Akses ditolak jika id menunjuk ke campaign operasional TNT. Seluruh operasi ekspor dan impor membaca serta menulis **eksklusif ke tabel fisik `archive_*`**.
- **Mode Impor (Append vs Replace):**
  - **Append (Penambahan):** Menambahkan data baru tanpa menghapus data historis/baseline yang sudah ada sebelumnya.
  - **Replace (Timpa):** Menghapus data kategori terkait (`archive_sales` atau `archive_ads_performance`) sebelum memasukkan baris baru.

#### B. Akses Portal Publik Brand Arsip (`/portal/[id]`)
- URL portal publik `/portal/[id]` mendukung ID dari `archive_campaigns` jika tidak ditemukan di `campaigns`.
- PIN default tetap `1234`, membuka portal brand publik `/portal/[id]/dashboard`.
- `portalActions.ts` menyajikan data ringkasan, kreator, video, dan performa dari tabel `archive_*`.

#### C. Kasus Penyesuaian Data Riil OMG 2 (Campaign ID 260)
- **Status Awal (Baseline Dummy):**
  - Sales Organik: 66 baris = Rp 79.724.057
  - Ads Performance: 1 baris dummy global (`OTHER_AD_OMG_2_ORIGINAL`) = $76.114,97 USD = Rp 1.217.839.520 (tanpa username kreator)
  - Total Achievement: **Rp 1.297.563.577 (~Rp 1,30 Miliar)**
- **Data Riil Diperbarui (Sesuai `OMG_2_FullData_2026-10-27.xlsx` Update Terbaru):**
  - Sales Organik: 66 baris dengan quantity riil (total 154.662 pcs) = **Rp 450.442.139**
  - Ads Performance: 36 baris per-kreator ($10.787,65 USD @ Rp 16.000) = **Rp 172.602.470** (100% terpetakan ke username kreator; bertambah 18 baris ads baru dari tim)
  - Baris dummy unmapped `OTHER_AD_OMG_2_ORIGINAL` dihapus resmi agar tidak ada data orphan.
- **Hasil Setelah Update & Pembersihan:**
  - Total Sales Organik: 66 baris = **Rp 450.442.139**
  - Total Ads Performance: 36 baris = **Rp 172.602.470** (0 unmapped, 0 null creator)
  - Total Achievement Baru: **Rp 623.044.609 (~Rp 623 Juta)**
  - Total Kreator: 155 kreator terdaftar & approved (78 kreator aktif di sales/ads 100% cocok)
  - Total Video: 298 video TikTok disetujui (approved)
  - Terekam konsisten di tabel fisik `archive_*`, view `vw_archive_campaign_summary`, halaman internal performa, dan portal publik brand `/portal/260/dashboard`.

#### D. Kasus Update Data Riil OMG 3 (Campaign ID 261)
- **Status Awal (Baseline Dummy):**
  - Sales Organik: 32 baris = Rp 10.690.668 (quantity = 1 pcs)
  - Ads Performance: 1 baris dummy global = $19.043,73 USD = Rp 304.699.680 (tanpa username kreator)
  - Total Achievement: **Rp 315.390.348 (~Rp 315 Juta)**
- **Data Riil Diperbarui (User Update):**
  - Sales Organik: 32 baris dengan quantity riil (total 2.063 pcs) = **Rp 10.690.668**
  - Ads Performance: 32 baris per-kreator ($133.633,35 USD @ Rp 16.000) = **Rp 2.138.133.600**
- **Hasil Setelah Update:**
  - Total Sales Organik: 32 baris = **Rp 10.690.668**
  - Total Ads Performance: 32 baris = **Rp 2.138.133.600**
  - Total Achievement Baru: **Rp 2.148.824.268 (~Rp 2,15 Miliar)**
  - Total Kreator: 245 kreator terdaftar
  - Total Video: 558 video TikTok disetujui (approved)
  - Sinkron di tabel `archive_*`, view `vw_archive_campaign_summary`, dan portal publik brand `/portal/261/dashboard`.

#### E. Kasus Update Data Riil Wardah 1 (Campaign ID 262)
- **Status Awal (Baseline):**
  - Sales Organik: 46 baris = Rp 336.872.439 (quantity = 1 pcs)
  - Ads Performance: 0 baris (belum ada data ads) = Rp 0
  - Total Achievement: **Rp 336.872.439 (~Rp 336 Juta)**
- **Data Riil Diperbarui (User Update):**
  - Sales Organik: 46 baris dengan nominal & quantity riil (total 45.937 pcs) = **Rp 1.010.617.317**
  - Ads Performance: 22 baris per-kreator ($125.757,88 USD @ Rp 16.000) = **Rp 2.012.126.016**
- **Hasil Setelah Update:**
  - Total Sales Organik: 46 baris = **Rp 1.010.617.317**
  - Total Ads Performance: 22 baris = **Rp 2.012.126.016**
  - Total Achievement Baru: **Rp 3.022.743.333 (~Rp 3,02 Miliar)** (Target Paragon > Rp 3 Miliar tercapai)
  - Total Kreator: 88 kreator terdaftar & approved
  - Total Video: 107 video TikTok disetujui (approved)
  - Sinkron di tabel `archive_*`, view `vw_archive_campaign_summary`, dan portal publik brand `/portal/262/dashboard`.

#### F. Kasus Update Data Riil Wardah 2 (Campaign ID 263)
- **Status Awal (Baseline):**
  - Sales Organik: 24 baris = Rp 4.238.135 (quantity = 1 pcs)
  - Ads Performance: 1 baris dummy global = $38.169,09 USD = Rp 610.705.440 (tanpa username kreator)
  - Total Achievement: **Rp 614.943.575 (~Rp 615 Juta)**
- **Data Riil Diperbarui (User Update):**
  - Sales Organik: 24 baris dengan nominal & quantity riil (total 2.803 pcs) = **Rp 63.572.025**
  - Ads Performance: 24 baris per-kreator ($99.331,29 USD @ Rp 16.000) = **Rp 1.589.300.626**
- **Hasil Setelah Update:**
  - Total Sales Organik: 24 baris = **Rp 63.572.025**
  - Total Ads Performance: 24 baris = **Rp 1.589.300.626**
  - Total Achievement Baru: **Rp 1.652.872.651 (~Rp 1,65 Miliar)**
  - Total Kreator: 99 kreator terdaftar & approved
  - Total Video: 93 video TikTok disetujui (approved)
  - Sinkron di tabel `archive_*`, view `vw_archive_campaign_summary`, dan portal publik brand `/portal/263/dashboard`.

#### G. Kasus Update Data Riil Wardah 3 (Cushion & Dew Tint) (Campaign ID 264)
- **Status Awal (Baseline):**
  - Sales Organik: 19 baris = Rp 2.891.050 (quantity = 1 pcs)
  - Ads Performance: 1 baris dummy global = $37.718,99 USD = Rp 603.503.840 (tanpa username kreator)
  - Total Achievement: **Rp 606.394.890 (~Rp 606 Juta)**
- **Data Riil Diperbarui (User Update):**
  - Sales Organik: 38 baris dengan nominal & quantity riil (total 1.669 pcs) = **Rp 164.789.850**
  - Ads Performance: 38 baris per-kreator ($185.388,58 USD @ Rp 16.000) = **Rp 2.966.217.307**
- **Hasil Setelah Update:**
  - Total Sales Organik: 38 baris = **Rp 164.789.850**
  - Total Ads Performance: 38 baris = **Rp 2.966.217.307**
  - Total Achievement Baru: **Rp 3.131.007.157 (~Rp 3,13 Miliar)** (Target Paragon > Rp 3 Miliar tercapai)
  - Total Kreator: 145 kreator terdaftar & approved
  - Total Video: 544 video TikTok disetujui (approved)
  - Sinkron di tabel `archive_*`, view `vw_archive_campaign_summary`, dan portal publik brand `/portal/264/dashboard`.

#### H. Kasus Update Data Riil Wardah 4 (Glasting Lip Matte) (Campaign ID 265)
- **Status Awal (Baseline):**
  - Sales Organik: 4 baris = Rp 517.377 (quantity = 1 pcs)
  - Ads Performance: 1 baris dummy global = $39.034,42 USD = Rp 624.550.720 (tanpa username kreator)
  - Total Achievement: **Rp 625.068.097 (~Rp 625 Juta)**
- **Data Riil Diperbarui (User Update):**
  - Sales Organik: 42 baris dengan nominal & quantity riil (total 1.772 pcs) = **Rp 165.307.227**
  - Ads Performance: 42 baris per-kreator ($289.287,65 USD @ Rp 16.000) = **Rp 4.628.602.363**
- **Hasil Setelah Update:**
  - Total Sales Organik: 42 baris = **Rp 165.307.227**
  - Total Ads Performance: 42 baris = **Rp 4.628.602.363**
  - Total Achievement Baru: **Rp 4.793.909.590 (~Rp 4,79 Miliar)**
  - Total Kreator: 90 kreator terdaftar & approved (termasuk penambahan otomatis 4 kreator cross-campaign yang aktif menghasilkan sales & ads: `katanyakezia`, `pilaaa.66`, `naatt167`, `alansecond7`)
  - Total Video: 127 video TikTok disetujui (approved)
  - Sinkron di tabel `archive_*`, view `vw_archive_campaign_summary`, dan portal publik brand `/portal/265/dashboard`.

#### I. Kasus Update Data Riil PWS 2 (Campaign ID 269)
- **Status Awal (Baseline):**
  - Sales Organik: 37 baris = Rp 132.392.153 (quantity = 1 pcs)
  - Ads Performance: 1 baris dummy global = $23.764,59 USD = Rp 380.233.440 (tanpa username kreator)
  - Total Achievement: **Rp 512.625.593 (~Rp 512 Juta)**
- **Data Riil Diperbarui (User Update & Koreksi Ads):**
  - Sales Organik: 37 baris dengan nominal & quantity riil (total 29.657 pcs) = **Rp 794.352.918**
  - Ads Performance: 37 baris per-kreator ($43.990,86 USD @ Rp 16.000) = **Rp 703.853.779** (100% terpetakan ke username kreator; koreksi data ads `angelmatondang` menjadi $7.079,25 USD = Rp 113.267.920)
- **Hasil Setelah Update & Koreksi:**
  - Total Sales Organik: 37 baris = **Rp 794.352.918**
  - Total Ads Performance: 37 baris = **Rp 703.853.779**
  - Total Achievement Baru: **Rp 1.498.206.697 (~Rp 1,50 Miliar)**
  - Total Kreator: 274 kreator terdaftar & approved
  - Total Video: 274 video TikTok disetujui (approved)
  - Sinkron di tabel `archive_*`, view `vw_archive_campaign_summary`, dan portal publik brand `/portal/269/dashboard`.

#### K. Penyesuaian Video Placeholder Sementara (0 VT ke Target Riil Tim) — Wardah 4, OMG 3, Light+ (28 Oktober 2026)
- **Konteks:** Hasil audit komparasi menunjukkan terdapat kreator dengan GMV sales organik jutaan rupiah namun baris videonya belum terinput pada sheet `Videos`. Sesuai konfirmasi owner & tim lapangan, video ditambahkan dengan status `approved`, kuota target disesuaikan, dan link video dikosongkan sementara (`link_video = ''`) sambil menunggu rekap link publik oleh tim.
- **Rincian Perubahan:**
  1. **Wardah 1 (Campaign ID 262):**
     - `@auliaditap`: ditambahkan **12 VT** (urutan 1–12, qty_vt = 12)
     - **Hasil:** Total achievement video naik dari 107 VT menjadi **119 VT**.
  2. **Wardah 4 (Glasting Lip Matte - Campaign ID 265):**
     - `@pilaaa.66`: ditambahkan **5 VT** (urutan 1–5, qty_vt = 5)
     - `@katanyakezia`: ditambahkan **7 VT** (urutan 1–7, qty_vt = 7)
     - `@naatt167`: ditambahkan **4 VT** (urutan 1–4, qty_vt = 4)
     - `@alansecond7`: ditambahkan **8 VT** (urutan 1–8, qty_vt = 8)
     - **Hasil:** Total achievement video naik dari 127 VT menjadi **151 VT**.
  3. **OMG 3 (Campaign ID 261):**
     - `@kikiromli89`: ditambahkan **5 VT** (urutan 1–5, qty_vt = 5)
     - **Hasil:** Total achievement video naik dari 558 VT menjadi **563 VT**.
  4. **Light+ (Campaign ID 279):**
     - `@goat`: ditambahkan **2 VT** (urutan 1–2, qty_vt = 2)
     - **Hasil:** Total achievement video naik dari 422 VT menjadi **424 VT**.
- **Penerapan Teknis:**
  - Script SQL: `docs/sql/98-add-empty-videos-goat-creators.sql` dan `docs/sql/99-add-auliaditap-videos-wardah1.sql` telah dieksekusi di database PostgreSQL VPS.
  - File spreadsheet di lokal user (`Wardah_1...xlsx`, `Wardah_4...xlsx`, `OMG_3...xlsx`, `Light...xlsx`) juga telah diperbarui pada sheet `Videos` dan `Creators`.
  - Ketika tim menyerahkan rekap URL video nantinya, fitur Excel Sync (`campaignExcelSyncActions.ts`) akan otomatis meng-update kolom `link_video` berdasarkan `campaign_creator_id` dan `urutan`.









