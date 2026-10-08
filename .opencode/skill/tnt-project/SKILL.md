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

### 3.33 Ratecard campaign SELALU murni dari campaign_creators.price (Listing), JANGAN fallback ke creator_snapshots (7 Okt 2026)
Ratecard seorang kreator adalah spesifik per campaign (hasil negosiasi campaign tersebut).
Sumber kebenaran tunggal ratecard campaign adalah **campaign_creators.price** (kolom Price (Rp) di menu Listing).
- Jika price = 0 (misal kreator Barter), maka ratecard untuk campaign tersebut adalah **Rp 0** (bukan hutang bayar).
- **JANGAN PERNAH** fallback effectivePrice = cc.price || snapshot.ratecard. Snapshot ratecard adalah data historis/global dari pool yang sering berisi angka lama/typo (misal Rp 140.000.000 pada @ignvrlatfaf_).
- Fallback ke snapshot sempat membuat kreator Barter ber-ratecard Rp 0 muncul di tab *Kreator Belum Dibayar* senilai Rp 140.000.000, dan menggelembungkan total komitmen campaign 42 hingga Rp 1,5 Miliar. Diperbaiki 7 Okt 2026.

### 3.34 Video Organik Auto-Generate & Sinkronisasi Total VT (8 Okt 2026)
Video dari laporan organik TikTok (`organic_videos`) dan penjualan (`sales`) kini otomatis di-generate menjadi slot video dengan ID `auto_${uid}` di `videoActions.ts` (`getInternalVideoData`), `listing/page.tsx`, dan `creator-pool/[id]/page.tsx` jika belum diinput manual oleh PIC di tabel `videos`:
- **Scoping Ketat**: Hanya mencakup video yang cocok dengan `campaign_id` atau SKU campaign (`product_id`), dan username kreator yang cocok secara case-insensitive tanpa simbol `@`.
- **Eksklusi Livestream**: Wajib menyaring `content_type NOT IN ('live', 'livestream')`. Livestream tidak boleh masuk sebagai video.
- **Dedup Terjamin**: UIDs yang sudah ada di tabel `videos` (melalui `content_uid` atau digit di `link_video`) tidak akan pernah dibuatkan duplikat.
- **Zero GMV Tetap Masuk**: Video awareness dengan Rp 0 penjualan tetap masuk dan link TikTok `https://www.tiktok.com/@username/video/${uid}` tetap dibentuk.
- **Creator Pool & Rekam Jejak**: Perhitungan `totalVtCount` dan list `combinedVideos` wajib memeriksa `campaignSales` dan `campaignOrganicVideos`, tidak boleh hanya salah satu. Metrik views mengambil nilai tertinggi dari kedua sumber agar video awareness tidak menampilkan 0 views.

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

### 3.36 `kurs` rusak di 314 baris - SUDAH DIPERBAIKI (1 Okt 2026)

`ads_performance.kurs` tersimpan `16.993` (bukan `16993`) di **314 dari 1.130
baris** - revenue baris itu **1000x terlalu kecil**. Penyebabnya dua:
- `importActions.ts:475` punya heuristics `if (kurs < 1000) kurs *= 1000` yang
  benar, TAPI
- `campaignPageActions.ts:234` melakukan `UPDATE ads_performance SET kurs = $kurs`
  **tanpa guard** - itulah yang menulis nilai rusak

Migration `20261001230000` sudah dijalankan:

| Aksi | Jumlah |
|---|---|
| `kurs = 1000` diset 0 (data korup: 1052 pembelian tanpa satu klik) | 1 |
| `kurs` satu-titik dikali 1000 | 313 |

Hasil: `total_gmv` **tidak berubah** (920.211.710 - itu yang dijanjikan),
`total_ads_spend` 110.655.058 -> 173.207.991, dan **tidak ada campaign baru jadi
over budget**. SALSA Cosmetic justru pulih ke dalam budget karena baris korup
itu penyebab seluruh lonjakannya.

**816 baris `kurs = 18000` SAH dan tidak disentuh.** Nilai itu kurs standar yang
dipakai user, bukan placeholder - kurs harian memang naik turun (terverifikasi
16.993-18.045). Jangan "meluruskan" tanpa tanya.

Sisa: **12 baris korup lain** (semua campaign 35 SALSA Cosmetic, 30 Mar 2026)
dengan `clicks = 0` tapi `purchases` 58-205. Harus diperbaiki tim Ads dari
ekspor TikTok asli - tidak bisa done dari sisi kita.

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
| ~~`ads_performance` = revenue sama~~ | ❌ **SALAH** — asumsi saya. **User membetulkan 2 Okt 2026:** Partner Center itu PURE ORGANIK, order dari video yang di-ads tidak masuk ke sana. Ads = Video Shopping Ads, sumber & cara lapor berbeda. Lihat §3A.7. **Kemiripan besaran bukan bukti.** |
| `live_sessions` punya kolom `gmv` | **Tidak ada** — ada di `live_session_products` |
| `creator_snapshots.gmv_30d_organic` | **Tidak ada** |
| 9.060 order salah atribusi | Semua `ambigu`, **nol berbeda** |

**Aturan:jangan tulis migration dari asumsi.** Urutan yang benar: query read-only
→ baca angka → baru migration. Dan kalau migration gagal, **baca error-nya sebagai
data** — 10 kegagalan itu semua memberi informasi yang converging.

### 3.46 Output psql yang TERPOTONG menghasilkan kesimpulan SALAH (1 Okt 2026)

Rencana migrasi payment §5.2 menyatakan `payment_items` tidak punya kolom
`actual_transfer`, sehingga `financeMarkPaid` akan error. **Salah.**

Akar masalahnya bukan skema berubah: **output psql yang dipaste terpotong di
tengah daftar kolom** (`information_schema`), lalu kesimpulan "kolom tidak ada"
ditulis dari daftar yang tidak lengkap. Setelah dicek ulang, `actual_transfer`
**ada** sebagai `numeric`, dan `SKILL.md` sejak lama sudah benar (glosarium
"Split payment" merujuknya).

**Aturan: jangan pernah menyimpulkan "kolom X tidak ada" dari daftar output.**
Uji per kolom dengan `EXISTS`:

```sql
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='payment_items' AND column_name='actual_transfer') AS punya_actual_transfer,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='payment_items' AND column_name='transaction_id') AS punya_transaction_id;
```

`docs/sql/42-verifikasi-payment.sql` §3 memakai pola ini persis.

### 3.47 `importHistoricalBatch` tidak PERNAH bisa jalan (1 Okt 2026)

`web-app/src/app/campaigns/actions/paymentActions.ts:806-814`

```sql
INSERT INTO payment_items (..., actual_payment_date, bukti_transfer_url, sender_account_id)
```

Ketiga kolom itu **tidak pernah ada di `payment_items`** — semuanya ada di
`payment_batches`. Fungsi ini pasti crash. Baris 795-796 (insert batch) juga
rusak: `profileId` diulang 4 kali.

Rencana §11 melarang memakainya, tapi **alasan sebenarnya bukan "berbahaya"
melainkan "outright mati"** — tidak akan pernah dipakai, dan tidak akan.

Status: **dihapus**. Migrasi payment akan murni SQL migration file.

### 3.48 Tiga kolom payment ada di tabel yang SALAH (1 Okt 2026)

Terverifikasi `docs/sql/42`:

| Kolom | `payment_items` | `payment_batches` |
|---|---|---|
| `actual_transfer` | ✅ `numeric` | — |
| `transaction_id` | ✅ `varchar` | — |
| `biaya_transfer` | ✅ `bigint` | — |
| `actual_payment_date` | ❌ | ✅ `date` |
| `bukti_transfer_url` | ❌ | ✅ `text` |
| `sender_account_id` | ❌ | ✅ `integer` |

Jadi ini bukan "kolom hilang" — **salah target tabel**. `actual_payment_date` /
`bukti_transfer_url` / `sender_account_id` adalah properti **batch**, bukan item.

### 3.49 Realitas tabel payment (1 Okt 2026, `docs/sql/42`)

```
payment_items     106 item   →  pending 61 · paid 44 · manager_approved 1
payment_batches    66 batch
payment_type      hanya '100_akhir' yang terpakai (106 item / Rp 42.050.349)
paid items        SATU batch "Batch - September 2026", 16–25 Sep 2026, Rp 13.550.000
campaign_id       NOT NULL → Qontak/LION lintas campaign tidak bisa masuk
orphan / NULL     0 / 0 (bersih)
unique index      tidak ada (hanya pkey)
creators          16.309 · campaign_creators 23.098 baris · 9.105 kreator unik
```

**CHECK `payment_type` = `100_akhir`, `50_awal`, `50_akhir`, `ads`, `crm`, `lion`,
`reward_affiliate`, `boost_views`, `boost_comment`.** `100_awal` dan
`boost_awareness` belum ada — perlu ditambah secara **aditif**.

### 3.50 Hanya 44% kreator yang punya campaign (1 Okt 2026)

`campaign_creators` = 23.098 baris tapi hanya **9.105 kreator unik**, dari total
16.309 kreator. Artinya:

- Angka "822 baris siap migrasi" di rencana payment **dihitung tanpa cek ini** —
  match rate aslinya belum diketahui, jangan diasumsikan.
- 23.098 baris untuk 9.105 kreator = rata-rata **2,5 campaign per kreator**, jadi
  pencocokan **wajib** `username + campaign`, bukan username saja.

### 3.51 Unique index `(campaign_creator_id, payment_type)` akan MENOLAK pembayaran sah (1 Okt 2026)

Rencana payment §10 mengusulkan index itu. Kasus nyata:

```
jimmy.hen — NAISDAY — 2026-06-19
  Rp 400.000  (bayar reguler)
  Rp  73.900  (note: "Reimburse Sample")
```

Dua pembayaran **sah**. Index `(campaign_creator_id, payment_type)` akan
**menolak yang kedua** — persis jenis data yang tidak boleh hilang.

Kunci yang benar:

```sql
(campaign_creator_id, payment_type, nominal, COALESCE(actual_payment_date, created_at::date))
```

Pasang **setelah** dedup manual bersih — `CREATE UNIQUE INDEX` gagal kalau
masih ada duplikat.

### 3.52 Aturan tanggal payment: PENGAJUAN dulu, bukan transfer (1 Okt 2026)

Spreadsheet **April–Juni tidak punya `Tgl Actual Payment` sama sekali.** Yang
ada hanya tanggal pengajuan.

> "samain aja kalo case gini dengan tanggal pengajuan, bodo amat lah yang
> penting semua data uang keluar itu tercatat brooo"

Prinsipnya **rekam, jangan menebak**. Lebih baik tanggal kurang tepat daripada
baris pembayaran hilang.

| Dari spreadsheet | Masuk ke | Fallback |
|---|---|---|
| Tanggal Pengajuan | `payment_items.created_at` + kunci pengelompokan batch | Tanggal Pembayaran |
| Tanggal Pembayaran | `payment_batches.actual_payment_date` | Tanggal Pengajuan |

**Efek samping yang bagus:** `paymentActions.ts:813` menyalin `tanggal_pengajuan`
ke `created_at`. Setelah aturan ini berlaku, `created_at` 16–25 Sep di 44 item
existing **bisa dibandingkan langsung** dengan spreadsheet → kunci dedup jadi
`username + nominal + tanggal_pengajuan`, **tanpa fuzzy matching**.

### 3.53 Dobel-input payment itu ATAS PERINTAH USER, bukan bug (1 Okt 2026)

> "saya mau migrasiin data payment lama ke sistem ... kenapa begitu karena itu
> **perintah saya** takut ada error dan data pembayarannya jadi ga akurat"

User sengaja mengisi **dua form** (spreadsheet + sistem). Jadi jangan diperbaiki
diam-diam dan jangan dianggap tidak valid - setelah migrasi, spreadsheet
**tidak dipakai lagi** (keputusan user).

Alokasi yang benar: **all-or-nothing per batch per tanggal**, hanya baris
`Paid Off`, dan baris tanpa padanan **harus dilist + didokumentasikan**
(laporan, bukan dikarang).

### 3.54 `requireRole` untuk approval payment = SENGaja DITUNDA (30 Sep 2026)

23 fungsi rantai approval tidak pernah mengecek role (§4). User **sengaja**
menundanya:

> "belum gapapa masih stabil kok dan gada yang melanggar aturan dan kalo mereka
> approve sendiri juga ketauan namanya biar kita liat aja siapa yang melanggar
> aturan"

Jadi jangan diam-diam menambahkan guard itu — itu membatalkan keputusan
observasi yang sudah diambil. Naikkan saja kalau ada yang benar-benar melanggar.

### 3.55 `submitted_by` ditautkan lewat EMAIL, bukan nama (1 Okt 2026)

`web-app/src/auth.ts:89` dan `:115`:

```sql
UPDATE profiles SET ... WHERE LOWER(email) = ${email}
SELECT id, nama, ... FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
```

**Konsekuensi:** placeholder dengan email karangan **tidak akan pernah tertaut.**
Saat orang itu login, `existingProfile` = NULL → sistem INSERT profil baru dengan
UUID baru → batch lama menunjuk **profil orphan**, tanpa error apa pun.

Jadi **placeholder email palsu lebih berbahaya daripada `submitted_by = NULL`**, dan
`submitted_by = NULL` + nama ditulis di `batch_label`/`notes` lebih aman karena
auditor tetap bisa menelusuri namanya.

