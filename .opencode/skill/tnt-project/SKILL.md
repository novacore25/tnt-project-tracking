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
| **Organic** | GMV dari link organic/affiliate tanpa Ads. **Ini satu-satunya sumber total GMV** | `sales` |
| **Ads / VSA** | GMV dari iklan TikTok Ads. **KUMULATIF per ad — jangan `SUM`.** Ditampilkan terpisah, tidak dijumlahkan ke total | `ads_performance` |
| **Custom report** | Awareness + hitung video saja. **Bukan untuk sales** | `organic_videos`, `live_session_products` |
| **GMV** | Gross Merchandise Value, dalam IDR. **Hanya dari `order_id` di `sales`.** Lihat §3.34 | `sales.gmv` (bigint) |
| **Komisi** | Fee creator, `%` | `skus.komisi` |
| **Rate card** | Harga tetap per posting | `campaign_creators.price` |
| **PIC** | Person in charge (internal) | `campaign_creators.notes_pic` |
| **Plafon** | Budget cap | `campaigns.budget_creator_plafon` / `budget_ads_plafon` |
| **Tier** |nano/micro/macro/mega + live | `campaign_creators.tier` |
| **Unmapped** | Order/video TikTok yang tidak bisa dipetakan ke campaign/SKU/creator | `syncUnmapped.ts` |
| **Batch** | Header pengajuan pembayaran massal`payment_batches` |
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
  `'use client'`** → revalidate tidak berguna untuk render client. Ini bukan bug,,
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

Read these before touching anything. Mengabaikannya = regresi data atau fatal.

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
Jangan tulis query yang "menganggap" RLS protecting-nya.

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

### 3.28 `.catch(() => [])` menyembunyikan query yang SELALU gagal (1 Okt 2026)
Pola `db.execute(sql\`...\`).catch(() => [])` dipakai di mana-mana. Kalau query-nya salah,
hasilnya array kosong — **tidak ada error, tidak ada log, UI tetap render** dengan angka nol.
User melihat "data tidak ada", padahal query-nya memang tidak pernah jalan.

**Verified: `creatorActions.ts:175` `ORDER BY order_time`.** Tabel `sales`
(`20260610000001_phase_2.sql:19-36`) tidak punya kolom `order_time` — kolom tanggalnya `tanggal`.
Query itu **selalu** error → `sales: []` → seluruh tab "Data Pesanan (Sales)" dan kolom
"Total GMV Campaign" di profil kreator **selalu kosong untuk semua kreator**.
`src/db/schema.ts:306` ikut salah (`orderTime: timestamp('order_time')`) — contoh terbaru
kenapa schema.ts tidak bisa dipercaya.

**Aturan:** kalau menyunting query, jangan`|catch(() => [])` polos di location yang datanya
penting. Ganti dengan `catch(err => { console.error('<fungsi>: query X gagal', err); return []; })`.
Error harus kelihatan di log server.

### 3.29 Tiga halaman baca universe data BERBEDA untuk sales/organic_videos
Halaman yang berbeda menghitung GMV yang berbeda dari data yang sama.

| Halaman | Filter `sales` | Sumber |
|---|---|---|
| Performa | `campaign_id = X` **OR** `product_id IN (skus of X)` | `campaignPageActions.ts:365-366` |
| Video & VT | **hanya** `campaign_id = X` (perbaiki 1 Okt 2026) | `videoActions.ts` |
| Profil kreator | **hanya** `campaign_id = X` (perbaiki 1 Okt 2026) | `creator-pool/[id]/page.tsx` |

Karena mayoritas baris `sales.campaign_id` **NULL** (keterkaitannya hanya ada di `product_id`),
hanya Performa yangoriginally benar. Selain itu Performa masih Persempit dengan `skuSet`
(`PerformaClient.tsx:115`) sedangkan dua halaman lain tidak — jadi angka tetap bisa beda.

**Aturan:** saat menambah halaman aggregate, salin **persis** pola filter dari
`fetchPerformaPageFullDataAction` (`campaignPageActions.ts:365-378`). Jangan `WHERE campaign_id = X` saja.

### 3.30 `organic_videos` bisa punya BARIS GANDA per `content_uid` → over-count
Tabel ini satu baris per (`content_uid`, tanggal import). Video yang sama bisa muncul berkali-kali
karena laporan TikTok di-import beberapa hari.

