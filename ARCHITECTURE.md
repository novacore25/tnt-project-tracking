# Dokumentasi Arsitektur, Skema Tabel & Rekayasa Sistem TNT Project Tracking System

> **Versi Dokumentasi**: 2.2 (Post-Audit Video, Listing, Livestream & RBAC)  
> **Status Sistem**: Production Ready on VPS Coolify  
> **Repository**: `banzilla25/tnt-project-system` / `novacore25/tnt-project-tracking`  
> **Terakhir Diperbarui**: September 2026  

---

## 1. Ikhtisar Sistem (System Overview)

**TNT Project Tracking System** adalah platform analitik dan manajemen operasional komprehensif untuk agensi periklanan dan affiliate marketing TikTok Shop. Sistem ini mengintegrasikan seluruh siklus bisnis:
1. **Creator Pool & Database**: Manajemen master kreator, ratecard, kuota VT, nomor kontak, niche, dan log audit komunikasi.
2. **Campaign Tracking & Listing**: Pemantauan campaign per brand, penugasan produk/SKU, alur approval kreator (`pending`, `approved`, `alternate`, `not_approved`), master konsep brief, dan pengiriman sampel.
3. **Video & VT Management**: Monitoring draft link, approval draft/revisi, tracking link video TikTok panjang, ekstraksi timestamp via TikTok Snowflake ID, serta agregasi GMV/Views/Likes.
4. **Live Stream Monitoring**: Tracking sesi live streaming (Live Sync & Organic Video), live GMV, live views, live likes, dan leaderboard Top Kreator.
5. **Sales & Ads Attribution Engine**: Pemrosesan transaksi penjualan (GMV, komisi, order settlement) dan performa TikTok Ads (Spend, CPM, CPC, ROAS, kurs konversi).
6. **Financial Batching & Invoicing**: Alur pengajuan pembayaran kreator (Payment Stepper), pembuatan batch invoice (unpaid, partial, paid), mutasi bank, dan split payment.
7. **Brand Client Portal**: Dashboard analitik real-time yang diamankan dengan enkripsi PIN per brand untuk transparansi laporan kepada klien tanpa akun Google.

```mermaid
flowchart TD
    subgraph Frontend ["Frontend Layer (Next.js 16 + React 19)"]
        UI_Dashboard["Dashboard & Analytics (/dashboard)"]
        UI_Listing["Listing & Seleksi (/campaigns/:id/listing)"]
        UI_Video["Video & VT (/campaigns/:id/video)"]
        UI_Live["Live Stream (/campaigns/:id/livestream)"]
        UI_Finance["Financial Batching (/invoice, /finance)"]
        UI_Admin["Manajemen Akun (/manajemen-akun, /activity-log)"]
        UI_Portal["Brand Client Portal (/portal/:id)"]
    end

    subgraph AuthLayer ["Authentication & Access Control"]
        NextAuth["NextAuth v5 (Auth.js) - Google OAuth"]
        RBAC["Role-Based Access (Manager, Executive, Finance, Anggota)"]
        PIN_Auth["Client Portal PIN Cookie Auth (portal_pin_:id)"]
    end

    subgraph ServerActions ["Server Actions Boundary ('use server')"]
        SA_Store["storeActions.ts (Auth, Brands, Campaigns, SKUs)"]
        SA_Campaign["campaignPageActions.ts (Concepts, Daily/Live Stats, Listing)"]
        SA_Video["videoActions.ts (Internal Video Data, Stats Aggregation)"]
        SA_Live["livestreamActions.ts (Unified Live Sessions & Sales)"]
        SA_DB["databaseActions.ts (Creators, Notes, Niches, Audit)"]
        SA_Import["importActions.ts (Sales, Ads, Organic, Unmapped Sync)"]
        SA_Payment["paymentActions.ts (Payment Batches, Split Items)"]
    end

    subgraph DatabaseLayer ["PostgreSQL 16 Engine (VPS Coolify)"]
        Drizzle["Drizzle ORM Engine (src/db/schema.ts)"]
        ConnPool["Postgres Direct Connection Pool (postgres driver)"]
        PG_DB[("PostgreSQL DB: db_tnt_project_system (Port 5432)")]
    end

    UI_Dashboard --> NextAuth
    UI_Listing --> NextAuth
    UI_Video --> NextAuth
    UI_Live --> NextAuth
    UI_Finance --> NextAuth
    UI_Admin --> NextAuth
    UI_Portal --> PIN_Auth

    NextAuth --> RBAC
    RBAC --> ServerActions
    PIN_Auth --> ServerActions

    UI_Dashboard --> SA_Store
    UI_Listing --> SA_Campaign
    UI_Video --> SA_Video
    UI_Live --> SA_Live
    UI_Admin --> SA_Store
    UI_Finance --> SA_Payment
    UI_Portal --> SA_Campaign

    ServerActions --> Drizzle
    Drizzle --> ConnPool
    ConnPool --> PG_DB
```

