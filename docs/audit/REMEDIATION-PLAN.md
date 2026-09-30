# Rencana Remediasi — TNT Project Tracking System

> Diturunkan dari audit 30 September 2026.
> **Prinsip utama: tidak merusak flow user yang sudah berjalan.**
> Setiap tahap harus bisa di-rollback dan tidak mengubah output yang dilihat user,
> kecuali pada tahap yang memang aimed untuk memperbaiki angka.

---

## Urutan Eksekusi: Kenapa Urutan Ini Penting

```
FASE 1  Kunci pintu          ← tidak mengubah UI sama sekali, hanya menolak yang tidak berhak
FASE 2  Rotasi secret        ← tidak mengubah kode, hanya env
FASE 3  Betulkan data entry  ← idempotent, boleh diulang
FASE 4  Jaga integritas      ← butuh migration, butuh backup
FASE 5  Rapikan arsitektur   ← refactor, tidak mengubah perilaku
FASE 6  Kualitas             ← polish
```

**Jangan mulai dari FASE 5.** Refactor komponen besar sebelum otorisasi dikunci hanya
menghasilkan kode nicer yang tetap bisa dieksploitasi.

> ⚠️ **Sebelum FASE 3/4: backup database penuh.** `pg_dump` dengan timestamp.
>_store di `C:\Users\Banzilla\AppData\Local\Temp\opencode` (di-approve untuk akses eksternal)
> atau langsung ke storage Coolify. Verifikasi file dump bisa di-restore sebelum lanjut.

---

## FASE 1 — Kunci Pintu (2-3 hari kerja)

**Dampak user: NOL.** Tidak ada perubahan tampilan, tidak ada perubahan alur data.
Yang berubah: permintaan yang sebelumnya berhasil diam-diam, sekarang ditolak.

### 1.1 Buat helper guard tunggal

File baru: `web-app/src/lib/guards.ts`

```ts
import { auth } from '@/auth';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error('Unauthorized');
  const [profile] = await db.execute(sql`
    SELECT id, nama, email, role, brand_id, status FROM profiles
    WHERE LOWER(email) = ${session.user.email.toLowerCase()} LIMIT 1
  `) as any[];
  if (!profile) throw new Error('Unauthorized');
  if (profile.status === 'inactive') throw new Error('Access revoked');
  return { session, profile };
}

export async function requireRole(roles: string[]) {
  const ctx = await requireUser();
  if (!roles.includes(ctx.profile.role)) throw new Error('Forbidden');
  return ctx;
}

export async function requireCampaignAccess(campaignId: number) {
  const ctx = await requireUser();
  if (['manager', 'admin', 'executive', 'finance'].includes(ctx.profile.role)) return ctx;

  // staff / anggota: WAJIB baca user_campaigns dari DB
  const [row] = await db.execute(sql`
    SELECT 1 FROM user_campaigns
    WHERE user_id = ${ctx.profile.id}::uuid
      AND (all_campaigns = true OR campaign_id = ${campaignId})
    LIMIT 1
  `) as any[];
  if (!row) throw new Error('Forbidden: no access to this campaign');
  return ctx;
}
```

> Helper ini **generalisasi dari `manajemen-akun/actions.ts:8-21`** (`getAdminUser`) yang
> sudah bekerja benar, plus ditambah pembacaan `user_campaigns` yang saat ini tidak ada di server.

### 1.2 Tutup bypass yang paling kritis (2 jam)

Tambah guard ke 5 fungsi ini **duluan** — ini bypass total yang paling merusak:

| Fungsi | File:line | Guard |
|---|---|---|
| `updateProfileAction` | `databaseActions.ts:1248` | `requireRole(['manager','executive','admin'])` + **hapus `updates.role` dari payload** |
| `updateUserCampaignsAction` | `databaseActions.ts:1272` | `requireRole(['manager','executive','admin'])` |
| `updateCreatorPaymentAction` | `databaseActions.ts:524` | `requireCampaignAccess(cc.campaign_id)` |
| `deleteSkuAction` | `storeActions.ts:304` | `requireCampaignAccess(campaignId)` + masukkan `campaign_id` ke `WHERE` |
| `deleteCampaignAction` | `storeActions.ts:250` | `requireRole(['manager','executive','admin'])` |

`updateProfileAction` adalah yang paling penting: **sekarang user `staff` bisa set role
sendiri jadi `admin`.** Perbaikannya sangat kecil (3 baris) dan menutup seluruh bypass role model.

### 1.3 Rantai approval pembayaran (1 hari)

`paymentActions.ts:808-1420` — 23 fungsi. Semuanya sudah panggil `auth()` tapi tidak cek hasil.

