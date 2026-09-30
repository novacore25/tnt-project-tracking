---
name: tnt-project
description: Konteks permanen untuk Project Tracking System TNT (repo novacore25/tnt-project-tracking). Gunakan skill ini SEBELUM menjawab pertanyaan apa pun tentang web-app ini — saat menambah fitur, memperbaiki bug, menulis server action, memigration DB, ataureviewed kode. Berisi peta domain, aturan bisnis, jebakan yang sudah diketahui, dan lokasi file yang wajib dibaca sebelum mengubah apa pun.
---

# TNT Project Tracking System — Konteks Proyek

> Dibangun dari audit mendalam repo pada 30 September 2026.
> Semua klaim di skill ini **sudah diverifikasi terhadap kode**. Kalau kamu menemukan
> ketidakcocokan, perbarui skill ini di sesi yang sama.

## 0. Identitas

| Item | Nilai |
|---|---|
| Repo | `github.com/novacore25/tnt-project-tracking` (branch `main`, produksi) |
| Root workspace | `C:\Users\Banzilla\Documents\DEV\Project-Tracking-System-VPS` |
| App yang dipush | `web-app/` (**hanya folder ini** yang masuk image Docker) |
| Deploy | VPS Coolify, Docker multi-stage, `output: 'standalone'`, port 3000 |
| Domain | `https://campaign.tntkreatif.com` |
| DB | PostgreSQL di VPS Coolify, `DATABASE_URL` via env, driver `postgres-js` + Drizzle |
| Skala | ~163 file TS/TSX, ~51.000 baris, 239 exported server action, 40 route |
| Bahasa UI | 100% Bahasa Indonesia. Hardcoded, tidak ada i18n. |

### Stack (dari `web-app/package.json`)

- Next.js **16.2.7** (App Router, Turbopack) — **bukan** Next 13/14/15. Baca `node_modules/next/dist/docs/` sebelum menulis kode.
- React **19.2.4**, TypeScript ^5, Tailwind **v4** (CSS-first, `@theme`)
- **NextAuth v5 (Auth.js) beta.32** — Google OAuth, `strategy: 'jwt'`
- **Drizzle ORM 0.45** + `postgres` (postgres-js). TAPI: hampir semua query lewat `db.execute(sql\`...\`)` raw, bukan Drizzle query builder.
- Zustand 5 (store global), SWR 2 (**terpasang tapi TIDAK dipakai** di mana pun)
- `papaparse` + `xlsx` + `exceljs` (import/export spreadsheet), `lucide-react`, `@radix-ui/*` (Dialog, Label, Switch)
- **`typescript: { ignoreBuildErrors: true }`** di `next.config.ts` — build TIDAK gagal atas error TS. Ada **89 error TS** yang live saat ini.
- ESLint 9 flat config. **Tidak ada test framework sama sekali.**

### Struktur direktori yang penting

```
web-app/src/
├── proxy.ts              ← gate auth (Next 16 ganti nama middleware → proxy)
├── auth.ts               ← konfigurasi NextAuth + callback signIn/jwt/session
├── instrumentation.ts    ← scheduler auto-sync TikTok (in-process setInterval)
├── app/                  ← App Router, 40 route
├── app/actions/          ← 'use server' modul-level (11 file)
├── app/campaigns/actions/← 'use server' (6 file, termasuk paymentActions 1281 baris)
├── app/portal/actions/   ← 'use server' untuk brand portal (PIN auth)
├── app/api/              ← 5 route handler
├── components/           ← 22 komponen + components/ui/ (8 primitif)
├── db/schema.ts          ← Drizzle schema (585 baris) — JANGAN percaya 100%
├── db/index.ts           ← pool singleton + helper sqlInList
├── lib/                  ← tiktokAutoSync, syncUnmapped, db-queries, reporting
├── providers/            ← AuthProvider, CampaignFilterProvider (client)
├── store/                ← useDatabaseStore (zustand, 601 baris)
├── types/database.ts     ← TS interfaces (PALING STALE dari semua deskripsi DB)
├── utils/                ← formatters, import*Sync, tiktokShopApi, stringSimilarity
└── hooks/                ← useDraftLocalStorage, useSmartRealtime
```

---

## 1. Peta Domain (wajib paham sebelum ubah data)

```
brands ──1:N──> campaigns ──1:N──> skus
                    │                    ▲
                    │                    └── sales.sku_id (SET NULL)
                    │
                    ├──1:N──> campaign_creators <──N:1── creators
                    │           ├──1:N──> videos
                    │           ├──1:N──> creator_addresses
                    │           ├──1:N──> payment_items ──> payment_batches
                    │           └──1:N──> campaign_creator_notes
                    │
                    ├──1:N──> campaign_concepts ──> videos
                    ├──1:N──> organic_videos   (creator_username = TEXT, bukan FK)
                    ├──1:N──> ads_performance / ads_spends / ads_topups
                    └──1:N──> daily_performance (sebenarnya VIEW di DB nyata)

profiles ──(role, brand_id)──> session JWT
user_campaigns ──(user_id TEXT, TANPA FK)──> profiles
whitelisted_emails ──> allowlist login (saat ini DILEWATI, lihat §4)
```

### Istilah bisnis (bahasa Indonesia, singkatan)