### 3.56 Spreadsheet payment: 8 sheet, 4 LAYOUT BERBEDA (1 Okt 2026)

`Form Payment Campaign TNT.xlsx` — jangan pernah pakai asumsi posisi kolom.
Cari kolom **per nama header**.

| Sheet | `TANGGAL PENGAJUAN` | `Tgl Actual Payment` | `Tanggal Pembayaran` | Baris header |
|---|---|---|---|---|
| September 2026 | ✅ kol 2 | kol 24 | — **kosong** | 1 |
| Agustus 2026 | ❌ | kol 23 | ✅ | 1 |
| Juli 2026 | ❌ | kol 22 | ✅ | 1 |
| Juni / Mei / April / Maret | ❌ | — | ✅ | 1 |
| Februari 2026 | ❌ | — | ✅ | **3** |

Kolom `PIC` pun berbeda: kol 13 (Sept), kol 11 (Juli), kol 9 (Maret), kol 10 (Feb).

**Scope terverifikasi:** 926 baris ber-PIC = **840 `Paid Off`** + 78 `Not Yet` +
**7 `Cancel`** + 1 kosong. Yang 840 itu persis scope migrasi.

**Dua jebakan isi data:**

| Jebakan | Detail |
|---|---|
| **Baris SUBTOTAL** | Kolom `Tanggal Pembayaran` memuat `TOTAL 16882900`. Kalau tidak difilter → **Rp 29 juta fiktif** masuk sistem |
| **Baris operasional** | `Campaign` = `Top up ADS` / `TOP UP LION` / `Sampel Kime`. **Campaign asli ada di kolom `Note`**, misal `"19 Juni - Ads OMG Makeup"` |
| **Nama dobel di satu sel** | `David David`, `Tiara David`, `LION Fira` — kolom tidak rapi di baris non-kreator |

### 3.57 ⚠️ `Marini` BUKAN `Maria` — jebakan fuzzy match (1 Okt 2026)

Spreadsheet payment pakai **NAMA DEPAN SAJA**; `profiles` pakai nama lengkap.
Jadi pencocokan selalu inferensi — dan ada yang treacherous:

```
Marini   22 baris  → TIDAK ADA di profiles
Maria   181 baris  → Maria Alvita
```

Fuzzy match akan **salah menempelkan `Marini` ke Maria Alvita**, padahal `Marini`
adalah orang ketiga yang **resign sebelum sistem ada**. 22 batch jadi salah pengaju
dan mustahil direkonsiliasi.

**Aturan: jangan fuzzy-match nama orang. Pakai peta eksplisit** (lihat
`docs/KEPUTUSAN-PEMBAYARAN.md` §4A.2).

Peta yang sudah diverifikasi:

| PIC | Baris | `profiles.id` |
|---|---:|---|
| Wahyu | 379 | `e0706894-ef03-47f9-aa63-f8340816f436` |
| Maria | 181 | `8d348a80-d4b3-4b25-a9c3-9be9cfe5d401` |
| Rija | 105 | `626ea2a0-518a-475c-865d-7436e2a0245e` |
| April | 79 | `709825a1-0712-4be7-8560-8f48665fab16` |
| Tiara (`inactive`) | 78 | `7fc3cba9-ad11-49ff-a8ca-8e71ae2e85b3` |
| Jerry = Jeremy | 2 | `dc479cf6-48dc-4cb3-a6ab-f9115d4eff2e` |
| Fira (`inactive`) | 2 | `0583ae90-0ba2-4594-bdea-59c92b56646e` |
| Daffa / Natallia / Marini / Riska / David | 92 | **`NULL`** — 4 sudah resign sebelum sistem ada |

### 3.58 Excel COM: `.Text` vs `.Value2`, dan `$data[$r,0]` meledak (1 Okt 2026)

Dua jebakan saat parse `.xlsx` di Windows yang sudah memakan 3 percobaan:

| Jebakan | Gejala | Solusi |
|---|---|---|
| `.Value2` ≠ `.Text` | Scan `.Value2` gagal mencocokkan `Paid Off` → hasil **0** | Pakai `.Text` |
| Kolom tidak ketemu = `0` | `$data[$r,0]` mengembalikan **seluruh baris** sebagai array → output meledak ribuan baris | Cek `if($c -gt 0)` sebelum diakses |
| `Format-Table` / raw dump | Satu baris bisa berisi alamat KTP + link drive = sangat panjang | Agregat dulu, jangan dump baris mentah |

```powershell
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Open($path, 0, $true)   # read-only
```

### 3.59 Profil Kreator: Sinkronisasi ID Alias & Fallback Ratecard Nego Terakhir (7 Okt 2026)

Dua temuan penting terkait tampilan ratecard dan relasi data di `/creator-pool/[id]`:
1. **Ratecard Master vs Ratecard Campaign**:
   - Card box `Ratecard` di header profil kreator membaca dari `creator_snapshots.ratecard` (ratecard master).
   - Di listing campaign, harga yang diinput tersimpan di `campaign_creators.price` (ratecard khusus campaign).
   - Jika kreator belum memiliki snapshot ratecard master, card atas menampilkan `-` (kosong), meskipun di bawahnya (`Riwayat Nego Campaign` & `Rekam Jejak`) harganya sudah ada (contoh: `@aliabdulazizzzz` Rp 1.300.000).
   - **Solusi**: Card `Ratecard` profil otomatis fallback ke ratecard negosiasi terakhir (`localData.ccs[0].price`) dengan label `(Nego Terakhir)` jika master snapshot kosong.
2. **Kreator Alias & Relasi Campaign**:
   - `fetchCreatorProfile` kini mencari seluruh `associatedCreatorIds` (creatorId + ID mana pun yang punya username cocok dengan `aliasList`), sehingga seluruh campaign (`campaign_creators`), snapshot, catatan, kontak, dan ads tetap terhubung utuh meskipun kreator berganti username atau terdaftar dengan ID alias.
3. **Syarat Muncul di Tab Kreator Belum Dibayar**:
   - Tab `Kreator Belum Dibayar` di `/campaigns/[id]/keuangan` hanya memuat kreator dengan `LOWER(approval) = 'approved'`. Kreator yang kolom Approval-nya masih strip (`-`) / pending sengaja tidak dimunculkan untuk mencegah pengajuan pembayaran ke kreator yang belum disetujui.
4. **Sub-Breakdown Ratecard Belum Dibayar (7 Okt 2026)**:
   - Card `Ratecard Belum Dibayar` di `/campaigns/[id]/keuangan` kini memecah sisa komitmen menjadi 2 sub-kartu mikro:
     - `Belum Diajukan`: Murni antrean kreator yang belum dimasukkan ke batch pengajuan mana pun (`totalBelumDiajukanNominal`).
     - `Sudah Diajukan`: Nominal kreator yang sedang berada di dalam proses batch berjalan (`pending_manager`, `pending_finance`, `ready_to_pay`) menunggu transfer (`totalPendingNominal`).
   - Hubungan matematis dijaga konsisten: `Total Belum Dibayar = Belum Diajukan + Sudah Diajukan`.

---

## 3A. Audit Halaman Harian & Timeline (1 Okt 2026)

Diaudit karena user minta "pastikan akurat dengan performa dan kinerja". **6 temuan.**
Empat sudah diperbaiki (2 Okt 2026), satu dibatalkan oleh user, satu masih terbuka.

### 3A.1 ✅ SUDAH DIPERBAIKI — Rekap Harian: `Not Approve` & `Alternate` SELALU 0

`web-app/src/app/campaigns/[id]/listing/page.tsx:1053`

```ts
if (r.approved_at && r.approval !== 'pending') {
  const actionDateKey = getLocalDateStr(r.approved_at);
  if (r.approval === 'approved')      group[actionDateKey].approved++;
  else if (r.approval === 'alternate')     group[actionDateKey].alternate++;
  else if (r.approval === 'not_approved') group[actionDateKey].not_approved++;
}
```

Dipakai `approved_at` untuk **ketiga** jenis aksi. Tapi saat penulisan datanya
(`:826-827`), `alternate` dan `not_approved` menyimpan tanggalnya di
**`not_approved_at`**, bukan `approved_at`:

```ts
if (r.approval === 'approved') { approvedAt = ...; }
else if (r.approval === 'alternate' || r.approval === 'not_approved') { notApprovedAt = ...; }
```

Jadi `approved_at` NULL untuk kedua status itu → **tidak pernah masuk cabang** → baris
`Not Approve` dan `Alternate` di Rekap Harian **selalu 0**.

**Bukti inkonsistensi di file yang sama:** filter tanggal di `:996` justru memakai
`row.not_approved_at` dengan benar. Satu file, dua cara.

**Perbaikan (2 Okt 2026):** tanggal aksi dipilih sesuai statusnya.

```ts
const actionDateStr = r.approval === 'approved' ? r.approved_at : r.not_approved_at;
if (actionDateStr) { ... }
```

### 3A.2 ✅ SUDAH DIPERBAIKI — `kurs = 0` jatuh ke `|| 16000`

`DailyClient.tsx:532`:
```ts
const kurs = (ad.kurs && ad.kurs < 1000) ? ad.kurs * 1000 : (ad.kurs || 16000);
```

Dengan `kurs = 0`: `(0 && 0<1000)` = falsy → cabang else → `(0 || 16000)` = **16000**.

Migration `20261001230000` sengaja menyetel 1 baris jadi `kurs = 0` supaya netral.
Baris itu (`id 2641`, campaign 35 SALSA Cosmetic, `gross_revenue_usd = 1261.34`)
jadi tampil sebagai **Rp 20.181.440**, bukan 0.

**Perbaikan (2 Okt 2026):** satu helper di `web-app/src/utils/computed.ts`, dipakai
di **10 tempat**.

```ts
export const normalizeKurs = (raw: unknown): number => {
  if (raw === null || raw === undefined || raw === '') return 16000;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 16000;
  if (n > 0 && n < 1000) return n * 1000;   // heuristik impor lama
  return n;                                  // 0 TETAP 0
};
```

| Input | Sebelum | Sesudah |
|---|---|---|
| `0` | 16000 | **0** |
| `16.993` (impor lama) | 16993 | 16993 |
| `null` | 16000 | 16000 |

Lokasi yang diganti: `DailyClient.tsx`, `ads-report/actions.ts` (×2),
`ads-report/page.tsx`, `ads-report/budgeting-ads/page.tsx`,
`performa/PerformaClient.tsx` (×2), `creator-pool/[id]/page.tsx`,
`portalActions.ts`, `databaseActions.ts`, `importActions.ts`.

### 3A.3 ⏳ MASIH TERBUKA — GMV Harian ≠ Total GMV resmi (2 filter tersembunyi)

`DailyClient.tsx:207-208`:
```ts
if (approvedUsernameSet.size > 0 && !approvedUsernameSet.has(u)) return;   // hanya approved+alternate
if (!hasSkus || !s.product_id || !skuSet.has(s.product_id)) return;       // hanya produk terdaftar
```

GMV di Harian = `SUM(sales.gmv)` yang **difilter** dua kali. Tidak sama dengan
`SUM(sales.gmv)` untuk campaign itu, dan tidak ada penjelasan di UI.

Catatan: `approvedUsernameSet` memasukkan **`alternate`** sebagai approved (`:191`).
`alternate` = kreator pengganti; apakah sales-nya memang harus dihitung, perlu
konfirmasi user.

### 3A.4 ❌ BUKA BUG — "GMV Total" = sales + ads (dikonfirmasi user)

Awalnya saya laporkan sebagai pelanggaran §10a. **User memastikan itu memang desain:**

- **Harian** → satu angka GMV = **sales + ads**
- **Bulanan** → tiga kotak terpisah: `GMV Total` · `Sales` · `Ads`

**Jangan diubah.** Tapi asumsi dasarnya sedang ditantang — lihat §3A.7.

### 3A.5 ✅ SUDAH DIPERBAIKI — `Kr Approve` tidak cek status → 265 vs 263

`DailyClient.tsx:340`: `if (cc.approved_at)` — **tanpa cek `approval`**. Jadi kreator
yang sudah di-approve lalu dibalik jadi `not_approved` **tetap terhitung approved**,
pada tanggal approve yang lama.

Terbukti di campaign 57 GHANISKIN: Listing **Approved 263**, Daily **Kr Approve 265**.
Selisih **2 baris** = `approved_at` basi yang tidak dikosongkan saat approval dibalik.

**Perbaikan (2 Okt 2026):** `if (cc.approval === 'approved' && cc.approved_at)`.

Efek sampingnya penting: `runningApprovedCreator` di kartu bulanan
(`DailyClient.tsx:703`) memakai angka yang sama, jadi bug ini **ikut menggeser sisa
target kreator tiap bulan** — bukan cuma tampilan.

### 3A.6 ✅ SUDAH DIPERBAIKI — `snapshotTierMap` dead code + Timeline awareness

- `snapshotTierMap` (`DailyClient.tsx:175`) **dideklarasi dan dibaca (`:305`), tapi
  tidak pernah diisi**. Jadi `resolvedTier = cc.tier || 'Nano'` — tidak salah, tapi
  menyesatkan.