Perubahan minimal (tidak mengubah alur approval yang sudah ada):
1. Ganti `const userId = session?.user?.id` → `const { profile } = await requireUser(); const userId = profile.id`
   (jadi kalau tidak login, fungsi throw, bukan lanjut dengan `userId = undefined`)
2. Tambahkan `requireRole([...])` per tahap:

| Tahap | Fungsi | Role yang boleh |
|---|---|---|
| Manager | `managerApproveItem:808`, `managerRejectItem:818`, `managerFinalizeReview:828`, `bulkApproveManager:1198`, `processBulkManagerItems:1420` | `manager`, `admin`, `executive` |
| Executive 1 | `executiveApproveItem1:850`, `executiveRejectItem1:860`, `executiveFinalizeReview1:870`, `bulkApproveExecutive1:1218` | `executive`, `admin` |
| Finance | `financeToggleItem:892`, `financeSubmitToExecutive:901`, `financeMarkPaid:1009`, `financeBulkMarkPaidItems:1053`, `financeUpdateAmounts:1141`, `bulkProcessFinanceReview:1272`, `bulkMarkPaidFinance:1322` | `finance`, `admin`, `executive` |
| Executive final | `executiveApproveItem:1094`, `executiveRejectItem:1104`, `executiveFinalizeReview:1114`, `bulkApproveExecutiveFinal:1252`, `processBulkExecutive:1358` | `executive`, `admin` |

> ⚠️ **Cek dulu siapa yang boleh approve di produksi** sebelum mengunci. Kalau ada staff yang
> selama ini ikut menyetujui (karena tidak ada gate), mengunci tiba-tiba bisa menghentikan alur.
> **Solusi aman: jalankan guard dalam mode "log-only" 1 minggu** — catat role yang mencoba,
> tidak tolak. Setelah yakin aturan ini benar, aktifkan penolakan.

### 1.4 Guard API route (2 jam)

| Route | Tambahkan |
|---|---|
| `api/sync/tiktok-manual/route.ts` | `await requireRole(['manager','admin','executive'])` di awal handler |
| `api/sync-unmapped/route.ts` | `await requireRole(['manager','admin','executive'])` |
| `api/cron/tiktok-sync/route.ts` | Jadikan `CRON_SECRET` **wajib** (throw kalau unset) — hapus cek opsional `if (cronSecret && ...)` |
| `api/expand-tiktok/route.ts` | Parse URL dengan `new URL()`, validasi `protocol === 'https:'` dan `hostname` berakhiran `.tiktok.com`, set `redirect: 'manual'` |

### 1.5 Perbaiki proxy.ts (30 menit)

`proxy.ts:14-18` — biomekanis-nya tidak bisa validasi JWT (harus pakai `auth()`).
Yang bisa diperbaiki sekarang: **tighter public path**.
- `/portal` → ubah jadi `/portal` hanya GET halaman, bukan POST action.
  Alternatif lebih aman: tambah `proxyClientMaxBodySize` + cek `request.nextUrl` di action.
- Matcher: tambahkan `api` handling eksplisit, dan perbaiki regex yang salah escape.

> **Rekomendasi:** jangan mengandalkan `proxy.ts` untuk otorisasi sama sekali.
> Proxy = lapisan UX (redirect cepat). Otorisasi = guard di dalam setiap action.
> Ini satu-satunya cara yang tahan terhadap miskonfigurasi.

### 1.6 Perbaiki `whitelisted_emails` jadi whitelist sungguhan (1 jam)

`auth.ts:46-53`:
```ts
// SEBELUM: selalu true + heuristik nama
if (!role) {
  if (email.includes('admin') || email.includes('executive')) role = 'executive';
  else role = 'staff';
}
return true;   // baris 80

// SESUDAH:
if (!whitelist && !existingProfile) {
  console.warn(`[auth] rejected unregistered email: ${email}`);
  return false;   // atau arahkan ke /pending
}
```

> **Trade-off:** kalau ada user yang selama ini masuk tanpa daftar whitelist, mereka akan kehilangan
> akses. **Seed `whitelisted_emails` dulu** dengan semua `profiles.email` yang ada + role-nya.
> Query untuk membuat backup daftar ini:
> ```sql
> SELECT email, role FROM profiles ORDER BY email;
> ```

Duplikat yang sama ada di `storeActions.ts:40-47` — perbaiki juga.

### 1.7 Aktifkan `profiles.status` (30 menit)

`requireUser()` di `1.1` sudah menolak `status = 'inactive'`.
Verifikasi: `deactivateUser` (`manajemen-akun/actions.ts:48`) selama ini **tidak** mencabut akses —
sekarang akan.

---

## FASE 2 — Rotasi Secret (1 jam, tidak perlu downtime)

