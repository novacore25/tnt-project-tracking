# Alur Video Import Manual (`/campaigns/[id]/video/import`)

Dokumen ini menjelaskan **kenapa** menu ini ada, bagaimana cara kerjanya, dan di mana
titik sinkronisasinya dengan data TikTok yang datang 2 hari kemudian.

> Status: **dipahami & terverifikasi ke kode + definisi RPC produksi** (30 Sep 2026).
> Tidak ada perubahan kode untuk fitur ini.

---

## 1. Masalah yang diselesaikan fitur ini

PIC punya 3 situation di mana video **tidak bisa_gt muncul dari impor otomatis:

| Situasi | Kenapa gagal terdeteksi otomatis |
|---|---|
| Video kreator **tidak pakai product ID** milik kita | Auto-sync & Excel cari lewat `product_id`, jadi video-nya tidak pernah masuk `organic_videos` |
| **Report TikTok delay 2 hari** | Sales & awareness belum ada, tapi video sudah tayang. Campaign perluqty video terisi sekarang |
| Link creator **di luar daftar resmi** | Tidak ada `campaign_creators`-nya |

Solusinya: PIC input manual → sistem tetap bisa menghitung performa.

---

## 2. Alur 6 langkah

```
[1] PIC paste link (singkat ATAU panjang)        ImportVideoClient.tsx:162
      │  filter: startsWith("http")
      ▼
[2] Scrape / expand link                          /api/expand-tiktok
      │  short link vt.tiktok.com → HEAD follow redirect
      │  kalau hasilnya "/@/video/ID" (username hilang)
      │     → oEmbed API TikTok ambil author_unique_id
      │  hasil: https://www.tiktok.com/@username/video/ID
      ▼
[3] Parse manual di browser                      ImportVideoClient.tsx:227
      username = match(/@([a-zA-Z0-9_.-]+)/)
      videoId  = match(/video\/(\d+)/)
      │  batch 3 link/request + jeda 1 detik (rate limit TikTok)
      ▼
[4] Validasi ke DB (server)                      campaignPageActions.ts:971
      bulkVerifyVideoLinksAction
      ├─ (!videoId || !username) → status 'error', canImport FALSE   ← L1052
      ├─ videoId sudah di DB campaign ini   → 'duplicate_db'
      ├─ videoId sudah di DB campaign lain  → 'duplicate_db'
      ├─ videoId kembar di batch yang sama  → 'duplicate_batch'
      ├─ ada di campaign_creators          → 'ready_existing'  (bisa import)
      ├─ ada di tabel creators (global)     → 'ready_global'    (bisa import)
      └─ belum ada sama sekali              → 'ready_new'       (bisa import)
      ▼
[5] PIC konfirmasi → commit                      campaignPageActions.ts:1161
      commitBulkImportVideosAction
      ├─ dedup ulang by videoId di memory
      ├─ cek ulang ke DB (s paranoia terakhir)
      ├─ INSERT creators (kalau belum ada)      ← auto-deteksi kreator baru
      ├─ INSERT campaign_creators (kalau belum) ← tier 'Nano', price 0, approval 'approved'
      ├─ INSERT creator_snapshots (0,0,0,0)
      └─ INSERT videos (urutan = MAX(urutan)+1, vt_approval='pending')
      ▼
[6] Auto-remap & revalidate
      revalidatePath /video dan /listing
```

### Yang ditulis ke database

```sql
INSERT INTO videos (
  campaign_creator_id, urutan, concept, link_video,
  content_uid, sku_id, vt_approval, added_by
) VALUES (
  ccId, <max+1>, '', 'https://www.tiktok.com/@user/video/ID',
  'ID', <sku_id nullable>, 'pending', <nama PIC>
)
```

**`content_uid` = kunci penyambung ke semua data lain.** Ini kolom terpenting.

---

## 3. Kenapa videonya langsung "tetep kehitung"

RPC `get_campaign_video_counts_fast(campaign_id)` mengambil video dari **3 sumber**,
gabung dengan `UNION`, lalu `DISTINCT ON (content_uid)`:

```sql
1. videos         → input manual PIC
2. sales          → hasil impor penjualan   (content_uid, ada 'video_%' prefix → di-strip)
3. organic_videos → awareness live & video
```

`DISTINCT ON` = **satu video dihitung satu kali**, walau muncul di 2–3 sumber sekaligus.
Jadi tidak ada double count.

