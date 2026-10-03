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
| Ukuran | 768 KB · **8 sheet** |
| Periode | Februari – September 2026 |
| **Scope migrasi** | **840 baris `Paid Off`** / **Rp 512.236.562** |
| Rincian | 783 baris kreator Rp 310.251.562 + 57 baris operasional Rp 201.985.000 |

### ✅ Scope terverifikasi (scan penuh 1 Okt 2026)

Harapan lama **840 baris** ternyata persis = jumlah `Paid Off`. Bukan kebetulan:

| `Status Pembayaran` | Baris | Actions |
|---|---:|---|
| **`Paid Off`** | **840** | ✅ **DIMIGRASI** |
| `Not Yet` | 78 | 📝 NOTA saja |
| `Cancel` | 7 | 📝 NOTA saja |
| (kosong) | 1 | 📝 NOTA saja |
| **TOTAL** | **926** | |

`Cancel` **baru ketemu saat scan** — rencana lama hanya tahu `Paid Off` dan `Not Yet`.

**Pola yang membuat ini masuk akal:** Juni, Mei, April **0 baris** belum lunas. September 35
dan Agustus 39. Jadi yang belum dibayar jelas berkumpul di dua bulan terakhir.

### ⚠️ Ada baris SUBTOTAL di dalam sheet

Contoh: `TOTAL 16882900`, `TOTAL 12132000`. Nilai ini ada di kolom `Tanggal Pembayaran`.
**Harus dilewati** saat migrasi — kalau tidak, Rp 29 juta fiktif masuk sistem.

### ⚠️ Belum ada cache ekstrak

Tidak ada CSV/JSON hasil ekstrak di repo maupun di folder plan. Setiap kali
mulai migrasi, spreadsheet **harus di-parse ulang**.

### Cara parse yang terbukti

Excel COM tersedia di mesin ini dan **jauh lebih andal** daripada parse XML di dalam xlsx:

```powershell
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Open($path, 0, $true)   # 0,$true = read-only
```

**Dua jebakan yang sudah terbukti:**

1. **`.Text` dan `.Value2` TIDAK konsisten.** Scan dengan `.Value2` gagal
   mencocokkan `Paid Off` (hasilnya **0**), sedangkan `.Text` benar. Pakai `.Text`.
2. **Selalu cek kolom > 0 sebelum diakses.** `$data[$r,0]` mengembalikan
   **seluruh baris** sebagai array — itu yang bikin output meledak ribuan baris.
3. **Cari kolom per NAMA header, bukan per nomor.** Posisi `PIC` berbeda tiap sheet
   (kolom 13 di September, kolom 9 di Maret, kolom 10 di Februari). Lihat §4A.1.


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
| 7 | **Hanya baris `Paid Off` yang dimigrasi.** `Not Yet`, `Cancel`, dan kosong **cukup di-NOTA** | "yang di migrasiin itu hanya yang udah di bayar aja, atau Paid Off, untuk yang lainnya nanti dulu aja di note aja" |
| 8 | **Alokasi all-or-nothing per batch** — bukan 840 baris sekali jalan | _aturan migrasi_ |
| 9 | PIC dicatat di `batch_label` | lihat #12 |
| 10 | **Tanggal: pakai TANGGAL PENGAJUAN.** Kalau kosong, samakan dengan tanggal pembayaran, dan sebaliknya | "pertanggal pengajuan aja bisa ga? kalo tanggal pengajuannya gada ya samain aja sama tanggal pembayaran begitapun sebaliknya" |
| 11 | **Kunci grouping batch = tanggal pengajuan + PIC + campaign** | "tanggal + PIC + campaign ini aja" |
| 12 | **Format label = `2026-03-15 - PIC: Ahmad - KIME`** | "2026-03-15 - PIC: Ahmad - KIME" |
| 13 | **PIC tanpa akun tetap dimigrasi** dengan `submitted_by = NULL`, nama ditulis di label + notes | "yang 4 orang itu ya tetep tercatat dulu aja namanya bro" |
| 14 | **`Tiara` & `Fira` (akun `inactive`) tetap dipakai apa adanya** | "tiara gapapa masukin aja, walaupun inactive yang penting ada namanya" |
| 15 | **`Jerry` = `Jeremy`** | "jerry itu sama dengan Jeremy" |