1. **Buat secret baru** di Google Cloud Console → OAuth client.
2. Update `AUTH_SECRET` di Coolify environment dengan `openssl rand -base64 32`.
3. Update `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (client baru).
4. Hapus fallback literal di `auth.ts:18,25,29` → `process.env.X` saja, **fail-fast kalau kosong**:
   ```ts
   if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is required');
   ```
5. Buat app baru di TikTok Shop Partner Center → update `TIKTOK_APP_KEY` / `TIKTOK_APP_SECRET` /
   `TIKTOK_REDIRECT_URI` di Coolify. Hapus fallback di `tiktokShopApi.ts:4-5`.
6. **Rotasi GitHub PAT**: revoke PAT lama di GitHub (Settings → Developer settings →
   Personal access tokens), buat yang baru. **Hapus PAT dari `.agents/AGENTS.md` dan
   `.git/config` remote `origin`**, ganti dengan credential helper:
   ```powershell
   git remote set-url origin https://github.com/novacore25/tnt-project-tracking.git
   git config --global credential.helper manager   # Windows Credential Manager
   ```
7. Rotasi password database + Supabase lama di `scripts/fix_view_vt.js`, `get_view_def.js`.
8. **Bersihkan `web-app/.env.example`** — ganti semua nilai nyata dengan placeholder.
   Dan perbaiki `.gitignore` agar `.env.example` **boleh** ter-track (biasanya `.env*` memblokirnya):
   ```gitignore
   .env*
   !.env.example
   ```

> **Catatan rotasi:** mengubah `AUTH_SECRET` **MENGLOGOUT semua user**.
> Lakukan di jam malam / acknowledge ke tim. Mengubah `TIKTOK_APP_SECRET` butuh
> re-approve di Partner Center —jwtcoordinate dengan whoever yang memegang akun agency.

> **Riwayat git tidak bisa dihapus tanpa rewrite.** Kalau reponame diubah ke
> `tnt-project-tracking-v2` (fresh repo tanpa history), semua secret lama hilang permanen.
> Ini opsi paling bersih kalau rewrite `git filter-repo` terasa berisiko.

---

## FASE 3 — Betulkan Data Entry (1-2 minggu, idempotent)

### 3.1 Perbaiki dedup yang sudah_running

Tiga masalah ditemukan. Semua perlu data check dulu sebelum написа SQL.

**a) `organic_videos` duplikat karena `product_id` NULL**
```sql
-- Lihat dulu
SELECT content_uid, COUNT(*) FROM organic_videos
WHERE campaign_id IS NOT NULL
GROUP BY content_uid HAVING COUNT(*) > 1 ORDER BY 2 DESC LIMIT 20;
```
```sql
-- Bersihkan: pertahankan yang punya product_id, atau yang paling lengkap
DELETE FROM organic_videos a USING organic_videos b
WHERE a.content_uid = b.content_uid
  AND a.product_id IS NULL AND b.product_id IS NOT NULL
  AND a.id < b.id;
```
Lalu migration untuk mencegah ini:
```sql
-- supabase/migrations/<timestamp>_fix_organic_videos_unique.sql
CREATE UNIQUE INDEX CONCURRENTLY idx_organic_videos_uid_product
  ON organic_videos (content_uid, COALESCE(product_id, ''));
-- ATAU (PostgreSQL 15+):
-- ALTER TABLE organic_videos ADD CONSTRAINT uq_organic_videos
--   UNIQUE NULLS NOT DISTINCT (content_uid, product_id);
```
Lalu update `importActions.ts:183` — `ON CONFLICT (content_uid, product_id)` tetap bekerja
karena index ekspresi dianggap cocok selama ekspresi sama.

**b) `order_id` tidak kompatibel antara Excel import dan auto-sync**

Excel: `${orderIdRaw}_${skuIdStr}_${rawProductId}_${tiktokCampaignId}` (`OrganicImport.tsx:425`)
Auto-sync: ID TikTok mentah (`tiktokAutoSync.ts:348`)

→ **Dampaknya sudah terlanjur ada di DB.** Cek:
```sql
SELECT COUNT(*) FROM sales WHERE order_id LIKE '%\_%';
-- vs
SELECT COUNT(*) FROM sales WHERE order_id !~ '^[0-9]+$';
```
Putuskan: apakah Excel import akan dipakai lagi? Kalau ya, samakan formatnya di kedua sisi
(simpan `raw_order_id` sebagai kolom terpisah, generate `order_id` dengan aturan sama persis).
Kalau tidak, hentikan jalur Excel untuk order dan beri tahu operator.

**c) `videos` & `campaign_creators` race → unique constraint**
```sql
-- Dedupe dulu
DELETE FROM videos a USING videos b
WHERE a.content_uid = b.content_uid AND a.content_uid IS NOT NULL
  AND a.id > b.id;