- Performa & `campaignPageActions` dedup pakai `Math.max` per `content_uid` (`PerformaClient.tsx:153-157`).
- Video & VT **tidak** — menjumlahkan semua baris. Views/likes bisa berlipat (perbaiki 1 Okt 2026).
- Profil kreator juga tidak.

Snapshot TikTok = nilai **terkecil** per metrik (views/likes naik monoton), tapi campaign
perCreative bisa turun. Ambil `Math.max` = snapshot terakhir = benar untuk views/likes.

### 3.31 Username kreator bisa berbeda kapitalisasi, GMV terhitung 2x
`bunaandshanum` dan `Bunaandshanum` ada sebagai **dua baris `creators` terpisah**
(terlihat di `/campaigns/36/performa`: keduanya `12 pcs`, `Rp 202.255`).

Semua agregasi server memakai `username.toLowerCase()` sebagai key Map
(`videoActions.ts:144/159/179`), jadi **kedua baris dapat angka yang sama persis** —
lalu campaign total terhitung **dua kali**. Barisnya tidak digabung, hanya datanya yang kembar.

**Verified: harus dicek di DB** - query ada di `docs/sql/17-audit-username-duplikat.sql`.
Jangan pakai `UNIQUE` case-insensitive tanpa memutuskan baris mana yang benar,
karena `campaign_creators` FK-nya sudah terlanjur terisi.

### 3.32 Kolom `vt_code` tidak pernah ada di tabel `videos`
Dipakai di `creator-pool/[id]/page.tsx:176` dan `:1131` sebagai pembanding. Selalu `undefined`.
Sudah dihapus 1 Okt 2026. Kalau ketemu lagi di file lain, itu sisa kode mati.
`videos` juga **tidak punya** `campaign_id` — campaign hanya terjangkau lewat join
`campaign_creators`, dan **tidak punya** kolom views/likes (tinggal di `organic_videos`).

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

11. **Jangan pakai `.catch(() => [])` polos di query yang datanya penting.** Itu menyembunyikan
     query yang selalu gagal - UI render normal dengan angka nol, tidak ada error, tidak ada log.
     `creatorActions.ts:175` terbukti seperti ini, query `ORDER BY order_time` ke kolom yang
     tidak pernah ada, hasilnya semua profil kreator kehilangan data sales (lihat 3.28).
     Kalau menyunting query, tulis `catch(err => { console.error(...); return []; })`.
12. **Halaman aggregate baru = salin persis pola filter dari `fetchPerformaPageFullDataAction`**
     (`campaignPageActions.ts:365-378`). Jangan `WHERE campaign_id = X` saja, karena
     kebanyakan baris `sales.campaign_id` NULL sehingga GMV hilang. Lihat 3.29.
13. **Halaman aggregate baru = dedup `organic_videos` per `content_uid` pakai `Math.max`.**
     Tabel itu satu baris per (content_uid, tanggal import). Tanpa dedup views/likes berlipat.
     Lihat 3.30.
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

### 3.33 `pg` mengembalikan `bigint`/`numeric` sebagai STRING — 12 tempat salah (1 Okt 2026)

**Ini jebakan paling merusak karena tidak kelihatan.** Driver `pg` mengembalikan kolom
`bigint` dan `numeric` sebagai string supaya presisi tidak hilang. Akibatnya:

```ts
0 + "3191697"           // -> "03191697"     RANGAI, bukan penjumlahan
"03191697" + "21080919" // -> "0319169721080919"
```

Gejalanya di UI: `Rp 0319169702108091919018000990010900113361919011...` — angka
ribuan digit. **Digit `0` di depan itu `sum` awal yang sudah jadi string**, sisanya
seluruh nilai gmv dirangkai. Totalnya **nol**, bukan cuma salah format.

**Semua penjumlahan rupiah WAJIB lewat `sumNum` / `toNum` di `utils/computed.ts`:**

```ts
import { sumNum, toNum } from "@/utils/computed";
const gmv = sumNum(rows, r => r.gmv);          // aman
const total = rows.reduce((s, r) => s + (r.gmv || 0), 0);  // BAHAYA
```

Kolom yang terkena: `sales.gmv`, `payment_items.nominal`,
`campaign_creators.nominal_pelunasan`, `campaigns.target_gmv`, `live_sessions.gmv`.
**Termasuk halaman KEUANGAN** — total pembayaran pernah salah.