---

## 2. Struktur Kolom Database Aktual (Database Schema Reference)

> [!IMPORTANT]
> **Penting untuk Mencegah Bug Column Mismatch**: Seluruh server actions dan query Drizzle harus mengacu pada nama kolom PostgreSQL aktual di bawah ini.

| Tabel | Kolom Kunci & Nama Kolom yang Benar | Kolom yang **TIDAK ADA** (Jangan Dipanggil) |
|---|---|---|
| `creators` | `id`, `username`, `nama_asli`, `link_account`, `rekening`, `avatar_url`, `mcn`, `alamat_penerima`, `alamat_jalan`, `alamat_kota`, `alamat_provinsi`, `alamat_kodepos`, `nama_wa_pic`, `nomor_wa_dealing` | ❌ `nama_lengkap`, `platform`, `status` |
| `campaign_creators` | `id`, `campaign_id`, `creator_id`, `tier`, `price`, `qty_vt`, `qty_live`, `approval`, `pic_assist`, `sample_progress`, `status_bayar`, `client_approval`, `assigned_sku_ids`, `notes_manager`, `notes_pic`, `notes_client` | ❌ `sow`, `status_approval` |
| `videos` | `id`, `campaign_creator_id`, `urutan`, `concept`, `concept_updated_at`, `concept_updated_by`, `link_video`, `link_draft`, `vt_approval`, `vt_approved_by`, `vt_approved_at`, `content_uid`, `sku_id`, `created_at` | ❌ `draft_url`, `approval_draft`, `approval_link`, `notes`, `views`, `likes` (Views/Likes dihitung dari `organic_videos`) |
| `sales` | `id`, `campaign_id`, `creator_username`, `content_uid`, `sku_id`, `product_id`, `tanggal`, `price`, `quantity`, `gmv`, `is_refund`, `content_type`, `order_id`, `order_status`, `raw_data`, `commission_rate`, `tiktok_campaign_id`, `shop_code` | ❌ `gross_sale` (gunakan `gmv`), `order_time` (gunakan `tanggal`), `creator_type` (gunakan `content_type`) |
| `organic_videos` | `id`, `content_uid`, `creator_username`, `post_time`, `video_views`, `video_likes`, `duration_str`, `video_product_rpm`, `campaign_id`, `product_id`, `tiktok_campaign_id`, `content_type`, `raw_data` | ❌ `video_id`, `publish_time`, `video_title`, `views`, `likes` |
| `live_sessions` | `id`, `livestream_room_id`, `creator_username`, `tt_campaign_id`, `livestream_name`, `start_time`, `end_time`, `duration_str`, `live_views`, `live_likes`, `live_product_rpm` | — |
| `live_session_products` | `id`, `livestream_room_id`, `product_id`, `product_name`, `shop_id`, `shop_name`, `category_1`, `category_2`, `gmv`, `orders`, `items_sold`, `commission`, `actual_commission` | — |
| `profiles` | `id`, `email`, `nama`, `role`, `status`, `avatar_url`, `created_at`, `updated_at` | ❌ `full_name` (gunakan `nama`) |

---

## 3. Detail Modul & Alur Sistem (System Flows)