> ### ⚠️ Detail penting: `videos.vt_approval` DIABAIKAN RPC
>
> Di sumber #1, RPC mengambil `cc.approval` (**approval level kreator**),
> bukan `v.vt_approval` (**approval level video**):
>
> ```sql
> SELECT v.content_uid, cc.approval as vt_approval, 'video' as content_type
> FROM videos v JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
> ```
>
> Efeknya: video hasil import manual yang ditulis `vt_approval='pending'`
> **tetap dihitung sebagai `total_approved`**, karena `commitBulkImportVideosAction:1314`
> sekaligus set `campaign_creators.approval = 'approved'`.
>
> **Ini yang membuat fitur ini bekerja.** Kalau suatu saat diubah jadi memakai
> `v.vt_approval`, semua video import manual langsung jatuh ke `total_pending`
> dan angka performa campaign turun. Jangan diubah tanpa sengaja.

---

## 4. Bagaimana nyambung ke Sales & Awareness (sinkronisasi tertunda)

Video manual ditulis **hanya** ke tabel `videos`./views, likes, dan GMV **tidak**
ikut — karena data itu memang belum ada di TikTok.

Begitu data TikTok tiba (±2 hari), auto-sync (`tiktokAutoSync.ts`) menulis:

| Data | Ke tabel | Kunci |
|---|---|---|
| Order | `sales` | `content_uid` |
| Views / likes | `organic_videos` | `content_uid` |

### Jembatan 1 — GMV muncul di video manual

`fetchSalesByCreatorUsernamesAction` (`campaignPageActions.ts:1491`) +
RPC join `videos ⋈ sales` **by `content_uid`**. Jadi begitu order masuk,
GMV video itu langsung menempel ke baris `videos` yang sudah dibuat PIC.

Tidak ada proses "sinkronisasi" terpisah. **Cukup keduanya punya `content_uid` sama.**

### Jembatan 2 — Views/likes muncul

`organic_videos` arriving dengan `content_uid` sama → baris di RPC sumber #3.
`DISTINCT ON` menyatukan dengan baris manual, dan angka views/likes ikut terbaca.
`auto-populate videos` (`importActions.ts:285-331`) juga bekerja **sebalik**:
data TikTok yang arrive duluan untuk konten yang belum ada di `videos`
→ otomatis INSERT ke `videos` dengan urutan berikutnya.

> Jadi urutan bebas: manual dulu atau TikTok dulu, hasilnya converges.
> Yang penting `content_uid` sama persis.

### Normalisasi `content_uid` (penting)

Beberapa sumber data awali dengan prefix `video_` (contoh `video_7382910...`).
Tiga bentuk normalisasi dipakai di migration berbeda:

```sql
SUBSTRING(content_uid FROM 7)      -- 20260918110000, 20260728130000, 20260716000000
split_part(content_uid,'_',2)      -- 20260909_optimize_livestream_rpc.sql
content_uid langsung                -- tiktokAutoSync.ts
```

Ketiganya **ekuivalen secara fungsional**: `split_part('12345','_',2)` di PostgreSQL
mengembalikan string utuh (tidak ada delimiter), dan `split_part('video_12345','_',2)`
menghasilkan `12345`. Sama seperti `SUBSTRING(... FROM 7)`.

> Yang **tidak** aman: `content_uid` yang mengandung `_` lebih dari sekali
> (contoh `video_123_456`) akan terpotong salah. Format TikTok asli tidak pernah
> seperti itu, tapi jangan pernah membangkitkan format manual seperti itu.

---

## 5. Catatan & temuan (tidak ada yang diubah)

### 5a. 🔴 Tidak ada auth guard (menegiati AGENTS.md aturan #2)

Kedua aksi ini **tidak punya** `requireUser()` / `requireCampaignAccess()`:

- `bulkVerifyVideoLinksAction` — `campaignPageActions.ts:971`
- `commitBulkImportVideosAction` — `campaignPageActions.ts:1161`

`commitBulkImportVideosAction` menulis ke `creators`, `campaign_creators`,
`creator_snapshots`, dan `videos` — hanya berdasarkan `campaignId` dari argumen.
Mekanisme Next.js server action **tidak** otomatis membatasi caller.

Dampak: user login level apa pun bisa membuat campaign_creators di campaign mana pun.
Tidak ada tombol UI untuk ini, tapi tidak butuh tombol — cukup panggil aksinya langsung.

