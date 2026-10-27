---
name: goat-campaign
description: Panduan analisis forensik, aturan deduplikasi data sheet/file, pemetaan kolom, dan prosedur ingestion arsip campaign GOAT ke sistem Project Tracking TNT. Khusus digunakan saat menganalisis spreadsheet GOAT atau mengimplementasikan multi-tenancy arsip GOAT.
---

# Skill: Analisis & Ingestion Campaign GOAT (`goat-campaign`)

> **BACA INI SEBELUM MEMPROSES DATA DARI FOLDER `C:\Users\Banzilla\Downloads\campaign goat` ATAU MENGUBAH FITUR ARSIP GOAT.**
> Panduan ini merangkum realitas spreadsheet historis GOAT, aturan deduplikasi antar-sheet/file, dan pemetaan data ke database TNT.

---

## 1. Aturan Mutlak Hak Akses & Isolasi

1. **Khusus Role `executive`:**
   - Fitur switcher perusahaan `[ TNT | GOAT ]` di UI **hanya dirender** jika `profile?.role === 'executive'`.
   - Di Server Actions / Query database, user dengan role non-executive **selalu difilter `WHERE company = 'TNT'`**. Jangan pernah membuka data GOAT ke role lain (`admin`, `manager`, `finance`, `creator`, dll.).
2. **Kolom Database:**
   - Tabel `campaigns` memiliki kolom `company VARCHAR(20) DEFAULT 'TNT'`.
   - Campaign GOAT disimpan dengan `company = 'GOAT'`.
   - Child records (`campaign_creators`, `videos`, `sales`, `ads_performance`) menempel pada `campaign_id`, sehingga otomatis terisolasi secara relasional.
3. **Penyimpanan Video (Tanpa Partner Center):**
   - Video disimpan langsung menggunakan URL TikTok publik (`link_video = 'https://www.tiktok.com/@...'` atau `vt.tiktok.com/...`).
   - Tidak memerlukan `content_uid` atau `product_id` TikTok Shop Partner Center.
   - Status video di-set `vt_approval = 'approved'`.

---

## 2. Aturan Deduplikasi Antar-Sheet & Antar-File (Anti Double-Count)

Berdasarkan audit forensik data spreadsheet GOAT:

### 2.1 File Berpasangan (Cross-File)
1. **Rose All Day (`Rose All Day (Internal)` + `GOAT X ROSE ALL DAY (EXTERNAL)`):**
   - **Keduanya adalah 1 campaign yang sama.**
   - Sheet `REPORT CAMPAIGN` di file External memuat link video live dan sales final.
   - File Internal memuat database prospek, rate card deal, dan spend ads harian.
   - **Aturan:** Ingestion menjadi **1 campaign**: `Rose All Day x GOAT`. Jangan dibuat 2 campaign terpisah!
2. **Light+ (`LIGHT+ (EXTERNAL)` + `Light+ Agency`):**
   - File Agency adalah katalog master SKU/produk (995 baris).
   - File External adalah data campaign kreator.
   - **Aturan:** Jadikan **1 campaign**: `Light+ x GOAT`.
3. **Wardah (Wardah 1, 2, 3, 4):**
   - Keempat file memiliki **0 link video overlap** (100% video unik).
   - **Aturan:** Pisahkan menjadi **4 campaign berurutan**:
     * `Wardah x GOAT 1` (General Seeding & Sales)
     * `Wardah x GOAT 2` (Bright Series & Tone Up)
     * `Wardah x GOAT 3 (Cushion & Dew Tint)` (Cushion & Dew Tint)
     * `Wardah x GOAT 4 (Glasting Lip Matte)` (Lip Matte)
4. **OMG (OMG 2 vs OMG 3):**
   - 0 link video overlap, hanya 17% kreator ikut lagi di batch 3.
   - **Aturan:** Pisahkan menjadi **2 campaign berurutan**: `OMG x GOAT 2` dan `OMG x GOAT 3`.
5. **BDL Skincare:**
   - Brand baru: `BDL x GOAT` (250 VT, GMV Rp 607 Juta).
6. **Mooi (Mooi x JAR vs Mooi 2):**
   - 0 video & 0 creator overlap.
   - **Aturan:** Pisahkan menjadi **2 campaign**: `Mooi x JAR Inhouse` dan `Mooi x GOAT 2`.

