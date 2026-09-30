# Arsitektur Aktual — TNT Project Tracking System

> **Status**: dokumen ini menggambar **kondisi sistem yang benar-benar ada di kode**, bukan kondisi yang *diharapkan*.
> Berbeda dari `ARCHITECTURE.md` (root, v2.2) yang ditulis lebih awal dan beberapa bagiannya sudah tidak akurat.
> **Tanggal audit**: 30 September 2026 · **Commit**: `fba7c36` di branch `main`
> **Ukuran**: 163 file TS/TSX · ~51.000 baris · 239 exported server action · 40 route

---

## 1. Bentuk Sistem (Big Picture)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                │
│  • 65 dari 109 komponen .tsx adalah "use client"                        │
│  • State global: Zustand (useDatabaseStore, 601 baris)                   │
│  • Auth state: AuthProvider (context) —_isi dari server action_          │
│  • Token TikTok: localStorage (MASIH ADA — lihat §6)                     │
│  • Halaman besar ambil data sendiri via server action di useEffect      │
└────────────┬─────────────────────────────────────────────────────────────┘
             │  Server Actions (POST, RSC protocol)  +  5 Route Handler
             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NEXT.JS 16.2.7 SERVER (Node.js, standalone output, Coolify container)   │
│                                                                          │
│  proxy.ts  ──►  gate: HANYA cek cookie "authjs.session-token" ADA      │
│                /login /api/auth /auth /portal = PUBLIK                  │
│                                                                          │
│  auth.ts   ──►  NextAuth v5, Google OAuth, JWT strategy                 │
│                signIn callback: whitelisted_emails → PALSU, selalu true  │
│                                                                          │
│  instrumentation.ts ──► setInterval 60s ──► cek slot [7,12,15,18] WIB    │
│                        ──► runTikTokAutoSync()                          │
│                                                                          │
│  239 server action ──► 95% tanpa cek role/kepemilikan yang bermakna      │
└────────────┬─────────────────────────────────────────────────────────────┘
             │  postgres-js (Drizzle wrapper), pool max = 20
             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (VPS Coolify) — db_tnt_project_system                        │
│  • 35+ tabel. 8 di antaranya TIDAK ada di src/db/schema.ts              │
│  • 12+ stored function (RPC) untuk agregasi                             │
│  • 4+ view (vw_campaign_summary didefinisikan ulang 6× dalam 6 bulan)   │
│  • RLS: ENABLED dengan policy USING(true) — tapi di-bypass karena      │
│    aplikasi konek langsung, bukan lewat Supabase client                │
└──────────────────────────────────────────────────────────────────────────┘
             ▲
             │  6 jalur ingestion (lihat §5)
   ┌─────────┴──────────┬──────────────┬─────────────┬──────────────┐
 TikTok Partner    Excel/CSV      Chrome Ext.   Cron ext.   Brand Portal
 Center OpenAPI   (papaparse)    (localStorage)  (Bearer)    (PIN 4-digit)