Sudah diperbaiki di 12 tempat. Pola yang benar sudah ada di `RekapAdsTab.tsx` dan
`LivestreamClient.tsx` (`Number(x) || 0`) — ikuti yang sudah ada, jangan buat pola baru.

Untuk render nominal rupiah: `Math.round(toNum(x)).toLocaleString('id-ID')`.
`toLocaleString()` pada string **tidak menambah pemisah ribuan**, jadi formatnya
juga salah, bukan cuma angkanya.

### 3.34 `sales` dan `organic_videos` punya universe BERBEDA (1 Okt 2026)

Aturan domain dari pemilik sistem - inilah yang mendefinisikan GMV:

> **Total GMV dihitung dari `order_id` saja.** Order dengan `content_type` live
> dihitung GMV live, selain itu GMV video. **Custom report hanya untuk awareness
> dan menghitung jumlah video, bukan untuk sales.** Ads Manager juga bukan revenue
> tambahan, karena order-nya sudah tercatat di `sales`.

Konsekuensi langsung:
- `live_session_products.gmv` (Rp 1.255.186) **TIDAK** masuk total GMV
- `ads_performance.gross_revenue_usd` **TIDAK** dijumlahkan dengan `sales.gmv`
- `organic_videos` hanya menyumbang video/awareness, tidak menyumbang GMV
- Pemetaan selalu lewat **`product_id`**, bukan `sku_id`. Nama `sku_id` di kode
  cuma penamaan historis; yang disimpan di menu Produk per campaign adalah
  `product_id` dari TikTok.

### 3.35 `ads_performance` KUMULATIF per ad — `SUM` salah, harus MAX per ad (1 Okt 2026)

`gross_revenue_usd` dan `purchases` **naik monoton per tanggal**. Untuk OMG Makeup
`MAX` per tanggal datar di ~Rp 74 juta selama tiga minggu, sementara `SUM` merangkak
ke Rp 786 juta. 20 tanggal x ~400 juta = Rp 8,05 miliar, persis total yang muncul.

Terbukti juga oleh `ads_lifetime_snapshots` (tabel yang memang dirancang untuk ini):
satu ad naik 1978,11 → 3979,25 → 5996,83 sepanjang Juni.

Konsekuensi:
```sql
-- SALAH: menghitung ulang revenue yang sama
SELECT campaign_id, SUM(gross_revenue_usd * kurs) FROM ads_performance GROUP BY 1
-- BENAR: satu ad = satu nilai
SELECT campaign_id, ad_id, MAX(gross_revenue_usd*kurs), MAX(cost_usd*kurs)
FROM ads_performance GROUP BY 1,2
```

Dampaknya ke budget: 5 campaign dilaporkan "over budget" padahal dalam budget
(OMG Makeup tercatat Rp 204 juta dari plafon Rp 60 juta, sebenarnya Rp 15,4 juta).

**`purchases` juga bukan attributable ke iklan** — 16.200 pembelian berbanding 31
order sales di hari yang sama (15 Jun 2026). Jadi jangan pakai kolom `purchases`
untuk ROAS atau CPA.

Ada infrastruktur yang sudah ada tapi **tidak dipakai**: `ads_performance_delta`
(punya `delta_gross_revenue_usd` dan `lifetime_gross_revenue_usd`) dan
`ads_lifetime_snapshots`.

### 3.36 `kurs` rusak di 314 baris (belum diperbaiki, 1 Okt 2026)

`ads_performance.kurs` tersimpan `16.993` (bukan `16993`) di **314 dari 1.130
baris** — revenue baris itu **1000x terlalu kecil**. Penyebabnya dua:
- `importActions.ts:475` punya heuristics `if (kurs < 1000) kurs *= 1000` yang
  benar, TAPI
- `campaignPageActions.ts:234` melakukan `UPDATE ads_performance SET kurs = $kurs`
  **tanpa guard** — itulah yang menulis nilai rusak

Sebanyak 816 baris memakai `kurs = 18000` bulat, bukan kurs harian (terverifikasi
16.993–18.045). Selisih sampai ~6%.

**Belum diperbaiki** karena mengoreksinya menaikkan angka, dan harus tahu dampaknya
ke budget lebih dulu.