### A. Otentikasi, Role & Hak Akses (RBAC)
- **Role Hierarchy**:
  - `manager` & `executive`: Akses penuh ke seluruh menu termasuk **Manajemen Akun** (`/manajemen-akun`), **Activity Log** (`/activity-log`), pembuatan/penghapusan campaign, approval kreator, dan approval VT/revisi.
  - `finance`: Akses ke modul pembayaran, invoice, stepper disbursement, dan reporting keuangan.
  - `anggota`: Akses operasional untuk input kreator ke listing campaign, upload data, dan update nomor resi/sampel.
- **Implementasi**:
  - Sesi Google OAuth dicocokkan ke tabel `profiles` via `src/auth.ts`.
  - Sidebar dinamis menyembunyikan menu manajemen jika pengguna bukan manager/executive.

---

### B. Modul Listing & Seleksi (`/campaigns/[id]/listing`)
- **Fungsi Utama**: Penambahan dan penyeleksian kreator khusus untuk campaign terpilih.
- **Optimasi Kinerja (High Performance Correlated Subqueries)**:
  - Menggunakan subquery JSON aggregation (`json_agg` untuk `creator_contacts`, `creator_snapshots`, `creator_niches`, dan `videos`) menggantikan relasi Cartesian `LEFT JOIN` berganda. Mengurangi memory footprint dan payload transfer dari 10MB+ menjadi <300KB.
- **Alur Status Approval**:
  - `pending` (Default saat kreator ditambahkan ke campaign)
  - `approved` (Disetujui untuk produksi konten / VT / Live)
  - `alternate` (Kreator cadangan)
  - `not_approved` (Ditolak)
- **Client Approval Gating**: Jika campaign mengaktifkan `require_client_approval = true`, kreator harus berstatus `client_approval = 'approved'` sebelum dapat masuk ke alur produksi video.

---

### C. Modul Video & VT (`/campaigns/[id]/video`)
- **Fungsi Utama**: Manajemen alur produksi video dari draft, review revisi, approval, hingga pelacakan postingan TikTok.
- **Penyelarasan Data**:
  - Server Action `getInternalVideoData(campaignId, searchKeyword)` hanya memuat kreator dengan status `LOWER(cc.approval) = 'approved'`.
  - Otomatis mengagregasikan statistik performa `_videoStats` per kreator dengan menggabungkan GMV dari `sales` dan Views/Likes dari `organic_videos`.
- **Tampilan Multi-Mode**:
  1. **Per Kreator**: Tampilan grup per kreator lengkap dengan target kuota VT (`qty_vt`), link draft, link video publik, dan status `vt_approval` (`pending`, `approved`, `revisi`).
  2. **Semua Video**: Tabel flat semua video yang telah diupload, filter rentang tanggal posting, SKU terkait, dan metrik GPM (Gross Revenue Per Mille: `(GMV / Views) * 1000`).
  3. **Draft Video**: Tampilan khusus review draft dengan tombol play Google Drive / video preview, serta modal catatan revisi (`campaign_creator_notes` dengan role `draft_revisi_[urutan]`).
  4. **Per Tanggal**: Agregasi performa posting video per hari.
- **Algoritma Snowflake TikTok**:
  - Mengekstrak timestamp upload secara presisi dari ID Video TikTok (`content_uid`) tanpa memerlukan pemanggilan API eksternal:
    $$\text{timestamp} = \left(\text{videoId} \gg 32\right) \times 1000$$

---

### D. Modul Live Stream (`/campaigns/[id]/livestream`)
- **Fungsi Utama**: Monitoring analitik dan hasil penjualan khusus sesi siaran langsung (*Live Streaming*).
- **Unifikasi Sumber Data Ganda**:
  - Menggabungkan sesi dari tabel `live_sessions` (impor via *Live Sync*) dan tabel `organic_videos` (`content_type = 'Livestream'`).
  - Mengorelasikan penjualan dari tabel `sales` (`content_type ILIKE '%live%'`) berdasarkan `content_uid`/`livestream_room_id`.