- `TimelineTarget` untuk campaign `awareness` (GHANISKIN) menampilkan
  **"GMV 0 / -"** karena `target_gmv = 0` untuk tipe awareness. Secara logika benar,
  tapi membingungkan karena GMV aktual 1,41 T tampil di kartu lain.

### 3A.7 ✅ SELESAI — `ads_performance` itu revenue TERPISAH dari `sales`

**Asumsi saya 1 Okt SALAH dan dicabut user.** Saya menyimpulkan "ads = revenue yang
sama dengan sales" dari bukti ini (tertulis di header migration `20261001200000`):

> "dengan ambil MAX per ad, total ads = Rp 1.086.274.665, sedangkan sales =
> Rp 1.110.174.161. **Selisih 2,2 persen, jadi itu revenue yang sama dari dua
> sumber.**"

**"Selisih 2,2% ⟹ revenue yang sama" tidak berlaku.** Dua angka segede itu bisa
saja dua stream yang **sama-sama bagus**. Kemiripan besaran bukan bukti — dan saya
menuliskannya sebagai fakta terverifikasi.

Koreksi user:

> "data ads dan data gmv organik itu ga pernah nyentu brooo, cara reportnya juga
> beda, kalo misal selisih 2 persen yaa, berarti emmg ads dan organik dari
> partner center ya sama sama bagus"

Dan: **ads = Video Shopping Ads**, langsung dari TikTok Ads, tidak lewat
Partner Center. Partner Center **pure organik**.

Kode mengonfirmasi dua sumber terpisah:

| Tabel | Diisi dari | Lokasi |
|---|---|---|
| `sales` | Impor **TikTok Partner Center** | `importActions.ts:99` |
| `ads_performance` | Impor laporan **Ads Manager** (impression/click/purchase) | `importActions.ts:499` |

**Bukti dari database** (`docs/sql/46`, 2 Okt 2026) — delta harian ads vs sales:

```
34 | 2026-06-22 | ads   880.818.439 | sales     583.408  → 1500x
34 | 2026-07-20 | ads   126.066.182 | sales     925.280  →  136x
33 | 2026-06-22 | ads   148.490.104 | sales   1.353.319  →  110x
```

Semuanya "beda jauh - stream terpisah". **Nol yang mirip.** Rata-rata nilai per
item ads Rp 39.243 vs sales Rp 40.297 — order dari tipe sama, sumber berbeda.

#### Cara menghitung ads yang benar

Laporan Ads mengambil **ALL TIME setiap tanggal** → tiap `ad_id` punya baris
kumulatif. Yang dipakai adalah **baris pada TANGGAL TERAKHIR**:

```sql
SELECT DISTINCT ON (campaign_id, ad_id)
       campaign_id, ad_id, gross_revenue_usd * kurs, cost_usd * kurs
FROM ads_performance
ORDER BY campaign_id, ad_id, tanggal DESC, id DESC
```

**Migration `20261002000000` sudah dijalankan** (2 Okt 2026):

```
total_gmv   920.211.710  →  4.160.235.142
  video       865.468.962  |  live   54.742.748
  ads_gmv   3.240.023.432  |  spend 171.167.128
Guard 1 OK: video + live + ads = total_gmv
Guard 2 OK: tidak ada campaign yang total_gmv turun
```

**Konsisten dengan dua halaman yang memang sudah benar:**
`PortalDashboardClient.tsx:377` dan `DailyClient.tsx:732` sama-sama
`gmv_organic + gmv_ads`. View-nya yang menyimpang.

**Aturan domain yang melekat (user, 2 Okt 2026):**

> "ads itu mengambil data all time hingga tanggal tersebut, jadi ga perlu hitung
> data tanggal sebelumnya kalo mau tau jumlah hasil ads dari ads id tersebut, jadi
> ya kurnya mah selalu ngikutin sesuai dengan tanggal. Misal tanggal 1 itu menarik
> data all time pada tanggal 1 kursnya 16ribu yauda di konvert ke rupiah dari
> dolar nya, nah terus tanggal 7 ada data lagi dan ini data paling baru diambil
> alltime juga tapi kursnya jadi 18ribu yaida ikutin aja"

Jadi: **baris terakhir per `ad_id`, dikalikan kurs pada baris itu sendiri.** Tidak
ada penjumlahan antar tanggal, dan kurs **tidak** diambil dari baris lain.

| Tanggal laporan | Revenue USD (all-time) | Kurs baris itu | Hasil IDR |
|---|---:|---:|---:|
| 1 | X | 16.000 | X × 16.000 |
| 7 (terbaru) | Y | 18.000 | **Y × 18.000** ← yang dipakai |

**Dan `ads` yang tidak ada = ads memang belum jalan lagi, itu normal.** Lakunya
menyesuaikan budget, jadi campaigns yang kehabisan budget atau belum mulai
benar-benar tidak punya data ads. **Tidak dianggap gap impor.**

#### ✅ Ter mysteries: 54 ad itu kurs, BUKAN data hilang (2 Okt 2026)

Awalnya `DISTINCT ON ... tanggal DESC` menghasilkan angka **Rp 8.368.134 lebih kecil**
daripada `MAX`. Sekarang sudah jelas penyebabnya (`docs/sql/47`):

```
3182 | 2026-06-15 | 2602.34 USD | 1021 | 6023 | 141937 | kurs 18000
2731 | 2026-06-22 | 2602.34 USD | 1021 | 6023 | 141937 | kurs 17819
                          ↑ IDENTIK. Tidak ada penurunan sama sekali.
```

**Nilai USD-nya sama persis.** Yang beda hanya konversi:
`2602.34 × 18000 = 46.842.120` vs `2602.34 × 17819 = 46.371.096`, beda `471.024` —
persis sama dengan yang dilaporkan migration.

**Dan justru itu bukti bahwa `tanggal TERAKHIR` lebih benar dari `MAX`:**

> `MAX(gross_revenue_usd × kurs)` = memilih baris dengan **kurs TERTINGGI**.
> Itu bukan aturan — itu **memilih kurs yang paling menguntungkan tanpa sengaja.**
> Kalau besok kurs 20.000, MAX ikut naik padahal revenue USD tidak berubah.

Kurs di baris MAX selalu lebih tinggi (campaign 33: 17.819–18.045) dibanding baris
terakhir (17.819–17.953). Conclusion: **jangan pernah pakai `MAX` untuk kolom
yang sudah dikalikan kurs.** Ambil berdasarkan tanggal, bukan berdasarkan nilai.

Dua verifikasi lain:

- **§C — nol baris dobel.** Tidak ada `ad_id + tanggal` sama dengan nilai beda,
  jadi tidak ada impor ganda.
- **§D — penurunan besar campaign 35 = baris `kurs = 0`** yang sengaja dinol-kan
  migration `20261001230000`. Itu justru yang diinginkan: baris korup tidak boleh
  menyumbang revenue.

**Tidak ada data hilang. 54 ad itu bukan rusak — kursnya berbeda di baris terakhir.**

#### Pelajaran

Saya menulis "terverifikasi" pada sesuatu yang sebenarnya **tebakan dari satu
perbandingan angka**. Kalau asumsi domain disampaikan sebagai fakta, seluruh
dokumentasi ikut mewarisi kesalahan itu — dan perubahan sudah terlanjur ditulis
ke migration produksi. **Tanyakan fakta domain ke pemilik sistem sebelum
menulis asumsi sebagai kesimpulan.**

- `docs/KONTEKS-DATABASE.md` — **peta database terverifikasi produksi** (tabel, view, fungsi, angka asli).
- `docs/ARCHITECTURE-CURRENT.md` — deskripsi arsitektur akurat (tidak seperti ARCHITECTURE.md lama yang stale).
- `docs/audit/2026-09-30-AUDIT.md` — laporan audit lengkap (DB, auth, frontend, pipeline).
- `docs/audit/REMEDIATION-PLAN.md` — rencana perbaikan bertahap.
- `docs/DOMAIN-CHEATSHEET.md` — cheat sheet query & istilah.
- **`docs/LOG-PERTEMUAN-2026-10-01.md`** — **catatan lengkap sesi 30 Sep–1 Okt 2026.**
  Timeline masalah → diagnosis → solusi, semua angka sebelum/sesudah, dan siapa
  siapa-amil item yang masih tertunda. Baca ini kalau perlu konteks "kenapa keputusan ini diambil".
- **`docs/KEPUTUSAN-PEMBAYARAN.md`** — **sumber kebenaran migrasi payment.**
  10 keputusan user yang sudah dikunci (jangan ditanya ulang), realitas DB
  terverifikasi, 18 baris DEFER, dan 1 keputusan yang masih tertunda.
- `web-app/scripts/one-time-data-fix/` — perbaikan `order_id` + `is_refund` + status `arsip` (SQL, transaksi, backup).
- `ARCHITECTURE.md` (root) — **DOKUMEN LAMA (v2.2), sebagian tidak akurat.** Baca sebagai sejarah, bukan kebenaran.
- `web-app/supabase/migrations/` — DDL, tapi **tidak bisa dipercaya untuk constraint**. Lihat §3.37.
- `web-app/.agents/skills/ponytail/SKILL.md` — gaya kode minimal.
- `C:\Users\Banzilla\.opencode\plan\rencana-migrasi-payment.md` — rencana payment
  lama (347 baris). **Sebagian basi** - bandingkan dengan `docs/KEPUTUSAN-PEMBAYARAN.md`.

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
| `41-dampak-kurs.sql` | Analisis dampak koreksi `kurs` (sudah dipakai) |
| **`42-verifikasi-payment.sql`** | **WAJIB sebelum migrasi payment.** Uji tiap kolom dengan `EXISTS` (§3.46) |
| `21`, `22`, `25` | Digunakan untuk investigasi tag palsu |
| `47-selidihi-54-ad-berbeda.sql` | Buktikan 54 ad = beda kurs, bukan data hilang (§3A.7) |
| `48-audit-portal-52.sql` | Audit portal bagian 1 — **nama view salah**, section §5/§10 error |
| `49-audit-portal-52-bagian2.sql` | Audit portal bagian 2 — §12/§14 masih salah nama kolom |
| **`50-audit-portal-52-bagian3.sql`** | **Angka final portal.** Nama view/kolom sudah benar (§3B) |

---

## 3B. AUDIT PORTAL BRAND (2 Okt 2026) — 9 SELISIH TERBUKTI

`/portal/[id]/dashboard` **tidak memakai view mana pun.** Ia fetch data mentah lalu
menghitung ulang sendiri di `portal/actions/portalActions.ts` + `PortalDashboardClient.tsx`.
Sirinya dengan `campaigns/[id]/performa/PerformaClient.tsx` — **dua implementasi
logika yang sama, ditulis terpisah.** Itu akar semua selisih di bawah.

### Cara mengaudit ulang (WAJIB pakai nama yang benar)

Nama view = **`vw_campaign_summary`**. `total_gmv` itu **nama kolom di dalamnya**,
bukan nama view. Nama kolom yang tersedia:

```
total_gmv_achievement  total_gmv          total_gmv_video   total_gmv_live
total_ads_gmv          total_ads_spend    achievement_video achievement_creator
budget_ads_terpakai    sisa_budget_ads    tracked_creator_gmv
```

> ❌ **Tidak ada kolom `total_organic_gmv` di view.** Organic cuma ada di CTE internal
> `organic_sales`. Oles ke view = error, dan seluruh section berikutnya hilang.
> Dua script pertama (`48`, `49`) tersandung ini. `50` sudah benar.

Script: `docs/sql/48` (bagian 1), `49` (bagian 2), `50` (bagian 3, angka final).

### 9 temuan, semuanya TERBUKTI dengan angka (campaign 52 = MILKYBOOST)

| # | Temuan | Dampak terukur | Lokasi |
|---|---|---|---|
| A | **Refund dihitung sebagai penjualan** | **+Rp 225.253 (+5,0%)** di 52; **+Rp 310.173.535** total DB (7.054 baris) | `portalActions.ts:118` & `PerformaClient:29` tidak punya `is_refund = false`; view **punya** |
| B | **Views/likes menjumlah livestream** | views **+11.711**, likes **+79.250 (10,9×)** | `portalActions:357-364` vs `PerformaClient:180-198` |
| C | **Jumlah video hanya organik** | portal **~50%** dari sebenarnya (seluruh campaign) | `fastVideoCountsData.total_approved = calcUniqueVideos` |
| D | **Status creator tidak difilter** | **6.160 baris `not_approved` tampil** di portal, hilang di internal | `portalActions` tidak filter; `performaActions:18` filter 3 nilai |
| E | **PIN `1234` untuk 47 dari 49 campaign** | semua portal brand terbuka | `campaigns.pin` plaintext |
| F | **`target_gmv` NULL di 37 dari 49 campaign** | persentase selalu `0%` | `PortalDashboardClient:127` |
| G | **Cabang `tt_campaign_id` tidak pernah kena** | 0 dari 209 session cocok | `portalActions:190` |
| H | **Livestream terduplikasi di `organic_videos`** | content_uid sama muncul 3× | lihat §50 §26 |
| I | **PIN bocor ke browser** | `SELECT *` → `pin` ikut ke payload RSC | `portalActions:50` → `return { campaign }` |

### A. Refund — bukti(storage) yang harus diingat

```
7.054 baris is_refund = true
  6.985 Positif  |  0 Negatif  |  69 Nol
  SUM = Rp 310.173.535
```