| Istilah | Arti | Sumber |
|---|---|---|
| **VT** | Video TikTok (UGC creator) | `videos` |
| **VT / Live** | Dua konten berbeda,Diifferentiate via `content_type` / `is_livestream` | `organic_videos` |
| **Organic** | GMV dari短视频/affiliate link tanpa Ads | `sales` |
| **Ads / VSA** | GMV dari iklan TikTok Ads | `ads_performance` |
| **GMV** | Gross Merchandise Value, dalam IDR | `sales.gmv` (bigint) |
| **Komisi** | Fee creator, `%` | `skus.komisi` |
| **Rate card** | Harga tetap per posting | `campaign_creators.price` |
| **PIC** | Person in charge (internal) | `campaign_creators.notes_pic` |
| **Plafon** | Budget cap | `campaigns.budget_creator_plafon` / `budget_ads_plafon` |
| **Tier** |nano/micro/macro/mega + live | `campaign_creators.tier` |
| **Unmapped** | Order/video TikTok yang tidak bisa dipetakan ke campaign/SKU/creator | `syncUnmapped.ts` |
| **Batch** | Header pengajuan pembayaran批量 | `payment_batches` |
| **Kurs** | Nilai tukar USD→IDR (default 16000) | `ads_performance.kurs` |
| **Split payment** | Pembayaran pecah: ratecard + biaya transfer | `payment_items.actual_transfer` / `biaya_transfer` |

### Alur approval pembayaran (5 tahap) — INI YANG PALING RAPUH

`manager → executive_1 → finance → executive → paid`

Tersimpan di `payment_items` dengan kolom `manager_status`, `executive_1_status`,
`finance_selected`, `executive_status`, `final_status`.
Fungsi-fungsinya di `paymentActions.ts:808-1420`.
**Semua 23 fungsi rantai ini memanggil `auth()` tapi TIDAK PERNAH mengecek hasilnya** — lihat §4.

---

## 2. Alur Kerja Utama (jangan rusak ini)

### 2.1 Bootstrap aplikasi
1. `app/layout.tsx` render `<GlobalLoadingOverlay /> <DataLoader /> <LayoutWrapper>`.
2. `LayoutWrapper` (client) bungkus semua dengan `<AuthProvider>` + `<Sidebar>`.
3. `AuthProvider` (client) panggil `getAuthProfileAction()` → dapat `profile` + `userCampaigns`.
4. `DataLoader` (client) panggil `useDatabaseStore().fetchData()` **sekali saja** per sesi
   (di-gate `hasFetched` ref, `DataLoader.tsx:16-21`).
5. `fetchData` → `getInitialStoreData()` → 7 query paralel: brands, campaigns, niches,
   skus, profiles, ad_name_mapping, `vw_campaign_summary`. Sisa tabel di-store = `[]`.
6. Halaman-halaman besar (video, listing, daily, performa) ambil datanya sendiri via
   server action di `useEffect`, **bukan** dari store.

### 2.2 Mutasi data
Pola STANDAR di seluruh app:
```
Component → server action ('use server') → db.execute(sql`...`) → revalidatePath() → return {success, data}
                                                                        ↓
Component → setState lokal (manual) atau pakai data balik
```
- Store zustand punya 32 pemanggilan action, **0calling `fetchData()` ulang** setelah mutasi.
- `revalidatePath()` dipanggil 101× di server action, tapi **hampir semua route adalah
  `'use client'`** → revalidate tidak berguna untuk render client. Ini、民 bukan bug,
  ini sisa migrasi dari era Supabase Realtime.
- Setelah mutasi, halaman **tidak auto-refresh**. User harus refresh manual atau
  komponen memanggil fetch sendiri. **Jangan "perbaiki" ini dengan menambahkan
  `router.refresh()` di server action** — itu tidak akan bekerja dan menambah bingka.

### 2.3 Auto-sync TikTok
`instrumentation.ts` (Jalur Node.js server startup) → `setInterval` 60 detik →
cek slot `[7, 12, 15, 18]` WIB → `runTikTokAutoSync()`.
Juga ada `GET/POST /api/cron/tiktok-sync` untuk cron eksternal.
Manual: `POST /api/sync/tiktok-manual` (SSE streaming progress) → tombol di
`components/TikTokSyncControlCard.tsx`.

### 2.4 Import Excel
`/creator-pool/import`, `/campaigns/[id]/listing/import-creator`,
`/campaigns/[id]/alamat/import`, `/campaigns/[id]/keuangan/import`, `/ads-report/import-ads`.
Client parse spreadsheet → validasi keras (blocking partial save) → server action upsert.
`utils/stringSimilarity.ts` untuk fuzzy match creator.

### 2.5 Brand Portal (untuk klien eksternal)
Login PIN 4-digit per campaign → cookie `portal_pin_{campaignId}` (httpOnly, plain PIN).
Total **6 halaman** tersedia tanpa akun Google. **Ini superficie anonim.**

---

## 3. Jebakan yang SUDAH DIKETAHUI (bukan opinion — terverifikasi)

Read these before touching anything. Mengabaikannya = regresi data atau安全问题.

### 3.1 `src/db/schema.ts` TIDAK cocok dengan database nyata — JANGAN `drizzle-kit push`
Skema Drizzle adalah **generasi lama** yang ditinggalkan. Contoh bobot:
- `payment_batches`: schema.ts punya `batch_code`/`batch_type`/`total_amount`;
  DB nyata punya `batch_label`/`submitted_by`/`*_reviewed_by`/`bukti_transfer_url`/...