### 3.37 Migration gagal 10x karena migration TIDAK bisa diandalkan (1 Okt 2026)

**File `web-app/supabase/migrations/` bukan sumber kebenaran untuk constraint.**
Migration merge creator gagal **10 kali berturut-turut**, tiap kali karena hal yang
tidak tertulis di migration:

| Gagal | Yang sebenarnya |
|---|---|
| query menggantung | `videos` **tidak punya index sama sekali** |
| syntax error | `WITH` di branch kedua `UNION ALL` |
| "Batal" | rantai merge `100→200→300` |
| duplicate key | bentrok muncul **setelah** `UPDATE` |
| duplicate key | `creator_niches` punya **PK `(creator_id, niche_id)`** |
| macet 49x | `JOIN _merge_map` **menggandakan baris** |
| FK violation | 1.279 baris "aman" **tidak pernah di-update** |

Tabel yang **tidak ada di migration manapun** padahal ada di DB:
`organic_videos`, `creator_address_book`, `ads_lifetime_snapshots`,
`ads_performance_delta`. Kolom yang **tidak ada** padahal dipakai kode:
`campaign_creators.assigned_sku_ids`, `live_sessions.gmv`.

**Aturan baru: sebelum menulis migration yang UPDATE/DELETE baris, jalankan preflight
`docs/sql/40-preflight-constraint.sql` yang membaca katalog PostgreSQL langsung.**

Yang perlu dicek dan hasilnya terverifikasi 1 Okt 2026:
- **3 constraint** saja yang bisa bentrok: `campaign_creators (campaign_id, creator_id)`,
  `creator_niches (creator_id, niche_id)`, `creator_bank_accounts (creator_id, bank_name, account_number)`
- 9 tabel lain punya `creator_id` tapi PK-nya cuma `id` atau `ad_name` → aman

### 3.38 Empat aturan SQL yang harus diingat (1 Okt 2026)

Keempatnya costing satu migration gagal. Semuanya valid untuk SELURUH query,
bukan cuma merge:

**a) `UPDATE` berurutan MEMBUAT bentrok yang tidak ada sebelumnya.**
Menghitung collision list sekali lalu `UPDATE` sisa **tidak cukup**, karena `UPDATE`
itu sendiri bisa menabrak. Harus **pikir per GRUP, bukan per baris**: pilih satu
selamat per `(root_id, campaign_id)`, pindahkan video, union sku, set creator_id
selamat itu, hapus sisanya.

**b) Satu `creator` bisa jadi `keep_id` untuk BANYAK `merge_id`.**
`JOIN _merge_map m ON cc.creator_id IN (m.merge_id, m.keep_id)` memasukkan baris
yang sama **dua kali** ke `array_agg` → `count(*)=2` padahal cuma satu baris nyata →
loop tidak pernah menyusut. **Buat peta `_root` dulu: satu baris per creator.**

**c) `ON CONFLICT DO UPDATE` tidak boleh menyentuh baris konflik yang sama 2x.**
```
ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time
```
Solusi: `SELECT DISTINCT ON (target_key) ... ORDER BY target_key, prioritas DESC`
sebelum `INSERT ... ON CONFLICT`.

**d) `ON CONFLICT` + `DO UPDATE` = pola yang lebih aman daripada loop** kalau target-nya
PK/UNIQUE sederhana. Terapkan juga ke tabel yang tidak bentrok *saat itu* — karena
bentrok bisa muncul di tengah proses, bukan hanya sebelumnya.

### 3.39 Cache `raw.githubusercontent.com` di jalur VPS (1 Okt 2026)

Path `main` **di-cache** dan query string **diabaikan**, jadi file lama terus
tersaji meski sudah `git push`. Gejalanya: output identik setelah commit baru, dan
banner `\pset` yang sudah dihapus masih muncul.

**WAJIB pakai commit SHA di path**, bukan `main`:
```bash
curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/x.sql" | ...
```
Verifikasi cepat kalau benar versinya:
```bash
curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/x.sql" | grep -c "penanda-unik-dari-file"
```

### 3.40 Tabel/views yang tidak ada di migration tapi nyata (1 Okt 2026)

Inventaris lengkap via katalog. Penting karena beberapa sudah jadi sumber GMV:

