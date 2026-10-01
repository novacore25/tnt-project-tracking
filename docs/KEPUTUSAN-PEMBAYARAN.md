# Keputusan & Rencana Migrasi Payment Historical

> **Status: MENUNGGU.** User menunda migrasi pada 1 Okt 2026 04:32 dengan
> alasan atasan meminta audit menu profil kreator dulu. Beding volver.
>
> Semua keputusan di bawah **sudah/user-tetapkan** — jangan ditanya ulang.
> Yang masih perlu keputusan hanya 1 hal, lihat §8.

---

## 1. Sumber data

| | |
|---|---|
| File | `C:\Users\Banzilla\Downloads\Form Payment Campaign TNT.xlsx` |
| Ukuran | 768 KB · 8 sheet |
| Periode | Februari – September 2026 |
| Total | **840 baris / Rp 512.236.562** |
| Rincian | 783 baris kreator Rp 310.251.562 + 57 baris operasional Rp 201.985.000 |

### ⚠️ Belum ada cache ekstrak

Tidak ada CSV/JSON hasil ekstrak di repo maupun di folder plan. Setiap kali
mulai migrasi, spreadsheet **harus di-parse ulang**.

---

## 2. Kenapa migrasi ini penting

> "saya mau migrasiin data payment lama ke sistem bandingin data datanya dengan
> yang disistem jangan sampe ada yang dobel, soalnya saat ini user itu kalo
> mengajukan itu selalu di dua form, satu form yang di spreadsheet satu lagi
> yang di sistem kenapa begitu karena itu **perintah saya** takut ada error dan
> data pembayarannya jadi ga akurat"

**Penting dipahami:** dobel-input ini **memang atas perintah user sendiri**,
bukan bug. Jadi koreksi tidak boleh menghilangkan jejaknya.

Setelah migrasi, spreadsheet **tidak dipakai lagi** (keputusan user 1 Okt 03:44).

---

## 3. Keputusan user yang sudah dikunci

Semua bertanggal 1 Okt 2026. **Jangan diubah tanpa tanya.**

| # | Keputusan | Sumber |
|---|---|---|
| 1 | **Plafon budget diisi SETELAH migrasi selesai & terverifikasi** | 03:44 — "iya plafon diisi setelah migrasi selesai, atau kita bahas lagi setelah rencana migrasi beres dan sudah akurat 100 persen gada yang ke dobel" |
| 2 | **`100_awal` = bayar dulu, baru bikin video.** `100_akhir` = bikin video dulu, baru dibayar di akhir | 03:44 — "100% awal maksudnya tuh biasanya kesepakatan doang dengan si kreatornya mau bayar dulu baru bikin video, atau 100% akhir itu mau bayar di akhir, jadi bikin video dulu baru dibayar" |
| 3 | **`boost_awareness` = `boost_views`** (tambah, jangan hapus nilai lama) | 03:59 — "boost awareness sama kok kayak boost views" |
| 4 | **Baris tanpa campaign harus DILIST + didokumentasikan, termasuk bulan** — supaya user bisa cek ke spreadsheet atau tanya tim finance | 03:59 |
| 5 | **SAMPEL KIME → operasional campaign KIME (44)**, tapi menunggu konfirmasi finance | 03:59 |
| 6 | **TOP UP QONTAK / TOP UP LION → operasional campaign masing-masing**, tapi sheet tidak mencatat campaign mana. Perlakuannya belum final | 03:59 — "oke nanti kita bahas" |
| 7 | **Hanya baris `Paid Off` yang dimigrasi.** `Not Yet` dilewati |_aturan migrasi_ |
| 8 | **Alokasi all-or-nothing per batch per tanggal** — bukan 840 baris sekali jalan | _aturan migrasi_ |
| 9 | **PIC format `<nama> - by sistem`** | _aturan migrasi_ |
| 10 | **Tanggal: pakai TANGGAL PENGAJUAN.** Kalau kosong, samakan dengan tanggal pembayaran, dan sebaliknya | 10-01 09:2x — "pertanggal pengajuan aja bisa ga? kalo tanggal pengajuannya gada ya samain aja sama tanggal pembayaran begitupun sebaliknya" |

### Kenapa tanggal penting

Spreadsheet **April–Juni tidak punya `Tgl Actual Payment` sama sekali** — kolomnya
kosong semua. Yang ada hanya tanggal pengajuan.

> "samain aja kalo case gini dengan tanggal pengajuan, bodo amat lah yang
> penting semua data uang keluar itu tercatat brooo"

