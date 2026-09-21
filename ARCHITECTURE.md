# Dokumentasi Arsitektur & Rekayasa Sistem TNT Project Tracking System

> **Versi Dokumentasi**: 2.0 (Post-Supabase Migration)  
> **Status Sistem**: Production Ready on VPS Coolify  
> **Repository**: `banzilla25/tnt-project-system`  
> **Terakhir Diperbarui**: September 2026  

---

## 1. Ikhtisar Sistem & Latar Belakang (System Overview)

**TNT Project Tracking System** adalah platform analitik dan manajemen operasional komprehensif untuk agensi periklanan dan affiliate marketing TikTok Shop. Sistem ini mengintegrasikan seluruh siklus bisnis periklanan:
1. **Creator Relationship & Pool Management**: Manajemen database master kreator, ratecard, kuota VT, kontak, niche, hingga log audit komunikasi.
2. **Campaign Tracking & Listing**: Pemantauan campaign per brand, penugasan produk/SKU ke kreator, alur approval video, master konsep, dan jadwal posting.
3. **Sales & Ads Attribution Engine**: Pemrosesan data penjualan organik (Sales GMV, komisi, order items) dan data periklanan TikTok Ads (Spend, CPM, CPC, ROAS, kurs konversi).
4. **Live & Organic Video Monitoring**: Tracking view harian, target view, interaksi likes/durasi, dan performa live streaming.
5. **Financial Batching & Invoicing**: Alur pengajuan pembayaran kreator (Payment Stepper), pembuatan batch invoice (unpaid, partial, paid), mutasi bank, dan split payment.
6. **Brand Client Portal**: Dashboard analitik real-time yang diamankan dengan enkripsi PIN per brand untuk transparansi laporan kepada klien tanpa akun Google.

```mermaid
flowchart TD
    subgraph Frontend ["Frontend Layer (Next.js 16 + React 19)"]
        UI_Dashboard["Dashboard & Analytics (/dashboard)"]
        UI_Campaigns["Campaign Management & Listing (/campaigns)"]
        UI_Database["Creator Pool & Notes (/database)"]
        UI_Finance["Financial Batching (/finance)"]
        UI_Import["Smart Import Engine (/import-data, /input-penjualan)"]
        UI_Portal["Brand Client Portal (/portal/:id)"]
    end

    subgraph AuthLayer ["Authentication & Access Control"]
        NextAuth["NextAuth v5 (Auth.js) - Google OAuth"]
        RBAC["Role-Based Access (Manager, Executive, Finance, Anggota)"]
        PIN_Auth["Client Portal PIN Cookie Auth (portal_pin_:id)"]
    end

    subgraph ServerActions ["Server Actions Boundary ('use server')"]
        SA_Store["storeActions.ts (Auth, Brands, Campaigns, SKUs)"]
        SA_DB["databaseActions.ts (Creators, Notes, Niches, Audit)"]
        SA_Campaign["campaignPageActions.ts (Concepts, Daily/Live Stats, Performa)"]
        SA_Import["importActions.ts (Sales, Ads, Organic, Unmapped Sync)"]
        SA_Payment["paymentActions.ts (Payment Batches, Split Items)"]
    end

    subgraph DatabaseLayer ["PostgreSQL 16 Engine (VPS Coolify)"]
        Drizzle["Drizzle ORM Engine (src/db/schema.ts)"]
        ConnPool["Postgres Direct Connection Pool (postgres driver)"]
        PG_DB[("PostgreSQL DB: db_tnt_project_system (Port 5432)")]
    end

    UI_Dashboard --> NextAuth
    UI_Campaigns --> NextAuth
    UI_Database --> NextAuth
    UI_Finance --> NextAuth
    UI_Import --> NextAuth
    UI_Portal --> PIN_Auth

    NextAuth --> RBAC
    RBAC --> ServerActions
    PIN_Auth --> ServerActions

    UI_Dashboard --> SA_Store
    UI_Campaigns --> SA_Campaign
    UI_Database --> SA_DB
    UI_Finance --> SA_Payment
    UI_Import --> SA_Import
    UI_Portal --> SA_Campaign

    ServerActions --> Drizzle
    Drizzle --> ConnPool
    ConnPool --> PG_DB
```

---

## 2. Keputusan Arsitektur & Alasan Migrasi (Architecture Decisions)

### A. Migrasi Penuh dari Supabase ke VPS PostgreSQL Mandiri
- **Keputusan**: Menghapus seluruh ketergantungan pada Supabase Cloud (`@supabase/ssr`, `@supabase/supabase-js`, PostgREST, Supabase Auth) dan memindahkan database ke PostgreSQL 16 di VPS Coolify (`168.231.118.146:5432/db_tnt_project_system`) yang dikelola via **Drizzle ORM**.
- **Alasan Utama**:
  1. **Eliminasi Latensi PostgREST/HTTP**: Supabase berkomunikasi melalui HTTP REST overhead. Dengan Drizzle ORM dan koneksi socket pool direct `postgres`, eksekusi query menjadi instan (sub-millisecond latency).
  2. **Bypass Limitasi Kuota & 1000 Row Default**: PostgREST secara bawaan membatasi query ke 1000 baris, memerlukan looping paginasi yang lambat pada data penjualan berukuran puluhan ribu baris. Pada Drizzle, batch insert dan reporting query dapat mengeksekusi streaming data tanpa batas buatan.
  3. **Efisiensi Resource & Cost Optimization**: Seluruh ekosistem berjalan pada dedicated VPS milik perusahaan tanpa kekhawatiran limit kuota Vercel Function execution time maupun Supabase database egress.
  4. **Kontrol Penuh atas Indexing & View**: Memungkinkan pembuatan composite index khusus (`idx_sales_campaign_date`, `idx_creators_username`), materialisasi analitik, dan query analitik kompleks langsung di server database.