CREATE UNIQUE INDEX CONCURRENTLY idx_videos_content_uid
  ON videos (content_uid) WHERE content_uid IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY idx_cc_campaign_creator
  ON campaign_creators (campaign_id, creator_id);
```
Lalu ganti check-then-insert di `importActions.ts:289`, `syncUnmapped.ts:83,143` dengan `ON CONFLICT`.

### 3.2 Perbaiki index yang hilang

Semua `CONCURRENTLY` (tidak lock tabel, aman untuk produksi):
```sql
CREATE INDEX CONCURRENTLY idx_sales_cc        ON sales (campaign_creator_id);
CREATE INDEX CONCURRENTLY idx_sales_status    ON sales (order_status);
CREATE INDEX CONCURRENTLY idx_organic_uv_key  ON organic_videos (campaign_id, content_uid);
CREATE INDEX CONCURRENTLY idx_organic_uv_user ON organic_videos (lower(creator_username));
CREATE INDEX CONCURRENTLY idx_videos_cc_urut  ON videos (campaign_creator_id, urutan);
CREATE INDEX CONCURRENTLY idx_pi_cc          ON payment_items (campaign_creator_id);
CREATE INDEX CONCURRENTLY idx_cc_composite   ON campaign_creators (campaign_id, creator_id);
```
`idx_organic_uv_user` pakai ekspresi `lower(...)` supaya cocok dengan query
`LOWER(creator_username) = LOWER(?)` di `creatorActions.ts:174` dan `syncUnmapped.ts:137`.

### 3.3 Samakan sumber kebenaran

Pilih satu sumber untuk status bayar. Rekomendasi: **`payment_items.final_status`** (sudah jadi
jalur utama di `paymentActions.ts`). Lalu:
- `campaign_creators.status_bayar` jadi **derived**, di-update hanya oleh
  `syncPaidItemsToCampaignCreators` (`paymentActions.ts:912`) — hapus penulisan dari
  `databaseActions.ts:545,565`.
- `creator_payments` (tabel legacy) → arsipkan, berhenti tulis.

Untuk role: `whitelisted_emails` jadi **authoritative** (sudah jadi begitu setelah 1.6).
`profiles.role` = cache, di-refresh saat signIn. `users.role` → hapus.

Untuk GMV: **tulis definisi resmi di `docs/DOMAIN-CHEATSHEET.md`** danVjerntukan
`vw_campaign_summary` mana yang benar sebelum menentukan view mana yang dipakai.

---

## FASE 4 — Jaga Integritas (2-3 minggu)

### 4.1 Bungkus operasi multi-tabel dalam transaksi

Prioritas (semua pakai `db.transaction`, contoh sudah ada di `listingActions.ts:127`):

| Fungsi | Alasan |
|---|---|
| `executeSalesImportChunkAction` (`importActions.ts:33-352`) | 5 tahap, saat ini 0 transaksi. Tahap 1-3 commit, tahap 4 gagal → user lihat "gagal" padahal data masuk |
| `importLiveOrganicAction` (`importActions.ts:509-580`) | DELETE-then-INSERT. Crash di tengah = data produk hilang permanen |
| `executeAdsImportAction` (`importActions.ts:415-473`) | DELETE range + INSERT. Crash = `ads_performance` kehilangan histori |
| `syncUnmappedForProduct` (`syncUnmapped.ts:12-190`) | UPDATE sales + UPDATE videos + loop creator + loop video |
| `assignCampaignsToUser` (`manajemen-akun/actions.ts:70-91`) | DELETE + loop INSERT |
| `financeUpdateAmounts` / `syncPaidItemsToCampaignCreators` | Update nominal + propagate ke `campaign_creators` harus atomik |

> Untuk yang involves `executeSalesImportChunkAction`, hati-hati: `Promise.all` di dalam
> transaksi pada `postgres-js` **tidak boleh** dipakai (transaksi di-pin ke satu koneksi).
> Ubah jadi sequential.

### 4.2 Hapus silent drop

`tiktokAutoSync.ts:717-722` — video unmapped harus **dicatat**, bukan di-`console.log`:
```ts
if (videoRowsUnmapped.length > 0) {
  diagnosticData.unmappedVideoCount = videoRowsUnmapped.length;
  diagnosticData.unmappedVideoSample = videoRowsUnmapped.slice(0, 20);
  // dan TAMPILKAN di accordion diagnostik TikTokSyncControlCard
}
```
User harus bisa lihat "2.847 video tidak terpetakan" — sekarang tidak ada jejak sama sekali.

### 4.3 Perbaiki match campaign yang otomatis (PENTING untuk akurasi GMV)

`tiktokAutoSync.ts:503-510` — `includes()` dua arah tanpa batas panjang.
Contoh breakage: campaign internal `TNT` cocok dengan semua campaign TAP yang namanya
mengandung "TNT". GMV masuk campaign yang salah, tidak reversible.

```ts
// SEBELUM — match otomatis
return cleanCampName === cleanTapName
    || cleanTapName.includes(cleanCampName)
    || cleanCampName.includes(cleanTapName);