### Keputusan 2 Oktober 2026 (hasil parsing penuh + verifikasi ke DB)

Semua bertanggal **2 Okt 2026**. **Jangan diubah tanpa tanya.**

| # | Keputusan | Sumber / bukti |
|---|---|---|
| **16** | **TIDAK ADA dedup sama sekali. 826 baris semua masuk.** Kunci duplikat yang benar adalah `username + campaign + status + nominal + tanggal` → **0 grup duplikat**. Aturan lama (`username+nominal+tanggal`) akan menghapus **31 pembayaran nyata = Rp 42.600.000** | *"username + nominal + tanggal + campaign kalo beda berarti itu ya beda pembayaran, tapi emang ada yang kayak gitu... staff saya selalu memasukan dengan benar kok ga pernah masukin dobel, dan finance juga ga pernah membayar dobel"* |
| **17** | **`PIC April` = profil `Aprilia`** | *"Iya April tuh nama aslinya Aprilia bro"* |
| **18** | **`PIC Rija` = profil `Irsadur Rija`** (67 baris / Rp 44.200.000) | *"Cocokkan ke Irsadur Rija"* — konfirmasi eksplisit owner, **bukan** fuzzy match |
| **19** | **`17/04/2025` di sheet April 2026 = salah ketik** → `2026-04-17`, teks aslinya tetap ditulis di `tanggal_asal`/`catatan` | *"oh itu typo broo harusnya 2026 benerin aja, aman kok bro"* |

### Keputusan 3 Oktober 2026 (sesi discussion: duplikat lokasi + import final)

| # | Keputusan | Sumber / bukti |
|---|---|---|
| **20** | **17 baris duplikat LOKASI tidak diimport** — `username + campaign + nominal` identik dengan item yang sudah ada di sistem. Sheet **September 2026 11 dari 11 baris** + 6 baris Agustus. Total **Rp 4.250.000** | `docs/sql/71 §1b`, output `17 | 4250000` |
| **21** | **`spill.by.lily` & `beauty.iidd` di KIME tetap diimport**, walau `campaign_creators.nominal_pelunasan` lebih kecil dari item sistem. Alasannya **tanggal berbeda** → pembayaran berbeda | *"emang tanggalnya yang di excel sama sama 16 september? ... yauda jika tanggalnya beda berarti pembayarannya emng beda bro, yauda masukin aja sesuai yang di excel"* |
| **22** | **Hanya `Sampel Kime` yang dimasukkan dari 17 baris DEFER** → campaign 44 KIME. 1 baris / Rp 10.000.000 | *"gapapa masukin asal ada nama campaignnya jelas bro"* |
| **23** | **17 baris lain tetap DEFER** (`METOO`, `TOP UP LION`, `TOP UP QONTAK`, `MCN*`, `Referal MCN`, `BOA`) = **Rp 118.460.000**. Rincian di `docs/payment/DEFER.md` | *"gausah di migrasiin catat dulu aja di dokumentasi"* |
| **24** | **BOA tidak boleh masuk sistem, apa pun hasilnya** — note di Excel: *"dibayar dari brand"* | *"BOA gausah di masukin, di notes aja"* |
| **25** | **Excel adalah sumber kebenaran. Mutasi bank tidak bisa diminta.** NIK yang dipakai >1 username dibiarkan apa adanya | *"mutasi bank itu ga cuman pembayaran sistem aja, dan juga sesuain aja sama data di excel"* |

> ⚠️ **Konsekuensi #21 yang belum diselesaikan** — dicatat, tidak diubah:
> ```
> KIME  spill.by.lily  ratecard Rp500.000 → tercatat Rp750.000 (Rp100.000 + Rp150.000 + Rp500.000)
> KIME  beauty.iidd    ratecard Rp450.000 → tercatat Rp550.000 (Rp100.000 + Rp450.000)
> ```
> Item Rp500.000 dan Rp450.000 itu **bukan hasil impor** — sudah ada sebelum
> 14 Sep 2026 (batch "Batch - September 2026", submitted 16 Sep 16:56 dan
> 16:36). `nominal_pelunasan` di `campaign_creators` tercatat Rp250.000 dan
> Rp100.000 — cocok dengan Excel. Jadi selisih Rp600.000 itu kemungkinan
> berasal dari data lama, **bukan dari impor ini**. Belum diverifikasi, belum
> dikoreksi. Lihat §Risiko di `docs/payment/DEFER.md`.