> Masukkan ke `docs/audit/REMEDIATION-PLAN.md` sebagai temuan baru.

### 5b. 🟡 `ensureVideoColumns()` jalan di setiap request

`campaignPageActions.ts:686-740` menjalankan **~30 `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` + loop drop constraint** setiap kali dipanggil. Dipanggil oleh
`bulkVerifyVideoLinksAction`, `commitBulkImportVideosAction`, dan banyak halaman lain.

`ADD COLUMN IF NOT EXISTS` yang tidak berubah tetap mengambil lock
`ACCESS EXCLUSIVE` sebentar. Secara kebenaran data aman, secara performa ini
menarik lock di tabel besar pada setiap request.

Bisa dipindah ke migration, tapi **jangan sekarang** — tidak ada urgency dan risikonya
tidak sepadan dengan pekerjaan lain yang sekarang sudah jalan normal.

### 5c. 🟡 `manual_video_imports` = fitur lama, masih ada di DB

`20260730185000_add_manual_video_imports.sql` membuat tabel terpisah
`manual_video_imports` dan RPC `get_campaign_creator_performance` yang meng-`UNION`
dengan `organic_videos`.

**UI `/video/import` sekarang tidak memakai tabel ini sama sekali** — dia langsung
tulis ke `videos`. Tabel itu sisa implementasi lama. Perlu dipastikan RPC-nya masih
dipakai halaman mana; kalau tidak, bisa di-drop di audit berikutnya.

### 5d. 🟡 Link foto / live tidak bisa di-import (memang sesuai desain)

Guard di `campaignPageActions.ts:1052` menolak item tanpa `videoId`:
`/photo/ID` dan `/live/` tidak punya pola `video/(\d+)` → status `'error'`,
pesan "Format URL TikTok tidak valid (username / Video ID tidak ditemukan)".

Sesuai permintaan PIC: konten yang di-import harus video. Live punya jalurnya sendiri
lewat tab Livestream / `organic_videos` dari awareness sync.

### 5e. 🔴 `/api/expand-tiktok` tanpa auth & tanpa rate limit

Route ini **publik** — tidak ada `requireUser()`, tidak ada pembatasan jumlah request.
Artinya siapa pun (termasuk bot) bisa memakainya sebagai proxy untuk menembak
TikTok dari IP server kita berulang kali.

Ini **langsung menambah risiko ban** yang sedang dikhawatirkan, bukan fokus
hanya pada bug correctness. Prioritasnya setara dengan nomor 4–6 di bagian 7.

Yang paling murah: batasi jumlah link per request (misal 25) + `auth()` dari
`@/auth`. Cookie sudah terkirim otomatis karena fetch-nya same-origin.

### 5f. 🟡 Batas harian tidak ada sama sekali

Tidak ada hitungan berapa request ke TikTok per hari. Kalau ada batch 50 link
dijalankan 10 kali, totalnya 500–1000 outbound request tanpa jejak.


---

## 6. Ringkasan mental model

```
                      content_uid  =  video ID TikTok (angka)
                       /                    |                    \
                      /                     |                     \
              PIC input manual        TikTok arrive (+2 hari)   Excel import
                 (tabah videos)         (sales + organic_videos)  (sales)
                      |                     |                     |
                      +---------------------+---------------------+
                                            |
                        get_campaign_video_counts_fast
                        UNION 3 sumber → DISTINCT ON(content_uid)
                                            |
                                   1 video = 1 hitungan
```

**Satu kolom penghubung: `content_uid`.** Kalau itu sama, semuanya nyambung
otomatis — tidak ada tabel mapping, tidak ada job sinkronisasi, tidak ada
kode yang perlu dijalankan ulang.

---

## 7. Riwayat perubahan scraper link pendek (30 Sep 2026)

### 7a. Yang sudah dikerjakan (nomor 1–3)

| # | Perbaikan | File |
|---|---|---|
| 1 | Terima `vm.tiktok.com` + `t.tiktok.com`, bukan cuma `vt.tiktok.com` | `api/expand-tiktok/route.ts` |
| 2 | User-Agent browser + timeout 10 detik | idem |
| 3 | oEmbed **dilewati** kalau redirect sudah membawa username | idem |
| 3b | `redirect: 'follow'` → `'manual'` + baca header `Location` | idem |

Dampaknya:

```
Sebelum  : 50 link pendek  =  50 (follow = 2 request) + ~50 oEmbed  = ~150 request
Sesudah  : 50 link pendek  =  50 HEAD (1 request, 0 oEmbed)          =  50 request
```

### 7a-1. Bukti bahwa `HEAD` + `Location` cukup (30 Sep 2026)

Diverifikasi dengan link asli:
```bash
curl -sSI -A "Mozilla/5.0" "https://vt.tiktok.com/ZSVu2Cmd9/" | grep -i "^location"
# Location: https://www.tiktok.com/@bundayul52/video/7675963488111480072?_r=1&_t=ZS-997EVrv5MHA
```

**Hop pertama sudah langsung membawa `@username` DAN `video/<id>`.**
Artinya oEmbed **tidak pernah dipanggil** untuk link normal, dan redirect tidak
perlu diikuti sampai halaman video.

> Penting: `curl -I` **tidak** mengikuti redirect — dia hanya menampilkan hop pertama.
> Kode lama memakai `redirect: 'follow'`, yang menambah request kedua dan berisiko
> mendarat di login wall yang username-nya hilang. Sekarang pakai
> `redirect: 'manual'` + `res.headers.get('location')`, dengan loop maksimal 3 hop
> yang berhenti begitu dapat username + video ID.

**Bug #1 sebelumnya:** client mengenali 3 domain, server cuma menerima 1.
Link `vm.` / `t.` ditolak 400 → link tidak berubah → item ditolak dengan pesan
"Format URL TikTok tidak valid" padahal linknya **valid**. Sekarang ketiganya sinkron.

**Perbaikan tambahan:** client sekarang menyimpan `expandError` dan
`bulkVerifyVideoLinksAction` menampilkannya. Jadi PIC sekarang melihat
*"TikTok tidak merespons (timeout)"* alih-alih mengira linknya sendiri yang rusak.
Menyentuh `VideoClient.tsx` juga ikut terperbaiki karena memakai API yang sama.

### 7b. Auth + rate limit + UX retry (30 Sep 2026, selesai)

| # | Perbaikan | File |
|---|---|---|
| 7 | `auth()` di dalam handler + rate limit 120/menit per user | `api/expand-tiktok/route.ts` |
| 8 | Jeda adaptif 2 detik → maks 10 detik saat TikTok menahan | `ImportVideoClient.tsx` |
| 9 | Tombol **"Salin N Link Gagal"** di bottom bar | `ImportVideoClient.tsx` |

#### Auth: koreksi terhadap klaim sebelumnya

Dulu saya bilang route ini "publik". **Itu tidak sepenuhnya benar.**
`proxy.ts` matcher's-nya `'/((?!_next/static|...).*)'` — menutupi `/api/expand-tiktok`.
Browser anonim dapat redirect ke `/login` dan tidak pernah sampai ke handler.

