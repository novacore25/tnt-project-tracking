# Log Pertemuan — 2 Oktober 2026 (sesi payment import fase 1)

> Melanjutkan `docs/LOG-PERTEMUAN-2026-10-01.md`. Sesi ini khusus **parsing
> penuh** spreadsheet payment + koreksi 4 asumsi yang salah.
> Semua keputusan owner ada di `docs/KEPUTUSAN-PEMBAYARAN.md` §3 (nomor 16–19).

---

## Hasil utama sesi ini

```
826 baris Paid Off dengan tanggal < 2026-09-14
Rp 507.736.562
rentang 2026-02-04 s/d 2026-09-11
815 baris dari kolom Tanggal Pembayaran, 11 dari TANGGAL PENGAJUAN
0 baris tanpa nominal
0 duplikat sejati
```

### Rekap category

| Kategori | Baris | Nominal |
|---|---:|---:|
| `kreator` | 769 | Rp 301.301.562 |
| `ads` | 51 | Rp 180.775.000 |
| `lion` | 3 | Rp 9.000.000 |
| `crm` | 2 | Rp 6.660.000 |
| `operasional_lain` (Sampel Kime) | 1 | Rp 10.000.000 |

---

## 1. Verifikasi sistem belum pernah dipakai sebelum 14 Sep 2026 — TERBUKTI

`MIN(payment_batches.submitted_at)` = **2026-09-14 12:42:13.621+00**.

Konsekuensi: 826 baris dari spreadsheet **nol tumpang tindih** dengan 110 item
yang sudah ada. Risiko duplikat dari sisi sistem = **0**.

### ❌ Yang SALAH di(section 3/8 script L0)

Query `§8` saya menulis `pi.status` — kolom itu **tidak ada**. Yang ada:

```
manager_status   NOT NULL
executive_status NOT NULL
final_status     NOT NULL
executive_1_status
```

Tidak masalah, karena `§7` (MIN `submitted_at`) sudah membuktikan sendiri.

---

## 2. Precedent pembayaran operasional — ditemukan lewat tes owner

Owner tes add pengajuan operasional di campaign 55 `Banzilla Test Bug`:

```
batch 93 → campaign_id = 55, status = pending_manager
item 155 → payment_type = 'ads', campaign_creator_id = NULL, nama_penerima = 'Hibban'
```

Sebelum tes ini, `§3` L0 **kosong** — sistem belum pernah menyimpan satu pun
pembayaran operasional, jadi tidak ada pola yang bisa ditiru.

**Pola yang sah:**
- `payment_items.campaign_creator_id = NULL` ✅ (kolomnya nullable)
- `payment_batches.campaign_id` **tetap wajib** (`NOT NULL`) → harus campaign nyata
- 51 baris `top up ads` punya kolom Campaign yang bisa dipakai
- 6 baris `TOP UP LION` / `TOP UP QONTAK` tidak punya campaign → destined DEFER

### 🐛 Bug UI ketahuan dari tes ini

Item tanpa kreator tetap ditampilkan dengan judul **"Menunggu Manager
(1 Kreator)"** dan baris kolom `Kreator` berisi `@ Hibban`, padahal
`campaign_creator_id IS NULL`. Salah label, bukan salah data. Belum diperbaiki.

### 🧹 Sisa tes yang perlu dibersihkan