> ⚠️ **#16 membatalkan rencana lama** di §6 "Deteksi duplikat" dan nomor **#3 di §4A.2**
> masih menyebut `April` → `NULL`. **Koreksi:** `April` → `Aprilia` (keputusan #17).
> Section §6 dan §7 di dokumen ini sudah usang — angka-angkanya dihitung dengan
> aturan dedup yang terbukti salah.

### Konsekuensi keputusan #16 terhadap daftar DEFER (§7)

Jumlah DEFER **tidak berubah** — daftar di §7 sudah benar. Yang berubah adalah
**nominal total dan pengelompokan kategori**:

```
SEBELUM (aturan dedup salah, 795 baris)   : Rp 465.136.562
SESUDAH (826 baris, tanpa dedup)         : Rp 507.736.562
Selisih                                   : Rp  42.600.000  <- 31 pembayaran nyata
```

### Kombinasi #11 + #12

Karena `campaign` ada di dalam label, dua campaign berbeda **wajib** punya batch berbeda.
Ini persis yang dibutuhkan `payment_batches.campaign_id` yang `NOT NULL` dan cuma satu nilai.

```
kunci grouping = (tanggal_pengajuan, PIC, campaign)
label          = 2026-03-15 - PIC: Ahmad - KIME
campaign_id    = <campaign_id dari nama campaign>
```

| Yang mengajuan | Jumlah batch |
|---|---|
| Ahmad 15 Mar, KIME | 1 |
| Budi 15 Mar, SDB | 1 (label beda) |
| Ahmad 16 Mar, KIME | 1 (label beda) |

**`submitted_by` satu per batch** — ini terbukti dari kode, bukan cuma konvensi:
`createPaymentBatch()` (`paymentActions.ts:434`) mengisi `submitted_by` dari
`auth().user.id`. Pemecahan termin mewarisi nilai yang sama (`:1010`).

### ⚠️ Konvensi batch yang SEBENARNYA dipakai sistem (beda dari rencana)

`BatchForm.tsx:37`:
```ts
const [batchLabel, setBatchLabel] = useState(`Batch - ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
```

| Yang ada | Nilainya | Bukan |
|---|---|---|
| `batch_label` | `Batch - September 2026` — **per bulan**, masih bisa diedit user | tanggal |
| `payment_batches.submitted_at` | `NOW()` saat batch dibuat di sistem | tanggal bisnis |
| `payment_items.created_at` | **per item** | satu per batch |

Bukti: 44 item `paid` berlabel sama punya `created_at` **16–25 Sep 2026**. Satu batch,
sembilan tanggal berbeda. Jadi klausa "tiap batch pasti tanggal pengajuan sama"
**tidak berlaku di sistem sekarang** — dan tidak perlu berlaku, karena `created_at`
sudah per item.

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

## 4A. Analisis spreadsheet (scan penuh 1 Okt 2026)

### 4A.1 ⚠️ Layout kolom BERBEDA di tiap sheet — 4 pola

Tidak boleh pakai asumsi posisi kolom. Harus cari **per nama header**.

| Sheet | `TANGGAL PENGAJUAN` | `Tgl Actual Payment` | `Tanggal Pembayaran` | Baris header |
|---|---|---|---|---|
| September 2026 | ✅ kol 2 (terisi) | kol 24 | — **kosong** | 1 |
| Agustus 2026 | ❌ | kol 23 | ✅ | 1 |
| Juli 2026 | ❌ | kol 22 | ✅ | 1 |
| Juni 2026 | ❌ | — | ✅ | 1 |
| Mei 2026 | ❌ | — | ✅ | 1 |
| April 2026 | ❌ | — | ✅ | 1 |
| Maret 2026 | ❌ | — | ✅ | 1 |
| Februari 2026 | ❌ | — | ✅ | **3** |

**Konsekuensi aturan tanggal:** kolom `TANGGAL PENGAJUAN` **hanya ada di September**.
Untuk Februari–Agustus satu-satunya tanggal adalah `Tanggal Pembayaran` — jadi itu yang
dipakai. Persis jaring pengaman aturan "pakai tanggal pengajuan".

**Juga:** `Tgl Actual Payment` ada di Sept/Jul/Agu tapi **tidak selalu terisi**, dan
terdapat data tanggal yang masuk ke kolom yang salah (`Rekening`). Jadi kolom itu
**tidak bisa dipercaya 100%** — jangan dipakai sebagai sumber tunggal.

Februari juga punya baris notes di atas header (`INPUT PAYMENT MAX JAM 15.00`) dan
satu kolom ekstra `Biaya transfer` yang tidak ada di sheet lain.

### 4A.2 Pemetaan PIC → akun sistem

Spreadsheet memakai **NAMA DEPAN SAJA** (`Wahyu`, `Maria`), sedangkan `profiles`
menyimpan nama lengkap. Jadi pencocokan selalu berupa inferensi.

| PIC di spreadsheet | Baris `Paid Off` | Akun |amp; PIC_ID |
|---|---:|---|---|
| Wahyu | 379 | Wahyu Prakoso | `e0706894-ef03-47f9-aa63-f8340816f436` |
| Maria | 181 | Maria Alvita | `8d348a80-d4b3-4b25-a9c3-9be9cfe5d401` |
| Rija | 105 | Irsadur Rija | `626ea2a0-518a-475c-865d-7436e2a0245e` |
| April | 79 | Aprilia | `709825a1-0712-4be7-8560-8f48665fab16` |
| Tiara | 78 | Tiara — `status = inactive` | `7fc3cba9-ad11-49ff-a8ca-8e71ae2e85b3` |
| Jerry | 2 | **Jeremy** | `dc479cf6-48dc-4cb3-a6ab-f9115d4eff2e` |
| Fira | 2 | Fira — `status = inactive` | `0583ae90-0ba2-4594-bdea-59c92b56646e` |
| **Daffa** | **31** | — tidak ada | `NULL` |
| **Natallia** | **30** | — tidak ada | `NULL` |
| **Marini** | **22** | — tidak ada | `NULL` |
| **Riska** | **6** | — tidak ada | `NULL` |
| **David** | **3** | — tidak ada | `NULL` |

Angka = baris `Paid Off` yang akan dimigrasi.

> ⚠️ **Jebakan yang akan merusak data kalau lolos:**
> **`Marini` (22 baris) BUKAN `Maria`.** Keduanya tidak ada di sistem, dan
> fuzzy match akan salah menempelkan `Marini` ke Maria Alvita. Padahal nama berbeda
> dan `Marini` memang orang ketiga.

### 4A.3 🚨 `submitted_by` ditautkan lewat EMAIL, bukan nama

`web-app/src/auth.ts:89` dan `:115`:

```sql
UPDATE profiles SET ... WHERE LOWER(email) = ${email}
SELECT id, nama, email, ... FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
```

Artinya kalimat *"nanti ketika dia login saya sesuaiin namanya agar bisa terkoneksi"*
**hanya jalan kalau email placeholder = email asli orang itu.**

Kalau dibuat akun placeholder dengan email karangan, maka saat dia login:

- `existingProfile` = **NULL** (email beda)
- → sistem **INSERT profil baru** dengan UUID baru
- → **batch lama menunjuk placeholder yang jadi orphan**, tanpa error apa pun

 tautan hilang dan tidak kelihatan. Jadi placeholder dengan email palsu **lebih
berbahaya daripada `submitted_by = NULL`.**

### 4A.4 Keputusan untuk 5 PIC tanpa akun

> "yang 4 orang itu ya tetep tercatat dulu aja namanya bro, jujur sebenernya 4 orang
> itu udh resign dan 4 orang itu emang resign sebelum sistem ini jadi jadi yaa ditulis
> aja biar jelas auditnya ketika keuangan di audit semua ke track"

> "MArini casenya sama kayak david daffa danlainnya, dia udh resign sebelum sistem ada,
> anda cek aja transaksi pertama apa deh di sistem, soalnya sistem pembayaran baru di
> terapkan atau dipake di aplikasi kita ini tuh sekitar minggu ke3 september"

### ✅ Terverifikasi: sistem pembayaran baru dipakai **14 September 2026**

Dari `batch_pertama` di `profiles` (30 akun):

| Nama | Batch pertama | Batch terakhir |
|---|---|---|
| **Irsadur Rija** | **2026-09-14** ← paling awal | 2026-09-28 |
| Wahyu Prakoso | 2026-09-16 | 2026-09-24 |
| Maria Alvita | 2026-09-16 | 2026-10-01 |
| Shabrina puspa | 2026-09-16 | 2026-09-16 |
| Aprilia | 2026-09-17 | 2026-09-17 |
| Jeremy | 2026-09-17 | 2026-09-17 |

Semua 66 batch dibuat **14–28 Sep 2026**. Jadi **minggu ke-3 September** — sesuai
katamu, dan sekarang bukan lagi dugaan.

**Artinya semua baris payment Feb–Agustus 2026 berada sebelum sistem ada** — tidak ada
satupun yang mungkin sudah tercatat di `payment_items`. Tidak ada risiko duplikat dari
periode itu.

### PIC tanpa akun — semua 5 sudah resign

| PIC | Baris `Paid Off` | Bulan | Status |
|---|---:|---|---|
| Daffa | 31 | Jun, Mei, Jul | 🔴 **Resign** sebelum sistem ada |
| Natallia | 30 | Feb, Mar, Apr, Mei | 🔴 **Resign** |
| Marini | 22 | Jun, Mei | 🔴 **Resign** |
| Riska | 6 | Feb, Mar, Apr, Jun | 🔴 **Resign** |
| David | 3 | Jul | 🔴 **Resign** |

**Keputusan: `submitted_by = NULL` + nama tetap ditulis di `batch_label`
(`2026-03-15 - PIC: Daffa - MSGLOWFORMEN`) dan di `notes` batch.**
Alasan user: audit keuangan butuh semua tercatat, dan nama yang hilang itu
justru yang paling sulit ditelusuri saat diaudit.

**Semua 92 baris `Paid Off`** — tidak ada yang `Not Yet`/`Cancel`, jadi tidak ada
yang hilang dari keputusan ini.

### 4A.6 Logika buat-kreator: sudah ada di kode, tapi TIDAK dipakai

`paymentActions.ts:729` — `resolveCreatorForMigration()` sudah mengimplementasikan logika yang
sama persis dengan yang kamu maksud:

```ts
// 1. Cari creator (case-insensitive)
SELECT id FROM creators WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1
// tidak ada → INSERT INTO creators (username, nama_asli, status) VALUES (..., 'active')

// 2. Cari di campaign
SELECT id FROM campaign_creators WHERE campaign_id = ${campaignId} AND creator_id = ${creatorId}
// tidak ada → INSERT INTO campaign_creators (..., 'approved', 'Nano', ratecard_awal || nominal, ...)
//             dengan notes = 'Di-import otomatis via Migrasi'
```

 bandingkan dengan `syncUnmapped.ts:119` (auto-assign dari TikTok) — **hampir identik**:

| | `syncUnmapped` | `resolveCreatorForMigration` |
|---|---|---|
| Cari creator | ✅ `LOWER(username)` | ✅ `LOWER(username)` |
| Bikin profil | ✅ `added_by='system'` | ✅ `status='active'` |
| Bikin `campaign_creators` | ✅ | ✅ |
| `approval` | `'pending'` | `'approved'` |
| `price` | `0` | `ratecard_awal \|\| nominal` |

Untuk migrasi historis, `approval='approved'` + `price` dari ratecard itu benar —
uang sudah keluar, jadi kreator memang sudah disetujui di campaign itu.

### ✅ KEPUTUSAN: tulis ulang di SQL migration (opsi C)

Pertanyaan awalnya "pakai fungsi yang sudah ada atau tulis ulang". Jawabannya: **tulis
ulang di SQL migration.** Alasannya:

1. `resolveCreatorForMigration` **tidak mengisi bukti transfer** sama sekali — itu
   kolom di `payment_batches`, dan fungsi itu tidak menyentuh batch
2. **PIC di fungsi itu pakai `ILIKE '%nama%'`** (`paymentActions.ts:739`) — bom waktu
   untuk `Marini` vs `Maria`. Plus `LIMIT 1` tanpa `ORDER BY`, jadi hasilnya tidak
   ditentukan kalau dua yang cocok
3. Kita sudah memutuskan hapus `importHistoricalBatch`, jadi mempertahankan file itu
   hanya demi satu fungsi terasa awkward

Logikanya akan ditulis **di dalam SQL migration** dengan pola yang sama persis
(`LOWER(username)` → insert kalau tidak ada → `campaign_creators` kalau belum ada),
tapi memakai **peta UUID PIC eksplisit** dari §4A.2. Nol perubahan kode produksi.

### Kolom yang akan diisi

| Kolom | Sumber di spreadsheet | Kartu |
|---|---|---|
| `payment_items.nik` | `NIK` | ✅ wajib |
| `payment_items.alamat_ktp` | `Alamat sesuai KTP` | ✅ |
| `payment_items.link_ktp` | `Link Drive KTP` | ✅ |
| `payment_items.link_kontrak` | `Kontrak` | ✅ |
| `payment_items.nomor_rekening` | `Nomor Rekening/ VA` | ✅ |
| `payment_items.nama_penerima` | `Nama Penerima Bank` | ✅ |
| `payment_items.biaya_transfer` | `Biaya transfer` (Februari saja) | ✅ |
| `payment_batches.bukti_transfer_url` | `Link Bukti TF` | ✅ |
| `payment_batches.actual_payment_date` | `Tgl Actual Payment` | ✅ |
| `creators.nama_asli` | `Nama Penerima Bank` | ✅ |

⚠️ **`Link Bukti TF` di spreadsheet tampaknya dipakai ulang di banyak banyak baris** —
scan September menunjukkan link Google Drive yang sama (`1eNwB9HI3gXvY8bag_Au-Tx1Zrm-lCeee`)
untuk banyak baris berbeda. Kalau begitu itu **link folder, bukan bukti per transaksi.**
Perlu dikonfirmasi sebelum dipakai — probative yang salah lebih berbahaya daripada kosong.

### 4A.5 Baris operasional punya kolom yang tidak rapi

Baris dengan `Campaign` berisi `Top up` / `Sampel` **tidak punya kreator** dan
kolomnya tidak sejajar dengan baris kreator. Contoh nyata:

```
Top up ADS | BCA 8832578478 | 15.000.000 | PT Akselerasi Realitas Bisnis ADS | PIC: April | Paid Off | Note: "19 Juni - Ads OMG Makeup"
```

**Campaign sebenarnya ada di kolom `Note`**, bukan di kolom `Campaign` (yang isinya
`Top up ADS`). Ini berarti sebagian baris §7 yang dianggap DEFER **sebenarnya punya
campaign yang bisa dipulihkan dari Note** — perlu dicek satu-satu.

Baris lain yang perlu perhatian:

- `Sampel Kime | SAMPLE KIME | ... | David Sukanto | David David | Paid Off`
  → kolom PIC berisi `David David` (nama dobel di satu sel)
- `TOP UP LION | ... | LION | Fira | Paid Off` dan `TOP UP QONTAK | ... | CRM | David | Paid Off`
  → nama orang mencampur dengan label (`LION`, `CRM`)
- `situkangoutdoor` muncul **dua kali** dengan nominal sama (75.000), PIC sama (Daffa),
  tapi `Status` berbeda: `50% AWAL` di satu baris dan `50% AKHIR` di baris lain.
  Kemungkinan duplikat — harus dicek di dry-run, jangan langsung migrasi.

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
melainkan "outright tidak bisa jalan"** — jadi tidak akan pernah dipakai.

**Keputusan: hapus fungsi ini.** Migrasi akan murni SQL migration file, sesuai
aturan repo. Tidak ada risiko mundur karena jalur ini sudah mati.

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

### 🚨 Baris SUBTOTAL di dalam spreadsheet

Kolom `Tanggal Pembayaran` memuat baris seperti `TOTAL 16882900` dan
`TOTAL 12132000`. **Harus difilter sebelum migrasi** — kalau tidak, Rp 29 juta
fiktif masuk sistem sebagai pembayaran.

### 🚨 Status bentrok di spreadsheet

`MSGLOWFORMEN / situkangoutdoor / 75.000 / Daffa` muncul dua kali dengan tanggal
berbeda, `Status` berbeda (`50% AWAL` vs `50% AKHIR`), dan **file KTP-nya sama**.
Kemungkinan besar salah satu duplikat pengajuan — tapi **jangan diasumsikan**,
cocokkan lewat `nomor_rekening + nama_penerima + NIK` di dry-run.

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

## 7. Yang di-DEFER - **17 baris / Rp 118.460.000** *(diperbarui 3 Okt 2026)*

> ⚠️ **Bagian ini sudah usang sebagian.** Angka aslinya 18 baris / Rp 128.460.000.
> Pada **3 Okt 2026** `Sampel Kime` (1 baris / Rp 10.000.000) diputuskan
> **dimasukkan** ke campaign 44 KIME (keputusan #22), jadi sisanya **17 baris /
> Rp 118.460.000**. Rincian per baris yang bisa dipakai: **`docs/payment/DEFER.md`**.

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

### 7.3 SAMPEL KIME - 1 baris, Rp 10.000.000 **→ SUDAH DIMASUKKAN 3 Okt 2026**

> Keputusan #22: *"gapapa masukin asal ada nama campaignnya jelas bro"*.
> Dipetakan ke campaign **44 KIME** sesuai keputusan #5. Batch
> `2026-07-31 - PIC: David - KIME`, item Rp 10.000.000 ke `David Sukanto`
> (BCA 5295174126), `campaign_creator_id` NULL karena username di spreadsheet
> cuma label `sample kime`, bukan akun TikTok.

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
| 0 | ~~Parse spreadsheet & verifikasi scope~~ | ✅ **SELESAI** — 840 `Paid Off`, 86 di-note. Lihat §1 & §4A |
| 0b | ~~Verifikasi PIC terhadap `profiles`~~ | ✅ **SELESAI** — 12 PIC, 5 tanpa akun. Lihat §4A.2 |
| 1 | **Dry run read-only:** cocokkan 840 baris ke `campaign_creators`, hitung match rate, deteksi duplikat (terutama `situkangoutdoor` & baris operasional). **Tidak menulis apa pun** | ⬜ |
| 2 | Tambah `100_awal` + `boost_awareness` ke CHECK (aditif) | ⬜ |
| 3 | Migrasi **pilot 1 bulan** (pilih yang paling bersih, mis. Mei = 141 baris, 0 `Not Yet`), backup + guard berlapis | ⬜ |
| 4 | Verifikasi pilot di UI bareng user, baru lanjut 7 bulan sisanya | ⬜ |
| 5 | Laporan dampak ke `vw_campaign_budget_summary` (read-only) | ⬜ |
| 6 | `100% Awal` (22 baris / Rp 24.250.000) setelah fase 4 bersih | ⬜ |
| 7 | Unique index kunci `nominal + tanggal` | ⬜ |
| 8 | Hapus `importHistoricalBatch` | ⬜ |

### ⏳ Yang MASIH perlu keputusan user

Tidak ada yang belum diputuskan soal **struktur** — grouping, label, tanggal, scope,
dan PIC semuanya sudah terkunci (§3). Yang tersisa:

1. **`David` (3 baris `Paid Off`)** — tidak masuk daftar 4 orang yang resign. Siapa?
   Untuk sekarang diperlakukan sama: `submitted_by = NULL`, nama di label.
2. **Baris operasional §7** (METOO, TOP UP QONTAK/LION, SAMPEL KIME, MCN) —
   masih DEFER sesuai keputusanmu. Tapi §4A.5 menunjukkan sebagian campaign bisa
   dipulihkan dari kolom `Note`, jadi DEFER-nya mungkin bisa diperkecil.
3. **Kapan mulai eksekusi.** Semua fase di atas masih ⬜ dan tidak ada yang dijalankan
   tanpa persetujuan eksplisit.

### Guardrail

1. **Jangan pakai `importHistoricalBatch`** — sudah pasti crash, dan akan dihapus.
2. **Migration file baru** di `web-app/supabase/migrations/` timestamp monotonic.
   Jangan edit `schema.ts`.
3. **Satu transaksi per batch.** Loop tanpa transaksi = batch setengah jadi.
4. **Idempotent.** Gagal di tengah lalu dijalankan ulang tidak boleh menambah dobel.
5. **Hanya menulis**, tidak pernah overwrite data yang sudah ada.
6. **Jalankan dry run lebih dulu** — migrasi harus bisa diulang tanpa menulis.
7. **Backup sebelum menulis**, dan jangan di-drop sampai user yakin.
8. **Filter baris `TOTAL` dari spreadsheet** sebelum migrasi (§4A.5).
9. **Jangan fuzzy-match nama PIC.** `Marini` ≠ `Maria`. Pakai peta eksplisit di §4A.2.

---

## 9. Campaign: status pemetaan (per 2 Okt 2026, setelah parse penuh)

**Peta ini BELUM final.** Tabel `payment_import_map_campaign` sengaja dibiarkan
kosong sampai owner mengonfirmasi. Sumber kandidat:
`docs/sql/66-petakan-campaign.sql` dan view `v_payment_campaign_candidates`.

### Sudah pasti (nama di sheet cocok persis / selisih ketik jelas)

| Nama di spreadsheet | `campaign_id` | Nama di DB | Baris |
|---|---|---|---:|
| PWS | 38 | PWS | 61 |
| DIOLY | 40 | DIOLY | 54 |
| SKINMOLOGY | 43 | SKINMOLOGY | 12 |
| WARDAH | 37 | WARDAH | 11 |
| GLOWIES | 51 | GLOWIES | 19 |
| ISWHITE | 47 | ISWHITE | 23 |
| SYB | 46 | SYB | 19 |
| QAHIRA | 45 | QAHIRA | 36 |
| OMG Makeup | 33 | OMG Makeup | 45 |
| OMG Skincare | 34 | OMG Skincare | 31 |
| NAISDAY | 39 | NAISDAY | 34 |
| Nutriflakes | 49 | NUTRIFLAKES | 28 |
| MILKYBOOST | 52 | MILKYBOOST | 1 |

### Selisih ketik / kapitalisasi — kandidat kuat, **tapi belum dikonfirmasi owner**

| Nama di spreadsheet | Kandidat | Nama di DB | Baris | Catatan |
|---|---|---|---:|---|
| KIMME | 44 | KIME | **325** | `KIMME` bukan `KIME`; baris terbanyak, harus pasti benar sebelum dipakai |
| MSGLOWBEAUTY | 41 | MS Glow Beauty | 32 | |
| MSGLOWFORMEN | 42 | MS Glow For Men | 14 | |
| SALSA COSMETICS | 35 | SALSA Cosmetic | 37 | jamak vs tunggal |
| **Votre Peu** | 53 | **VOTRE PEAU** | 2 | ⚠️ **koreksi §9 lama:** yang terbalik. `docs/sql/42` + `payment_batches` **membuktikan nama DB campaign 53 adalah `VOTRE PEAU`**, dan sheet menulis `Votre Peu`. Bukan sebaliknya. |

### ⚠️ Belum ada padanan / belum diputuskan — destined DEFER

| Nama di spreadsheet | Baris | Nominal | Status |
|---|---:|---:|---|
| `METOO` | 4 | Rp 89.500.000 | Tidak ada di `campaigns` yang Known. Receiver asli: `jesselinjess`, `sindi9rande`, `yusmankusumaa`, `lauratheux` (nama bank `PT Potluck Studio Indonesia`). Perlu cek `SELECT nama FROM campaigns WHERE ...` |
| `TOP UP QONTAK` | 3 | Rp 12.210.000 | Campaign tidak dicatat di sheet (keputusan #6 belum final) |
| `TOP UP LION` | 3 | Rp 9.000.000 | Sama. Kandidat: 58 `LION PARCEL`? **Belum dikonfirmasi** |
| `Sampel Kime` | 1 | Rp 10.000.000 | Keputusan #5 → kandidat 44 KIME, **menunggu konfirmasi finance** |
| `SALSA Baby Care` | 24 | Rp 22.450.000 | ⚠️ Kandidat 36 `SALSA Mom & Baby` — **TIDAK terbukti**. Dua brand "SALSA", jangan diasumsikan |
| `MCN`, `MCN Zoicy`, `MCN CLOGENT`, `Referal MCN` | 6 | Rp 7.700.000 | MCN/agen, tidak punya campaign sendiri |
| `BOA` | 1 | Rp 50.000 | `note` = "dibayar dari brand" → bukan expenses TNT |

**Rekap 826 baris / Rp 507.736.562:**

```
kreator         769 baris   Rp 301.301.562
ads              51 baris   Rp 180.775.000   <- kolom Status = 'ADS'
lion              3 baris   Rp   9.000.000   <- kolom Status = 'LION'
crm               2 baris   Rp   6.660.000   <- kolom Status = 'CRM'
operasional_lain  1 baris   Rp  10.000.000   <- Sampel Kime
```

**Status "siap" versi lama (822 baris / Rp 383.776.562) sudah usang** — dihitung
dengan aturan dedup yang terbukti menghapus Rp 42.600.000 pembayaran sah.
Jangan dipakai sebagai angka acuan. Lihat keputusan #16.