**Tapi itu tetap bukan auth.** `proxy.ts` hanya cek *ada* cookie
`authjs.session-token`, **tidak** memverifikasi isinya. Cukup set
`authjs.session-token=ngarang` di browser untuk lolos. Karena itu guard
`auth()` di dalam handler tetap wajib (AGENTS.md aturan #9).

#### Rate limit

In-memory, sliding window 60 detik, **120 request/menit per user**.
Dihitung dari `session.user.id` (fallback ke email).

Kenapa 120: client legitimate mengirim 3 link per ~2,5 detik, jadi batch
500 link = **~72 request/menit**. 120 memberi headroom tanpa membiarkan abuse.

> ⚠️ **In-memory = reset kalau server restart, dan tidak dibagi antar-instance.**
> Coolify sekarang 1 container jadi cukup. Kalau nanti di-scale ke >1 instance
> atau pakai Redis,WAJIB pindahkan ke sana — kalau tidak, rate limit bisa
> dilewati dengan grafting request ke instance berbeda.

#### Jeda adaptif

```
Dasar        : 2 detik antar chunk
Gagal 1x     : 2s → 4s
Gagal lagi   : 4s → 8s → 10s (batas)
3 chunk bersih berturut-turut : kembali ke 2s
```

Progress bar menampilkan `"TikTok menahan, jeda dinaikkan ke 5 detik..."`
supaya PIC tahu kenapa prosesnya melambat — bukan menggantung.

Estimasi waktu:

| Link | Waktu |
|---|---|
| 10 | ~8 detik |
| 50 | ~40 detik |
| 200 | ~2,7 menit |
| 500 | ~7 menit |

#### Tombol "Salin N Link Gagal"

Hanya muncul kalau `metrics.error > 0`. Menyalin `originalUrl` (bukan
`expandedUrl`) ke clipboard, dipisah baris — langsung bisa di-paste lagi
ke textarea. Kalau Clipboard API gagal (butuh HTTPS), muncul `prompt()`
sebagai fallback supaya link tetap bisa disalin manual.

### 7c. Cache `short_url → final_url` (migration wajib)

Migration: `20260930090000_create_tiktok_link_cache.sql` — **harus dijalankan manual**
(bontoh via `drizzle-kit`, sesuai AGENTS.md aturan #1).

Tabel `tiktok_link_cache`:
```
short_url (PK) | final_url | video_id | creator_username | hit_count | created_at | last_used_at
```

Tidak ada TTL — redirect TikTok permanen, jadi tidak pernah basi.

**Graceful degradation:** `readCache` / `writeCache` dibungkus `try/catch`.
Kalau tabel belum ada, route tetap berfungsi normal, hanya tanpa penghematan
request. Jadi **kode boleh deploy sebelum migration dijalankan.**

**Dua aturan yang tidak boleh dilanggar:**

1. **Hanya hasil BERHASIL yang di-cache.** Kalau link yang gagal ikut tersimpan,
   link itu tidak akan pernah dicoba lagi walau TikTok sudah bisa diakses.
   -> Diimplementasikan dengan menulis cache *setelah* oEmbed selesai, dan hanya
   kalau `hasUsername(finalUrl) && hasVideoId(finalUrl)`.
2. **`hit_count` selalu incremented** setiap kali cache dipakai, jadi bisa diukur.
   Kalau setelah 2 minggu `SUM(hit_count)` masih 0, cache ini tidak berguna
   dan boleh di-drop.

#### Mengukur apakah cache benar-benar dipakai

```sql
SELECT count(*) AS total_link,
       sum(hit_count) AS total_pakai_cache,
       count(*) FILTER (WHERE hit_count > 1) AS link_yang_diulang
FROM tiktok_link_cache;
```

Kalau `link_yang_diulang` = 0 setelah beberapa minggu, artinya PIC hampir tidak
pernah mengulang link yang sama — dan cache **tidak** menghemat apa pun.
Itu yang membuat fitur **batch expand di server** jadi lebih berharga
daripada cache.

### 7d. Yang MASIH belum dikerjakan

| # | Perbaikan | Kenapa | Perlu migration? |
|---|---|---|---|
| 6 | Batch expand di server | 500 request browser → 1 request. **Kemungkinan lebih bernilai daripada cache** — lihat query ukur di atas | Tidak |
| 10 | Bungkus commit dalam transaksi | Import 500 link tanpa transaksi = kalau gagal di tengah, data parsial tersimpan tanpa error jelas | Tidak |
| 11 | Placeholder `sqlInList` | `IN ($1,$2,...)` sebagai gantinya ribuan `?` — juga menutup risiko SQL injection | Tidak |

Nomor 10 & 11 **tidak** boleh dikerjakan bersamaan dengan perubahan lain —
keduanya menyentuh `commitBulkImportVideosAction` yang adalah jalur utama
import PIC.


### 7d. Cara menguji link pendek dengan benar

Link palsu akan selalu dialihkan ke homepage:
```bash
# SALAH -> Location: https://www.tiktok.com/?_r=1 (kode tidak dikenal)
curl -sSI -A "Mozilla/5.0" "https://vt.tiktok.com/ZSxxxxxxx/" | grep -i "^location"

# BENAR -> pakai kode pendek asli dari PIC
curl -sSI -A "Mozilla/5.0" "https://vt.tiktok.com/<KODE-ASLI>/" | grep -i "^location"
```

Hasil yang diharapkan: `Location:` berisi `tiktok.com/@username/video/ID`.
Kalau tidak muncul, `HEAD` tidak didukung TikTok dan harus diganti ke `GET`.
`route.ts` sudah menandai kasus ini sebagai gagal dengan aman — tidak ada
risiko data salah masuk.

> **Tidak ada metadata scraping.** Sistem hanya membaca header `Location`
> dari redirect, dan hanya memanggil `oembed` (endpoint resmi & publik TikTok)
> kalau username belum ada. Tidak ada pengambilan konten/metadata halaman,
> sehingga tidak ada masalah dengan ketentuan platform.