Batch 93 / item 155 (`Rp 10.000`, `Banzilla Test Bug`, notes "jangan di bayar
ini mau ngetes doang bro"). Jangan dibiarkan ikut terhitung sebagai payment riil.

---

## 3. Aturan dedup lama terbukti menghapus Rp 42.600.000

Rencana lama: duplikat kalau `username + nominal + tanggal` sama persis.
Diterapkan ke 826 baris → kena **26 grup / 31 baris**.

**NOL satu pun duplikat sejati.** Semua 26 grup punya campaign berbeda:

| Yang "kena" | Bukti beda pembayaran |
|---|---|
| `intnwulnn_` Rp300.000 02/06 | MSGLOWBEAUTY `50% AWAL` + NAISDAY `100% AKHIR` — **status beda** |
| `tesazakia` Rp300.000 05/06 | DIOLY `100% AWAL` + NAISDAY `100% AKHIR` — **status beda** |
| `zihanokta` Rp350.000 19/05 | **4 campaign**: OMG Makeup / ISWHITE / SYB / NAISDAY |
| `top up ads` Rp5.000.000 09/06 | OMG Makeup + QAHIRA — top up ads memang per campaign |

Dengan kunci lengkap `username + campaign_sheet + status_klaim + nominal +
tanggal` → **0 grup duplikat**.

Konfirmasi owner: *"staff saya selalu memasukan dengan benar kok ga pernah
masukin dobel, dan finance juga ga pernah membayar dobel."*

→ **Keputusan #16: tidak ada dedup, 826 baris semua masuk.**

---

## 4. Tanggal `17/04/2025` = salah ketik → `2026-04-17`

4 baris di sheet April 2026 (`ekbardiary`, `ncaaaaaaa24_`, `aleena_balqis`,
`sonyasinaga_`, total Rp 1.100.000).

Bukti posisi di sebaran tanggal sheet itu:

```
02 Apr(31) 07(10) 10(10) 14(34) [17/04/2025 → 4] 21(9) 24(9) 28(22) 30(16)
```

Sistem **nol data 2025** (`MIN(submitted_at)` = Sep 2026). Konfirmasi owner:
*"oh itu typo broo harusnya 2026 benerin aja, aman kok bro"*.

Teks aslinya tetap ditulis di `tanggal_asal` + `catatan` supaya jejaknya auditable.

---

## 5. ⚠️ Sel Excel berisi newline — SQL langsung rusak

**6 dari 826 baris punya `\n` di dalam sel.** Ditemukan karena satu baris SQL
terpotong saat di-inspect:

```
('April 2026', 97, DATE '2026-04-17', '17/04/2025', 'tanggal_pembayaran', 'aleena_balqis', 'aleena_balqis
), 'KIMME', '100% AKHIR', 'kreator', 250000, 0, 'Wahyu'),
```

Kalau ini masuk DB, **seluruh migration gagal** tanpa error yang berguna.

### Kasus terburuk: `Juli 2026` r61 — 4 username dalam 1 sel

```
hi.syah vv.vianaaa
eloraariyani
zaraaa.nh
beautyaul_
```

1 pembayaran Rp 2.000.000, 1 penerima (`M FARHAN MAULANA`, rek `8881127032`),
untuk **4 akun**. Dicatat sebagai **SATU** `payment_items` dengan
`username_multi = true`. **Memecahnya = mengarang nominal per akun** yang tidak
pernah ada di spreadsheet.

### Perbaikan

`Q()` di `docs/scripts/gen-staging-sql.ps1` menulis `\r` / `\n` / `\t` sebagai
teks dua huruf, bukan karakter kontrol mentah. Single quote di-escape `''`.

Validasi otomatis yang ditambahkan:
- semua 826 baris harus tepat **15 kolom** (dihitung dengan parser yang menghormati
  kutip, bukan `Split(',')` — koma di dalam `catatan` bikin hitungan salah)
- tidak boleh ada baris `VALUES` tanpa penutup
- jumlah kutip tunggal harus genap

---

## 6. Kolom `Status` berisi 7 nilai, bukan cuma `100% AWAL/AKHIR`

```
100% AKHIR         603 baris   Rp 243.851.562
50% AKHIR          106 baris   Rp  20.025.000
ADS                 51 baris   Rp 180.775.000   <- OPERASIONAL
50% AWAL            35 baris   Rp   8.125.000
100% AWAL           18 baris   Rp  22.950.000   <- '100_awal' BELUM ADA di CHECK
(kosong)             7 baris   Rp  16.300.000
LION                 3 baris   Rp   9.000.000   <- OPERASIONAL
CRM                  2 baris   Rp   6.660.000   <- OPERASIONAL
"kekurangan dikit"   1 baris   Rp      50.000   <- CATATAN, bukan jenis bayar
```

Klifikasi operasional ditentukan dari **kolom `Status`**, bukan dari kolom
`Campaign` (percobaan pertama saya salah di sini — hanya menemukan 7 dari 56 baris).

`payment_items_payment_type_check` **tidak punya `100_awal`** →
18 baris / Rp 22.950.000 butuh migration Fase 2 yang menambahkannya dulu.

---

## 7. Nama campaign di sheet ≠ nama di DB

```
KIMME           325 baris  vs DB KIME
SALSA COSMETICS  37 baris  vs DB SALSA Cosmetic      (jamak vs tunggal)
MSGLOWBEAUTY     32 baris  vs DB MS Glow Beauty
MSGLOWFORMEN     14 baris  vs DB MS Glow For Men
Nutriflakes      28 baris  vs DB NUTRIFLAKES
Votre Peu         2 baris  vs DB VOTRE PEAU
SALSA Baby Care  24 baris  vs ?? SALSA Mom & Baby   <- TIDAK terbukti
METOO             4 baris  Rp 89.500.000              <- tidak ada di DB
```

### Koreksi terhadap `docs/KEPUTUSAN-PEMBAYARAN.md` §9 versi lama

Tabel lama menulis:

```
| VOTRE PEAU | 53 | VOTRE PEU (typo di spreadsheet) |
```

**Itu terbalik.** `payment_batches` (§2 L0) dan `docs/sql/42` membuktikan nama DB
campaign 53 adalah **`VOTRE PEAU`**, sedangkan sheet menulis `Votre Peu`.

### Yang belum bisa dipastikan

- `SALSA Baby Care` (24 baris / Rp 22.450.000) — dua brand "SALSA" di DB
  (`SALSA Cosmetic` 35, `SALSA Mom & Baby` 36). **Jangan diasumsikan.**
- `METOO` (4 baris / Rp 89.500.000) — perlu `SELECT nama FROM campaigns`
- `TOP UP LION` → kandidat 58 `LION PARCEL`? belum dikonfirmasi

Semua kandidat ditampilkan lewat view `v_payment_campaign_candidates`.
**Bukan auto-map** — owner yang memutuskan.

---

## 8. Peta PIC setelah konfirmasi owner

| PIC di sheet | `submitted_by` | Sumber |
|---|---|---|
| Wahyu | `Wahyu Prakoso` | konfirmasi owner |
| Maria | `Maria Alvita` | konfirmasi owner |
| **April** | **`Aprilia`** | *"April tuh nama aslinya Aprilia bro"* |
| **Rija** | **`Irsadur Rija`** | *"Cocokkan ke Irsadur Rija"* |
| Tiara | `Tiara` (inactive) | keputusan #14 |
| Fira | `Fira` (inactive) | keputusan #14 |
| Daffa, Natallia, Marini, Riska, David, (kosong) | **NULL** | keputusan #13 |

```
TIDAK NULL : 729 baris   Rp 356.181.562
NULL       :  97 baris   Rp 151.555.000
```

`Rija` → `Irsadur Rija` dicatat sebagai **konfirmasi eksplisit owner**, bukan
fuzzy match. Beda sifat: kalau tidak dikonfirmasi, baris itu tetap `NULL`.

> `*.csv` ada di `.gitignore`. Staging dibungkus sebagai SQL `INSERT ... VALUES`
> dengan PII dikecualikan — supaya bisa lewat `curl` tanpastoredata sensitif di git.

---

## File yang dibuat sesi ini

| File | Isi |
|---|---|
| `web-app/supabase/migrations/20261004000000_payment_import_staging.sql` | Tabel staging + peta PIC + peta campaign (kosong) + 2 view. **Belum dijalankan.** |
| `docs/sql/67-isi-staging-payment.sql` | 826 baris `INSERT` staging + 2 guard. **Belum dijalankan.** |
| `docs/sql/68-cocokkan-payment.sql` | 10 query read-only: match rate, kandidat campaign, status→`payment_type`. **Belum dijalankan.** |
| `docs/sql/66-petakan-campaign.sql` | Kandidat campaign (d superseded oleh view di migration) |
| `docs/scripts/parse-payment-l1.ps1` | Parser Excel COM (read-only) |
| `docs/scripts/gen-staging-sql.ps1` | Generator SQL staging + escape karakter kontrol |
| `docs/payment/analisis-l2.txt` | Bukti 0 duplikat + damage aturan lama |
| `docs/payment/analisis-l3.txt` | Baris anomali (2025, username kosong, status ngawur) |
| `docs/payment/parsed-826.csv` | Cache lengkap **termasuk PII** — otomatis tidak masuk git |

## Urutan eksekusi

```
1. docs/sql/68-cocokkan-payment.sql   -> BASELINE, read-only, jalan duluan
2. migration 20261004000000           -> buat tabel staging
3. docs/sql/67-isi-staging-payment.sql -> isi 826 baris + guard
4. PETAKAN KAMPANY (view + keputusan owner) -> isi payment_import_map_campaign
5. migration payment_type '100_awal'  -> tambah ke CHECK
6. SQL INSERT ke payment_batches + payment_items (Fase 2, belum ditulis)
7. Bersihkan batch tes 93 / item 155
```

---

# STATUS AKHIR — 4 Oktober 2026

Sesi 2 Okt ditutup dengan impor **berhasil**. Semua yang tercatat di file ini
sudah dijalankan ke produksi.

```
Payment historis : 796 item / Rp 385.026.562 / 278 batch
Data asli        : 110 item / Rp 44.270.000  (batch tes 93 SUDAH dihapus)
Staff baru       :   5 item / Rp  1.790.000  (LION PARCEL, pending_manager)
TOTAL            : 911 item / Rp 431.086.562 / 349 batch
```

## Yang terjadi setelah impor selesai

1. **Bug label "1 Kreator"** untuk item operasional - sudah diperbaiki
   (commit `b7289cd`). Judul batch sekarang hitung kreator dan operasional
   terpisah; kolom Kreator menampilkan "Tanpa kreator (operasional)".

2. **Bug kolom "PIC Submit" kosong** - sudah diperbaiki. `getPaymentBatches`
   tidak pernah mengambil kolom `submitter` yang dibaca `keuangan/page.tsx:330`.
   Bug **lama**, bukan dari impor - cuma baru kelihatan karena jumlah batch
   PWS mendadak banyak. Data `submitted_by` sendiri sudah benar sejak awal
   (Rija -> Irsadur Rija).

3. **Rollback disiapkan** - `docs/sql/74-rollback-payment-historis.sql`,
   100% read-only. Semua `DELETE` di dalam `\echo`.

4. **`jimmy.hen` dicek** - 2 baris NAISDAY 19 Jun (Rp400.000 + Rp73.900),
   keduanya masuk, tidak kena dedup. Kasus yang rencana lama tandai
   "wajib tidak terdedup" terbukti jalan dengan benar.

5. **5 item baru muncul** dari staff (LION PARCEL, `pending_manager`,
   4 Okt 2026) - sistem berjalan normal setelah impor.

## Angka lama yang sudah TIDAK berlaku di dokumen ini

| Angka lama | Angka sebenarnya | Kenapa |
|---|---|---|
| 840 baris `Paid Off` | **826** | 11 baris September jatuh setelah 14 Sep, sisanya baris TOTAL |
| 822 baris / Rp 383.776.562 | **792 / Rp 385.026.562** | dihitung dengan aturan dedup yang terbukti menghapus Rp 42.600.000 |
| "semua 840 masuk" | 792 dari 826 | 17 duplikat lokasi + 17 DEFER |
| 18 baris DEFER / Rp 128.460.000 | **17 / Rp 118.460.000** | Sampel Kime masuk ke KIME (keputusan #22) |

## Tahap berikutnya

Keputusan owner #1 (1 Okt 2026): **"Plafon budget diisi SETELAH migrasi selesai,
atau kita bahas lagi setelah rencana migrasi beres dan sudah akurat 100 persen
gada yang ke dobel."**

Syaratnya sekarang **terpenuhi**: impor selesai, nol duplikat terbukti, semua
angka terverifikasi ke-VPS.

Sisa pekerjaan lain:
- 17 baris DEFER / Rp 118.460.000 menunggu jawaban bos (METOO, TOP UP LION,
  TOP UP QONTAK, MCN). Rincian: `docs/payment/DEFER.md`
- Hapus `importHistoricalBatch` (fungsinya pasti crash, 3 kolom tidak pernah ada)
- Risiko terbuka: `KIME spill.by.lily` Rp750.000 vs ratecard Rp500.000,
  `KIME beauty.iidd` Rp550.000 vs ratecard Rp450.000
