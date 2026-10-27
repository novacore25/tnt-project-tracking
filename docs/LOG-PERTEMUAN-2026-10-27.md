# Log Pertemuan & Eksekusi — 27 Oktober 2026

> **Status: SELESAI & TERVERIFIKASI.**  
> Berhasil mengarsipkan 27 campaign historis perusahaan terdahulu owner (GOAT) ke dalam entitas terisolasi **Company Lain** (`company = 'OTHER'`), membangun switcher multi-entity khusus role `executive`, mengimplementasikan sistem rollback satu-klik, serta memvalidasi keutuhan 100% data TNT tanpa kebocoran.

---

## 1. Ringkasan Eksekusi Hari Ini

| No | Modul / Berkas | Permintaan / Kebutuhan | Solusi Teknis & Eksekusi | Status |
|:--:|---|---|---|:---:|
| 1 | **Database Schema Migration** (`20261027210000_add_company_to_campaigns.sql`) | Pemisahan entitas multi-company antara TNT dan arsip perusahaan lain. | Menambahkan kolom `company VARCHAR(50) DEFAULT 'TNT' NOT NULL`, membuat index `idx_campaigns_company`, dan merefresh view `vw_campaign_summary` agar menyertakan kolom `company` dan `campaign_group`. | ✅ Terverifikasi di PostgreSQL VPS |
| 2 | **Forensic Parsing & Ingestion** (`docs/sql/96-ingest-company-lain.sql`) | Ingest 25 spreadsheet historis tanpa menduplikasi data dan tanpa distorsi angka. | 1. Memetakan 27 campaign berurutan dengan penamaan netral (`Wardah 1-4`, `OMG 2-3`, `BDL`, `PWS 2`, dst) tanpa kata "GOAT".<br>2. Filter regex nomor HP Indonesia (`0812...`) agar tidak terbaca sebagai GMV.<br>3. Konversi metrik Kalodata (`m` = $10^6$, `b` = $10^9$).<br>4. Ingest 5.779 video link publik, 2.105 kreator unik, dan 27 campaign ke PostgreSQL VPS. | ✅ Terverifikasi di DB |
| 3 | **Otorisasi & Keamanan Multi-Entity** (`AuthProvider.tsx`, `storeActions.ts`, `Sidebar.tsx`) | Switcher dan data arsip hanya boleh dilihat dan diakses oleh akun dengan role `executive`. | 1. `AuthProvider`: `selectedCompany` dipaksa selalu `'TNT'` untuk non-executive.<br>2. `Sidebar`: Switcher `[ TNT \| Company Lain ]` hanya dirender untuk role `executive`.<br>3. `storeActions`: Query `getInitialStoreData` memfilter `WHERE company = 'TNT' OR company IS NULL` di server-side untuk non-executive. | ✅ Terverifikasi |
| 4 | **Sistem Rollback Satu-Klik** (`rollbackActions.ts`, `rollback_company_lain.sql`, `campaigns/page.tsx`) | Kemampuan membatalkan/menghapus seluruh data arsip Company Lain kapan saja jika tidak diperlukan. | 1. Server action `rollbackCompanyLainAction()` dengan guard `requireRole('executive')`.<br>2. Tombol rollback di banner arsip halaman `/campaigns` dengan double-confirmation.<br>3. Script SQL `rollback_company_lain.sql` (`DELETE FROM campaigns WHERE company = 'OTHER'`) yang menghapus data secara CASCADE bersih tanpa menyentuh TNT. | ✅ Terverifikasi |
| 5 | **Ads Report Multi-Entity** (`ads-report/actions.ts`, `ads-report/page.tsx`) | Halaman Ads Report mendukung pemisahan data per entitas. | Server action `getAdsReportData` menerima parameter `company` dengan server-side guard; UI Ads Report memfilter campaign dan tabel performa ads sesuai company yang dipilih. | ✅ Terverifikasi |
| 6 | **Pemisahan Fisik Tabel Arsip** (`20261027220000_create_archive_tables_and_isolate_tnt.sql`) | Memastikan data Company Lain terpisah secara fisik dalam tabel khusus dan tabel operasional TNT 100% steril. | 1. Membuat tabel fisik `archive_campaigns`, `archive_campaign_creators`, `archive_videos`, `archive_sales`, `archive_ads_performance` dan view `vw_archive_campaign_summary`.<br>2. Menghapus seluruh baris Company Lain dari tabel utama TNT (`campaigns`, `sales`, `videos`, dll).<br>3. Server actions mengalihkan pembacaan ke tabel `archive_*` saat mengakses entitas arsip. | ✅ Terverifikasi di DB & Build |
| 7 | **Export & Import Excel Campaign Sync** (`campaignExcelSyncActions.ts`, `CampaignExcelSyncModal.tsx`, `layout.tsx`) | Format multi-sheet komprehensif untuk mengekspor seluruh data campaign agar tim dapat mengisi data riil dan mengimpornya kembali. | 1. Format workbook 6 sheet terstruktur (`Ringkasan Campaign`, `Creators`, `Videos`, `Sales Organik`, `Ads Performance`, `Panduan Pengisian`).<br>2. Ekspor instan zero-latency via SheetJS dengan auto column width.<br>3. Import & Upsert atomic dalam `db.transaction` dengan opsi `append` / `replace` untuk data sales & ads.<br>4. Tombol `Excel Sync` terintegrasi langsung di header layout campaign. | ✅ Selesai & Deployed |