### B. Otentikasi: NextAuth v5 (Auth.js) + Cookie PIN Portal
- **Keputusan**: 
  - Internal users (Tim TNT) diautentikasi menggunakan **NextAuth v5** via Google OAuth. Session diverifikasi ke tabel `profiles` (`role`: `manager`, `executive`, `finance`, `anggota`).
  - Klien brand eksternal (`/portal/[id]`) diautentikasi melalui sistem PIN per-brand menggunakan signed encrypted HTTP-only cookie (`portal_pin_[id]`).
- **Alasan**:
  - Memisahkan flow autentikasi internal (Google Workspace) dan portal klien eksternal tanpa mewajibkan klien membuat akun Google khusus.
  - Sesi tersimpan aman di level edge/server Next.js dengan hashing `AUTH_SECRET`.

### C. Pola Komunikasi: Next.js Server Actions Boundary (`'use server'`)
- **Keputusan**: Seluruh mutasi dan pengambilan data dilakukan melalui Next.js Server Actions yang dideklarasikan secara eksplisit dengan `'use server'` pada file terpisah (`src/app/actions/*`).
- **Alasan**:
  - Mengisolasi driver Node.js database (`postgres`, `net`, `tls`, `fs`) agar tidak pernah bocor ke Client Component (mencegah error bundling Turbopack).
  - Type-safe end-to-end dari database schema ke komponen UI tanpa perlu menulis API route boilerplate (`fetch('/api/...')`).
  - Integrasi alami dengan `revalidatePath` untuk peremajaan cache UI yang instan.

### D. Smart Background Realtime (`useSmartRealtime.ts`)
- **Keputusan**: Menggantikan WebSocket realtime channel bawaan Supabase dengan custom hook `useSmartRealtime.ts` berbasis event-visibility dan idle-awareness.
- **Alasan**:
  - Koneksi WebSocket yang terbuka terus-menerus memakan memory connection pool di server VPS.
  - `useSmartRealtime` memantau tab visibility (`document.visibilityState`) dan window focus. Saat pengguna aktif, sinkronisasi berjalan ringan; saat idle/minimized, interval polling dihentikan otomatis.

---

## 3. Data Flow & Modul Inti Sistem (Core Modules)

### 1. Modul Store & Master Initialization (`storeActions.ts`)
- **Fungsi**: Memuat initial state aplikasi saat user membuka dashboard (brand list, active campaign, master SKU, profile user, role privilege).
- **Security**: Memvalidasi session email ke tabel `profiles`. Jika user belum terdaftar, profile dibuat otomatis dengan role default `anggota`.

### 2. Modul Database Kreator (`databaseActions.ts`)
- **Fungsi**: Mengelola pool master kreator (`creators`), riwayat snapshot performa (`creator_snapshots`), log komunikasi (`creator_notes`), niche mapping (`creator_niches`), pembayaran ratecard (`creator_payments`), pengeluaran ads kreator (`ads_spends`), dan log audit sistem (`audit_logs`).
- **Idempotency**: Menjamin username kreator unik dan penambahan kreator massal tidak menyebabkan duplikasi data.

### 3. Modul Campaign & Performance Reporting (`campaignPageActions.ts`)
- **Fungsi**:
  - **Master Konsep**: CRUD konsep konten video (`campaign_concepts`), penugasan nomor konsep, hook, USP, CTA, dan approval brief.
  - **Performa Page Aggregation**: Menghitung performa harian/mingguan (Total GMV, Video Views, Engagement Rate, ROAS, Cost Per View) melalui query SQL berindeks.
  - **Listing Page**: Menampilkan daftar kreator di campaign, status approval, kuota VT, status bayar, nomor resi, dan penugasan SKU.
  - **Live Streaming Tracking**: Merekam statistik durasi, GMV, dan views per sesi live kreator.

### 4. Modul Smart Import & Unmapped Routing (`importActions.ts`)
- **Fungsi**: Mengimpor data penjualan massal (CSV TikTok Partner Center), data ads (Excel TikTok Ads Manager), dan data video organik.
- **Hierarki Routing**:
  1. *Priority 1*: Pencocokan `product_id` dengan tabel `skus`.
  2. *Priority 2*: Pencocokan `tiktok_campaign_id`.
  3. *Priority 3 (Unmapped)*: Disimpan dengan `campaign_id = NULL` agar data transaksi historis tidak pernah hilang.
- **Auto-Sync Trigger**: Ketika produk baru didaftarkan ke campaign, fungsi `syncUnmappedForProduct()` otomatis mengaitkan data unmapped ke campaign terkait.

### 5. Modul Finance & Payment Batches (`paymentActions.ts`)
- **Fungsi**:
  - Mengelompokkan kewajiban bayar kreator ke dalam `payment_batches` dan `payment_items`.
  - Workflow status: `draft` -> `submitted` -> `approved` -> `paid` / `rejected`.
  - Auto-split item pembayaran jika dana dicairkan secara bertahap (partial payment).
  - Generate template mutasi bank untuk upload massal ke sistem internet banking.

---

## 6. Prosedur Deployment & Panduan Pengembang

### Environment Variables Wajib (`.env.production` / Coolify Environment):
```env
# Database PostgreSQL VPS
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

# Build Next.js Production
npm run build

# Start Production Server
npm run start
```

### Aturan Git Push:
Selalu gunakan kredensial Personal Access Token (PAT) resmi untuk remote repository:
```bash
git push https://banzilla25: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@github.com/banzilla25/tnt-project-system.git main
```