- **Leaderboard Otomatis**:
  - 🏆 **Top 5 Kreator (Sesi Terbanyak)**
  - 💰 **Top 5 Kreator (GMV Terbanyak)**
  - 🔥 **Top 5 Sesi Live (GMV Terbesar per Sesi)**
- **Multi-View Rendering**:
  - **Tampilan Per Kreator**: Statistik akumulasi sesi, views, likes, order, dan GMV per kreator.
  - **Tampilan Per Tanggal**: Agregasi performa live harian dengan filter rentang tanggal.

---

### E. Modul Analitik & Performa Campaign (`/campaigns/[id]/performa`)
- **Fungsi Utama**: Hub analitik terpusat yang memantau performa menyeluruh (Total GMV, Organic vs Ads GMV, Total Views, Likes, CPR/CPM, ROAS, dan ringkasan per kreator).
- **Arsitektur Pengambilan & Agregasi Data**:
  - `fetchPerformaPageFullDataAction` menarik seluruh dataset esensial secara paralel:
    - **Metadata Campaign & Master Konsep**: `campaigns` & `campaign_concepts`.
    - **SKU Campaign**: `skus` (sebagai basis atribusi produk).
    - **Kreator Campaign**: `campaign_creators` + `creators` (status `approved`, `pending`, `alternate`).
    - **Produksi Video**: `videos` (link video, content UID, urutan, approval).
    - **Transaksi Penjualan**: `sales` (GMV, kuantitas order, tipe konten).
    - **Performa Iklan**: `ads_performance` (Spend USD, GMV Ads USD, Purchases, Kurs konversi IDR).
    - **Video Organik**: `organic_videos` (Views, Likes, Durasi, Post Time).
  - Agregasi dilakukan secara in-memory di level client dengan pemetaan $O(1)$ Hash Map, memungkinkan filter dinamis (Global Creator Filter, Pencarian, Konsep, Status) tanpa round-trip fetch ulang.
- **Kalkulasi & Metrik Utama**:
  - $\text{Total GMV} = \text{GMV Organik} + \text{GMV Ads}$
  - $\text{ROAS} = \frac{\text{GMV Ads (IDR)}}{\text{Total Spend Ads (IDR)}}$
  - $\text{Cost Per View (CPV)} = \frac{\text{Budget Terpakai}}{\text{Total Views}}$
  - $\text{Kurs Konversi Ads}$: Dapat disesuaikan per entri ads secara real-time via `updateAdsPerformanceKursAction`.

---

### F. Modul Daily Performance & Timeline Target (`/campaigns/[id]/daily`)
- **Fungsi Utama**: Tracking performa harian dan bulanan, kecepatan pencapaian target (*Velocity Tracking*), serta visualisasi *Timeline Target* interaktif.
- **Arsitektur Pengambilan & Agregasi Data**:
  - `fetchDailyPerformancePageDataAction` mengambil data multi-tabel (`campaigns`, `skus`, `campaign_creators`, `videos`, `ads_performance`, `sales`, `organic_videos`).
  - Menghitung statistik harian dalam zona waktu **WIB (UTC+7)** (`toWIBDateStr`) untuk memastikan konsistensi tanggal transaksi TikTok dan posting video.
- **Agregasi Metrik Harian (`grouped[dateStr]`)**:
  - **Kreator Baru (Pending)**: Dihitung berdasarkan `cc.created_at` dan dikelompokkan per tier (Nano, Micro, Macro, Mega).
  - **Kreator Disetujui (Approved)**: Dihitung berdasarkan `cc.approved_at`.
  - **Video Baru**: Dihitung dari `videos.created_at` dan `organic_videos.post_time` (didukung deduplikasi ID Video TikTok untuk mencegah *double counting*).
  - **Live Streaming**: Sesi live unik harian dari `organic_videos` (`content_type = 'Livestream'`).
  - **GMV VT vs Live**: Pemisahan akurat antara GMV video (`gmv_vt`) dan GMV siaran langsung (`gmv_live`).
  - **GMV Ads Harian**: Dihitung dari delta kenaikan harian revenue iklan (`gross_revenue_usd * kurs`).