- `payment_items`: schema.ts punya `amount`; DB nyata punya `nominal`/`ratecard_awal`/`biaya_transfer`/`actual_transfer`.
- `sales`: schema.ts punya `gross_sale`/`refund`/`buyer_payment`; DB nyata punya `gmv` bigint + `is_refund` boolean.
- **8 tabel tidak ada di schema.ts sama sekali**: `live_sessions`, `live_session_products`,
  `live_schedules`, `payout_requests`, `payout_creator`, `creator_payments`, `ads_allocations`, `pembayaran` (legacy).
- **`schema.ts` punya nol deklarasi `index()`.** Semua index dibuat manual lewat SQL.
- `daily_performance` di DB nyata adalah **VIEW**, bukan tabel — tapi
  `databaseActions.ts:746,763,867` masih `INSERT`/`UPDATE` ke sana dengan kolom yang
  tidak ada. Halaman daily performance kemungkinan sudah rusak.

**Aturan:** perubahan skema SELALU lewat file SQL baru di `web-app/supabase/migrations/`.
Jangan pernah menjalankan `drizzle-kit generate` atau `push`. Schema Drizzle dipakai
hanya untuk typing dan sudah terbukti salah.

### 3.2 Otorisasi hanya ada di client — ini arquitetura, bukan bug kecil
`AuthProvider.canEditCampaign()` (`AuthProvider.tsx:71-80`) adalah satu-satunya
implementasi ACL. Ia hanyaluence render tombol. **TIDAK ADA server action atau API route
yang membaca `user_campaigns` untuk memutuskan boleh/tidak.**
Konsekuensi: user `staff` dengan 0 campaign grant tetap bisa memanggil action apa pun
dengan `campaignId` milik orang lain. **Jangan percayai `canEditCampaign` sebagai proteksi.**
Ketika menambah fitur baru, tambahkan guard server-side; jangan tiru pola lama.

### 3.3 `whitelisted_emails` bukan whitelist
`auth.ts:33-85` query tabel itu lalu **selalu `return true`** di baris 80.
Role default ditetapkan heuristik: email yang mengandung substring `"admin"` atau
`"executive"` → `role = 'executive'`. Profil baru dibuat `status='approved'` langsung.
Konsekuensi: siapa pun dengan akun Google (bahkan `xyz-admin@gmail.com`) masuk sebagai executive.
**Jangan tambah fitur yang mengasumsikan whitelist membatasi user.**

### 3.4 `profiles.status` tidak pernah dibaca untuk menolak akses
`deactivateUser` (`manajemen-akun/actions.ts:48`) set `status='inactive'`, tapi tidak ada
 kode yang denies access berdasarkan status itu. Offboarding tidak mencabut akses.

### 3.5 PIN portal default `'1234'` dan plaintext
`storeActions.ts:177,228` — campaign tanpa PIN dapat PIN `'1234'`.
`portalActions.ts:26-31` — cookie berisi PIN mentah, `secure: false`.
`loginPortal` tanpa rate limit. `portalActions.ts:775 updateClientNotes` tidak cek PIN sama sekali.

### 3.6 SQL: `sqlInList` aman, jangan diubah
`db/index.ts:28-31` dan `campaignPageActions.ts:7-10` membangun `IN (...)` dari bound
parameter. Array kosong → `IN (NULL)` (fail-closed). **Aman. Jangan refactor jadi string concat.**
Satu-satunya wisuhand-built SQL literal: `storeActions.ts:155,197` (`rawTiktokIds` untuk
`text[]`) — saat ini aman karena di-bind sebagai parameter dengan cast, tapi rapuh.
Pola LIKE wildcards di `paymentActions.ts:720` — bukan SQLi, hanya atribusi yang bisa dimanipulasi.

### 3.7 Relation yang putus (string-based, tanpa FK/index)
- `organic_videos.creator_username` (TEXT) → `creators.username` — query pakai `LOWER(col)=LOWER(?)` = full scan.
- `sales.campaign_creator_id` — **tidak ada di schema.ts**, dipakai `reporting.ts:22`.
- `ads_performance.creator_id` — **tidak ada di schema.ts**, dipakai di 6 file.
- `videos.content_uid` — bridge ke `organic_videos`/`sales`, **tanpa unique index**. Dedupe bergantung kode.
- `user_campaigns.user_id` — tanpa FK. User dihapus → ACL yatim.

### 3.8 Tiga sumber kebenaran yang bisa berbeda
- **Status bayar:** `payment_items.final_status` vs `campaign_creators.status_bayar` vs `creator_payments.status_bayar`. Dua penulis, tanpa transaksi.
- **Role:** `profiles.role` vs `whitelisted_emails.role` vs `users.role`.
- **GMV:** 5 sumber tumpang tindih (`sales.gmv`, `ads_performance`×kurs, `videos.organic_sales_*`×4, `campaign_creators.gmv_*_legacy`, `daily_performance`).

Jangan menulis query "penyatuan" baru yang menjumlahkan dua sumber ini — angka akandobbel.

### 3.9 Race condition yang sudah ada
`SELECT COALESCE(MAX(urutan),0)+1` lalu `INSERT` di 3 tempat (`importActions.ts:311`,
`syncUnmapped.ts:148`, `campaignPageActions.ts:1291`) tanpa unique constraint
`(campaign_creator_id, urutan)`. Check-then-insert yang sama untuk
`campaign_creators (campaign_id, creator_id)`. **Jangan tambah pola serupa.**