### 2.2 Duplikasi Antar-Sheet dalam 1 File (Intra-File)
1. **Sheet `R` vs `Report Campaign` (pada SALSA 2 dan DLF):**
   - Sheet `R` adalah draft interim mingguan, sedangkan `Report Campaign` adalah rekapan final.
   - Overlap mencapai 70%–86%.
   - **Aturan:** Prioritaskan sheet `Report Campaign`. Hindari membaca sheet `R` tanpa deduplikasi `DISTINCT link_video`.
2. **Sheet `Report` vs `Report Campaign` (pada PWS 2):**
   - Overlap 93% kreator.
   - **Aturan:** Gunakan `Report Campaign` sebagai acuan master.
3. **PrettyMe (Exposure vs Sale 2):**
   - Memiliki overlap 0% antara sheet `Exposure Creator List` dan `Report Campaign Sale 2`.
   - **Aturan:** Pecah menjadi **2 campaign**: `PrettyMe x GOAT (Exposure)` dan `PrettyMe x GOAT 2 (Sale)`.
4. **Deto Life (Multi-Toko):**
   - Memiliki 5 sheet produk terpisah (`Detobets`, `Gerd Zero`, `Diabetolac`, `Warung Herba`, `Stevia`).
   - **Aturan:** Gabung dalam payung `Deto Life x GOAT` dengan tagging sub-kategori/produk.
5. **Ellips (`Creator Address` vs `Copy of Creator Address`):**
   - 98% duplikat (sheet cadangan). Ambil salah satu saja.

---

## 3. Peta Ekstraksi Kolom Spreadsheet

| Entitas Sistem | Nama Header di Spreadsheet GOAT | Format / Catatan |
|---|---|---|
| **Username Creator** | `Username ID`, `Username Creator`, `Username`, `Creator` | Bersihkan awalan `@`, spasi, atau URL profil TikTok |
| **Nama Asli Creator** | `Nama Lengkap`, `Nama`, `Name` | Nama asli pemilik akun |
| **Kontak Creator** | `No Handphone`, `No HP`, `No. Telp`, `Telp`, `Phone` | Normalisasi format telepon (08xx / 628xx) |
| **Alamat Pengiriman** | `Alamat Lengkap`, `Address` | Alamat sample produk |
| **Link Akun TikTok** | `Link Account`, `Link Tiktok`, `Tautan Akun`, `Account Link` | URL profil TikTok kreator |
| **Rate Card / Fee** | `Harga`, `Rate card`, `RC`, `Price`, `RATE` | Nominal rupiah, bersihkan string `Rp`, `JT`, titik |
| **Link Video (VT)** | `Link Video 1`, `Link Video 2`, `Link Video 3`, `Link VT`, `Video 1` | URL video TikTok (`https://www.tiktok.com/...` atau `vt.tiktok.com/...`) |
| **GMV Organik** | `Sales Organic`, `SALES`, `Order organic`, `GMV` (di sheet Report) | **PERINGATAN:** Jangan ambil `GMV Kalodata L30D` di sheet `Database` (itu portofolio umum kreator, bukan sales campaign) |
| **GMV Ads** | `Sales by ADS`, `Order by ADS`, `GMV Ads`, `Gross` (di sheet GMV MAX) | GMV hasil dorongan iklan |
| **Spending Ads** | `Spending`, `Spend`, `SPEND HARIAN` | Biaya iklan TikTok Ads |
| **Ads Code** | `Code Boost`, `Ads Code`, `codeboost` | Kode autorisasi ads video TikTok |

---

## 4. Standar Penamaan Campaign GOAT

Gunakan rumus penamaan standar:
$$\text{Nama Campaign} = \text{[Nama Brand]} \times \text{GOAT } [\text{Nomor Batch / Varian}]$$

Contoh resmi:
* `AHW Skin Lab x GOAT`
* `Animate x GOAT`
* `DLF x GOAT`
* `Deto Life x GOAT`
* `Ellips x GOAT`
* `Fameux x GOAT`
* `FlimColla x GOAT`
* `Mooi x GOAT 2`
* `PWS x GOAT 2`
* `Rose All Day x GOAT`
* `SALSA x GOAT 2`
* `Skin Game x GOAT`
* `Wardah x GOAT 1`
* `Wardah x GOAT 4 (Glasting Lip Matte)`