```

---

## 2. Pola Arsitektur yang Benar-Benar Dipakai

### 2.1 Client-heavy, bukan server-rendered

Ini keputusan yang **sengaja** (atau hasil evolusi) dan sebaiknya dipertahankan — memindahkan
UI ke Server Component sekarang = rewrite besar.

- Halaman **`app/page.tsx`, `app/campaigns/page.tsx`, `app/campaigns/[id]/layout.tsx`** semuanya `"use client"`.
- `app/page.tsx:9` langsung baca `useDatabaseStore()`.
- Hanya 16 dari ~30 `page.tsx`/`layout.tsx` adalah server component, dan hampir semuanya
  hanya wrapper tipis yang me-render client component.

**Konsekuensi yang harus dipahami:**
- `revalidatePath()` dipanggil **101×** di server action, tapi **tidak ada efeknya** untuk
  render client. Ini bukan bug — ini sisa era Supabase Realtime. Menghapus 101 panggilan
  itu *bolt-bolt* dan berisiko. **Biarkan.**
- Setelah mutasi, halaman **tidak auto-refresh**. Ini perilaku yang sudah.users习惯了.
  **Jangan tambahkan `router.refresh()`** — tidak akan memperbaiki apa pun dan menambah bingka.
- Store melakukan `setState` lokal setelah setiap mutasi (32 action). Somewhat manual
  tapi konsisten.

### 2.2 Database: raw SQL, bukan Drizzle query builder

Hampir **100% query** adalah `db.execute(sql\`...\`)` dengan tagged template Drizzle.
Drizzle dipakai hanya sebagai:
1. Pool manager + typed parameter binding (`db/index.ts`)
2. Type-only schema (`db/schema.ts` — sudah stale, lihat §4.1)
3. Helper `sqlInList` (`db/index.ts:28-31`)

**Konsekuensi:** tidak ada compile-time check nama kolom. Salah nama kolom = runtime error
yang tertangkap `.catch(() => [])` di banyak tempat → **kehilangan data senyap**.

> ⚠️ `.catch(() => [])` muncul di mana-mana. Contoh: `storeActions.ts:121` untuk
> `vw_campaign_summary`. Kalau view itu error, dashboard jadi kosong **tanpa pesan error**.
> Ini pola yang perlu diimsak: kalau menambah fetch, jangan swallow error diam-diam.

### 2.3 Server action = satu-satunya "API"

Tidak ada REST API untuk CRUD. Semua operasi tulis dari browser adalah server action.
Konsekuensi penting untuk keamanan: **server action adalah endpoint publik yang tidak
memperhatikan UI sama sekali.** Component yang menyembunyikan tombol tidak menyembunyikan
kemampuan.

---

## 3. Domain: Rudolf Chain yang Sebenarnya

```
                    ┌──────────┐
                    │  brands  │
                    └────┬─────┘
                         │ 1:N
                    ┌────▼──────┐        ┌──────────────┐
                    │ campaigns │──1:N──│ campaign_    │◄──┐
                    │ (induk)   │        │  concepts    │   │
                    └──┬──┬──┬──┘        └──────┬───────┘   │
          1:N    ┌────┘  │  │  └────┐           │ 1:N       │
       ┌─────────▼──┐┌──▼──┐┌───▼────────┐┌────▼────────┐  │
       │    skus    ││ads_*││organic_    ││    videos    │──┘
       └────┬───────┘└─────┘│  videos    │└──────────────┘
            │  ▲            └────────────┘
            │  │ sku_id (SET NULL)
       ┌────▼──┴───────────────┐
       │        sales         │  ← order TikTok, gmv bigint, order_id UNIQUE
       └───────────────────────┘

       ┌──────────────────┐
       │  campaign_       │◄── pivot utama domain
       │  creators        │──1:N── creator_addresses
       └──┬────┬─────┬───┘──1:N── campaign_creator_notes
          │    │     └──────1:N── videos (via campaign_creator_id)
          │    └────────────1:N── payment_items ──► payment_batches
          └─────N:1─────► creators ──1:N── creator_snapshots
                                              ├─1:N── creator_contacts
                                              ├─1:N── creator_niches
                                              ├─1:N── creator_address_book
                                              └─1:N── creator_bank_accounts
```

### 3.1 Relasi yang **terputus** (string-based, tanpa FK)

Ini yang menyebabkanakyanya query lambat dan data gampang "hilang":

| Kolom | Seharusnya FK ke | Kenapa bermasalah |
|---|---|---|
| `organic_videos.creator_username` | `creators.username` | Query pakai `LOWER(col)=LOWER(?)` → **full table scan**, index B-tree tidak kepakai |
| `sales.campaign_creator_id` | `campaign_creators.id` | **Tidak ada di `schema.ts`**, dipakai `reporting.ts:22` |
| `ads_performance.creator_id` | `creators.id` | **Tidak ada di `schema.ts`**, dipakai di 6 file |
| `videos.content_uid` | `organic_videos.content_uid` | **Tanpa unique index.** Dedupe 100% bergantung kode aplikasi |
| `user_campaigns.user_id` | `profiles.id` | Tanpa FK. User dihapus → ACL yatim |
| `ads_topups.sender_account_id` | `sender_accounts.id` | Tanpa FK |

### 3.2 Tiga sumber kebenaran yang bisa berbeda

**Status bayar** — 3 tempat:
- `payment_items.final_status` (sumber baru, dipakai `paymentActions.ts`)
- `campaign_creators.status_bayar` (legacy, ditulis `databaseActions.ts:545,565` DAN `paymentActions.ts:929`)
- `creator_payments.status_bayar` (legacy, tabel tidak ada di schema.ts)

Dua penulis pada `campaign_creators.status_bayar`, **tanpa transaksi**. Banyak bugs
"kok sudah lunas tapi belum" dan sebaliknya adalah konsekuensi ini.

**Role** — 3 tempat: `profiles.role`, `whitelisted_emails.role`, `users.role` (tabel `users` nyaris tidak dipakai).

**GMV** — 5 sumber tumpang tindih:
1. `sales.gmv` (organik, per order)
2. `ads_performance.gross_revenue_usd × kurs` (ads)
3. `videos.organic_sales_video` + `organic_sales_livestream` + `ads_sales_video` + `ads_sales_livestream` (4 kolom per video)
4. `campaign_creators.gmv_organic_legacy` + `gmv_ads_legacy` (beku, tidak ada proses refresh)
5. `daily_performance.organic_sales` + `vsa_sales`

`vw_campaign_summary` dijadwalkan ulang **6 kali dalam 6 bulan** dengan logika berbeda.
Versi phase_2 menjumlahkan (1)+(2)+(4). Versi phase_5 memakai `GREATEST(total_daily, tracked)`.
**Angka "achievement GMV" di dashboard berubah definisi setiap kali view di-update.**

> ⚠️ Jangan menulis query penjumlahan baru yang menggabungkan 2 sumber ini — angka akan dobel.

---

## 4. Database: Temuan Struktural

### 4.1 `src/db/schema.ts` **tidak cocok** dengan database nyata

Drizzle schema adalah **generasi lama yang ditinggalkan**. Bukti bobot:

| Tabel | `schema.ts` bilang | Database nyata bilang |
|---|---|---|
| `payment_batches` | `batch_code`, `batch_type`, `total_amount`, `item_count` | `batch_label`, `submitted_by`, `manager_reviewed_by`, `finance_reviewed_by`, `executive_reviewed_1_by`, `paid_by`, `actual_payment_date`, `bukti_transfer_url`, `sender_account_id` |
| `payment_items` | `amount` | `nominal`, `ratecard_awal`, `biaya_transfer`, `actual_transfer` |
| `sales` | `gross_sale`, `refund`, `buyer_payment` | `gmv BIGINT`, `is_refund BOOLEAN` |
| `ads_performance` | `cost`, `gmv`, `impressions`, `clicks` | `cost_usd`, `gross_revenue_usd`, `kurs NUMERIC` |
| `daily_performance` | 9 kolom counter | **VIEW** dengan 2 kolom (`organic_sales`, `vsa_sales` NUMERIC(15,2)) |

**8 tabel tidak ada di `schema.ts` sama sekali** (23% entitas runtime):
`live_sessions`, `live_session_products`, `live_schedules`, `payout_requests`,
`payout_creator`, `creator_payments`, `ads_allocations`, `pembayaran`.

**`schema.ts` punya nol deklarasi `index()`.** Semua index dibuat manual lewat SQL migration.

> 🔴 **Aturan keras: JANGAN PERNAH menjalankan `drizzle-kit push` atau `generate`.**
> Itu akan menghapus unique constraint `sales.order_id` danGwilight database.
> Perubahan skema SELALU lewat file SQL baru di `web-app/supabase/migrations/`.

### 4.2 Constraint yang hilang padahal kode mengandalkannya

| Yang dibutuhkan | Bukti kode | Status |
|---|---|---|
| `campaign_creators (campaign_id, creator_id)` UNIQUE | check-then-insert di 4 tempat | ❌ tidak ada → race condition |
| `videos.content_uid` UNIQUE | `syncUnmapped.ts:144`, `importActions.ts:290` | ❌ tidak ada |
| `videos (campaign_creator_id, urutan)` UNIQUE | `MAX(urutan)+1` di 3 tempat | ❌ tidak ada → nomor video bentrok/bolong |
| `organic_videos (content_uid, product_id)` | `ON CONFLICT` di `importActions.ts:183` | ⚠️ rapuh — kalau `product_id` NULL, conflict **tidak pernah terpicu** |
| `live_sessions.livestream_room_id` UNIQUE | `ON CONFLICT` di `importActions.ts:529` | ❌ tidak ada di repo |
| `ads_performance` unique | `importActions.ts:465` INSERT polos | ❌ tidak ada → upload 2× = dobel |
| `profiles.email` lowercase-unique | semua query `LOWER(email)=?` | ⚠️ unique ada tapi **case-sensitive** |
| `skus (campaign_id, product_id)` UNIQUE | `syncUnmapped.ts:23` | ✅ ada di DDL |

### 4.3 Index yang hilang → full table scan

Tabel `sales` (ratusan ribu order) punya 6 index. Yang **tidak** ada padahal dipakai:
- `sales.campaign_creator_id` (`reporting.ts:22`)
- `sales.order_status` (filter refund di semua dashboard)
- `organic_videos (campaign_id, content_uid)` (`syncUnmapped.ts:50`)
- `organic_videos.creator_username` (`creatorActions.ts:174`)
- `payment_items.campaign_creator_id` (`paymentActions.ts:917,1015,1298`)
- `campaign_creators (campaign_id, creator_id)` composite (hanya index terpisah)

### 4.4 Penyimpanan uang

| Jenis | Kolom | Tipe | Risiko |
|---|---|---|---|
| Rupiah bulat | `campaigns.budget_*_plafon`, `campaign_creators.price`, `payment_items.nominal` | `bigint` | ✅ aman sampai 9.0e15 |
| Desimal | `skus.komisi`, `ads_performance.kurs` | `NUMERIC` **tanpa skala** | ⚠️ presisi penuh, tidak ada `ROUND()` |
| Terbatas | `daily_performance.organic_sales` | `NUMERIC(15,2)` | ⚠️ **overflow** untuk GMV > ~10 triliun → insert gagal diam-diam |
| Campuran | `ads_topups.nominal_idr` + `nominal_usd` + `kurs_topup`; `ads_allocations.alokasi_usd` + `alokasi_idr` | 2 representasi | ⚠️konvensi berbeda per tabel, `vw_campaign_budget_summary` menjumlahkan sebagai rupiah sementara `vw_campaign_summary` menjumlahkan `cost_usd × kurs` |

**Rekomendasi untuk kolom uang baru:** `NUMERIC(18,2)` untuk yang desimal, `bigint` untuk rupiah bulat,
`ROUND()` di SQL bukan di JS. Akumulasi di client dengan JS number akan menambah galat floating point.

### 4.5 RLS adalah keamanan semu

`supabase/migrations/20260628000000_enable_rls.sql` meng-enable RLS di **semua** tabel dengan
policy `USING (true) WITH CHECK (true) TO authenticated`.

Tapi aplikasi **tidak pernah pakai Supabase JS client** — dia konek langsung ke Postgres
lewat `postgres-js` (`db/index.ts:14`). Akibatnya:
- Tidak ada claim `auth.uid()` yang dibuat → policy RLS berbasis identity akan menolak semua request
- Kredensial koneksi adalah user pemilik tabel → **RLS di-bypass** (RLS tidak berlaku ke table owner tanpa `FORCE ROW LEVEL SECURITY`)

**Semua scoping 100% di level aplikasi.** Meaning: kalau aplikasinya tidak cek, database juga tidak cek.
Ditambah tabel yang dibuat **setelah** tanggal migration itu (28 Juni 2026) — `ads_allocations`,
`live_sessions`, `payout_requests`, `manual_video_imports` — **tidak pernah dapat RLS sama sekali**.

---

## 5. Enam Jalur Ingestion Data

### 5.1 TikTok Shop OAuth
`/auth/tiktok-shop/callback` → user login Partner Center → `?code=` → tukar token →
**disimpan plaintext di DB** (`tiktok_authorizations`, 1 baris global) **dan** `localStorage`
→ token ditampilkan di `<input readonly>` + tombol copy.
**Tidak ada penulisan ke `sales`/`organic_videos` di jalur ini.**

### 5.2 Auto-sync (cron in-process)
`instrumentation.ts` → `setInterval` 60 detik → cek slot `[7,12,15,18]` WIB → `runTikTokAutoSync()`.
Pipeline: auth → campaigns (3 status × ≤20 halaman) → orders (window 30 hari × ≤100 halaman)
→ products per campaign → performance per product → **content statistics per creator**
→ save → `syncAllUnmappedGlobal()`.

> ⚠️ Tanpa throttle, retry, backoff, timeout. `Promise.all` tanpa batas di `tiktokAutoSync.ts:612`
> bisa menembakkan ratusan request HTTP bersamaan. `maxDuration = 60` di route cron
> **tidak realistis** — sync penuh butuh puluhan menit.

### 5.3 Manual sync (SSE)
`POST /api/sync/tiktok-manual` → stream `text/event-stream` → progress bar di
`TikTokSyncControlCard.tsx` (polling 3 detik saat running, 15 detik saat idle).
**Tanpa autentikasi.** Kalau stream terputus, sync **tetap berjalan** dan menulis DB.

### 5.4 Excel/CSV
5 parser (`importCreatorSync`, `importCampaignSync`, `importAddressSync`, `importBudgetSync`,
`importAdsSync`), semua parse di **browser**, hanya tulis lewat server action.
`executeSalesImportChunkAction` (`importActions.ts:33-352`) menjalankan **5 tahap tanpa transaksi**:
sales → organic_videos → creators → campaign_creators → videos.
Kegagalan di tahap 4 padahal tahap 1-3 sudah commit → user melihat "Data Gagal" padahal
data **berhasil masuk**.

### 5.5 Chrome Extension
**Ada dua salinan yang berbeda** — ini jebakan:
- `chrome-extension/` (root) → ✅ target `https://campaign.tntkreatif.com/creator-pool/import`,
  tulis `localStorage['tnt_import_draft_global']`, dibaca `SpreadsheetImportClient.tsx:61,142,144,429`. **INI YANG BENAR.**
- `web-app/chrome-extension/` → ❌ target `http://localhost:5173/bulk-input`,
  route `/bulk-input` **tidak ada**. Salinan mati.

### 5.6 Brand Portal (untuk klien eksternal)
PIN 4-digit per campaign → cookie `portal_pin_{campaignId}` berisi **PIN mentah**.
Default PIN campaign baru = `'1234'` (`storeActions.ts:177`). Tanpa rate limit.
`getPortalData` mengembalikan PII kreator: nomor WA, alamat, rekening, data keuangan.
`/portal` adalah **prefix publik** di `proxy.ts:11` — seluruh 6 halaman dapat diakses anonim
(asalkan punya/nabrak PIN).

---

## 6. Autentikasi & Otorisasi: Bentuk Sebenarnya

### 6.1 Gerbang: `proxy.ts`
```ts
const sessionToken =
  request.cookies.get('authjs.session-token')?.value || ...;   // proxy.ts:14-18

if (!sessionToken && !isPublicPath) redirect('/login');
```
**Hanya mengecek cookie ADA, nilainya tidak diverifikasi.** Public path: `/login`, `/api/auth`, `/auth`, `/portal`.

### 6.2 Identitas: `auth.ts`
`signIn` callback (`auth.ts:33-85`):
1. Query `whitelisted_emails` → **lalu diabaikan**
2. Query `profiles` → dipakai
3. Kalau role kosong: email mengandung `"admin"` atau `"executive"` → `role = 'executive'`, selain itu `'staff'`
4. Insert profile baru dengan `status = 'approved'`
5. **`return true` di baris 80, selalu**

Konsekuensi: **siapa pun dengan akun Google masuk sebagai staff (atau executive kalau namanya kebetulan mengandung "admin").**

### 6.3 Otorisasi: hanya di client
`AuthProvider.canEditCampaign(campaignId)` (`AuthProvider.tsx:71-80`) adalah **satu-satunya**
implementasi ACL (`user_campaigns`). Ia dipanggil dari komponen `.tsx` untuk `disabled` tombol.

**Tidak ada server action atau API route yang membaca `user_campaigns` untuk memutuskan.**
Data fetch di halaman keuangan (`keuangan/page.tsx:49-54`) berjalan **tanpa gate**;
`hasAccess` hanya membungkus 2 blok JSX (`:271,279`).

### 6.4 Peta guard yang benar vs salah

**Benar (pola yang harus digeneralisasi):**
- `manajemen-akun/actions.ts:8-21` `getAdminUser()` — cek session + cek role dari DB
- `portalActions.ts:707-717` `updateResiByClient` — cek kepemilikan alamat terhadap campaign
- `skuActions.ts:50` — `DELETE ... WHERE id=? AND campaign_id=?`

**Salah (reachability nyata):**

| Fungsi | File:line | Akibat |
|---|---|---|
| `updateProfileAction` | `databaseActions.ts:1248` | **Ubah role user mana pun jadi `admin`** — twin tanpa auth dari `changeUserRole` |
| `updateUserCampaignsAction` | `databaseActions.ts:1272` | **Self-grant `all_campaigns`** |
| `updateCreatorPaymentAction` | `databaseActions.ts:524` | Tandai kreator mana pun jadi `lunas` |
| `financeMarkPaid` / `bulkMarkPaidFinance` | `paymentActions.ts:1009` / `:1322` | Tandai pembayaran lunas + tulis `status_bayar='lunas'` |
| 23 fungsi rantai approval | `paymentActions.ts:808-1420` | Semua panggil `auth()` tapi **tidak pernah cek hasilnya** |
| `getInitialStoreData` | `storeActions.ts:104` | Semua campaign + semua profile + role |
| `deleteCampaignAction` | `storeActions.ts:250` | Hapus campaign (+ cascade semua anaknya) |
| `deleteSkuAction` | `storeActions.ts:304` | `campaignId` **hanya untuk `revalidatePath`**, tidak masuk `WHERE` |
| `batchDeleteCampaignCreatorsAction` | `campaignPageActions.ts:2131` | `DELETE ... WHERE id IN (...)` lintas semua campaign |
| `updateClientNotes` | `portalActions.ts:775` | Tulis ke campaign mana pun, **tanpa cek PIN** |
| `POST /api/expand-tiktok` | `api/expand-tiktok/route.ts:7-15` | **SSRF** — validasi `String.includes('vt.tiktok.com')` bisa di-bypass |
| `POST /api/sync-unmapped` | `api/sync-unmapped/route.ts` | `syncAll: true` = tulis global, tanpa auth |
| `POST /api/sync/tiktok-manual` | `api/sync/tiktok-manual/route.ts` | Sync campaign mana pun, tanpa auth |
| `GET/POST /api/cron/tiktok-sync` | `api/cron/tiktok-sync/route.ts:21` | `CRON_SECRET` **opsional** — kalau unset, terbuka |

---

## 7. Pipeline TikTok: Detail Teknis

### 7.1 Skema token
| Aset | Lokasi | Catatan |
|---|---|---|
| `app_key` / `app_secret` | **hardcoded fallback** `tiktokShopApi.ts:4-5` | ⚠️ di git history |
| `access_token` / `refresh_token` | Kolom `TEXT` **plaintext** di DB | Tidak ada enkripsi/vault |
| `access_token` / `refresh_token` | `localStorage['tts_*']` | XSS → token dicuri, valid ~365 hari |
| `service_id` | hardcoded `TikTokCallbackClient.tsx:30` | |
| Scoping | **Tidak ada** — `WHERE status='active' ORDER BY id DESC LIMIT 1` | Hanya 1 seller per instalasi; token kedua **menimpa** yang pertama |

**`app_secret` dikirim sebagai query string GET** (`tiktokShopApi.ts:41-47, 67-73`) → bocor ke
access log, log proxy, dan `Referer`.

**Bug refresh** (`tiktokShopApi.ts:251-262`): kalau refresh gagal (token expired/revoked),
fungsi **tetap return `{ isValid: true, accessToken: <token mati> }`**. Sync berikutnya gagal
dengan 401 yang tidak deskriptif. Tidak ada notifikasi "re-authorize required".

### 7.2 Idempotensi
| Tabel | Conflict target | Masalah |
|---|---|---|
| `sales` | `ON CONFLICT (order_id)` | ✅ aman. Tapi `order_id` **berbeda skema** antara Excel import (komposit, `OrganicImport.tsx:425`) dan auto-sync (ID TikTok mentah, `tiktokAutoSync.ts:348`) → **jawduplikasi + GMV dobel** bila keduanya jalan untuk periode yang sama |
| `organic_videos` | `ON CONFLICT (content_uid, product_id)` | ⚠️ kalau `product_id` NULL → `NULL != NULL` → conflict tidak pernah terpicu → **duplikat setiap sync** |
| `videos` | check-then-insert | ❌ race-prone |
| `campaign_creators` | check-then-insert | ❌ race-prone |
| `ads_performance` | `INSERT` polos | ❌ upload 2× = dobel |
| `live_session_products` | DELETE-then-INSERT tanpa transaksi | ❌ crash di tengah = **data hilang permanen** |

### 7.3 Transaksi
`db.transaction` dipakai di **satu tempat** seluruh aplikasi: `listingActions.ts:127`.
Semua import, sync, dan bulk operation berjalan **tanpa transaksi**.

### 7.4 Silent drop
`tiktokAutoSync.ts:717-722`:
```ts
const videoRowsUnmapped = videoRowsToInsert.filter(v => v.campaign_id == null);
console.log(`… ${videoRowsUnmapped.length} video rows skipped`);
// videoRowsUnmapped TIDAK PERNAH dipakai lagi
```
Ribuan video bisa hilang per sync, satu-satunya jejak = `console.log` yang tidak pernah
ditampilkan ke user dan **tidak** masuk `tiktok_sync_logs.details`.

### 7.5 "Unmapped" — konsep kunci yang harus dipahami

Baris `sales`/`organic_videos` dengan `campaign_id IS NULL` karena `product_id`-nya
belum terdaftar di `skus`. **Datanya lengkap** (product_id, creator, content_uid, gmv,
tanggal) — hanya tidak punya alamat campaign.

**Penyebab:** (1) produk TikTok baru belum didaftarkan sebagai SKU — paling umum;
(2) produk terdaftar di campaign lain; (3) `campaigns.tiktok_campaign_ids` tidak memuat
ID TAP dari Partner Center → fallback ambil `possibleCampaigns[0]` **secara arbitrer**;
(4) time-window sync tidak menjangkau order lama (default 90 hari); (5) produk tidak muncul
di `/campaigns/{id}/products`.

**⚠️ ResikoFinansial:** `syncUnmappedForProduct` (`syncUnmapped.ts:31-45`) UPDATE sales
dengan `WHERE campaign_id IS NULL AND product_id = X` **tanpa filter tanggal**. Satu klik
"Simpan" di halaman SKU Detective bisa **mengubah angka GMV historis campaign secara retroactive
dan signifikan** tanpa review. Dan kalau `product_id` sama terdaftar di 2 campaign, **SKU
pertama yang diproses menang** secara diam-diam.

### 7.6 Fuzzy matching

| Lokasi | Threshold | Dampak |
|---|---|---|
| `stringSimilarity.ts:55` (`findClosestMatch`) | 50% | ⚠️ longgar (`anna`↔`anna1` = 80%), tapi **hanya saran** — user wajib klik. Tidak ada overwrite diam-diam. **Desain yang benar.** |
| `tiktokAutoSync.ts:503-510` (match nama campaign) | `includes()` **dua arah**, tanpa batas panjang | 🔴 **Diterapkan otomatis tanpa review.** Campaign internal bernama `TNT` cocok dengan campaign TAP mana pun yang namanya mengandung "TNT". **GMV masuk campaign yang salah, tidak reversible kecuali sync ulang.** |

---

## 8. Debt Teknis Terukur

| Kategori | Angka | Detail |
|---|---|---|
| Error TypeScript | **89** | `tsc --noEmit`. `next.config.ts` set `ignoreBuildErrors: true` → build tidak gagal atasnya |
| Vulnerability npm | **9** (3 moderate, 5 high, **1 critical**) | `next@16.2.7` kena advisory critical: middleware/proxy bypass, SSRF via Server Actions, unauthenticated disclosure of internal endpoints. Plus `brace-expansion`, `nanoid`, `sharp`/`libvips` |
| Test | **0** | Tidak ada test framework, tidak ada file test |
| CI/CD | **Tidak ada** | Tidak ada `.github/workflows`. Deploy manual via Coolify |
| `.dockerignore` | **Tidak ada** | Build context bisa 743MB+ (node_modules 544MB + .next 199MB) |
| Server action tanpa guard | **~190 dari 239** | Lihat §6.4 |
| Tabel hilang dari schema | **8** | Lihat §4.1 |
| File SQL di luar `migrations/` | **~22** | 12 di root + 10 di `scripts/` — tidak reproducible, kemungkinan tidak pernah ter-deploy |
| File junk ter-track di git | **223 di `web-app/scripts/`**, plus `graphify-out/` (ratusan file cache) | `output.json`, `excel_summary.json`, `curl_output.html`, `tiktok_ids.json`, `indexes.txt` |
| Sekret di source | **6 lokasi** | Lihat §9 |

---

## 9. Sekret yang Ada di Git History

> Semua sudah diverifikasi. **Jangan tulis nilai ini di dokumen lain — sudah cukup di sini,
> dan nilai ini harus dirotasi.**

| Lokasi | Jenis |
|---|---|
| `auth.ts:18` | `AUTH_SECRET` fallback |
| `auth.ts:25,29` | Google OAuth clientId + **clientSecret** |
| `utils/tiktokShopApi.ts:4,5` | `TIKTOK_APP_KEY` + **`TIKTOK_APP_SECRET`** |
| `.agents/AGENTS.md` | **GitHub PAT** |
| git remote `origin` | PAT yang sama ter-embed di URL remote |
| `web-app/scripts/fix_view_vt.js`, `get_view_def.js` | Password Supabase lama |
| `web-app/.env.example` | Berisi credential **nyata** (file-nya sendiri ter-gitignore, tapi isinya nyata) |

**Yang baik:** `.env.local`/`.env.example` **tidak pernah** masuk git history
(verified via `git log --all --diff-filter=A --name-only`). Repo `novacore25/tnt-project-tracking`
**private** (API GitHub return 404 tanpa auth) — jadi kebocoran belum tervalidasi publik.
Tapi nilainya tetap harus dirotasi karena siapa pun yang punya akses repo bisa memakainya.

---

## 10. Ringkasan: Apa yang Harus Diingat

1. **`schema.ts` tidak bisa dipercaya.** Sumber kebenaran DDL = `web-app/supabase/migrations/`. Jangan pernah `drizzle-kit push`.
2. **Otorisasi hanya di client.** Server action = endpoint publik. Menutupi tombol tidak menutupi kemampuan.
3. **`whitelisted_emails` bukan whitelist.** Login = siapa pun dengan akun Google.
4. **Tidak ada transaksi** di jalur import/sync mana pun. Kegagalan tengah = data setengah jadi.
5. **Tidak ada rate limit / retry / timeout** di TikTok API wrapper. `Promise.all` tanpa batas.
6. **GMV bisa masuk campaign yang salah** lewat fuzzy match `includes()` dua arah di `tiktokAutoSync.ts:503`.
7. **Unmapped bisa di-retag retroactive** tanpa filter tanggal dan tanpa review.
8. **Tidak ada auto-refresh setelah mutasi** — itu perilaku yang sudah.users accustomed. Jangan "perbaiki".
9. **`revalidatePath` tidak berguna untuk UI client** — sisa era Supabase Realtime. Jangan ditambah.
10. **Next 16, bukan Next 14/15.** Baca `node_modules/next/dist/docs/` dulu. `middleware` → `proxy`.