> **Refund disimpan sebagai `gmv` POSITIF, bukan negatif.** Jadi `SUM(gmv)` tanpa
> filter **menambah** refund ke penjualan — bukan mengurangi. View benar karena
> memang `WHERE is_refund = false`. Portal dan Performa **salah**, dan
> **keduanya tidak punya filter itu sama sekali.**
>
> **Skala penuh (bukan cuma campaign 52):**
>
> ```
> portal se-DB  : Rp 1.454.605.235
> refund        : Rp   310.173.535
> seharusnya    : Rp 1.144.431.700
> OVERSTATEMENT :         21,32 %
> ```
>
> **Paling parah: KEMBANG 7 RUPA (76) = 89,5%** (portal 36,3 M vs kenyataan 19,2 M —
> hampir 2×). Lalu USMILE 64,1%, NUTRIFLAKES 76,2%, NAISDAY 43,7%, ISWHITE 37,4%.
> **Jangan hanya perbaiki campaign yang paling besar — campaign kecil (52) justru
> yang pencongkarannya paling kecil (5,0%).**

### B. Kenapa likes portal 10,9× internal

`portalActions:357-364` menjumlah `views`/`likes` untuk **semua** entri.
`PerformaClient:180-184` hanya untuk `!isLive`.

Data livestream-nya memang rusak — `likes > views` (likes 79.250 vs views 11.711 di
campaign 52), dan **`content_uid` yang sama muncul sampai 28×**.

### C. Video — 48,3% di seluruh DB, dan ada TIGA angka berbeda

```
portal    : 26.439 video
internal  : 54.736 video
manual    : 28.297 video
portal menampilkan 48,3%
```

| Campaign | Portal | Internal | View |
|---|---:|---:|---:|
| KIME (44) | 9.648 | 19.253 | **9.605** |
| MS Glow Beauty (41) | 806 | 1.601 | **795** |
| WARDAH (37) | 682 | 1.288 | **681** |
| OMG Makeup (33) | 679 | 1.388 | **709** |

> **`achievement_video` di view = `COUNT(v.id) WHERE link_video IS NOT NULL`, TANPA
> filter approval.** Jadi view dan internal menghitung dua hal berbeda. **Tiga
> layar, tiga angka, campaign sama. Mana definisi resmi "video tayang"? → user.**

### H. `organic_videos` — 46% baris duplikat

```
content_uid dobel    : 8.655
total baris          : 56.660
baris terlibat       : 26.118  (46,1%)
livestream di antaranya: 12.124
paling parah         : 28 salinan (7645587310418922260)
```

> **Jangan pernah `SELECT COUNT(*)` dari `organic_videos`.** Selalu
> `COUNT(DISTINCT content_uid)`. Portal aman karena pakai `Math.max()` per uid.
> **Sebagian besar duplikat punya `campaign_id` = NULL** — tidak bisa diatribusi.

### E. PIN — 47 dari 49 campaign masih `1234`

Semua kecuali 50 Biodef dan 51 GLOWIES (kosong). Catatan: `SKILL.md` §3.5 sudah
bilang PIN plaintext, tapi **skornya masih default untuk semua campaign produksi.**
Selector: `WHERE pin = '1234'` (lihat `50` §19).

### G. Cabang mati di filter live session

```sql
WHERE ls.tt_campaign_id = ${campaignId}::text      -- 0 dari 209 session COCOK
   OR ls.creator_username IN (...)                  -- satu-satunya yang bekerja
```

`tt_campaign_id` **bukan** id internal kita. Jadi seluruh 39 live session campaign 52
masuk lewat cabang `OR` — yang **tidak punya scoping campaign sama sekali**. Kalau
seorang kreator ikut 2 campaign, session-nya bocor ke keduanya.

### ✅ KEPUTUSAN OWNER + SUDAH DITERAPKAN (2 Okt 2026)

Sumber: `docs/KEPUTUSAN-PORTAL.md`.

| # | Keputusan owner | Yang dikerjakan |
|---|---|---|
| 1 | *"semua data masuk termasuk refund"* | **View** diubah — `WHERE is_refund = false` dihapus. `total_gmv` se-DB naik **Rp 1.144,4 M → Rp 1.454,6 M (+21,32%)**. Migration `20261003000000`. |
| 2 | *"note approve sembunyikan aja bro"* | Query `campaign_creators` portal + filter `approval IN ('approved','pending','alternate')` |
| 3 | *"jika uinya ada di portal brand ya harus tampilin"* | **Tidak diubah.** Views/likes tetap hitung livestream. Selisih vs internal = beda definisi yang **disetujui**, bukan bug |
| 4 | *"gapapa pinnya 1234"* | **Tidak diubah.** Kalau PIN diganti lewat Campaign Settings, nilai lama masih ada di cookie browser sampai 7 hari |
| 5 | *"internal broo, soalnya di internal ada input manual"* | Blok `3b` di `portalActions.ts` — video manual ikut dihitung. `total_approved` = `allApprovedVideoIds.size` |

#### ⚠️ Konsekuensi penting keputusan #1

> Yang diubah adalah **VIEW**, bukan portal — karena portal **sudah** menjumlahkan
> semua baris. View-lah yang `WHERE is_refund = false`.
>
> **Semua halaman ikut naik**, bukan cuma portal: Harian, Rekap, Dashboard,
> Timeline, Campaign list, seluruh angka tracked.
>
> `sales.gmv` refund **POSITIF** → menjumlahnya **menambah** pendapatan.
> Ini keputusan **akuntansi owner** yang diterima. Rollback: kembalikan
> `WHERE is_refund = false` di view.
>
> **Naik aktual: `total_gmv` Rp 4.160.235.142 → Rp 4.393.570.140 (+Rp 233.334.998).**
> Verifikasi rekonsiliasi: `docs/sql/51-verifikasi-setelah-refund.sql`.

#### Migration `20261003000000` punya **3 guard**

Guard 3 yang baru dan **paling penting**: membandingkan view dengan **tabel
`sales` mentah**. Guard 1 & 2 cuma membandingkan bagian view dengan bagian view,
jadi keduanya tetap lolos walau filter refund masih aktif — hanya guard 3 yang
bisa menangkap.

> ✅ **Polanya pakai ulang:** kalau migrasi mengubah cara agregasi, tulis guard
> yang membandingkan hasil dengan **tabel asal**, bukan hanya dengan kolom lain
> di view yang sama.

#### ✅ HASIL AKTUAL migration `20261003000000` (2 Okt 2026)

```
SEBELUM : total_gmv Rp 4.160.235.142,36
SESUDAH : total_gmv Rp 4.393.570.140,36
NAIK    :           Rp   233.334.998,00
Ketiga guard LOLOS.
```

**Rekonsiliasi yang membuktikan benar — pakai ini kalau migrasi agregasiSimilar:**

```
refund total di sales        : Rp 310.173.535
  campaign_id IS NOT NULL    : Rp 233.334.998  <- masuk ke view
  campaign_id IS NULL        :  Rp 76.838.537  <- TIDAK masuk
  ---------------------------------------------
  jumlah                     : Rp 310.173.535  ✓

Naik total_gmv view          : Rp 233.334.998  ✓ SAMA DENGAN YANG HARUSNYA
```

> ⚠️ **Dua angka refund itu BEDA, jangan dicampur:**
> - **Rp 233.334.998** = refund yang punya `campaign_id` → masuk view
> - **Rp 310.173.535** = semua refund di `sales`
>
> Selisihnya **Rp 76.838.537 = refund tanpa `campaign_id`**, bagian dari masalah
> lama "Rp 224.219.990 sales tanpa campaign" (`docs/sql/36`, `38`).
> **Masalah terpisah, belum tersentuh.** Jangan_PROCESSED "sudah beres" karena
> refund sudah masuk view — baris tanpa campaign masih belum punya rumah.

### ❌ Yang TIDAK diubah (dan kenapa)

| Temuan | Alasan |
|---|---|
| Cabang `tt_campaign_id` mati | Butuh scoping benar, risiko session ikut hilang. Tertunda. |
| `organic_videos` 46% duplikat | Butuh migration sendiri + preflight. |
| 169 baris `videos` tanpa link & uid | Perlu keputusan: hapus atau diisi PIC. |
| `target_gmv` NULL di 37 campaign | Butuh data owner, bukan kode. |
| Biaya ads tidak tampil di portal | Keputusan tampilan. |

> 🔑 **Aturan going forward:** jangan tambah angka baru di portal sebelum
> menyamakan dengan internal. Kalau belum sinkron, tambah di **internal** dulu
> (satu sumber), lalu pakai ulang. Akar semua selisih: **dua implementasi logika
> yang sama ditulis terpisah.**

---

### 🔴 Import Penjualan mati total — regresi dari `20261001220000` (2 Okt 2026)

> Gejala: `duplicate key value violates unique constraint
> "idx_creators_username_lower_unique"` → **429 sales + 10.650 awareness gagal.**

| | |
|---|---|
| **Penyebab** | Migration `20261001220000` menambah `UNIQUE (lower(username))`. Kode import masih `ON CONFLICT (username)` yang hanya cocok dengan index `creators_username_key` (case-sensitive). Bentrok kapital lolos dari sana, lalu ditolak index LOWER. |
| **Kenapa banyak sekali** | **1 batch = 1 transaksi.** 1 kreator bentrok → seluruh 150 baris rollback. 10.650 baris gagal BUKAN 10.650 masalah. |
| **Bukti** | `docs/sql/57`: 796 dari 16.311 creator masih huruf besar; **0 duplikat** setelah di-lowercase |
| **Fix** | Semua **12** titik `INSERT INTO creators` → `ON CONFLICT (lower(username))` |
| **Doc** | `docs/BUG-IMPORT-CREATOR-CONFLICT.md` |

> ⚠️ **Empat titik tadinya TIDAK punya `ON CONFLICT` sama sekali**
> (`addressActions.ts:478`, `databaseActions.ts:71` & `1160`, `paymentActions.ts:751`).
> Semuanya akan crash dengan cara yang sama. Sudah diperbaiki.

> 📌 **Pola:** kalau sebuah index UNIQUE berubah (dari kolom jadi ekspresi), **SEMUA**
> `ON CONFLICT` yang menunjuk kolom itu harus ikut berubah. Index itu ditambahkan
> *setelah* kodenya ditulis, jadi tidak ada yang mengetesnya.

#### Jebakan saat memperbaiki (2 dari saya sendiri)

| Kesalahan | Gejala | Deteksi |
|---|---|---|
| Backtick penutup hilang di template literal | 84 → **286** TS error | `tsc --noEmit` |
| Komentar berisi **backtick** di dalam template SQL | **5** TS error | `tsc --noEmit` |

> ⚠️ **Jangan tulis backtick di dekat template literal SQL.** Backtick menutup
> template lebih awal. Sama seperti pelajaran "SELECT tanpa FROM" (§KEPUTUSAN-PORTAL):
> **yang berhasil hanya cek otomatis, bukan niat.**

## 3C. IMPORT PAYMENT HISTORIS (2 Okt 2026) - SPREADSHEET MEMBOHONG DI 6 TEMPAT

`C:\Users\Banzilla\Downloads\Form Payment Campaign TNT.xlsx`, 8 sheet, 4 layout kolom.
Cakupan: **826 baris `Paid Off` dengan tanggal < 2026-09-14, Rp 507.736.562.**

Yang sudah dibuktikan (bukan dugaan) ada di `docs/payment/analisis-l2.txt` dan `l3.txt`.

### 3C.1 Kunci dedup HARUS ikut `campaign` - ini hampir menghapus Rp 42.600.000

Rencana lama: duplikat kalau `username + nominal + tanggal` sama persis.
Applied ke 826 baris, itu kena **26 grup / 31 baris**. **NOL satu pun duplikat sejati.**

| Yang "kena" | Bukti bahwa beda pembayaran |
|---|---|
| `intnwulnn_` Rp300.000 02/06 | MSGLOWBEAUTY `50% AWAL` + NAISDAY `100% AKHIR` - status beda |
| `tesazakia` Rp300.000 05/06 | DIOLY `100% AWAL` + NAISDAY `100% AKHIR` - status beda |
| `zihanokta` Rp350.000 19/05 | **4 campaign** (OMG Makeup/ISWHITE/SYB/NAISDAY) |
| `top up ads` Rp5.000.000 09/06 | OMG Makeup + QAHIRA - top up ads memang per campaign |

Kunci benar: `username + campaign_sheet + status_klaim + nominal + tanggal` → **0 grup**.
Konfirmasi owner 2 Okt 2026: *"staff selalu memasukan dengan benar, finance ga pernah
membayar dobel."* Jadi **jangan dedup baris payment sama sekali.**

### 3C.2 `Ratecard` = nominal. BukanBiaya, bukan rate per unit

Kolom `Ratecard` berisi `Rp100.000` / `Rp450.000` - itu **nominal yang dibayar**.
`Ratecard Awal` terpisah (78 baris terisi, biasanya di baris `100% AKHIR`).
Nominal kecil Rp 50.000-850.000 → ini biaya operasional harian (transport/meet),
bukan fee kreator. Average ~Rp 614.000 x 826 baris = Rp 507 juta, konsisten.

### 3C.3 Kolom `Status` BERISI NGGAWUR - 7 nilai, bukan cuma `100% AWAL/AKHIR`