// SESUDAH — exact dulu, substring HANYA kalau panjang signifikan + unik
if (cleanCampName === cleanTapName) return true;
const lenRatio = cleanCampName.length / cleanTapName.length;
if (lenRatio > 0.6 && lenRatio < 1.6 && cleanTapName.includes(cleanCampName)) {
  // hanya kalau unik
  return matches.length === 1;
}
return false;
```
Tambahkan `console.warn` + entry di `diagnosticData` setiap kali match berbasis substring dipakai,
supaya bisa diaudit setelahnya.

### 4.4 Lindungi retag GMV historis

`syncUnmapped.ts:31-45` — UPDATE tanpa filter tanggal + tanpa konfirmasi.
- Tambahkan konfirmasi di UI: "Perintah ini akan men-tag ulang **N order** (total GMV Rp X)
  dari campaign Y ke campaign Z. Lanjutkan?"
- Backfill threshold: kalau `order_id` sebelum 90 hari, tetap proses tapi **tampilkan
  ringkasan** di response supaya user bisa reviewing sebelum save.

### 4.5 Tambah halaman "Unmapped Report"

Baru: `web-app/src/app/unmapped/page.tsx` + `app/actions/unmappedActions.ts`
(server action dengan `requireRole(['manager','executive','admin'])`).

Isi:
- Tabel `product_id` yang masih orphan, jumlah order, total GMV, rentang tanggal
- Dropdown pilih campaign + tombol "Tag" (pakai `syncUnmappedForProduct` yang sudah ada)
- Filter: "ambiguous" (product_id ada di >1 SKU) — tandai merah, jangan auto-tag
- Link ke `/input-penjualan` untuk daftarkan SKU baru

Ini menghapus kebutuhan user untuk scroll `console.log` dan memberi kontrol atas
bagian data yang paling sensitif secara finansial.

---

## FASE 5 — Rapikan Arsitektur (1-2 bulan)

> **Hanya setelah FASE 1-4 selesai.** Refactor sekarang =-"
> kode nicer yang tetap bisa dieksploitasi.

### 5.1 `schema.ts` — selaraskan atau delete

Dua opsi, pilih satu:

**Opsi A (disarankan):** generate ulang `schema.ts` dari database nyata
```bash
npx drizzle-kit pull     # baca DB, tulis schema.ts yang akurat
```
Lalu commit hasilnya dan **maintain** sebagai sumber typing. Tambahin `index()` dan `.unique()`
sesuai §3.2/§3.3 supaya reflect reality. Tandai clearly di header file:
> "Generated from production DB on <tanggal>. Regenerate dengan `drizzle-kit pull`.
> Untuk perubahan, buat migration SQL di `supabase/migrations/`, lalu pull ulang."

**Opsi B:** hapus `schema.ts` sepenuhnya, ganti dengan `types/database.ts` yang diperbaiki
dan selalu baca dari `pg_catalog` saat runtime (tidak ada ORM typing).

Jangan biarkan pilihan tidak diambil — sekarang `schema.ts` **aktif menyesatkan**.

### 5.2 Pindahkan DDL runtime ke migration

`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` yang dieksekusi
per-request akan mengambil lock `ACCESS EXCLUSIVE` dan renovate di tengah sync:

| Lokasi | DDL | Frekuensi |
|---|---|---|
| `tiktokShopApi.ts:104-133` | 2× `CREATE TABLE` | tiap OAuth |
| `tiktokShopApi.ts:187-203` | `CREATE TABLE` | tiap sync |
| `tiktokShopApi.ts:254-278` | `CREATE TABLE` + 4× `ALTER TABLE` | **tiap polling UI (3-15 detik × user)** |
| `tiktokShopApi.ts:366-379` | `CREATE TABLE` | tiap polling |
| `tiktokAutoSync.ts:688-739` `ensureVideoColumns()` | `DO $$ ALTER TABLE × 20 $$` | **tiap render halaman `/campaigns/[id]/video`** |

Pindahkan semua ke `supabase/migrations/`. Hapus pemanggilan runtime.
`campaignPageActions.ts:720-722` yang memakai `EXCEPTION WHEN OTHERS THEN NULL`
**menyembunyikan kegagalan upgrade schema** — hapus setelah dipindah.

### 5.3 Ubah sync jadi background job

Masalah sekarang: sync berjalan **di dalam HTTP request/stream** dengan `maxDuration = 60`
(tidak realistis — sync penuh butuh puluhan menit).

Pola yang sudah ada (`sync_progress_*` + `tiktok_sync_logs` + polling) **sudah halfway ke arah
yang benar**. Tinggal:
1. Tambah tabel `sync_jobs (id, trigger, campaign_id, status, progress, started_at, finished_at, error)`
2. `instrumentation.ts` jadi worker: `setInterval` cek `sync_jobs` berstatus `pending` → jalankan
3. Route `/api/sync/tiktok-manual` hanya INSERT job + return `job_id`
4. `TikTokSyncControlCard` polling `/api/sync/status?job_id=X` (SSE jadi bonus, bukan syarat)
5. `pg_try_advisory_lock()` di awal worker supaya cron + manual + multi-instance tidak tumpang tindih
6. Hapus `maxDuration = 60` dari route cron

### 5.4 Rate limit + retry + timeout di TikTok API wrapper

`tiktokShopApi.ts:268-321` tidak punya satu pun:
```ts
// Tambahkan timeout
const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15_000) });