### 3.10 `numeric` tanpa skala
`skus.komisi`, `ads_performance.kurs` (default 16000), `gross_revenue_usd` — semua
`NUMERIC` tanpa presisi/skala. Tidak ada `ROUND()` di mana pun. `daily_performance`
pakai `NUMERIC(15,2)` yang bisa overflow untuk campaign besar. Jika menambah kolom uang
atau agregasi rupiah, **jelaskan-scale (`NUMERIC(18,2)`) dan bulatkan di SQL, bukan di JS.**

### 3.11 RLS adalah keamanan semu
`supabase/migrations/20260628000000_enable_rls.sql` meng-enable RLS di semua tabel dengan
policy `USING (true) WITH CHECK (true) TO authenticated`. Tapi aplikasi **tidak pernah
pakai Supabase client** — dia konek langsung ke Postgres via `postgres-js`
(`db/index.ts:14`). Sehingah RLS: (a) tidak pernah melihat context `authenticated`,
(b) di-bypass karena koneksi pakai user pemilik/bypassrls. **Semua scoping 100% di level aplikasi.**
Jangan撰tulis query yang "menganggap" RLS protecting-nya.

### 3.12 Secret yang ter-hardcode di dalam source (SUDAH di git history)
| File:line | Secret |
|---|---|
| `auth.ts:18` | `AUTH_SECRET` fallback |
| `auth.ts:25,29` | Google OAuth clientId + **clientSecret** |
| `utils/tiktokShopApi.ts:4,5` | `TIKTOK_APP_KEY` + **`TIKTOK_APP_SECRET`** |
| `.agents/AGENTS.md` | **GitHub PAT** (juga ada di `.git/config` remote `origin`) |
| `web-app/scripts/fix_view_vt.js`, `get_view_def.js` | Password Supabase lama |
| `web-app/scripts/` (21 file) | Mengandung string `postgresql://` |
| `web-app/.env.example` | Berisi `DATABASE_URL` + `AUTH_SECRET` + Google secret **nyata** (file-nya sendiri di-gitignore, tapi isinya nyata) |

`.env.local`/`.env.example` **tidak pernah** masuk git history (verified via
`git log --all --diff-filter=A`). Repo `novacore25/tnt-project-tracking` **private**
(API return 404 tanpa auth). Jadi kebocoran belum tervalidasi publik, tapi nilainya
tetap harus dirotasi. **Jangan pernah menulis secret literal lagi di file mana pun —
termasuk di dokumen. Gunakan placeholder.**