```
100% AKHIR 603 | 50% AKHIR 106 | ADS 51 | 50% AWAL 35 | 100% AWAL 18
(kosong) 7 | LION 3 | CRM 2 | "kekurangan dikit" 1
```

- **`ADS` / `LION` / `CRM` = baris OPERASIONAL**, bukan pembayaran kreator.
  `username`-nya literal `top up ads`, `top up lion`, `top up qontak`.
  Jangan dipaksa jadi `campaign_creator_id`.
- `"kekurangan dikit"` = **catatan**, bukan jenis pembayaran.
- 7 baris kosong. Semuanya butuh `payment_type` diputuskan manual.
- 18 baris `100% AWAL` butuh `payment_type = '100_awal'` yang **BELUM ada** di CHECK
  `payment_items_payment_type_check` (lihat 3C.6).

### 3C.4 ⚠️ SEL DI EXCEL BOLEH PUNYA NEWLINE - SQL langsung rusak

**6 dari 826 baris punya `\n` di dalam sel.** Contoh: `April 2026` r97 isinya
`aleena_balqis\n`. Kalau diteruskan mentah ke SQL, **satu baris jadi dua** dan
seluruh migration gagal tanpa nilai error yang berguna.

**Sel Worse: `Juli 2026` r61 = 4 username dalam 1 sel:**

```
hi.syah vv.vianaaa
eloraariyani
zaraaa.nh
beautyaul_
```

1 pembayaran Rp 2.000.000 ke 1 penerima (`M FARHAN MAULANA`, rek 8881127032) untuk
**4 akun**. Ini **SATU** `payment_items`, bukan 4. Memecahnya = mengarang nominal
per akun yang tidak pernah ada di spreadsheet. Ada kolom `username_multi boolean`
bertamaXNama untuk menandainya.

**Sel non-ASCII/single-quote** juga harus di-escape (`'` → `''`), dan newline
harus ditulis `\n`/`\r`/`\t` sebagai teks dua huruf supaya jejak audit tetap ada.

### 3C.5 Satu username bisa punya campaign berbeda di sheet yang sama

`ndaahq` Rp250.000 tanggal 02/06 → `ISWHITE` **dan** `SYB`, dua baris terpisah.
Itu **dua pembayaran sah**. Jangan gabung berdasarkan username saja.

### 3C.6 `payment_type` CHECK - yang dipakai sistem vs yang butuh

Nilai yang di CHECK: `100_akhir, 50_awal, 50_akhir, ads, crm, lion,
reward_affiliate, boost_views, boost_comment`.

**Tidak ada `100_awal`.** 18 baris / Rp 22.950.000 butuh nilai itu → migration
Fase 2 wajib menambahkannya DULUAN sebelum INSERT.

### 3C.7 Precedent baris operasional (dibuktikan owner 2 Okt 2026)

Owner tes add pengajuan operasional di campaign 55 `Banzilla Test Bug`:

```
payment_batches : campaign_id = 55, status = pending_manager   <- campaign WAJIB ada
payment_items   : payment_type = 'ads', campaign_creator_id = NULL
```

Jadi polanya jelas: item operasional **boleh tanpa kreator**, tapi **batch tetap
butuh campaign nyata**. 51 baris `top up ads` punya kolom Campaign yang bisa
dipakai (`OMG Makeup`, `SALSA COSMETICS`, ...). 6 baris `TOP UP LION` /
`TOP UP QONTAK` tidak punya campaign → DEFER.

> ⚠️ **Bug UI ketahuan dari tes ini:** item tanpa kreator tetap tampil dengan
> judul **"Menunggu Manager (1 Kreator)"** dan baris kolom `Kreator` berisi
> `@ Hibban` padahal `campaign_creator_id IS NULL`. Salah label, bukan salah data.

### 3C.8 `*.csv` sudah di-ignore git - dipakai untuk menyimpan PII

`.gitignore` memuat `*.csv` dan `*.xlsx`. Staging payment therefore **tidak boleh
pakai `\copy` dari file CSV di repo**. Yang dipakai: SQL `INSERT ... VALUES`
dengan PII dikecualikan (`nama_penerima`, `nomor_rekening`, `nik`, `alamat`
tidak ikut di fase staging), lalu disisihkan terpisah di SQL INSERT fase 2.

### 3C.9 Nama PIC di spreadsheet ≠ nama profil (tapi ini BUKAN fuzzy match)

PIC di sheet: Wahyu, Maria, **April**, Tiara, **Rija**, Fira, Daffa, Natallia,
Marini, Riska, David.

Konfirmasi owner 2 Okt 2026 - **dua pemetaan ini bukan tebakan saya**:

| PIC di sheet | Profil | Bukti |
|---|---|---|
| `April` | `Aprilia` | *"April tuh nama aslinya Aprilia bro"* |
| `Rija` | `Irsadur Rija` | *"Cocokkan ke Irsadur Rija"* |

Sisanya **tetap NULL** (`Daffa`, `Natallia`, `Marini`, `Riska`, `David`) sesuai
aturan #17/#18. Hasil: 729 baris / Rp 356.181.562 punya `submitted_by`,
97 baris / Rp 151.555.000 NULL.

### 3C.10 Staging-first: jangan INSERT langsung ke `payment_items`

Tabel `payment_import_staging` (+ `payment_import_map_pic`,
`payment_import_map_campaign`) dibuat oleh migration
`20261004000000_payment_import_staging.sql`. Alasan: **match rate
`(username + campaign) -> campaign_creators` belum pernah diukur.** Hanya 44%
kreator yang punya baris `campaign_creators` (§3.50). Kalau langsung INSERT,
kita baru tahu hasilnya SETELAH data masuk.

`views`: `v_payment_campaign_candidates` (kandidat, **bukan auto-map**) dan
`v_payment_campaign_unmapped` ( destined DEFER).

### 3C.10 Staging-first: jangan INSERT langsung ke `payment_items`

Tabel `payment_import_staging` (+ `payment_import_map_pic`,
`payment_import_map_campaign`) dibuat oleh migration
`20261004000000_payment_import_staging.sql`. Alasan: **match rate
`(username + campaign) -> campaign_creators` belum pernah diukur.** Hanya 44%
kreator yang punya baris `campaign_creators` (§3.50). Kalau langsung INSERT,
kita baru tahu hasilnya SETELAH data masuk.

`views`: `v_payment_campaign_candidates` (kandidat, **bukan auto-map**) dan
`v_payment_campaign_unmapped` ( destined DEFER).

### 3C.11 DUPLIKAT LOKASI - batas tanggal TIDAK menjamin apa pun (2-3 Okt 2026)

batas impor `tanggal < 2026-09-14` berdasarkan
`MIN(payment_batches.submitted_at) = 2026-09-14`. Itu **SALAH** untuk
tujuan anti-duplikat:

- Data **benar-benar** mulai masuk sistem **16-17 Sep 2026**. 14 Sep cuma batch
  PWS pertama.
- Semua 71 batch dibuat **14-28 Sep 2026**.
- Jadi pembayaran bertanggal **Juli** pun bisa sudah tercatat di sistem.

**Terbukti 17 baris / Rp 4.250.000 duplikat lokasi:**
sama persis di `username + campaign + nominal`. **11 dari 11 baris sheet
"September 2026"** + 6 baris Agustus.

**PWS justru aman** (0 username sama dari 61 baris Excel vs 30 item sistem).
Angka "30 = 30" yang terlihat ICollectionYork ternyata kebetulan - item PWS
sistem adalah 25 kreator @ Rp700.000 ke satu rekening.

> ⚠️ `docs/sql/70 §4` melaporkan "66 baris sudah ada" - itu **terlalu longgar**
> (cuma `EXISTS` username, tidak peduli campaign/nominal). Angka yang bisa
> dipakai hanya dari `docs/sql/71 §1b`: **17 baris / Rp 4.250.000**.

### 3C.12 Nilai CHECK constraint TIDAK BOLEH DITEBAK (3 Okt 2026)

Saya menulis `final_status = 'approved'` karena **`approved` tidak ada di CHECK**.
Tidak ada nama kolom yang salah, tapi nilainya tetap salah → **semua 795 item
akan tampil "belum dibayar" padahal uangnya sudah keluar sebulan.**

Nilai yang benar (terbukti dari `pg_constraint`):

```
payment_items.manager_status    pending | approved | rejected
payment_items.executive_status  pending | approved | rejected
payment_items.final_status      pending | manager_approved | executive_1_approved |
                                pending_finance_outstanding | finance_selected |
                                executive_approved | ready_to_pay | paid | rejected
payment_batches.status          draft | pending_manager | pending_executive_1 |
                                pending_finance | pending_executive |
                                ready_to_pay | paid | cancelled
```

Untuk pembayaran historis yang **sudah dibayar**: `manager=approved`,
`executive_1=approved`, `executive=approved`, `final=paid`, `batch=paid`.

**Pelajaran lebih besar:** preflight `pg_constraint` itu wajib, sama seperti
preflight `information_schema` untuk nama kolom (§3.1 `schema.ts` tidak bisa
diandalkan). Nama kolom dan nilai CHECK adalah dua hal berbeda yang sama-sama
harus dicek.

### 3C.13 Empat bug SQL yang tertahan oleh `-v ON_ERROR_STOP=1` (3 Okt 2026)

Semua rollback bersih. Produksi tetap di 111 item / Rp 44.270.000 sampai
perbaikan terakhir.

| Bug | Gejala | Akar |
|---|---|---|
| `submitted_by uuid` diisi nama | `invalid input syntax for type uuid: "Aprilia"` | kolom tak perlu - `submitted_by` diambil dari JOIN `profiles` |
| Tiap baris VALUES diakhiri `;` | `syntax error at or near "1"` | tiap baris jadi statement sendiri |
| `UPDATE ... FROM` rujuk tabel target | `invalid reference to FROM-clause entry` | PostgreSQL tidak mengizinkan; pakai subquery korelasi |
| `final_status = 'approved'` | `violates check constraint` | lihat §3C.12 |

> Plus satu migration rollback: view `v_payment_campaign_candidates` pakai
> `s.nama_sheet`, padahal kolom di staging `campaign_sheet`. Satu transaksi =
> 3 tabel hilang. **Perbaikan struktural: view dipindah ke transaksi sendiri
> setelah tabel di-COMMIT.** Lihat §3C.14.

### 3C.14 Migration: pisahkan transaksi "tahan data" dari "laporan" (3 Okt 2026)

Satu typo di view menghapus 3 tabel yang sudah berhasil dibuat. Aturan:

```sql
BEGIN;  -- tabel + peta + data
  CREATE TABLE ...; INSERT ...; 
COMMIT;

BEGIN;  -- view / laporan, transaksi TERPISAH
  DROP VIEW IF EXISTS ...; CREATE VIEW ...;
COMMIT;
```

Plus `DROP VIEW IF EXISTS` di awal supaya migration bisa dijalankan ulang.

### 3C.15 NIK di spreadsheet TIDAK bisa dipakai sebagai identitas (3 Okt 2026)

- **1 NIK dipakai 32 username berbeda.** `3201232511970003` dipakai 25 kreator PWS.
- 8 username punya **2 NIK berbeda** (`lehabottoh`, `nurnnyas`, `salwanarulita`).
- 7 NIK total dipakai >1 username, menyentuh 331 baris.

**Artinya kolom NIK di `payment_items` tidak boleh dipakai untuk pencocokan
identitas.** Data masuk apa adanya dari Excel (keputusan owner #25: Excel
adalah sumber kebenaran). Kalau suatu saat butuh repair, selalu cek dulu
"NIK ini dipakai berapa username".

### 3C.16 Cara kirim file SQL berisi PII tanpa masuk git (3 Okt 2026)

`*.csv` sudah di-ignore, tapi SQL harus tetap dikirim lewat jalur lain karena
`raw.githubusercontent` hanya bisa membaca file yang ada di repo.

**Jalur yang terbukti berhasil** (SSH alias `vps` sudah ada di `~/.ssh/config`):

```powershell
# 1. cek hash dulu sebelum eksekusi apa pun
cmd /c 'ssh vps "sha256sum /root/payment-historis.sql"' < docs\sql\73-insert-payment-historis.sql

# 2. kirim sebagai byte mentah - JANGAN lewat base64 (PowerShell membungkus
#    string panjang saat pipe, jadi `base64 -d` gagal "invalid input")
cmd /c 'ssh vps "cat > /root/payment-historis.sql" < docs\sql\73-insert-payment-historis.sql'

# 3. bandingkan hash lokal vs VPS
(Get-FileHash docs\sql\73-insert-payment-historis.sql -Algorithm SHA256).Hash

# 4. jalankan
ssh vps "docker exec -i <container> psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1 < /root/payment-historis.sql"
```

> ⚠️ **`wsl` tidak dipakai di mesin owner** ("no installed distributions").
> WSL hanya ada di mesin developer.

### 3C.17 HASIL AKHIR impor (3 Okt 2026)

```
826 baris di-parse dari spreadsheet
-17  duplikat lokasi                      Rp   4.250.000
-17  DEFER (tanpa campaign di DB)          Rp 118.460.000
─────────────────────────────────────────────────────────
= 792 baris siap diimport  Rp 385.026.562
→ jadi 796 payment_items / 278 batch (1 baris agency dipecah jadi 5 item)

Sistem total: 907 item / Rp 429.296.562 / 349 batch
```