// Tambahkan retry + backoff + 429 handling
for (let attempt = 0; attempt < 3; attempt++) {
  const res = await fetchWithTimeout(url, opts);
  if (res.status === 429) {
    await sleep(Number(res.headers.get('Retry-After') ?? 2 ** attempt * 1000));
    continue;
  }
  if (res.ok) return res.json();
  if (res.status < 500) break;  // 4xx tidak akan berubah dengan retry
}
```
Tambahkan concurrency limiter sederhana (tanpa dependency baru, sesuai skill `ponytail`):
```ts
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) results.push(await fn(items[i++]));
  }));
  return results;
}
```
Gunakan untuk `tiktokAutoSync.ts:612` (`Promise.all` tanpa batas) dan `:450` (loop campaign).

### 5.5 Hapus O(n²)

`tiktokAutoSync.ts:185, 393, 423, 656` — ganti `.some()`/`.findIndex()` dengan `Set`/`Map`.
`:393` adalah **bottleneck utama**: dengan 10.000 order × 1,5 SKU = **150 juta iterasi**.

```ts
// SEBELUM
if (salesRowsToInsert.some(s => s.order_id === orderId && s.sku_id === skuId)) continue;
// SESUDAH
const key = `${orderId}::${skuId}`;
if (salesKeySet.has(key)) continue;
salesKeySet.add(key);
```

### 5.6 Chunk + checkpoint sync

`importActions.ts:363` sudah punya pola chunk 250. `tiktokAutoSync.ts:726` **tidak** —
ia mengirim seluruh array (20-40MB untuk 10.000 order, karena `raw_data` menyimpan
objek order TikTok lengkap di `tiktokAutoSync.ts:419`).
```ts
for (const chunk of chunkArray(salesRowsToInsert, 250)) {
  await executeSalesImportChunkAction(chunk, [], true);
}
```
Sekalian: jangan simpan `raw_data` penuh. Simpan hanya field yang dibutuhkan debugging.

### 5.7 Batch `syncAllUnmappedGlobal`

Sekarang ~6.100 query fully sequential untuk 300 SKU. Target: 3-5 query dengan
`INSERT ... SELECT ... FROM unnest($1::text[])` + `ON CONFLICT DO UPDATE` + `array_agg`
untuk `assigned_sku_ids`. Hapus juga `revalidatePath` × 8 per SKU (jadi 1 kali di akhir).

### 5.8 Pisahkan file besar

5 file > 50KB. Angka aktual:

| File | Baris | Trigger refactor |
|---|---|---|
| `app/campaigns/[id]/video/VideoClient.tsx` | 200KB | Pisahkan: `VideoTable`, `VideoApprovalModal`, `VideoSyncPanel`, `VideoDiagnostics` |
| `app/campaigns/[id]/listing/page.tsx` | 142KB | Pisahkan: `CreatorTable`, `CreatorDetailDrawer`, `ListingFilters` |
| `app/portal/[id]/PortalDashboardClient.tsx` | 124KB | Pisahkan per tab |
| `app/creator-pool/[id]/page.tsx` | 92KB | Pisahkan: `CreatorProfile`, `CreatorSnapshots`, `CreatorHistory` |
| `app/campaigns/actions/campaignPageActions.ts` | 2028 baris | Pisahkan per domain: concepts, listing, daily, video, addresses |
| `app/campaigns/actions/paymentActions.ts` | 1281 baris | Pisahkan: reads, approval chain, finance, bulk ops |

**Aturan:** extract, parsing, markup atau state ownership — pindahkan kode apa adanya
ke file baru, lalu verify tampilan identik. Refactor behaviour (misal ubah fetch jadi
server component) = proyek terpisah.

### 5.9 Hapus kode mati & file junk

- Hapus `web-app/chrome-extension/` (salinan mati — root version yang benar)
- Hapus `web-app/scripts/` dari git (223 file), pindahkan ke luar repo atau `.gitignore`.
  **Tapi**: sebelum dihapus, grep semua file itu untuk credential dan rotasi (§FASE 2.7)
- Hapus `graphify-out/` dari git (ratusan file cache), gitignore
- Hapus `output.json`, `excel_summary.json`, `curl_output.html`, `sku_analysis.json`,
  `tiktok_ids.json`, `indexes.txt`, `temp_original.tsx`, `old_creator_row*.txt`
- Hapus `app/pending/page.tsx` — `signIn` selalu set `status='approved'`, tidak pernah
  diarahkan ke sini. **Atau** perbaiki alur approval supaya benar-benar dipakai (§5.10)
- Pindahkan 22 file SQL di root + `scripts/*.sql` ke `web-app/supabase/migrations/`
  supaya jadi bagian dari versioning

### 5.10 Perbaiki status approval user

sekarang: profil baru langsung `approved`, whitelist diabaikan, `profiles.status` tidak pernah dibaca.
Target:
- `auth.ts` menolak email tidak terdaftar → arahkan ke `/pending`
- `profiles.status = 'pending'` benar-benar memblokir akses (sudah ada di `requireUser()`)
- `manajemen-akun` jadi tempat persetujuan nyata (sudah ada UI-nya, tinggal sambungkan)
- Kalau tidak ada resource untuk approval manual, **hapus saja `/pending` dan whitelist-nya**
  dan andalkan `whitelisted_emails` + Google Workspace domain restriction

---

## FASE 6 — Kualitas & Keandover (berkala)

### 6.1 Matikan `ignoreBuildErrors`, incrementally

89 error TS sekarang. Jangan perbaiki semua sekaligus. Urutan:
1. `next.config.ts`: **biarkan** `ignoreBuildErrors: true` dulu
2. Perbaiki file yang sedang kamu sentuh di FASE 1-5
3. Kalau error < 20: ubah ke `false`, `npm run build`, perbaiki sisanya
4. Tambah script ke `package.json`:
   ```json
   { "scripts": { "typecheck": "tsc --noEmit", "check": "npm run typecheck && npm run lint" } }
   ```

### 6.2 Tambahkan test — mulai dari yang paling berisiko

Tidak ada test framework. Rekomendasi **minimal, tanpa dependency baru** kalau bisa:
`node --test` (built-in Node 20).

Prioritas test (semua pure function, tidak perlu DB):
| Target | File | Alasan |
|---|---|---|
| `sqlInList` | `db/index.ts:28` | Params binding, fail-closed pada array kosong |
| `findClosestMatch` | `stringSimilarity.ts:29` | Threshold & edge case username pendek |
| `generateTtsSignature` | `tiktokShopApi.ts:20-25` | Sortir key + HMAC — kalau salah, semua API call TikTok gagal |
| `formatters` | `utils/formatters.ts` | Format rupiah/tanggal, regresi Format tanggal sering |
| Chunk mapper | `executeSalesImportChunkAction` Tahap 1 | Dedupe order_id + Σ gmv multi-SKU |

Integration test butuh DB test — skip dulu, tambahkan kalau sudah ada CI.

### 6.3 Tambah CI minimal

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: web-app/package-lock.json }
      - run: npm ci
        working-directory: web-app
      - run: npm run check
        working-directory: web-app
      - run: npm audit --omit=dev --audit-level=high
        working-directory: web-app
```
`npm audit --audit-level=high` akan gagal selama Next 16.2.7 kena advisory critical —
**itu memang tujuannya**: CI yang terlihat. Update Next lebih dulu (§6.4), atau
tambahkan `# audit-ignore` sementara dengan komentar + link advisory + tanggal review.

### 6.4 Update Next.js

`next@16.2.7` kena 9 advisory (1 critical). **Baca `node_modules/next/dist/docs/` setelah update** —
seperti yang tertulis di `web-app/AGENTS.md`, "This is NOT the Next.js you know".

Yang perlu dicek setelah update:
- `proxy.ts` — apakah matcher API berubah
- `experimental.staleTimes` — masih experimental?
- `experimental.serverActions.bodySizeLimit: '10mb'` — masih valid?
- Standalone output trace — pastikan `.next/standalone` masih berisi `node_modules/postgres`

### 6.5 Perbarui `next.config.ts`

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: { dynamic: 300, static: 1800 },
    serverActions: { bodySizeLimit: '10mb' },
  },
  // Aktifkan setelah 6.1 selesai
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,        // jangan bocorkan versi Next
  // images: { remotePatterns: [...] }  // kalau ada next/image dari domain luar
};
```

### 6.6 Tambah `.dockerignore`

Tidak ada sekarang → build context 743MB+ (node_modules 544MB + .next 199MB).
`web-app/.dockerignore`:
```
node_modules
.next
.git
.env*
scripts
scratch
*.json
*.txt
*.xlsx
supabase/.temp
```
Yang **tidak** boleh di-ignore: `public/`, `package.json`, `package-lock.json`, `src/`.

### 6.7 Update dependency & hapus yang tidak dipakai

- **Hapus `swr`** — sudah terpasang, **tidak dipakai di satu pun file**. Hanya `zustand`.
- **Hapus `@types/papaparse`** — `papaparse` sudah membawa type-nya sendiri.
- Cek `xlsx` — versi 0.18.5 dari npm registry lama, punya advisory known.
  Pertimbangkan `exceljs` (sudah dipakai) atau `xlsx` dari `cdn.sheetjs.com`.
- `npm audit fix` untuk `brace-expansion` + `nanoid` (aman, minor).

### 6.8 Perbarui dokumentasi

Setelah semua fase selesai:
- Ganti isi root `ARCHITECTURE.md` dengan link ke `docs/ARCHITECTURE-CURRENT.md` (atau hapus)
- Update `.agents/AGENTS.md`: **hapus GitHub PAT**, sisakan instruksi push pakai credential helper
- Update `.opencode/skill/tnt-project/SKILL.md` dengan jebakan baru yang ditemukan
- Tulis `docs/RUNBOOK.md`: cara restore backup, cara rotasi secret, cara disable cron sync

---

## Checklist Pelaksanaan

### Sebelum mulai
- [ ] `pg_dump` penuh + verifikasi bisa restore
- [ ] Catat daftar user yang benar-benar punya akses (untuk seed whitelist & validasi role approval)
- [ ] Cek `SELECT email, role FROM profiles ORDER BY email;` — ini daftar user yang sudah Anda
- [ ] Jadwalkan window untuk rotasi `AUTH_SECRET` (logout semua user)
- [ ] Koordinasi dengan pemilik akun TikTok Partner Center untuk rotasi app

### FASE 1
- [ ] `lib/guards.ts` dibuat
- [ ] 5 bypass kritis ditutup (1.2)
- [ ] 23 fungsi approval payment diguard (**mode log-only dulu 1 minggu**)
- [ ] 4 API route diguard, `CRON_SECRET` jadi wajib
- [ ] SSRF `/api/expand-tiktok` diperbaiki
- [ ] Whitelist jadi sungguhan (seed dulu)
- [ ] `profiles.status` dihormati

### FASE 2
- [ ] Semua secret dirotasi & fallback literal dihapus
- [ ] `.env.example` dibersihkan +/gitignore diperbaiki
- [ ] GitHub PAT lama di-revoke

### FASE 3
- [ ] Audit duplikat di `organic_videos`, `videos`, `campaign_creators`
- [ ] Migration unique constraint
- [ ] Migration index (`CONCURRENTLY`)
- [ ] Sumber kebenaran status_bayar & role diseragamkan

### FASE 4
- [ ] `executeSalesImportChunkAction` dalam transaksi
- [ ] `importLiveOrganicAction` & `executeAdsImportAction` dalam transaksi
- [ ] Silent drop video visible ke user
- [ ] Fuzzy match campaign diperketat
- [ ] Konfirmasi retag GMV historis
- [ ] Halaman Unmapped Report live

### FASE 5
- [ ] `schema.ts` di-pull dari DB nyata (atau dihapus)
- [ ] Semua runtime DDL dipindah ke migration
- [ ] Sync jadi background job + advisory lock
- [ ] Rate limit/retry/timeout di TikTok wrapper
- [ ] O(n²) diganti Set/Map
- [ ] 6 file besar dipecah
- [ ] File junk & script mati dihapus dari git

### FASE 6
- [ ] `ignoreBuildErrors: false` + `npm run typecheck` bersih
- [ ] Test untuk 5 fungsi kritis
- [ ] CI workflow
- [ ] Next.js di-update
- [ ] `swr` & dependency mati dihapus
- [ ] `.dockerignore` ditambahkan
- [ ] Dokumentasi & skill diperbarui