---

## 2. Metrik Database: Sebelum vs Sesudah Ingestion

| Metrik | TNT (Sebelum) | Company Lain (Arsip) | TNT (Sesudah) | Keterangan |
|---|---:|---:|---:|---|
| **Jumlah Campaign** | 54 campaign | **27 campaign** | 54 campaign | Data TNT 100% utuh & tidak tersentuh |
| **Total Video** | 35.303 video | **5.779 video** | 35.303 video | Tersimpan via link TikTok publik |
| **Total Kreator Unik** | 11.102 creator | **2.105 creator** | 11.102 creator | Menggunakan upsert nama & username |
| **Total GMV (Organik + Ads)** | Rp 4.160.235.142 | **Rp 8.440.151.975** | Rp 4.160.235.142 | Paragon Group: Rp 3.796.232.926 |
| **Total Video Shopping Ads** | 316 ad rows | **1.205 ad rows** | 316 ad rows | GMV Ads Company Lain: Rp 4,66 Miliar |

---

## 3. Hasil Pengujian & Verifikasi

1. **Rollback Dry-Run:**
   - Script transaksi `BEGIN; DELETE FROM campaigns WHERE company = 'OTHER'; ROLLBACK;` berhasil menghapus tepat 27 campaign dan mengembalikan state DB secara sempurna.
2. **Lint & Code Quality:**
   - Menjalankan `npx eslint` pada file yang diubah: **0 violations**, aturan React Hooks dipatuhi tanpa early return sebelum hooks.
3. **Build Check:**
   - Menjalankan `npm run build` pada direktori `web-app`: kompilasi Turbopack sukses (20.2s), seluruh 30 rute SSR/RSC ter-generate tanpa error tipe data.

---

## 4. Format & Standar Excel Campaign Sync

Struktur file Excel multi-sheet (`Campaign_{nama}_FullData_{tanggal}.xlsx`):

1. **`Ringkasan Campaign`**: Menyimpan ID, Nama, Brand, Status, Tipe Campaign, Periode (Start/End Date), serta target numerik (`target_gmv`, `target_video`, `target_creator`, plafon budget).
2. **`Creators`**: Daftar kreator dengan kolom `Username`, `Nama Asli / KTP`, `Link Profil TikTok`, `Status Approval`, `Tipe Konten`, `Tier`, `Rate Card (Rp)`, `Target Qty VT`, dan `Target Qty Live`. Username menjadi kunci unik.
3. **`Videos`**: Daftar video dengan `Username Creator`, `Urutan VT`, `Link Video TikTok`, `Link Draft Video`, `Konsep / Catatan`, dan `Status Approval VT`.
4. **`Sales Organik`**: Catatan penjualan organik per tanggal dengan `Username Creator`, `GMV (Rp)`, `Jumlah Terjual (Qty)`, `Tipe Konten`, dan `Order ID`.
5. **`Ads Performance`**: Rekap iklan Video Shopping Ads dengan `Tanggal`, `Ad ID`, `Nama Ads`, `Nama Campaign Ads`, `Username Creator`, `Cost (USD)`, `Gross Revenue (USD)`, dan `Kurs IDR`.
6. **`Panduan Pengisian`**: SOP pengisian untuk tim agar format tanggal (`YYYY-MM-DD`) dan angka murni (tanpa tanda mata uang atau titik ribuan) terisi dengan benar.

Sistem mendukung 2 mode import:
- **Append**: Menambahkan baris transaksi atau ads baru tanpa menghapus data yang telah tersimpan sebelumnya.
- **Replace**: Mengganti total riwayat penjualan/iklan campaign tersebut dengan data riil pada file Excel (disertai konfirmasi pencegahan ketidaksengajaan).