**Prinsipnya: rekam, jangan menebak.** Lebih baik tanggal kurang tepat daripada
baris pembayaran hilang dari sistem.

**Pemisahan kolom:**

| Dari spreadsheet | Masuk ke | Fallback |
|---|---|---|
| Tanggal Pengajuan | `payment_items.created_at` + kunci pengelompokan batch | Tanggal Pembayaran |
| Tanggal Pembayaran | `payment_batches.actual_payment_date` | Tanggal Pengajuan |

Tidak ada tanggal yang hilang — masing-masing disimpan di kolomnya.

**Efek sampingnya bagus:** `paymentActions.ts:813` menyalin `tanggal_pengajuan`
ke `created_at`. Setelah aturan ini berlaku, `created_at` 16–25 Sep di 44 item
yang sudah ada **bisa dibandingkan langsung** dengan spreadsheet. Kunci cocok
menjadi `username + nominal + tanggal_pengajuan` — tanpa fuzzy matching.

---

## 4. Realitas database (terverifikasi 1 Okt 2026, `docs/sql/42`)

### `payment_type` — hanya SATU nilai yang terpakai

```sql
CHECK (payment_type = ANY (ARRAY['100_akhir','50_awal','50_akhir','ads','crm',
                                  'lion','reward_affiliate','boost_views','boost_comment']))
```