| Objek | Isi | Status |
|---|---|---|
| `organic_videos` | 56.660 baris, UNIQUE `(content_uid, product_id) NULLS NOT DISTINCT` | dipakai app |
| `ads_lifetime_snapshots` | 1.388, snapshot kumulatif per ad | bukti ads kumulatif |
| `ads_performance_delta` | view, punya `delta_*` + `lifetime_*` | tidak dipakai view mana pun |
| `creator_address_book` | ada, **tidak ada di migration** | FK CASCADE |
| `campaign_total_sales` | view, **tidak konsisten** dengan `sales` | jangan dipakai |
| `campaign_creators_performance` | view 23.523 baris | |
| `sales_aman_backup_20260930` | 32.813 baris | sumber pemulihan 951 order |
| `sales_bk_20260930b` | 32.320 baris | snapshot `sales` 30 Sep |
| `sales_excel_backup_20260930` | 25.774 baris | sumber pemulihan 951 order |

`daily_performance` **ada di migration tapi tidak pernah diisi** — 0 baris, tidak ada
satu pun INSERT di seluruh codebase. Field `official_daily_gmv` dan
`total_daily_organic` selalu 0 = **field mati**.
`gmv_organic_legacy` / `gmv_ads_legacy` = 0 di semua campaign = **field mati**.

### 3.41 951 order hilang dari `sales`, sudah dipulihkan (1 Okt 2026)

Dua backup independen (`sales_aman_backup_20260930`, `sales_excel_backup_20260930`)
sama-sama punya **951 `order_id` yang tidak ada di `sales`**, GMV Rp 34.257.539.
Normal semua: 950 bukan refund, tanggal dalam rentang, `content_uid` terisi,
912 punya `campaign_id`. Sudah dipulihkan migration `20261001210000`.

`order_id` UNIQUE jadi ini|data hilang, bukan duplikat.

### 3.42 Tag `product_id` palsu di `organic_videos` — SUDAH DIBERSIHKAN (1 Okt 2026)

362 video ter-tag 21–70 `product_id` sekaligus, tersebar di 7 campaign brand
berbeda. Satu video tidak mungkin menjual 7 brand. Bukti: di `sales`, video yang
sama hanya muncul dengan 0–2 product; 4.433 dari 4.436 order tidak bisa
dipetakan ke campaign manapun.

**Penyebabnya BUKAN kode** — `syncUnmapped.ts:49` hanya `UPDATE ... WHERE product_id = X`
dan `importActions.ts:129` sudah dedup per pasangan. Sumbernya file ekspor TikTok
yang salah associate.

Cara memetakannya: `organic_videos.tiktok_campaign_id = ANY(campaigns.tiktok_campaign_ids)`.
**329 dari 362** resolve ke tepat 1 campaign. Selesai migration
`20261001150000`, hapus 10.851 tag. 0 video hilang, views/likes per video utuh.
33 video tanpa bukti dibiarkan utuh.

**Pola ini juga successfully dipakai untuk 9.060 order yang tadinya terlihat salah
atribusi — setelah diuji ketat, semuanya `ambigu` (tiktok_campaign_id ada di array
beberapa campaign), nol yang benar-benar berbeda.**

### 3.43 `creators.username` UNIQUE tapi case-SENSITIVE (1 Okt 2026)

`syncUnmapped.ts` INSERT dengan username **sudah di-lowercase** dan hanya
bergantung pada `ON CONFLICT (username)` → `Bunaandshanum` dan `bunaandshanum`
bisa sama-sama ada. 10 dari 11 titik INSERT lain sudah benar (lookup `LOWER()` dulu).