### 3.13.next critical advisory
`next@16.2.7` terkena advisory critical/high (termasuk "Middleware / Proxy bypass in App
Router using Turbopack" GHSA-6gpp-xcg3-4w24, "Unauthenticated disclosure of internal
Server Function endpoints" GHSA-955p-x3mx-jcvp, SSRF via Server Actions GHSA-89xv-2m56-2m9x).
`npm audit --omit=dev` → 9 vulnerabilities (3 moderate, 5 high, 1 critical).
`brace-expansion`, `nanoid`, `sharp`/`libvips` juga kena.
**Perbarui Next saat Opportunity — tapi baca `node_modules/next/dist/docs/` dulu
(ekspektifl APP_DIR sudah berubah: `middleware.ts` → `proxy.ts`, config `staleTimes` masih experimental).**

### 3.14 `proxy.ts` hanya cek cookie ada, bukan valid
`proxy.ts:14-18` cek **keberadaan** cookie bernama `authjs.session-token`/dll —
nilai tidak diverifikasi. `proxy.ts:11` menandai `/portal` sebagai public (semua prefix).
Matcher regex `'/((?!...).*)'` — `api` **tidak** dikecualikan, jadi API route melewati
gate cookie, tapi gate itu hanya "punya cookie dengan nama itu"._FORGEABLE kalau
`AUTH_SECRET` bocor. Lihat §3.12.

### 3.15 Ada dua salinan chrome-extension yang berbeda
- `chrome-extension/` (root) → target `https://campaign.tntkreatif.com/creator-pool/import`,
  baca `localStorage['tnt_import_draft_global']`, scrape TikTok Partner Center + Kalodata.
  **Ini yang dipakai flow `SpreadsheetImportClient.tsx:61,142,144,429`.**
- `web-app/chrome-extension/` → target `http://localhost:5173/bulk-input`,
  route `/bulk-input` **tidak ada** di app. Salinan mati/usang.
Jangan edit yang salah. Root yang benar.

### 3.16 Store mengosongkan `creators` paksa — 3 fitur mati tanpa error
`useDatabaseStore.ts:138-173` (`fetchData`) meng-`[]` kan `creators`, `creator_snapshots`,
`campaign_creators`, `videos`, `daily_performance`, `creator_payments`, `sales`, `ads_performance`.
Hanya 7 key yang terisi: `brands`, `campaigns`, `niches`, `skus`, `vw_campaign_summary`,
`profiles`, `ad_name_mapping`.

Konsekuensi: `CampaignSyncModal.tsx:15-16`, `CreatorSyncModal.tsx:18`, `AddressSyncModal.tsx:17-18`
membaca `creators` untuk daftar username → **selalu kosong** → `findClosestMatch` tidak pernah
dapat kandidat, badge "Valid" tidak pernah muncul di preview import. **Username matching mati
di 3 alur sync utama.** Kalau user lapor "semua kreator import kelihatan baru", ini penyebabnya.

> Store = cache **master data** (campaign/brand/SKU), bukan cache seluruh tabel.
> Halaman besar (video, listing, daily, performa) punya local state sendiri.

### 3.17 `revalidatePath` tidak efektif untuk halaman client — tapi jangan ditambah
101 panggilan `revalidatePath()` di server action **tidak menyegarkan** Zustand store maupun
local state client. `applyRealtimeUpdate` (`useDatabaseStore.ts:114-136`) sudah ditulis lengkap
dengan handler INSERT/UPDATE/DELETE tapi **tidak pernah dipanggil** (verified: hanya deklarasi
di `:79` dan definisi di `:114`). `useSmartRealtime.ts` juga tidak pernah di-import.

Setelah mutasi, halaman **tidak auto-refresh** — itu perilaku yang sudah diasumsikan user.
**Jangan tambahkan `router.refresh()` atau `revalidatePath` baru** — tidak memperbaiki apa pun.

### 3.18 Route mati & halaman yang salah tampil
- **`/brand-portal/summary`** — dead route. `summary/page.tsx:11` pakai `useParams()` ambil
  `campaignId` tapi route tidak punya `[id]` segment → selalu `undefined`. **Pasti rusak.**
- **`/invoice`** — halaman penuh approve/reject, **tidak ada di Sidebar**, tidak ada `<Link>`.
- **`/pending`** — `auth.ts:72` selalu set `status='approved'` dan tidak ada `pages.error`
  di NextAuth config → **tidak pernah tampil**.
- **`campaigns/[id]/layout.tsx:155`** — `if (!campaign) return "Campaign tidak ditemukan."`.
  Deep-link / paste URL ke `/campaigns/5/video` sebelum store ter-hydrate → tampil error
  padahal `video/page.tsx:21-32` sudah punya data. **Halaman valid tampil sebagai tidak ditemukan.**
- **`activity-log/page.tsx:19`** hanya izinkan `'manager'`, sementara `Sidebar.tsx:137` menampilkan
  menu ke `['manager','finance','executive','admin']` → role `admin` melihat error.

### 3.19 Halaman tanpa cek role sama sekali
Verified **nol** kemunculan `useAuth`/`isManager`/`role` di:
- `app/import-data/page.tsx` — menyediakan `CampaignSyncModal` mode `excel_acuan` yang
  `DELETE FROM campaign_creators` (`databaseActions.ts:1141-1144`) **tanpa confirm dialog**
  (hanya statistik merah di `CampaignSyncModal.tsx:337-340`). Terbuka semua role.
- `app/settings/page.tsx` — CRUD brand & niche, semua role.
- `app/skus/page.tsx` — CRUD SKU, semua role.
- `app/input-penjualan/page.tsx` — `isManager` dihitung di `:18` tapi **tidak pernah dipakai**.

### 3.20 `VideoClient` bisa rollback data tanpa jejak
`VideoClient.tsx:383-393` — dua `useEffect` menyalin `initialListingData`/`initialVideos`
(RSC props) ke local state setiap props berubah. RSC memberi array baru tiap navigasi,
jadi setiap `router.refresh()` **menimpa hasil fetch manual** yang mungkin lebih baru.
`VideoClient.tsx:363` juga selalu `setHasMore(false)` → tombol "load more" mati permanen.

### 3.21 Ganti akun tanpa reload = lihat data user lain
`DataLoader.tsx:11` `hasFetched` ref tidak di-reset; `AuthProvider.tsx:47-69` fetch profile
sekali di mount (`[]` deps). Setelah `signOut` → `signIn`, store masih berisi data user
sebelumnya sampai full reload. Untuk dashboard lintas-client ini serius.

### 3.22 Match campaign TikTok bisa salah (dampak GMV)
`tiktokAutoSync.ts:503-510` mencocokkan nama campaign dengan `includes()` **dua arah** tanpa
batas panjang minimum. Campaign internal `TNT` cocok dengan campaign TAP mana pun yang namanya
mengandung "TNT". **Otomatis, tanpa review, tanpa log.** GMV masuk campaign yang salah.
Bandingkan `stringSimilarity.ts:55` yangthreshold 50% tapi **hanya saran** — itu desain yang
benar, jangan diubah jadi otomatis.

### 3.23 Route yang tidak terjangkau
`/campaigns/[id]/keuangan/import` (hanya self-link), `/campaigns/[id]/alamat/import`
(dibuka via `window.open()` di `alamat/page.tsx:335` — satu-satunya yang tidak pakai Dialog).

---

## 4. Peta Otorisasi (yang SEHARUSNYA ada, dan yang tidak)

**Hanya 2 dari 22 modul `'use server'` yang punya guard otentikasi efektif:**
- `app/manajemen-akun/actions.ts` — punya `getAdminUser()` (`actions.ts:8-21`), satu-satunya
  pola yang benar. **Ini template yang harus digeneralisasi.**
- `app/portal/actions/portalActions.ts` — PIN check per campaign (tapi `updateClientNotes:775` lupa).

Server action yangreachable(user login staff/anggota) tanpa cek role/kepemilikan:
- Seluruh rantai approval pembayaran (`paymentActions.ts:808-1420`, 23 fungsi)
  → termasuk `financeMarkPaid:1009` dan `bulkMarkPaidFinance:1322` (tandai lunas + tulis `status_bayar='lunas'`).
- `updateProfileAction` (`databaseActions.ts:1248`) → **ubah role user mana pun jadi admin**. Twin tanpa auth dari `changeUserRole`.
- `updateUserCampaignsAction` (`databaseActions.ts:1272`) → **self-grant `all_campaigns`**.
- `updateCreatorPaymentAction` (`databaseActions.ts:524`) → tandai kreator lunas.
- `getInitialStoreData` (`storeActions.ts:104`) → semua campaign + semua profile + role.
- Semua bulk delete: `batchDeleteCampaignCreatorsAction` (`campaignPageActions.ts:2131`),
  `deleteCampaignAction` (`storeActions.ts:250`), `deleteSkuAction` (`storeActions.ts:304` — `campaignId` cuma untuk revalidatePath, tidak dipakai di WHERE), dll.
- API route tanpa auth: `/api/sync/tiktok-manual` (POST), `/api/sync-unmapped` (POST),
  `/api/expand-tiktok` (POST — **SSRF**: validasi `String.includes('vt.tiktok.com')` bisa
  di-bypass dengan `http://169.254.169.254/...#vt.tiktok.com`), `/api/cron/tiktok-sync` (`CRON_SECRET` opsional — kalau unset, terbuka).

**Yang benar (jadikan pola):**
- `manajemen-akun/actions.ts:8-21` `getAdminUser()` — cek session + cek role dari DB.
- `portalActions.ts:707-717` `updateResiByClient` — cek kepemilikan alamat terhadap campaign.
- `skuActions.ts:50` — `DELETE ... WHERE id=? AND campaign_id=?` (ownership di WHERE).

---

## 5. Aturan kerja saat mengubah kode

1. **Baca `node_modules/next/dist/docs/` dulu** untuk API Next 16 yang belum kamu kenal.
   `middleware` sudah jadi `proxy`. `staleTimes` masih `experimental`.
2. **Server action baru = wajib** panggilan guard server-side (`auth()` + cek role/kepemilikan).
   Jangan tiru pola lama yang hanya andalkan `canEditCampaign` client.
3. **Jangan sentuh** `db/schema.ts` kecuali menambah typing. Perubahan DB = file SQL baru
   di `web-app/supabase/migrations/` dengan timestamp monotonic. Tidak ada `drizzle-kit push`.
4. **Uang:** `bigint` untuk rupiah bulat, `NUMERIC(p,s)` berskala untuk desimal,
   `ROUND()` di SQL. Jangan `float`/JS number untuk akumulasi.
5. **TypeScript error sudah 89 dan `ignoreBuildErrors: true`.** Kalau kamu menambah
   error baru di area yang kamu sentuh, perbaiki sekalian. Jangan menambahkan yang baru.
6. **Jangan hardcode secret.** `process.env.X` tanpa fallback literal.
7. **UI language = Bahasa Indonesia.** Komentar/user-facing string juga Indonesia.
8. **Ikuti skill `ponytail`** (`.agents/skills/ponytail/SKILL.md`): native-first, minimalist,
   reuse sebelum bikin baru, anti-boilerplate. Dan **`revalidatePath` bukanemapin UI client** —
   jangan tambah sia-sia.
9. **Hormati `proxy.ts` public paths.** `/login`, `/api/auth`, `/auth`, `/portal` public.
   Kalau menambah API route baru, **tambahkan cek auth di dalam handler**, jangan andalkan proxy.
10. **Deploy:** hanya `web-app/` yang di-copy ke image. Root punya `Dockerfile` sendiri
    (multi-stage, `COPY web-app/ ./`). Tidak ada `.dockerignore` — build context bisa membengkak
    (node_modules lokal 544MB, `.next` 199MB). Pertimbangkan menambahkan `.dockerignore`.

---

## 6. Peta Route (40 halaman) — siapa pakai apa

| Route | Audience | Catatan |
|---|---|---|
| `/login` | publik | Google OAuth. Tidak ada daftar akun terpisah (UI "Daftar" cuma toggle label). |
| `/pending` | publik | Halaman mati — signIn selalu `status='approved'`, tidak pernah diarahkan ke sini. |
| `/` | staff+ | Dashboard summary (dari `vw_campaign_summary`). |
| `/campaigns` | staff+ | Daftar campaign + CRUD. |
| `/campaigns/[id]/concepts` | staff+ | Master konsep brief. |
| `/campaigns/[id]/listing` | staff+ | **142KB** — pivot campaign×creator. Import creator, rate card, tier. |
| `/campaigns/[id]/listing/import-creator` | staff+ | Import spreadsheet creator, validasi keras. |
| `/campaigns/[id]/video` | staff+ | **200KB** — video VT, approval draft, live. |
| `/campaigns/[id]/video/import` | staff+ | Import video manual. |
| `/campaigns/[id]/livestream` | staff+ | Sesi live + produk live. |
| `/campaigns/[id]/live` | staff+ | Jadwal live (`live_schedules`). |
| `/campaigns/[id]/daily` | staff+ | Timeline harian + target. |
| `/campaigns/[id]/performa` | staff+ | Performa creator (RPC). |
| `/campaigns/[id]/keuangan` | staff+ | **Batch pembayaran, palette.** Rantai approval. |
| `/campaigns/[id]/keuangan/import` | staff+ | Import batch historis. |
| `/campaigns/[id]/alamat` | staff+ | Alamat kirim + resi + expedisi. |
| `/campaigns/[id]/alamat/import` | staff+ | Import alamat. |
| `/campaigns/[id]/sku` | staff+ | CRUD SKU. |
| `/creator-pool` `/creator-pool/[id]` `/add` `/import` | staff+ | Master kreator. |
| `/input-penjualan` | staff+ | Import sales organic + ads. |
| `/ads-report` `/ads-report/budgeting-ads` `/ads-report/import-ads` | staff+ | Laporan & budget ads. |
| `/budgeting` | staff+ | Budget summary. |
| `/invoice` | staff+ | `payout_requests` approve/reject. |
| `/activity-log` | staff+ | `audit_logs` (500 terakhir). |
| `/skus` | staff+ | Master SKU global. |
| `/settings` | staff+ | Pengaturan. |
| `/extension` | staff+ | Panduan chrome extension. |
| `/auth/tiktok-shop/callback` | publik | OAuth callback TikTok Shop. |
| `/manajemen-akun` | **manager/executive** | One-satunya route dengan guard server (`page.tsx:8-20` redirect). |
| `/brand-portal/summary` | ? | Halaman statis, `force-dynamic`. Cek manual. |
| `/portal/[id]` `/portal/[id]/dashboard` | **PIN** | Untuk klien brand. 6 halaman. |

---

## 7. Kompleksitas Komponen (angka terukur — jangan lupa saat membagi file)

| File | Baris | useState | useEffect | alert | confirm |
|---|---|---|---|---|---|
| `app/campaigns/[id]/video/VideoClient.tsx` | 3.998 | 27 | 10 | 22 | 2 |
| `app/campaigns/[id]/listing/page.tsx` | 3.128 | 26 | 13 | 20 | 6 |
| `app/portal/[id]/PortalDashboardClient.tsx` | 2.012 | 16 | 3 | 3 | 0 |
| `app/creator-pool/[id]/page.tsx` | 1.558 | 16 | 2 | 5 | 1 |
| `app/campaigns/[id]/daily/DailyClient.tsx` | 1.468 | 2 | 1 | 0 | 0 |
| **Total** | **12.164** | **87** | **29** | **50** | **9** |

`VideoClient` memegang 8 domain (fetch, filter 3-dimensi, bulk import, TikTok embed, riwayat,
audit, export, revision notes). `listing/page.tsx` memegang 9 domain (batch-edit engine,
13 filter, paginasi server, duplicate merge, export, drag-fill, selection persist, recap matrix,
revision notes). Saat memecah: **pindahkan kode apa adanya**, jangan ubah markup atau
ownership state di sesi yang sama — refactor behaviour = proyek terpisah.

---

### 3.24 Verified 30 Sep 2026 — database produksi, bukan dari kode

**`db_tnt_project_system` diakses lewat:**
```bash
docker exec -it 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
```
Dari PC lokal **tidak bisa** (hostname internal Docker; IP publik timeout).
Container DB lain: `kqgwtzqknu9axud1urkau5si` = `sales_novacore` (CRM tim sales — BUKAN milik TNT).
Jangan salah akses.

**Empat klaim audit yang ternyata SALAH** (verifikasi ulang sebelum percaya):
| Klaim lama | Kenyataan produksi |
|---|---|
| `organic_videos` duplikat karena `product_id` NULL | ❌ `UNIQUE NULLS NOT DISTINCT` sudah menutup. Duplikat sejati **0** |
| `campaign_creators` tidak ada unique | ❌ `UNIQUE (campaign_id, creator_id)` **ada** |
| RPC `get_campaign_creator_performance` arity beda | ❌ Yang aktif 1 param, pemanggilnya 1 param |
| `schema.ts` salah total | ⚠️ Benar sebagian — `sales` ternyata cocok, tapi 8 tabel memang tidak ada |

**Pelajaran: klaim dari kode HARUS diverifikasi ke DB.** Saya sempat salah melabeli
`raw_data.autoGeneratedFromOrder` sebagai milik Excel — sebenarnya dari `tiktokAutoSync.ts:436`.

**`sales` terverifikasi (30 Sep 2026, sebelum perbaikan):**
```
32.813 baris · Rp 1.394.297.454 · kreator 948 · produk 221
Excel 25.774 + auto-sync 7.039 (tidak pernah dedup; autosync_unik = 0)
```

**`campaigns.status` CHECK hanya `('aktif','selesai')`** — UI punya tab `Arsip`
(`campaigns/page.tsx:322-324`) tapi **tidak bisa dipakai** sebelum constraint dilonggarkan.

**`content_type` & `order_status` campur huruf besar-kecil** (`Video`/`video`, `SETTLED`/`Settled`).
Mayoritas kode aman, kecuali `portalActions.ts:369,379,478`.

**Tidak ada tabel lain yang menunjuk `sales`** → hapus baris aman dari sisi FK.

**4 trigger audit (`log_cc_*`): funsinya ada, trigger-nya TIDAK pernah di-mount.**
`audit_logs` cuma 7 baris. Fungsinya salah kolom → kalau di-mount tanpa perbaikan,
**setiap update harga/approval akan error dan membatalkan seluruh query.**

**Healthcheck Coolify salah rujuk ke database `hypetracking` (tidak ada)** → container
selalu `unhealthy` padahal DB-nya sehat (`pg_isready` → accepting connections).

### 3.25 PENTING: filter `is_refund` jangan dihapus dulu (30 Sep 2026)

`vw_campaign_summary` + `daily_performance` memakai `WHERE is_refund = false`.
Filter itu **saat ini SANGAT PENTING** dan tidak boleh dihapus:

```
Tabel sales sekarang     : Rp 1.376.546.880
Yang tampil di dashboard  : Rp 1.376.546.880 - Rp 309 juta  (is_refund = false)
Kalau filter dihapus     : naik ke Rp 1.686 juta  ← +23% PALSA
```

Sebabnya 7.039 baris auto-sync salah flag `is_refund = true` dan **semuanya punya
kembaran di Excel** (`autosync_unik = 0`). Filter itu kebetulan yang menyembunyikan
kembaran tersebut dari dashboard.

> Menghapus filter tanpa menghapus baris auto-sync = dashboard naik 23% palsu.
> Urutan wajib: **hapus baris auto-sync DULU, baru hapus filter.**
> User sudah memutuskan auto-sync disampingkan dulu, jadi filter TETAP ADA.

Konsekuensi yang diterima: **Performa** dan **Livestream** (tidak memfilter
`is_refund`) masih over-count ±23% sampai auto-sync diputuskan.

### 3.26 Cara kirim SQL ke VPS (pola yang terbukti bekerja)

Terminal SSH sering memotong paste panjang. Pola yang andal:
```bash
# 1. base64 dipecah per ~600 karakter, dikirim satu per satu
echo -n '<chunk1>' >> /tmp/b64.txt
echo -n '<chunk2>' >> /tmp/b64.txt
# 2. decode + jalankan
base64 -d /tmp/b64.txt > /tmp/x.sql
cat /tmp/x.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
```
> Kalau file tidak berisi `COMMIT`, `psql` keluar dan transaksi **otomatis rollback**.
> Jadi `cat | docker exec` tidak bisa dipakai untuk script yang butuh interaksi manual
> (ketik COMMIT di psql). Selalu taruh `COMMIT` di dalam file, dan pakai
> `DO $$ ... RAISE EXCEPTION` sebagai pengaman: kalau angka tidak sesuai,
> PostgreSQL batalkan sendiri.

### 3.27 Dedupe `sales` — SUDAH SELESAI (30 Sep 2026)

```
                 SEBELUM      SESUDAH
baris sales        32.813  ->    32.320
GMV         1.394.297.454  -> 1.376.546.880
quantity/kreator/produk  ->  TIDAK BERUBAH (aman)
```
Backup: `sales_aman_backup_20260930`. Sisa **58 kelompok ambigu** dibiarkan
(beda GMV antar baris > 100 rupiah, tidak bisa diputuskan mesin).

---

## 8. Referensi dokumen

- `docs/KONTEKS-DATABASE.md` — **peta database terverifikasi produksi** (tabel, view, fungsi, angka asli).
- `docs/ARCHITECTURE-CURRENT.md` — deskripsi arsitektur akurat (tidak seperti ARCHITECTURE.md lama yang stale).
- `docs/audit/2026-09-30-AUDIT.md` — laporan audit lengkap (DB, auth, frontend, pipeline).
- `docs/audit/REMEDIATION-PLAN.md` — rencana perbaikan bertahap.
- `docs/DOMAIN-CHEATSHEET.md` — cheat sheet query & istilah.
- `web-app/scripts/one-time-data-fix/` — perbaikan `order_id` + `is_refund` + status `arsip` (SQL, transaksi, backup).
- `ARCHITECTURE.md` (root) — **DOKUMEN LAMA (v2.2), sebagian tidak akurat.** Baca sebagai sejarah, bukan kebenaran.
- `web-app/supabase/migrations/` — sumber kebenaran DDL (43 file). **Kurang 6 view** — lihat §3.24.
- `web-app/.agents/skills/ponytail/SKILL.md` — gaya kode minimal.

---

## 9. Cara memperbarui skill ini

Setelah sesi yang modify kode, jika ada temuan baru (jebakan, keputusan arsitektur, nama
kolom yang mengejutkan), **tambahkan ke §3 atau §5 pada sesi yang sama**. Skill ini
nilainya dari akurasi — entry basi lebih buruk dari tidak ada entry.

---

## 10. Ringkasan 10 Hal yang Harus Diingat

1. **`schema.ts` tidak bisa dipercaya.** Sumber kebenaran DDL = `web-app/supabase/migrations/`.
   Jangan pernah `drizzle-kit push`. 8 tabel tidak ada di schema.ts.
2. **Otorisasi hanya di client.** Server action = endpoint publik. Menutupi tombol tidak
   menutupi kemampuan. `updateProfileAction` (`databaseActions.ts:1248`) = staff bisa jadi admin.
3. **`whitelisted_emails` bukan whitelist.** Login = siapa pun dengan akun Google.
   Email mengandung "admin"/"executive" otomatis dapat role executive.
4. **Tidak ada transaksi** di jalur import/sync mana pun (kecuali `listingActions.ts:127`).
   Kegagalan tengah = data setengah jadi atau hilang permanen.
5. **Tidak ada rate limit / retry / timeout** di TikTok API wrapper. `Promise.all` tanpa batas.
   `maxDuration = 60` di cron route tidak realistis.
6. **GMV bisa masuk campaign yang salah** lewat fuzzy match `includes()` dua arah
   (`tiktokAutoSync.ts:503`). Dampak finansial, tidak reversible tanpa sync ulang.
7. **Unmapped bisa di-retag retroactive** tanpa filter tanggal dan tanpa konfirmasi
   (`syncUnmapped.ts:31-45`).
8. **Store mengosongkan `creators`** → 3 modal sync tidak bisa match username. Fitur mati
   tanpa error. Kalau user lapor "semua import kelihatan kreator baru", ini penyebabnya.
9. **Tidak ada auto-refresh setelah mutasi** dan `revalidatePath` tidak berefek untuk UI client.
   Jangan "perbaiki" — itu sisa era Supabase Realtime dan user sudah terbiasa.
10. **Next 16, bukan Next 14/15.** Baca `node_modules/next/dist/docs/` dulu.
    `middleware` → `proxy`. `experimental.staleTimes` masih experimental.