| | |
|---|---|
| Terpakai | `100_akhir` saja (106 item / Rp 42.050.349) |
| Perlu ditambah | `100_awal` (keputusan #2), `boost_awareness` (keputusan #3) |
| Sifat penambahan | **Aditif — jangan hapus `boost_views`/`boost_comment`**, berisiko merusak data lama |

### Isi tabel

```
payment_items     106 item   →  pending 61 · paid 44 · manager_approved 1
payment_batches    66 batch
paid items         SATU batch: "Batch - September 2026", 16–25 Sep 2026, Rp 13.550.000
campaign_id        NOT NULL  → Qontak/LION lintas campaign tidak bisa masuk
orphan / NULL      0 / 0     (bersih)
unique index       tidak ada (hanya pkey)
creators           16.309
campaign_creators  23.098 baris · 9.105 kreator unik
```

### ⚠️ Risiko cakupan: hanya 44% kreator punya campaign

Dari 16.309 kreator, hanya **9.105** yang punya baris di `campaign_creators`.
Angka "822 baris siap migrasi" di rencana dihitung **tanpa** memeriksa ini.

**Match rate asli belum diketahui.** Itu yang harus diukur di dry-run, bukan
diasumsikan. 23.098 baris untuk 9.105 kreator artinya rata-rata **2,5 campaign per
kreator** → pencocokan wajib memakai `username + campaign`, bukan username saja.

---

## 5. Yang salah di rencana lama

Rencana `rencana-migrasi-payment.md` §5.2 menyatakan `payment_items` tidak punya
`actual_transfer` sehingga `financeMarkPaid` akan error. **Itu salah.**

| Kolom | `payment_items` | `payment_batches` |
|---|---|---|
| `actual_transfer` | ✅ `numeric` | — |
| `transaction_id` | ✅ `varchar` | — |
| `biaya_transfer` | ✅ `bigint` | — |
| `actual_payment_date` | ❌ | ✅ `date` |
| `bukti_transfer_url` | ❌ | ✅ `text` |
| `sender_account_id` | ❌ | ✅ `integer` |

`SKILL.md` sudah sejak lama benar (glosarium "Split payment" merujuk
`payment_items.actual_transfer`) — jadi **rencana basi sejak ditulis**, bukan
berubah karena ada perubahan skema.

**Akar masalahnya:** output psql yang dipaste **terpotong di tengah daftar kolom**.
Kesimpulan "kolom tidak ada" ditulis dari daftar yang tidak lengkap.
`docs/sql/42` sekarang menguji tiap kolom dengan `EXISTS` satu-satu supaya
tidak bisa terulang.

### 🎯 Bug nyata: `importHistoricalBatch` tidak pernah bisa jalan

`web-app/src/app/campaigns/actions/paymentActions.ts:806-814`

```sql
INSERT INTO payment_items (
  ..., created_at, actual_payment_date, bukti_transfer_url, sender_account_id
)
```

Tiga kolom itu tidak pernah ada di `payment_items` → **fungsi ini pasti crash.**
Baris 795-796 (insert batch) juga rusak: `profileId` diulang 4 kali.

Rencana §11 sudah melarang memakainya, tapi **alasan sebenarnya bukan "berbahaya"
melainkan "outright tidak bisa jalan"**.—byidak pernah dipakai, dan tidak akan.

**Keputusan: hapus fungsi ini.** Migrasi akan murni SQL migration file, sesuai
aturan repo. Tidak ada risiko mundur karenajalur ini sudah mati.

### ⚠️ Unique index rencana §10 akan **menolak pembayaran sah**

Rencana mengusulkan `(campaign_creator_id, payment_type)`. Kasus `jimmy.hen`:

```
NAISDAY  2026-06-19  Rp 400.000  (bayar reguler)
                      Rp  73.900  (note: "Reimburse Sample")
```

Dua pembayaran **sah**. Index tersebut akan **menolak yang kedua** — persis jenis
data yang tidak boleh hilang. Kunci harusoby nomer:

```sql
(campaign_creator_id, payment_type, nominal, COALESCE(actual_payment_date, created_at::date))
```

Pasang **setelah** dedup manual bersih, karena `CREATE UNIQUE INDEX` akan gagal
kalau masih ada duplikat.

---

## 6. Deteksi duplikat

Tidak memakai satu kunci eksak. Normalisasi dulu, lalu cocokkan berlapis.

**Normalisasi** (diperlukan karena ada 22 username dengan spasi excess dan 6 dengan newline):

| Field | Aturan |
|---|---|
| `username` | trim + lowercase + buang prefix `@` + buang newline |
| `nomor_rekening` | buang semua karakter non-angka (`27.101.849.1-506.000` → `271018491506000`) |
| `nama_penerima` | trim + lowercase + rapikan spasi ganda |

| Tingkat | Kunci | Perlakuan |
|---|---|---|
| 1 — pasti duplikat | username + nominal + tanggal_pengajuan | exclude otomatis, dicatat ke batch mana |
| 2 — kemungkinan duplikat | username + nominal | tampilkan di laporan, user putuskan |
| 3 — curiga lain | nomor_rekening + nama_penerima + nominal | tampilkan di laporan |

Dibanding terhadap **106 item** yang sudah ada (bukan cuma 44 `paid`). 62 item
lagi juga berisiko: kalau spreadsheet sudah `Paid Off` sementara sistem masih
`pending`, uang sudah keluar tapi sistem menampilkan menunggu approval — dan kalau
PIC approve, **dobel bayar**.

Tidak ada baris yang dieksklusi diam-diam. Semua hasil perbandingan keluar di laporan.

**Kasus khusus yang WAJIB tidak terdedup:** `jimmy.hen` — lihat §5.

---

## 7. Yang di-DEFER — 18 baris / Rp 128.460.000

User memutuskan **membiarkan DEFER** (1 Okt 09:2x: "Biarkan DEFER dulu").
Tidak dimigrasi, tapi tetap tercetak di laporan supaya tidak hilang jejaknya.

### 7.1 METOO — 4 baris, Rp 89.500.000 (Maret 2026)

| Tanggal | User | Status | Nominal | Penerima |
|---|---|---|---|---|
| 2026-03-13 | `jesselinjess` | 100% AKHIR | Rp 19.500.000 | Jesselin |
| 2026-03-13 | `sindi9rande` | 100% AKHIR | Rp 12.000.000 | Sindi Komalasari |
| 2026-03-13 | `yusmankusumaa` | 100% AKHIR | Rp 16.000.000 | usman saepul kusuma |
| 2026-03-27 | `lauratheux` | 100% AKHIR | Rp 42.000.000 | **PT Potluck Studio Indonesia** |

3 baris ke kreator, 1 baris (42 juta) ke badan usaha (PT). Tidak jelas apakah
`lauratheux` = evolusi dari PT Potluck atau kreator yang nama bayarnya atas nama PT.

### 7.2 TOP UP QONTAK — 3 baris, Rp 12.210.000

| Bulan | Tanggal | Nominal | Status |
|---|---|---|---|
| Juli 2026 | 2026-07-21 | Rp 2.220.000 | CRM |
| Juli 2026 | 2026-07-28 | Rp 5.550.000 | (kosong) |
| Agustus 2026 | 2026-08-12 | Rp 4.440.000 | CRM |

Ketiganya `nama_penerima` kosong, lintas campaign.

### 7.3 SAMPEL KIME — 1 baris, Rp 10.000.000

2026-07-31 · `SAMPLE KIME` · 100% AKHIR · David Sukanto
Seharusnya operasional campaign KIME (44) — menunggu konfirmasi finance.

### 7.4 TOP UP LION — 3 baris, Rp 9.000.000

2026-07-21 Rp 2.000.000 · 2026-07-31 Rp 2.000.000 · 2026-08-12 Rp 5.000.000

### 7.5 Campaign MCN lain — 6 baris, Rp 7.700.000

| Campaign | Tanggal | User | Status | Nominal |
|---|---|---|---|---|
| MCN CLOGENT | 2026-06-09 | `mei_arifin180899` | 100% AWAL | Rp 4.500.000 |
| MCN ZOICY | 2026-03-05 | `nonazawa` | 100% AKHIR | Rp 2.200.000 |
| MCN | 2026-04-21 | `Lilmoon (ammiay)` | 100% AKHIR | Rp 700.000 |
| REFERAL MCN | 2026-02-27 | `Bemyung` | 100% AKHIR | Rp 100.000 |
| REFERAL MCN | 2026-02-27 | `tazkiafauza` | 100% AKHIR | Rp 100.000 |
| BOA | 2026-02-04 | `aboutpipita` | 100% AKHIR | Rp 50.000 |

### 7.6 Baris dieksklusi/didokumentasikan — 5 baris, Rp 3.100.000

Termasuk 1 sel berisi 4 creator dengan NIK atas nama orang ketiga.

---

## 8. Rencana eksekusi

| Fase | Isi | Status |
|---|---|---|
| 1 | Parse ulang spreadsheet (768 KB, 8 sheet) | ⬜ |
| 2 | **Dry run read-only:** cocokkan terhadap `campaign_creators` + 106 item existing. Keluarkan matched / unmatched / duplikat. **Tidak menulis apa pun** | ⬜ |
| 3 | Tambah `100_awal` + `boost_awareness` ke CHECK (aditif) | ⬜ |
| 4 | Migrasi per batch per tanggal pengajuan, pilot 1 bulan dulu, backup + guard | ⬜ |
| 5 | `100% Awal` (22 baris / Rp 24.250.000) setelah fase 4 bersih | ⬜ |
| 6 | Unique index kunci `nominal + tanggal` | ⬜ |
| 7 | Hapus `importHistoricalBatch` | ⬜ |
| 8 | Laporan dampak ke `vw_campaign_budget_summary` (read-only) | ⬜ |

### ⏳ SATU keputusan yang belum diambil

**Kunci pengelompokan batch ikut tanggal pengajuan, benar?**

Kalau batch dihitung dari tanggal pembayaran tapi itemnya tanggal pengajuan, satu
batch bisa berisi item beda-beda tanggal dan rekonsiliasi jadi repot.
Aturan tanggal item sudah jelas (keputusan #10); yang belum jelas adalah
pengelompokannya.

### Guardrail

1. **Jangan pakai `importHistoricalBatch`** — sudah pasti crash, dan akan dihapus.
2. **Migration file baru** di `web-app/supabase/migrations/` timestamp monotonic.
   Jangan edit `schema.ts`.
3. **Satu transaksi per batch.** Loop tanpa transaksi = batch setengah jadi.
4. **Idempotent.** Gagal di tengah lalu dijalankan ulang tidak boleh menambah dobel.
5. **Hanya menulis**, tidak pernah overwrite data yang sudah ada.
6. **Jalankan dry run lebih dulu** — migrasi harus bisa diulang tanpa menulis.
7. **Backup sebelum menulis**, dan jangan di-drop sampai user yakin.

---

## 9. Campaign yang sudah terpetakan

21 campaign punya padanan `campaign_id` yang sudah diverifikasi.

| Nama di spreadsheet | `campaign_id` | Nama di DB |
|---|---|---|
| KIMME | 44 | KIME |
| PWS | 38 | PWS |
| DIOLY | 40 | DIOLY |
| SYB | 46 | SYB |
| GLOWIES | 51 | GLOWIES |
| MS Glow For Men | 42 | MSGLOWFORMEN |
| SKINMOLOGY | 43 | SKINMOLOGY |
| WARDAH | 37 | WARDAH |
| VOTRE PEAU | 53 | VOTRE PEU (typo di spreadsheet) |
| GHANISKIN | 57 | GHANISKIN |
| MILKYBOOST | 52 | MILKYBOOST |

**Total 822 baris / Rp 383.776.562** dianggap siap — **tapi angka ini belum
divalidasi terhadap `campaign_creators`.** Lihat §4.