`METOO` (Rp 89.500.000) adalah defer terbesar dan **tidak ada di rekap
manapun** - perlu ditanyakan ke PIC Natallia. Rincian 17 baris defer ada di
`docs/payment/DEFER.md`.

**Risiko yang dibiarkan terbuka** (keputusan owner, dicatat bukan diubah):
`KIME spill.by.lily` tercatat Rp 750.000 dari ratecard Rp 500.000, dan
`KIME beauty.iidd` Rp 550.000 dari ratecard Rp 450.000. Item system'seorang
berasal dari batch September 2026, **bukan dari impor ini**.

### 3C.18 STATUS SETELAH IMPOR (4 Okt 2026) - SUDAH SELESAI

```
Payment historis : 796 item / Rp 385.026.562 / 278 batch
Data asli        : 110 item / Rp 44.270.000  (batch tes 93 sudah dihapus)
Staff baru       :   5 item / Rp  1.790.000  (LION PARCEL, pending_manager)
TOTAL            : 911 item / Rp 431.086.562 / 349 batch
```

**Angka lama yang sudah tidak berlaku** (jangan dipakai lagi):

| Angka lama | Sebenarnya | Kenapa |
|---|---|---|
| 840 baris `Paid Off` | **826** | 11 baris Sept jatuh setelah 14 Sep + baris TOTAL |
| 822 / Rp 383.776.562 | **792 / Rp 385.026.562** | dihitung dengan aturan dedup yang terbukti menghapus Rp 42.600.000 |
| 18 baris DEFER / Rp 128.460.000 | **17 / Rp 118.460.000** | Sampel Kime masuk ke KIME (keputusan #22) |

### 3C.19 Dua bug UI yang BUKAN dari impor (4 Okt 2026)

Keduanya sudah diperbaiki, tapi **pola’ellesnya perlu diingat**:

**1. Kolom "PIC Submit" selalu kosong.** `keuangan/page.tsx:330` baca
`b.submitter?.nama`, tapi query `getPaymentBatches` (`paymentActions.ts:14`)
**tidak pernah mengambil kolom itu**. Yang punya `submitter` cuma query lain
di `L338`. Jadi tampil `-` untuk SEMUA batch — termasuk yang `submitted_by`-nya
sudah terisi. Bug lama, baru ketahuan setelah impor karena jumlah batch
mendadak banyak.

**2. Label "1 Kreator" untuk item operasional.** `getGroupTitle` memakai
`items.length` (jumlah ITEM) untuk memberi label "Kreator". Begitu ada item
operasional tanpa kreator, angkanya bohong.

> 📌 **Pola yang sama di keduanya:** UI membaca field yang query-nya tidak
> mengambil, atau menghitung jumlah item tapi menamainya "kreator". Setelah
> impor massal, **cek UI-nya** - jangan cuma cek angka di SQL. Kedua bug ini
> tidak terlihat dari query mana pun.

### 3C.20 `jimmy.hen` - kasus wajib tidak terdedup, SUDAH DICEK (4 Okt 2026)

Rencana lama menandai `jimmy.hen` sebagai kasus yang WAJIB tidak terdedup.

Hasil: NAISDAY 19 Jun 2026, **2 baris** - Rp400.000 dan Rp73.900. Keduanya
masuk, satu batch `2026-06-19 - PIC: Maria - NAISDAY`. Tidak kena dedup karena
nominal berbeda. **Yang jelas,** tapi dicek karena sudah lama ditandai wajib.

### 3C.21 Rollback siap pakai (4 Okt 2026)

`docs/sql/74-rollback-payment-historis.sql` - **100% read-only**, semua
`DELETE` ada di dalam `\echo`. Dijalankan = hanya mencetak laporan.

Yang penting untuk diingat: **rollback tidak menghapus data Excel.**
`payment_import_staging` selalu utuh 826 baris termasuk 17 baris DEFER. Kalau
perbaiki, koreksi peta campaign di `payment_import_map_campaign`, ubah
`status_import`, generate ulang `67-` lalu `73-`. Tidak perlu buka Excel lagi.

> Untuk kasus 1 campaign yang salah mapping, **jangan rollback semua.**
> 796 item itu benar secara aritmetika. `UPDATE` satu campaign jauh lebih aman.

### 3C.22 DNS VPS punya SATU nameserver - build Docker gagal karena itu (4 Okt 2026)

Deploy gagal 2x berturut-turut, **bukan karena kode**:

```
Percobaan 1 (08:01)  gagal di #2 FROM node:20-alpine
  -> auth.docker.io: "lookup ... on 127.0.0.11:53: server misbehaving"
  -> timeout 5 dari 6 percobaan

Percobaan 2 (08:57)  LOLOS dari #2 (image sudah ter-cache), gagal di
  #6 deps RUN apk add --no-cache libc6-compat
  -> dl-cdn.alpinelinux.org: "DNS: transient error (try again later)"
```

**Diagnosis yang menyelamatkan waktu** ( jangan langsung menyalahkan kode ):

| Uji | Hasil | Arti |
|---|---|---|
| `dig @1.1.1.1` 20x | 20/20 | resolver-nya SEHAT |
| `getent ahostsv4` 10x | **4/10** | glibc gagal 60% |
| `registry.npmjs.org` 20x | 30/30 | host yang dipakai `npm ci` aman |
| `conntrack_count` | 99/262144 | bukan SYN flood |
| `ss -s` | 286 total | koneksi normal |

`/etc/resolv.conf` cuma punya `nameserver 1.1.1.1`. `dig` pakai resolver
sendiri (sehat), glibc/`apk` retry ke satu-satunya server itu - satu packet
 hilang = build gagal total.

**Perbaikan:**
1. `/etc/resolv.conf` ditambah `8.8.8.8` + `9.9.9.9` → `getent ahostsv4`
   4/10 → 18/20. Backup di `/etc/resolv.conf.bak-20261004`.
2. `RUN apk add --no-cache libc6-compat` **dihapus** dari `web-app/Dockerfile`.
   node:20-alpine sudah musl, nol dari 32 dependency butuh glibc, dan
   `node -e "require('fs')"` jalan tanpa itu. Baris itu panggilan jaringan
   PERTAMA di build - jadi satu-satunya yang bisa menggagalkan build sebelum
   kode bahkan dievaluasi.

> 📌 **Pelajaran:** error `DNS: transient error` / `server misbehaving` di
> log Coolify itu **infrastruktur, bukan kode.** Jangan mulai debugging
> aplikasi. Cek `dig @<ns> <host>` vs `getent hosts <host>` dulu - kalau
> yang pertama sehat dan yang kedua gagal, itu NSS/resolv.conf.

### 3C.23 Cara diagnosa cepat saat deploy Coolify gagal

```bash
# 1. steps #N di log itu apa? Kalau #2 = FROM, itu DNS/registry.
#    Kalau #9+ = npm/build, itu baru masalah kode.

# 2. apakah container lama masih jalan? (tidak ada downtime?)
ssh vps "docker ps --filter name=<prefix> --format '{{.Image}} | {{.Status}}'"

# 3. DNS sehat?
ssh vps "dig +short @1.1.1.1 <host> A; getent ahostsv4 <host>"   # bandingkan

# 4. image sudah ter-cache?
ssh vps "docker images node:20-alpine"
```

> Coolify memakai **nama image = commit SHA** (`du7trdtlmdpmahkkptmjokvp:edeb2b4...`).
> Cara paling cepat tahu build lama atau baru:
> `docker inspect <container> --format '{{index .Config.Image}}'`

### 3C.24 SATU campaign internal bisa punya BEBERAPA TikTok Campaign ID (6 Okt 2026)

User skeptis: sistem tunjuk **547 livestream** untuk SYB, export alltime
TikTok Shop miliknya cuma **271 room ID unik**. Selisihnya 276 room.

**Data sistem BENAR.** Bedanya bukan import salah, bukan data hilang:

```
campaign 46 (SYB) di tabel campaigns:
  tiktok_campaign_ids = {7631140567631972112}      <- CUMA SATU

tapi organic_videos campaign 46 berisi DUA TikTok campaign:
  7631140567631972112  -> 273 live   <- ada di file Excel user
  7643606629893670677  -> 278 live   <- TIDAK ada di file Excel user
  4 room tercatat di keduanya (dobel)
  273 + 278 - 4 = 547   ✅ sama dengan angka di UI
```

Kedua campaign itu **shop yang sama persis**: `SYB` / `IDLCDYLLQP` /
shop ID `7494083758024001281`. Artinya `7643606629893670677` adalah
campaign TikTok kedua di dalam shop SYB — sah. Export Excel user
di-filter satu Campaign ID, jadi tidak ikut terbawa.

### 3C.25 `content_type` di `organic_videos` BERCAMPUR HURUF BESAR/KECIL

Import mengambil nilai **apa adanya** dari Excel
(`OrganicImport.tsx:420` — `contentType = row[...content_type]`). Hasilnya
di seluruh DB:

```
Video        47.386 baris / 36.865 uid
Livestream   15.346 baris /  5.670 uid
livestream      115 baris /    115 uid    <-- huruf kecil, 115 room
video            29 baris /     29 uid    <-- huruf kecil
```

> ⚠️ **Query dengan `content_type = 'Livestream'` akan kehilangan 115
> room.** Selalu pakai `ILIKE '%live%'` atau `lower(content_type)`.

**Semua jalur baca di app sudah aman** — semuanya pakai `ILIKE`:
`campaignPageActions.ts:133,142`, `livestreamActions.ts:59,117`,
`paymentActions.ts:213,215`. Jadi angka di UI **tidak** salah karena
kasus ini. Tetap perlu normalisasi kapitalisasinya, tapi itu nanti,
**bukan bug yang menjelaskan selisih angka SYB.**

### 3C.26 Auto-sync TIDAK memetakan lewat `tiktok_campaign_ids`

`web-app/src/lib/tiktokAutoSync.ts:547-559` — campaign TikTok dicocokkan
ke campaign internal dengan urutan:

1. **cocok `product_id`** (lewat `skus.campaign_id`)
2. kalau gagal, cocok **nama campaign** (`tapName` vs `ic.nama_campaign`)

`campaigns.tiktok_campaign_ids` **tidak dipakai sama sekali** untuk
pemetaan. Konsekuensi:

- Mendaftarkan `7643606629893670677` ke `campaign 46` itu **kosmetik**
  (keterangan saja), **tidak** memperbaiki auto-sync.
- Semua 20 produk SYB sudah terdaftar di `skus` dengan `campaign_id=46`
  → auto-sync **tetap** akan menarik kedua campaign TikTok.
- Kalau auto-sync bermasalah someday, cek `skus.campaign_id` DULU,
  bukan `tiktok_campaign_ids`.

### 3C.27 "SYB X TNT CREATOR FEST 2026" = TikTok campaign tanpa campaign internal (6 Okt 2026)

Semua laporan TikTok Shop dari user bisa memuat **lebih dari satu** Campaign ID
—even kalau hanya satu brand yang dipilih. Yang kedua tidak selalu punya
campaign internal sendiri:

```
7631140567631972112  "TNT MEDIA x SYB"                 -> campaign 46 (SYB)
7643606629893670677  "SYB X TNT CREATOR FEST 2026"     -> TIDAK ADA di tabel campaigns

campaign 76 KEMBANG 7 RUPA - CREATOR FEST 2026   tiktok_campaign_ids = {}
campaign 77 USMILE - Creator Fest 2026            tiktok_campaign_ids = {}
campaign 137 Sorae x Creator Fest 2026            tiktok_campaign_ids = {}
```

Jadi pola "Creator Fest 2026" punya campaign internal untuk 3 brand, tapi
**bukan untuk SYB**. Konsekuensi: isi TikTok campaign `7643606629893670677`
ikut masuk ke campaign 46 karena **product_id**-nya cocok (`skus`),
bukan karena campaign ID-nya dicocokkan.

**Cara memastikan nama campaign TikTok:** kolom `Campaign name` di laporan
TikTok (kolom 4). Cek dengan:

```sql
SELECT DISTINCT raw_data->>'Campaign name' FROM organic_videos WHERE campaign_id=46;
```

Atau dari file Excel user langsung — `CustomReport_..._Video_...` dan
`CustomReport_..._Live_...` bisa berisi Campaign ID BERBEDA.

### 3C.28 `videos.content_uid` bisa menunjuk konten campaign LAIN (6 Okt 2026)

`videos` terhubung ke `campaign_creators` (slot kreator), lalu
`content_uid`-nya dicocokkan ke `organic_videos`. **Tidak ada filter
campaign di JOIN itu** — jadi satu `content_uid` bisa jadi "milik"
beberapa campaign. Kebocoran silang terukur:

```
45.845 baris videos yang punya content_uid
 40.858 senada (93%)
  3.398 BOCOR  -> 714 content_uid, isinya milik campaign lain

videos.id 62072: slot campaign 46 (SYB), tapi organic_videos-nya
                 campaign 42 (MS Glow For Men), produk MS Glow
```

Terparah: **campaign 76 (1.258 baris), 77 (344), 137 (41)** menunjuk
konten MS Glow Beauty — padahal `skus` campaign 76/77/137 **tidak punya
satu pun** produk MS Glow Beauty. Jadi benar-benar salah, bukan
kebetulan.

> ✅ **Yang menyelamatkan: semuanya masih `vt_approval = 'pending'`.**
> Belum ada satu pun yang approved. Jadi tidak ada data "sudah disetujui"
> yang perlu diturunkan ke pending — user sendiri yang dikonfirmasi aturan
> ini: *"kalau statusnya udh approve ya gausah di pendingin lagi"*.

Query deteksi (read-only, `docs/sql/76-audit-konsistensi-content-id.sql`):

```sql
WITH link AS (
  SELECT cc.campaign_id AS camp_slot, v.content_uid, v.vt_approval,
         o.campaign_id AS camp_isinya
  FROM videos v
  JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
  JOIN organic_videos o ON o.content_uid = v.content_uid
  WHERE v.content_uid IS NOT NULL
)
SELECT vt_approval, count(*), count(DISTINCT content_uid)
FROM link WHERE camp_slot <> camp_isinya GROUP BY 1;
```

### 3C.29 Hampir semua `videos.sku_id` NULL - produk tak bisa diverifikasi

```
videos (seluruh DB): 31.816 baris
  31.621 punya content_uid
  25.818 punya sku_id
campaign 46: 513 baris videos -> 512 punya sku_id NULL
```

Artinya **"cocok dengan product_id campaign" tidak bisa dicek** untuk
mayoritas baris. Yang bisa dicek cuma lewat `content_uid` ->
`organic_videos.product_id`. Kalau suatu saat harus diverifikasi manual,
join lewat `content_uid`, bukan `sku_id`.

### 3C.30 GMV kreator pending DIHITUNG, bukan ditahan (koreksi 6 Okt 2026)

User koreksi asumsi awal saya: **kreator yang belum approve tapi sudah
berproduksi TETAP dihitung GMV-nya.** Filter "Unattributed (Sisa + GMV)"
di halaman listing justru untuk melihat itu - siapa yang belum approve
tapi sudah ada penjualan.

Sudah ada di `campaignPageActions.ts:1653-1664`:
`cc.approval != 'approved' AND EXISTS (sales ... gmv > 0)`.

> 📌 **Jangan pernah dipersempit jadi `approval = 'approved'`.** Itu
> menghapus justru informasi yang dicari tim. Kreator yang sudah ada di
> listing juga **tidak boleh diapa-apain** - itu kinerja listingan PIC.

### 3C.31 `gmv_30d*` di listing BUKAN performa campaign (6 Okt 2026)

Tiga kolom di `CreatorRow.tsx`:

```
GMV 30 Days  <- creator_snapshots.gmv_30d        :577
GMV (Video)  <- creator_snapshots.gmv_30d_video  :597
GMV (Live)   <- creator_snapshots.gmv_30d_live   :617
```

Semuanya **snapshot manual dari TikTok**, bisa diedit per sel
(`onClick` -> input -> `onBlur` -> simpan). Disimpan di
`creator_snapshots` bersama `followers`, `tier`, `level`, `ratecard` -
jadi jelas ini data **screening kreator**, bukan performa campaign.

Bukti selisihnya 1.000-5.000x (campaign 46):

```
_karisma__01      snapshot Rp 3.000.000.000  | sales SYB Rp    603.145
mei_arifin180899  snapshot Rp 2.700.000.000  | sales SYB Rp    454.669
nris9             snapshot Rp 1.150.000.000  | sales SYB Rp 13.113.484
```

> Kalau user tanya "performa penjualan kreator ini berapa", jangan pakai
> angka ini. Pakai `sales` dengan filter `campaign_id` + `creator`.

### 3C.32 `sales.content_type` punya 6 nilai, 2 di luar live/video (6 Okt 2026)

```
Video                       25.011 item  Rp 1.028.207.026
video                        7.576 item  Rp   321.646.014
Livestream                   1.069 item  Rp    69.284.015
livestream                     327 item  Rp    29.263.249
External Traffic Program       653 item  Rp    29.988.918   <- di luar
Showcase                        96 item  Rp     4.919.285   <- di luar
```

`ILIKE '%live%'` **tidak** cocok untuk dua nilai terakhir, jadi 749 item /
Rp 34.908.203 tidak masuk hitungan live maupun video. `organic_videos`
justru bersih - hanya 4 nilai (`Video`, `Livestream`, `livestream`,
`video`). Lihat §3C.25 untuk angka lengkapnya.

### 3C.33 Tag `AUTO` sudah ada - jangan bikin kolom baru (6 Okt 2026)

Saya sempat bertanya mau taruh tag "dibuat otomatis" di mana. **Jawabannya
sudah ada di kode** - `CreatorRow.tsx:232`:

```tsx
{(!cc.added_by || cc.tier === 'Auto-Detect') && <span>AUTO</span>}
```

Jadi tag = `campaign_creators.added_by` NULL (bukan dibuat PIC) **atau**
`tier = 'Auto-Detect'`. Tidak perlu migration, tidak perlu kolom baru.

> `campaign_creators.added_by` bertipe **UUID** (referensi `profiles`),
> jadi tidak mungkin diisi string `'auto'`. Hanya `creators.added_by`
> yang varchar, dan itu sudah dipakai `'system'` (`syncUnmapped.ts:93`).

### 3C.34 Tiga definisi "performa" berbeda, tapi angkanya sama sekarang (6 Okt 2026)

```
performaActions.ts:31,41    WHERE campaign_id = X
portalActions.ts:135        WHERE campaign_id = X
videoActions.ts:52-55,67-70 WHERE campaign_id = X OR product_id IN (skus X)
```

Cabang `OR` menarik baris dari campaign lain **secara teori**, tapi
**0 campaign punya angka berbeda** sekarang - karena tidak ada
`product_id` yang dipakai lebih dari 1 campaign (terverifikasi 6 Okt:
0 dari 33.000+ baris `skus`).

> ⚠️ **Risiko latent.** Kalau suatu saat satu produk dipakai 2 campaign,
> definisi `videoActions.ts` akan menarik data campaign lain dan angka
> Performa vs Video akan mulai beda. Kalau products didaftarkan ganda,
> ini yang pertama harus dicek.

### 3C.35 SATU live room = BANYAK produk di BANYAK campaign (6 Okt 2026)

Ini fakta paling penting untuk memahami semua angka organic. Terverifikasi
langsung dari file Excel owner (`1 APRIL - 31 AGUSTUS LIVE`):

```
room 7645577769421867783   creator: mamizain.homedecor
  SORAE X TNT CREATOR FEST 2026        SORAE PERFUME
  TNT x MS GLOW Beauty                 msglow.beauty
  CRYSTAL GLOW X TNT CREATOR FEST      CRYSTAL GLOW OFC
  PWS X TNT CREATOR FEST 2026          perfectwhiteseries
  KIME X TNT CREATOR FEST 2026         Kime Skincare Shop
  KYMMSKIN X TNT CREATOR FEST          KymmSkin
  PRATISUN X TNT CREATOR FEST          Pratisun cosmetics
  BEAUTY OF ANGEL X TNT CREATOR FEST   Beauty Of Angel
  USMILE X TNT CREATOR FEST 2026       usmile Indonesia
  SYB X TNT CREATOR FEST 2026          SYB
```

Satu creator, satu live room panjang (program "Creator Fest 2026"), di
dalamnya jualan produk dari ~10 shop. TikTok menulis **satu baris per
(room x produk x campaign)**.

> ⚠️ **Karena itu 62.876 baris `organic_videos` hanya berisi 42.586 uid.**
> Itu **BUKAN** bug duplikasi - itu format laporan TikTok. JANGAN
> "dideduplikasi" dengan menghapus baris: satu room memang harus punya banyak
> baris, satu per produk yang dijual di dalamnya.

### 3C.36 Aturan hitung yang dipakai owner (6 Okt 2026)

> *"untuk campaign SYB misal cukup hitung yang ada product id dia aja ...
> livestream room id dan product id jadi acuan untuk menghitung sesi live
> di campaign tersebut"*

Definisi baku: **room dihitung untuk campaign X HANYA kalau `product_id`-nya
terdaftar di `skus` campaign X.**

Ternyata `organic_videos.campaign_id` selalu di-set dari `product_id` saat
import, jadi `WHERE campaign_id = X` **sudah** equivalent dengan
product-scoped. Verifikasi 44 campaign aktif (6 Okt):

| Definisi | Hasil |
|---|---|
| live by `campaign_id` vs by `product_id` | **43/44 identik** |
| video by `campaign_id` vs by `product_id` | **43/44 identik** |
| longgar (`videoActions`) vs ketat | **44/44 identik** |

Yang beda cuma **campaign 38 PWS** (live 677 vs 676, video 8.125 vs
8.037) - produknya belum terdaftar di Master Produk PWS. SYB identik di
semua definisi.

### 3C.37 Views WAJIB MAX, bukan SUM - dan semua jalur sudah benar (6 Okt 2026)

Satu room dengan 13 baris produk punya `video_views = 232` **diulang 13
kali** (itu views ruangan, bukan per produk). Jadi:

```
SUM = 3.016   <- 13x lebih besar, SALAH
MAX =   232   <- ini yang benar
```

Untuk SYB: `SUM 691.030` vs `MAX 529.526` = **30,5% lebih** kalau dijumlah.

Semua jalur baca sudah benar:
- `PerformaClient.tsx:156-157` - `Math.max` ✓ (plus filter `skuSet` di `:143`)
- `portalActions.ts:351-352` - `Math.max` ✓
- `videoActions.ts:185-186` - `Math.max` ✓

> Kalau menambah jalur baca baru, **jangan pernah `SUM(video_views)`**.
> Dedup per `content_uid` dulu, lalu `MAX`.

### 3C.38 ARSITEKTUR: raw import + filter per campaign saat BACA (6 Okt 2026)

Ini prinsip yang owner reiterate, dan saya sempat salah paham beberapa kali:

> *"data yang masuk akan mentah plek ketiplek seperti Excelnya, dan nanti di
> bagian tiap-tiap campaign akan memfilternya sesuai campaign setting-nya:
> waktunya kapan, kreatornya siapa aja, product id-nya apa aja, tipe
> kontennya apa aja, dan order id yang layak masuk"*

```
IMPORT (MENTAH)  organic_videos = isi apa adanya dari CustomReport TikTok
                 sales          = semua order_id yang pernah di-import
READ   (PER CAMPAIGN, mandiri)
                 product_id ∈ skus(campaign)   ← penyentu utama
                 creator    ∈ campaign_creators(campaign)
                 content_type ∈ {Livestream, Video}
                 tanggal ∈ start_date .. end_date
                 order_id → sales
```

> **"Kalau database-nya ngaco atau ga jelas gapapa, kita ubah aja."**
> Yang penting logikanya benar dan angka yang tampil akurat.

Dokumentasi lengkap: `docs/KEPUTUSAN-ARSITEKTUR-DATA.md`.

### 3C.39 JANGAN PERNAH pakai `tiktok_campaign_id` untuk memetakan campaign

Owner **sengaja** tidak memakainya:

```
33 OMG Makeup     tiktok_campaign_ids = {7584662142017324821}   10 produk make up
34 OMG Skincare   tiktok_campaign_ids = {7584662142017324821}    8 produk skincare
                  produk yang tumpang tindih = 0
```

Satu TikTok campaign ID untuk 2 campaign internal. `product_id` satu-satunya
pembeda yang sah.

> Konsekuensi: produk SYB dipakai di 2 campaign TikTok (7631140567631972112 dan
> 7643606629893670677), dan karena produknya terdaftar di `skus` campaign 46,
> **room Creator Fest tetap dihitung sebagai SYB**. Owner sudah menyetujuinya.
> SYB live = **847** sesuai aturan ini, bukan 547.

Kalau product_id salah input, itu **kesalahan PIC, bukan kesalahan sistem**.
Sistem tidak berwenang menebak.

### 3C.40 Import video manual: organic menang, lalu manual (6 Okt 2026)

```
1. Video ID ada di organic_videos  → PAKAI YANG ORGANIK, manual diabaikan
2. Tidak ada di raw data          → pakai hasil import manual, tetap dihitung
                                     di Performa tapi tidak terhubung
3. Live room                      → HARUS dihitung LIVE, tidak jadi pending video
```

Semua hitungan pakai `Set`, jadi satu ID tidak pernah terhitung dua kali
(`PerformaClient.tsx:236,240,244,251`). **Tapi ada dua bug** — lihat §3C.41.

### 3C.41 Dua bug di PerformaClient yang belum diperbaiki (6 Okt 2026)

**Bug 1 — approved/pending bisa dobel** (`:236` vs `:238`)

```tsx
:236  allApprovedVideoIds.add(id);                              // tidak cek pending
:238  if (!allApprovedVideoIds.has(id)) allPendingVideoIds.add(id);   // cek approved
```

Kalau organic sudah **pending** lalu manual masukkan **approved** → ID ada di
dua Set → terhitung dua kali. Persis skenario yang owner minta dihindari.

**Bug 2 — `sku_id` NULL lolos filter produk** (`:222`)

```tsx
if (campaignSkuIds.size > 0 && v.sku_id && !campaignSkuIds.has(v.sku_id)) continue;
```

`v.sku_id` NULL → baris **tidak difilter sama sekali**. Seharusnya NULL berarti
"belum terverifikasi", bukan "lolos semua filter".

### 3C.42 `start_date` / `end_date` campaign tidak pernah dipakai (6 Okt 2026)

Searching seluruh `web-app/src`: `start_date`/`end_date` campaign hanya muncul
di `app/page.tsx:29` (daftar campaign) dan `layout.tsx:30-38` (oper ke props
`CampaignFilterProvider`). **Tidak ada query data yang memfilter rentang
tanggal campaign.**

Yang ada di `importActions.ts:464-471` adalah filter tanggal untuk import Ads,
bukan campaign.

> Artinya filter "waktunya kapan" yang owner sebut **belum diimplementasikan**.
> Kalau perlu, ini gap yang harus diisi.

### 3C.43 `creator_filter_type` / `creator_filter_usernames` hanya filter UI

`providers/CampaignFilterProvider.tsx:55-58` → `isCreatorVisible` menyembunyikan
kreator dari tampilan di semua tab. **Tidak menyentuh query**, jadi tidak
memengaruhi GMV, live count, atau angka lain.

Yang dipakai untuk menghitung, hanya `campaign_creators.campaign_id` +
`creators.username` (misal `performaActions.ts:17`).

### 3C.44 `videos` tercemar live room — siap dibersihkan (6 Okt 2026)

```
jenis                          baris     uid    approved
Video                       39.844   30.008         22
tidak ada di organic_videos  1.150    1.139         28
LIVESTREAM  <- seharusnya bukan 1.015     358          0
```

358 live room nyangkut di `videos`. **Nol approved** → aman dihapus tanpa
melanggar aturan owner "approved jangan di-pendingin lagi".

Owner juga siap refresh data: *"gapapa kok jika saya harus refresh data biar
masuknya sesuai dan rapih raw datanya"*.

## 9. Cara memperbarui skill ini

Setelah sesi yang modify kode, jika ada temuan baru (jebakan, keputusan arsitektur, nama
kolom yang mengejutkan), **tambahkan ke §3 atau §5 pada sesi yang sama**. Skill ini
nilainya dari akurasi — entry basi lebih buruk dari tidak ada entry.

### Aturan tambahan (permintaan user, 1 Okt 2026)

> "setiap ada sesuatu tolong update skill dan dokumentasi yaa biar anda ga lupa
> konteks dan makin pinter dan jika saya berganti model tetep masih paham apa aja
> yang udah kita lakukan"

Kalau tidak ada konteks chat, **dokumentasi adalah satu-satunya cara model berikutnya
bisa tahu apa yang sudah terjadi.** Jadi:

| Jenis informasi | Ditempatkan di |
|---|---|
| Jebakan teknis, kolom aneh, asumsi yang salah | **§3 skill ini** |
| Keputusan user + alasannya | **`docs/KEPUTUSAN-*.md`** |
| Timeline masalah → solusi + angka sebelum/sesudah | **`docs/LOG-PERTEMUAN-*.md`** |
| Rencana yang masih jalan | `.opencode/plan/` |

**Jangan tunggu sesi berikutnya.** Tulis di sesi yang sama, lalu commit.

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
7. **Jangan simpulkan "kolom X tidak ada" dari daftar output psql.** Output bisa terpotong di
   tengah. Uji per kolom dengan `EXISTS` — inilah akar kesalahan rencana payment §5.2.
   Lihat §3.46.
8. **Cegah duplikat dengan upsert, jangan replace.** Ini perintah user: data yang tidak
   lengkap lebih boleh ada daripada data yang hilang saat ditimpa.

### 10c. Aturan data payment

1. **Tanggal payment pakai TANGGAL PENGAJUAN dulu**, fallback tanggal pembayaran. April–Juni
   di spreadsheet tidak punya `Tgl Actual Payment` sama sekali. Prinsipnya **rekam, jangan
   menebak**. Lihat §3.52 dan `docs/KEPUTUSAN-PEMBAYARAN.md`.
2. **Baris tanpa campaign harus DILIST + didokumentasikan** (laporan), tidak pernah dikarang
   atau dibuang diam-diam.
3. **Alokasi payment all-or-nothing per batch per tanggal**, hanya baris `Paid Off`.
4. **Dobel-input spreadsheet + sistem itu atas perintah user**, bukan bug. Jangan diperbaiki
   diam-diam. Lihat §3.53.
5. **`importHistoricalBatch` sudah dihapus.** Fungsi itu insert 3 kolom yang tidak pernah ada
   di `payment_items` → pasti crash. Migrasi = SQL migration file. Lihat §3.47.
6. **Jangan pasang unique index `(campaign_creator_id, payment_type)`** — akan menolak
   pembayaran sah yang sah (kasus `jimmy.hen` 2 pembayaran). Butuh `nominal` + tanggal. §3.51.
7. **`requireRole` untuk approval payment = sengaja ditunda** untuk observasi. Jangan
   menambahkan diam-diam. Lihat §3.54.

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

---

### 10d. Pemetaan Raw TikTok vs Tabel Videos PIC & Audit Performa (7 Okt 2026)

1. **Pemetaan File Raw TikTok:**
   - `affiliate_orders_*.xlsx` -> Tab **Input Penjualan > Organik Sales** -> Tabel **`sales`** (kunci: `order_id`).
   - `CustomReport_*_Video_*.xlsx` -> Tab **Input Penjualan > Awareness Video** -> Tabel **`organic_videos`** (`content_type = 'Video'`, kunci: `(content_uid, product_id)`).
   - `CustomReport_*_Live_*.xlsx` -> Tab **Input Penjualan > Awareness Live** -> Tabel **`organic_videos`** (`content_type = 'Livestream'`, kunci: `(content_uid, product_id)`).
2. **Pemisahan Kerjaan Manual PIC:**
   - Import video manual PIC disimpan di tabel **`videos`** (terikat ke `campaign_creators`).
   - Reset/pembersihan data TikTok Partner Center **HANYA** menyentuh `sales` dan `organic_videos`. Tabel `videos` **DILARANG DIHAPUS** agar hasil kerja PIC tetap utuh.
   - Status 'Terkoneksi' di menu video adalah hasil pencocokan dinamis `videos.content_uid` ke `organic_videos` / `sales`.
3. **Hasil Audit Performa Campaign 46 (SYB) - 7 Okt 2026:**
   - GMV Organik (Rp 75,4M / 2.336 order), GMV Ads (Rp 86,4M), Total Achievement (Rp 161,8M), Views (1.597.236 dari 496 video unik) **100% cocok dengan raw PostgreSQL**.
   - Tidak ada kebocoran produk asing (`0` order di luar SKU SYB), `0` kreator unmapped, `0` duplikat order ID se-DB (34.869 order unik), dan `0` duplikat video ID di campaign SYB.
4. **Logika Listing & Seleksi:**
   - Checkbox `Sisa ber-Video (Belum Approved)`: filter kreator belum approved (`cc.approval != 'approved'`) yang sudah memiliki video di tabel `videos` atau terdeteksi di `organic_videos`/`sales`.
   - Checkbox `Unattributed (Sisa + GMV)`: filter kreator belum approved yang sudah menghasilkan penjualan (`s.gmv > 0`). Digunakan untuk menyelesaikan Unattributed GMV Gap.
   - Badge `AUTO`: menandai kreator yang masuk otomatis dari laporan TikTok Partner Center (`added_by IS NULL` atau `tier = 'Auto-Detect'`), membedakannya dari kreator hasil scouting PIC internal.
5. **Logika Live Room (Multi-Produk per Room):**
   - Dalam TikTok CustomReport Live, 1 live room bisa berisi banyak produk sehingga diekspor dalam banyak baris.
   - Perhitungan jumlah sesi live SELALU menggunakan `COUNT(DISTINCT content_uid)` dari tabel `organic_videos`.
   - Angka sesi live murni dari `organic_videos` (Awareness Live) dan TIDAK PERNAH tercampur dengan data pesanan di tabel `sales`.
   - Rujukan sesi lengkap: `docs/LOG-PERTEMUAN-2026-10-07.md`.

---

### 10e. Metrik Performa Organik, Leaderboard Top 10 & Winning Concept (8 Okt 2026)

1. **Batasan & Transparansi Data TikTok Partner Center (Murni Organik):**
   - Kolom yang **PASTI ADA** di TikTok Partner Center: `Video views`, `Video likes`, `Quantity` (Items Sold), `Order ID` (Orders), dan `Commission GMV`.
   - Kolom yang **TIDAK ADA** di Partner Center: Clicks keranjang kuning, Shares, dan Saves (klik hanya ada di TikTok Ads Manager berbayar).
2. **Standardisasi Metrik untuk Klien & Tim Internal:**
   - **Like Engagement Rate (ER)**: $\frac{\text{Total Likes}}{\text{Total Views}} \times 100\%$ (indikator rasio apresiasi penonton per tayangan).
   - **Conversion Rate (CR)**: $\frac{\text{Total Items Sold}}{\text{Total Views}} \times 100\%$ (indikator ketajaman konten membujuk audiens membeli).
   - **Sales-to-Likes Ratio**: $\frac{\text{Total Items Sold}}{\text{Total Likes}} \times 100\%$ (rasio efektivitas audiens engaged hingga menjadi pembeli fisik).
   - **Revenue per Video**: $\frac{\text{Total GMV Organik}}{\text{Total Video Terupload}}$ (omzet rata-rata per video tayang).
   - **Revenue per Active Creator**: $\frac{\text{Total GMV Organik}}{\text{Jumlah Kreator yang Sudah Upload Video}}$ (kreator approved tanpa upload tidak menjadi pembagi).
3. **Top 10 Creator Performance:**
   - Dikelompokkan dalam 4 pilar: **Top GMV**, **Top Views**, **Top Like ER**, dan **Top Items Sold**.
   - Dilengkapi nomor ranking 1-10, badge prestasi, link TikTok profil, dan rincian unit produk terjual.
4. **Winning Concept Showcase & Relasi Link VT:**
   - Master konsep dari `campaign_concepts` dihubungkan ke `videos.concept`, `organic_videos`, dan `sales`.
   - Mengakumulasikan Total VT, Total Views, Items Sold, GMV Konsep, serta Like ER.
   - Menyediakan accordion dropdown link TikTok VT valid (`https://www.tiktok.com/@username/video/${content_uid}`) yang dapat langsung diklik oleh tim dan brand.
   - **Zero Database Migration**: Memanfaatkan skema tabel yang sudah ada tanpa penambahan tabel/kolom baru di PostgreSQL.
   - Rujukan sesi lengkap: `docs/LOG-PERTEMUAN-2026-10-08.md`.

5. **Penyelarasan Metrik Portal Brand vs Internal (Pemisahan Livestream & Resolusi Alias Kreator):**
   - **Bug Livestream di Like ER**: Di `portalActions.ts`, likes dan views dari sesi livestream sebelumnya ikut diakumulasikan ke `calcTotalViews` dan `calcTotalLikes`. Pada campaign dengan live session yang mendulang jutaan like (misal Campaign 41 memiliki live session 5,2 juta like), Like ER di portal membengkak menjadi `409.92%` (5,2M likes / 1,2M views) sedangkan di dashboard internal tercatat `2.25%` (12.758 likes / 566K views). Solusi: Akumulasi awareness video (`calcTotalViews`, `calcTotalLikes`, `perf.video_views`, `perf.video_likes`) **WAJIB diisolasi HANYA untuk video non-livestream** (`!isLive`).
   - **Resolusi Alias Kreator (Kreator Aktif 166 vs 170)**: Di dashboard internal, `creator_aliases` dipetakan ke `primary_username` sehingga username lama/alias tidak dianggap entitas baru. Di portal brand sebelumnya tidak ada lookup `creator_aliases`, menyebabkan 4 alias username terhitung sebagai kreator terpisah (170 kreator aktif vs 166 di internal) sehingga nilai `Revenue per Active Creator` berselisih (Rp 172.578 vs Rp 176.736). Ditambahkan query `creator_aliases` di `portalActions.ts` dan pemetaan `aliasToPrimaryMap` pada data `sales` dan `organic_videos`.
   - **Perbaikan Subtitle Card "Revenue per Active Creator"**: Teks di bawah kartu yang sebelumnya berbunyi *"Dihitung dari X kreator yang sudah upload video"* disesuaikan menjadi *"Rata-rata performa omzet per kreator aktif"*, agar persentase kreator yang upload vs total approved tidak vulgar ditampilkan ke hadapan brand klien.
   - Rujukan sesi lengkap: `docs/LOG-PERTEMUAN-2026-10-08.md`.

6. **Definisi Kreator Aktif & Penambahan Metrik pada Pencapaian Target Creator:**
   - **Kriteria Kreator Aktif**: Kreator approved/alternate yang telah menghasilkan konten baik itu video (`total_vt > 0`) ATAU sesi live (`total_livestreams > 0`), maupun keduanya (`isActive = total_vt > 0 || total_live > 0`). Hal ini mengakomodasi tipe kreator *live-only*, *video-only*, dan *hybrid* (live + video).
   - **Revenue per Active Creator**: Pembagi kini mencakup seluruh kreator aktif (video atau live), sehingga omzet terbagi adil terhadap seluruh kreator yang benar-benar aktif berkontribusi.
   - **Card Pencapaian Target Creator**: Ditambahkan badge indikator **`X Kreator Aktif (VT / Live)`** berdampingan dengan jumlah kreator approved dan pending di Internal Dashboard dan Brand Portal.