- **Komponen Timeline Target (`TimelineTarget.tsx`)**:
  - Menghitung **Target Velocity** harian dan mingguan berdasarkan hari kerja efektif (Senin–Jumat).
  - Menampilkan progres kumulatif target GMV, kuota video, dan target kreator lengkap dengan status pacing (*on-track*, *ahead*, *behind*).

---

---

### G. Modul Manajemen Keuangan & Pembayaran Kreator (`/campaigns/[id]/keuangan`)
- **Fungsi Utama**: Manajemen pengajuan batch pembayaran kreator (*Payment Stepper*), monitoring kreator belum lunas (*Unpaid Creators*), log mutasi rekening kreator (*Creator Mutations*), serta top-up saldo iklan (*Ads Top Up*).
- **Arsitektur Batching & Stepper Persetujuan Bertingkat**:
  ```mermaid
  flowchart LR
      Draft[1. Draft / Submission PIC] --> Manager[2. Review Manager]
      Manager --> Exec1[3. Review Executive 1]
      Exec1 --> Finance[4. Review Finance & Selection]
      Finance --> Exec2[5. Final Approval Executive 2]
      Exec2 --> Paid[6. Disbursement / Paid]
  ```
- **Relasi Tabel Inti**:
  - `payment_batches`: Menyimpan master batch pengajuan (`batch_label`, `campaign_id`, `status`, approval timestamps dari manager/executive/finance, bukti transfer URL, rekening pengirim).
  - `payment_items`: Detail setiap kreator dalam batch (`ratecard_awal`, `nominal`, `biaya_transfer`, `actual_transfer`, `payment_type`: `100_akhir`, `50_awal`, `50_akhir`, `ads`, `ops`, `status_bayar`, data bank rekening, KTP, kontrak).
  - `creator_bank_accounts`: Master rekening bank kreator (`bank_name`, `account_number`, `account_holder`, `is_primary`).
- **Fitur-Fitur Kunci**:
  1. **Unpaid Creators Tab (`fetchUnpaidCreators`)**: Memfilter seluruh kreator berstatus `approved` yang belum lunas (`price > 0`), mengecek riwayat pembayaran yang sudah ada, serta mendeteksi aktivitas live dari tabel `sales` & `organic_videos`.
  2. **Mutasi Kreator Tab (`fetchCampaignCreatorMutations`)**: Log transaksi transfer yang sudah berstatus `final_status = 'paid'`, lengkap dengan nomor batch dan link bukti transfer.
  3. **Batch Creator & Ads Form**: Pembuatan batch pembayaran khusus kreator atau top-up saldo ads dengan validasi bank account otomatis.

---

### H. Modul Smart Import & Sales Attribution (`/import-data`, `/input-penjualan`)
- **Routing Hierarki Penjualan**:
  1. *Priority 1*: Berdasarkan `product_id` yang terdaftar pada tabel `skus` campaign.
  2. *Priority 2*: Berdasarkan `tiktok_campaign_id` campaign.
  3. *Priority 3 (Unmapped)*: Disimpan dengan `campaign_id = NULL` agar riwayat transaksi tidak hilang.
  4. *Auto-Sync Trigger*: Saat SKU baru didaftarkan, fungsi `syncUnmappedForProduct()` otomatis mengaitkan data penjualan unmapped sebelumnya ke campaign tersebut.

---

## 4. Panduan Pengembang & Prosedur Deployment

### Environment Variables Wajib (`.env.production` / Coolify Environment):
```env
# PostgreSQL VPS Connection
DATABASE_URL=postgres://tnt_user:tnt_password@168.231.118.146:5432/db_tnt_project_system

# NextAuth v5 Configuration
AUTH_SECRET=your_generated_auth_secret_key
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://your-domain.com

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Menjalankan Build & Verifikasi:
```bash
# Install dependencies
npm install

# Build Next.js Production (Turbopack)
npm run build

# Start Production Server
npm run start
```

### Aturan Git Push:
Selalu push ke remote repository branch `main`:
```bash
git push origin main
```
Atau menggunakan Personal Access Token (PAT) yang terkonfigurasi.