Sudah diperbaiki + `UNIQUE INDEX ON creators(LOWER(username))` (DB-level, 11 titik
INSERT tidak bisa.Selected merge 619 creator, dan `campaign_creators` yang
(campaign, username) sama sekarang **0** → video tidak lagi terhitung 2x di Performa.

**Kelas kedua yang TIDAK tertangkap `LOWER()`: beda tanda baca.**
`emak_kekinian` / `emak__kekinian` (3 `content_uid` sama) — sudah digabung karena
**ada bukti** (video sama atau campaign sama). 349 pasangan **tanpa** bukti
(`Aisyah Fitriani` / `AisyahFitriani`) **sengaja dibiarkan** — menggabungkan tanpa
bukti = menebak orang.

### 3.44 Cara mengirim SQL ke VPS yang terbukti berhasil (1 Okt 2026)

```bash
# WAJIB pakai commit SHA, bukan "main" — cache mengabaikan query string
curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/<file>.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
```

Migration yang butuh gagal-batal:
```bash
... -v ON_ERROR_STOP=1
```

**Pola yang dipakai berhasil:** letakkan `\set ON_ERROR_STOP off` + `\echo` di setiap
section, supaya error di satu bagian **tidak menghilangkan** bagian lain. Lihat
`docs/sql/33` yang gagal di 7 dari 10 section tapi tetap memberikan info.

Untuk SQL read-only yang panjang, `\pset pager off` + `\t on` supaya `\echo` jelas.

### 3.45 Daftar asumsi saya yang SALAH (1 Okt 2026)

Hari ini saya **salah 6x** sebelum migration pertama jalan. Semuanya ketahuan karena
diuji dulu, dan **tidak ada data yang hilang** — itu yang menyelamatkan. Daftarnya:

| Asumsi | Kenyataan |
|---|---|
| `legacy_gmv` penyebab selisih GMV | Kolomnya **nol semua** |
| duplikasi `ads_performance` | Faktor **1,00** |
| `ads_performance` = revenue sama | **Benar** (Rp 1,74 M vs Rp 920 M) |
| `live_sessions` punya kolom `gmv` | **Tidak ada** — ada di `live_session_products` |
| `creator_snapshots.gmv_30d_organic` | **Tidak ada** |
| 9.060 order salah atribusi | Semua `ambigu`, **nol berbeda** |

**Aturan:jangan tulis migration dari asumsi.** Urutan yang benar: query read-only
→ baca angka → baru migration. Dan kalau migration gagal, **baca error-nya sebagai
data** — 10 kegagalan itu semua memberi informasi yang converging.

---

## 8. Referensi dokumen

- `docs/KONTEKS-DATABASE.md` — **peta database terverifikasi produksi** (tabel, view, fungsi, angka asli).
- `docs/ARCHITECTURE-CURRENT.md` — deskripsi arsitektur akurat (tidak seperti ARCHITECTURE.md lama yang stale).
- `docs/audit/2026-09-30-AUDIT.md` — laporan audit lengkap (DB, auth, frontend, pipeline).
- `docs/audit/REMEDIATION-PLAN.md` — rencana perbaikan bertahap.
- `docs/DOMAIN-CHEATSHEET.md` — cheat sheet query & istilah.
- `web-app/scripts/one-time-data-fix/` — perbaikan `order_id` + `is_refund` + status `arsip` (SQL, transaksi, backup).
- `ARCHITECTURE.md` (root) — **DOKUMEN LAMA (v2.2), sebagian tidak akurat.** Baca sebagai sejarah, bukan kebenaran.
- `web-app/supabase/migrations/` — DDL, tapi **tidak bisa dipercaya untuk constraint**. Lihat §3.37.
- `web-app/.agents/skills/ponytail/SKILL.md` — gaya kode minimal.

### `docs/sql/` — query audit 1 Okt 2026 (read-only kecuali disebut lain)

Semua file ini **read-only** kecuali yang ada di `web-app/supabase/migrations/`.
Jalankan dengan **commit SHA** di URL, bukan `main` (§3.44).

| File | Isi |
|---|---|
| `19-urai-asal-total-gmv.sql` | Mengurai asal Rp 12,5 M di dashboard -> **ads_performance** |
| `20-dry-run-merge-creator.sql` | Dry-run merge creator (superseded oleh 40) |
| `21-akurasi-video-profil.sql` | Buktikan `organic_videos` **nol duplikat** sejati |
| `22-vi-banyak-sku.sql` | Buktikan cross-join tag `product_id` |
| `25-cek-tag-palsu.sql` | Verifikasi sebelum bersihkan tag palsu |
| `29-kontradiksi-terakhir.sql` | Bentrok video yang terlewat |
| `33-sumber-gmv-lain.sql` | Inventaris sumber GMV (error di beberapa section) |
| `34-inventaris-gmv.sql` | Tabel/view yang tidak ada di migration |
| `35-order-hilang.sql` | Lacak **951 order** yang hilang dari `sales` |
| `36-gmv-tanpa-campaign.sql` | Rp 224 M tanpa `campaign_id` |
| `37-daftar-produk-daftarkan.sql` | 91 `product_id` yang perlu didaftarkan |
| `38-daftar-kerja-produk.sql` | **Daftar kerja** 91 produk + nama dari `raw_data` |
| `39-duplikat-creator.sql` | Pisahkan duplikat creator jadi 3 kelas |
| **`40-preflight-constraint.sql`** | **WAJIB** sebelum migration UPDATE/DELETE |
| `21`, `22`, `25` | Digunakan untuk investigasi tag palsu |

---

## 9. Cara memperbarui skill ini

Setelah sesi yang modify kode, jika ada temuan baru (jebakan, keputusan arsitektur, nama
kolom yang mengejutkan), **tambahkan ke §3 atau §5 pada sesi yang sama**. Skill ini
nilainya dari akurasi — entry basi lebih buruk dari tidak ada entry.

---

## 10. Ringkasan 12 Hal yang Harus Diingat

### 10a. Aturan data (paling sering dilanggar)

1. **Total GMV = `SUM(sales.gmv)` saja.** Non-refund, dipecah live/video dari `content_type`.
   **Jangan** tambahkan `ads_performance` (revenue yang sama, dan `SUM`-nya salah karena
   kumulatif per ad) atau custom report (awareness, bukan sales). Lihat §3.34-3.35.
2. **`pg` mengembalikan `bigint`/`numeric` sebagai STRING.** `0 + "123"` = `"0123"`. Semua
   penjumlahan rupiah **wajib** lewat `sumNum`/`toNum` dari `utils/computed`. 12 tempat pernah
   salah, termasuk halaman keuangan. Lihat §3.33.
3. **`schema.ts` DAN `supabase/migrations/` sama-sama tidak bisa dipercaya untuk constraint.**
   Migration merge gagal **10x** karena batasan yang tidak tertulis di file. Jalankan
   `docs/sql/40-preflight-constraint.sql` (baca katalog PostgreSQL) **sebelum** menulis migration
   yang melakukan UPDATE/DELETE. Lihat §3.37.
4. **`UPDATE` berurutan membuat bentrok yang belum ada sebelumnya.** Untuk dedupe/merge **pikir
   per GRUP**, bukan per baris: pilih satu selamat, pindahkan relasi, union kolom, hapus sisanya.
   Dan **satu parent bisa punya banyak child**, jadi buat peta `_root` satu-baris-per-creator,
   karena join langsung menggandakan baris dan loop tidak akan pernah selesai. Lihat §3.38.
5. **Pemetaan selalu lewat `product_id`, bukan `sku_id`.** Nama `sku_id` di kode cuma
   penamaan historis. Yang diisi di menu Produk per campaign = `product_id` dari TikTok.
6. **`raw.githubusercontent.com` di jalur VPS men-cache path `main`.** Selalu pakai commit SHA
   di URL, dan verifikasi dengan `grep -c` penanda unik file sebelum jalankan. Lihat §3.44.

### 10b. Jebakan lama yang masih berlaku

1. **`schema.ts` tidak bisa dipercaya.** Sumber kebenaran DDL = `web-app/supabase/migrations/`.
   Jangan pernah `drizzle-kit push`. 8 tabel tidak ada di schema.ts.
   (Dan untuk *constraint*, migration juga tidak bisa dipercaya - lihat §3.37.)
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

### Cara kerja yang terbukti (1 Okt 2026)

Sesi ini 10 migration gagal sebelum berhasil. Yang membuat **aman** bukan migration-nya,
tapi **guard berlapis dalam satu transaksi** plus **backup yang tidak di-drop**. Nol data
berubah di 10 percobaan itu, dan semuanya masih bisa di-rollback karena backup utuh:

- `_backup_creators_20261001`
- `_backup_campaign_creators_20261001`
- `_backup_videos_20261001`
- `_backup_organic_videos_20261001`
- `_backup_view_vw_campaign_summary_20261001`
- `sales_aman_backup_20260930`, `sales_bk_20260930b`, `sales_excel_backup_20260930`

Yang **tidak boleh diulang**: menulis migration dari asumsi. Asumsi saya salah 6 kali
sebelum migration pertama jalan (§3.45). Urutan yang benar:

**read-only query -> baca angka -> preflight constraint -> baru migration**

Dan kalau migration gagal, **baca error-nya sebagai data**. 10 kegagalan itu semuanya
memberi informasi yang saling menguatkan, bukan noise.
