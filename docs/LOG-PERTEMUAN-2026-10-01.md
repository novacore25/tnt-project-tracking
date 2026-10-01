# Log Pertemuan 30 Sep – 1 Okt 2026

> **Dokumen ini adalah sumber kebenaran untuk sesi kerja 30 Sep – 1 Okt 2026.**
> Berisi masalah, diagnosis, solusi, keputusan, dan angka sebelum/sesudah.
> Ditulis ulang dari export sesi `ses_f0ff79fb6ffdqLCa58H6si9YXS` (2.371 pesan).
>
> Untuk jebakan teknis yang bisa dipakai kapan saja, lihat `.opencode/skill/tnt-project/SKILL.md`.
> Untuk rencana migrasi payment yang masih jalan, lihat `docs/KEPUTUSAN-PEMBAYARAN.md`.

---

## 1. Aturan main yang ditetapkan user

Sesi ini berjalan di bawah 3 aturan yang tidak bisa ditawar. Semua keputusan
di bawah hanya sah karena aturan ini ada.

| # | Aturan | Asal |
|---|---|---|
| 1 | **Data harus seakurat mungkin dan tidak boleh ada yang hilang** | "pokoknya datanya harus seakurat mungkin lah dan gada data yang hilang" |
| 2 | **Kalau data PIC tidak lengkap/error, jangan masukkan** — tandai supaya bisa dilengkapi | "kalo data yang diisi oleh pic ga lengkap atau error yaa jangan di masukin sekaligus" |
| 3 | **Cegah duplikat pakai upsert, jangan replace** — replace menghapus data yang tidak lengkap | "cegah duplikatnya pake upsert aja biar keupdate aja bukan menggantikan takutnya datanya ga lengkap kan" |

Aturan 3 penting karena meal-nya: user lebih-eq prioritise data yang ada tapi
tidak lengkap daripada data yang bersih tapi hilang. Compilasi mana yang salah
lebih sulit daripada mengisinya ulang.

---

## 2. Timeline

### 30 Sep 2026 — audit mendalam

**Permintaan awal:** audit struktur kode, flow kerja, hubungan antar sistem,
celah bahaya, rekomendasi solusi tanpa merusak flow user.

**Hasil:** lahir `.opencode/skill/tnt-project/SKILL.md` dan
`docs/audit/2026-09-30-AUDIT.md`.

**Temuan yang langsung beraksi:**
- Database `sales_novacore_system` **bukan** milik aplikasi ini — itu aplikasi
  CRM untuk tim sales. Dua database berbeda, jangan dicampur.
- Auto-sync punya 7.035 baris kembaran dengan impor Excel.
- Filter `is_refund = false` di view menahan GMV **Rp 310 juta palsu**.
- `whitelisted_emails` ternyata bukan whitelist — login = siapa pun dengan akun
  Google, dan email mengandung "admin"/"executive" otomatis dapat role executive.
- `profiles.status` tidak pernah dibaca untuk menolak akses.

**Keputusan:** skrip 06 + 07 dijalankan berurutan. `docs/sql/06` menghapus
kembaran, `docs/sql/07` melepas filter refund dari view. Ada guard
`RAISE EXCEPTION` di keduanya dalam satu transaksi.

### 30 Sep — TikTok sync & import Excel

| Masalah | Solusi | Keputusan user |
|---|---|---|
| Auth rate limit TikTok | Retry + jeda; link gagal bisa disalin lalu dipaste ulang | 500 link sekaligus boleh; yang gagal harus bisa dicopy |
| Import batch awareness gagal: `The "string" argument must be of type string` | Perbaikan tipe tanggal di server action | Diterima, deploy ulang |
| Auth secret lama bocor di source | Rotasi secret | User: "kenapa harus buat auth secret baru? gausah" → tetap diganti setelah jelas Dampaknya |
| Partial approve dalam satu batch | Alur partial approval | "pokoknya udah sesuai flow yang ada kan yaa" |

### 30 Sep — import kreator

Alur yang diminta: **validasi data kreator sebelum masuk sistem.**

| Fitur | Status |
|---|---|
| Baris kreator tidak lengkap → tandai "Kreator Belum Lengkap" | Selesai |
| Tombol "Muat Kreator dari Database" | Selesai — user minta langsung supaya bisa disuruh PIC coba |
| Tombol "Tarik ke Campaign" | Selesai — cara kedua ambil kreator untuk listing |

**Keputusan user soal role:**
- Staff biasanya yang mengajukan payment.
- Hanya executive yang approve (executive = bos / role tertinggi).
- **Staff boleh mengubah plafon**, tapi jarang — biasanya manager atau executive.

### 30 Sep — TikTok app secret

User menambahkan TikTok app secret sendiri, sudah di-deploy. Sepakat dipakai apa adanya.

### 1 Okt — Akurasi data profil kreator & video

**Permintaan atasan (via user):** data performa di profil kreator tidak muncul,
dan menu video harus akurat untuk affiliate order + custom report.

#### Aturan GMV (keputusan user, foundational)

> "iya kalo gmv itu cukup liat dari order id aja jika order id tersebut content
> tipenya live ya masuk ke gmv live, jika video maka masuk ke video, soalnya
> custom report itu bukan untuk menghitung sales tapi hanya awarenessnya aja dan
> untuk menghitung videonya aja, bisa jadi ada video yang gapernah ada order maka
> itu gunanya custom report"

R ангunutannya:

| Sumber | Untuk apa | Bukan untuk apa |
|---|---|---|
| `sales` (via `order_id`) | **Total GMV** — satu-satunya sumber | — |
| `content_type` | Memecah GMV jadi live vs video | — |
| Custom report | Awareness + hitung video | **Bukan sales** |
| `ads_performance` | Ditampilkan terpisah (`total_ads_gmv`) | **Jangan dijumlahkan ke total** |

Dan soal pemetaan:

> "iya semua tuh berdasarkan product id, sku id ga terlalu penting sebenernya broo
> seperti yang anda tahu setup produk di menu produk tiap campaign itu adalah
> product id yang didapat dari tiktok sesuai campaignnya, cuman yaa gitu di kode
> masih namanya sku id"

#### Enam masalah yang ditemukan & diselesaikan

**1. `pg` mengembalikan `bigint`/`numeric` sebagai STRING**

`0 + "123"` = `"0123"`. Gejalanya di UI: angka ribuan digit diawali `0`
(`Rp 0319...`). Terjadi di **12 tempat**, termasuk halaman keuangan.
→ Perbaikan: helper `toNum`/`sumNum` di `web-app/src/utils/computed.ts`, semua
penjumlahan rupiah wajib memakainya.

**2. Cross-join tag produk palsu di `organic_videos`**

362 video ter-tag dengan 21–70 produk. Tvariasinya cross-join, bukan tag asli.

| Angka | Nilai |
|---|---|
| Video dengan >20 `product_id` | 362 |
| Baris yang akan dihapus | **10.851** |
| Video yang bisa di-resolve ke 1 campaign | 329 (dari 362) |
| Video **tidak disentuh** (aman tapi tanpa bukti) | 33 |

Migration `20261001150000`. Verifikasi: 0 video hilang, views/likes per video
tidak berubah (37.590.000 / 19.186.921), 39.197 video sebelum dan sesudah.

**3. Total GMV view salah total 13,6x**

`vw_campaign_summary` menjumlahkan `sales` + `ads_performance` + custom report.

```
SEBELUM  Rp 12.571.853.594
SESUDAH  Rp    920.211.710
         video 865.468.962 | live 54.742.748
```

Migration `20261001200000`. Guard membatalkan kalau total per campaign ≠
`SUM(sales.gmv)`.

**4. `ads_performance` kumulatif per ad — `SUM` salah**

Data naik monoton per ad, jadi harus `MAX` per ad, bukan `SUM`.
→ 5 campaign tidak lagi salah "over budget".

**5. 951 order hilang dari `sales`**

Ditemukan dari `sales_aman_backup_20260930` dan `sales_excel_backup_20260930`.

```
32.320 order  →  34.171 order
Rp 1.110.174.161  +  Rp 34.257.539  =  Rp 1.144.431.700  (cocok persis)
```

Migration `20261001210000`.

**6. 582 pasangan kreator dobel karena kapitalisasi**

`creators.username` UNIQUE tapi **case-sensitive**. `Wulandari10_0` dan
`wulandari10_0` = 2 baris.

| Kelas | Pasangan | Bukti | Aksi |
|---|---|---|---|
| **A** — beda kapital saja | 582 | — | Gabung |
| **B** — beda tanda baca | 385 | 3 video/campaign bersama | Gabung |
| **C** — beda tanda baca | 349 | **0 bukti** | **Sengaja tidak digabung** |

Migration `20261001220000` — **gagal 10 kali** sebelum berhasil.

| Percobaan | Yang menempel |
|---|---|
| 1–3 | `videos` tidak punya index → scan 28.406 baris |
| 4 | `WITH` ilegal di cabang `UNION ALL` kedua |
| 5–6 | Rantai merge perlu re-anchoring |
| 7 | `UPDATE` berurutan membuat bentrok yang belum ada sebelumnya |
| 8 | `creator_niches` PK `(creator_id, niche_id)` |
| 9 | `ON CONFLICT DO UPDATE` tidak bisa menyentuh baris sama dua kali → butuh `DISTINCT ON` |
| 10 | Satu parent → banyak child butuh peta `_root` satu-baris-per-parent |

Hasil: **619 pasangan merged**, 16.927 → 16.308 kreator,
`UNIQUE INDEX ON creators(LOWER(username))` dibuat, duplikat
`campaign_creators` (campaign, username) = **0**.

Bonus: `videos` diberi index (`20261001215000`) — `content_uid`,
`campaign_creator_id`, dan pasangan gabungan.

**7. `kurs` rusak di 314 baris**

`ads_performance.kurs` tersimpan `17.313` (bukan `17313`) di 314 dari 1.130 baris
→ revenue baris itu **1000x terlalu kecil**.

Penyebab: `importActions.ts:475` punya heuristics `if (kurs < 1000) kurs *= 1000`
yang benar, TAPI `campaignPageActions.ts:234` melakukan
`UPDATE ads_performance SET kurs = $kurs` **tanpa guard** — itulah yang menulis
nilai rusak.

> **Koreksi user atas asumsi saya:** "sebenernya kurs emng beda beda sih broo
> soalnya kurs suka naik turun". 816 baris `kurs = 18000` itu **sah, bukan default**.
> Saya sempat salah menganggapnya placeholder.

Migration `20261001230000`:

| Aksi | Jumlah |
|---|---|
| `kurs = 1000` diset 0 (data korup: 1052 pembelian tanpa satu klik) | 1 |
| `kurs` satu-titik dikali 1000 | 313 |
| Kurs 16.993–18.045 | Guard memastikan semua nilai realistis |

```
total_gmv          920.211.710  (TIDAK BERUBAH - ini dijanjikan)
total_ads_spend    110.655.058  →  173.207.991
```

Budget setelah koreksi — **tidak ada campaign baru jadi over**:

| Campaign | Biaya | Plafon | Status |
|---|---|---|---|
| OMG Makeup | 37.727.651 | 60.000.000 | dalam budget |
| SYB | 22.245.158 | 40.000.000 | dalam budget |
| SALSA Cosmetic | 31.616.162 | 35.000.000 | dalam budget ← **pulih** |
| QAHIRA | 21.224.520 | 30.000.000 | dalam budget |
| OMG Skincare | 26.997.662 | 27.320.000 | dalam budget |
| WARDAH | 4.157.795 | 10.000.000 | dalam budget |
| SALSA Mom & Baby | 18.362.866 | 15.000.000 | OVER ← **sudah over sebelum koreksi** |

**Laporan untuk tim Ads:** 12 baris korup, semua campaign 35 (SALSA Cosmetic),
semua 30 Mar 2026 — `clicks = 0` tapi `purchases` 58–205. Revenue ada tapi nol
lalu lintas. Harus diperbaiki dari ekspor TikTok asli.

---

## 3. Yang BELUM selesai, dan siapa-Amilnya

| # | Item | Nilai | Pemilik | Kenapa belum |
|---|---|---|---|---|
| 1 | **91 `product_id` belum didaftarkan** | Rp 224.219.990 · 4.436 order · 38 `tiktok_campaign_id` | **User** | Butuh registering produk di menu Produk per campaign. Setelah itu `syncUnmappedForProduct` mengisi `campaign_id` di sync berikutnya — **tidak perlu migration** |
| 2 | 12 baris ads korup | 30 Mar 2026, campaign 35 | **Tim Ads** | Harus diperbaiki dari ekspor TikTok asli |
| 3 | 18 baris payment DEFER | Rp 128.460.000 | **User + Finance** | Menunggu konfirmasi. Daftar di `docs/KEPUTUSAN-PEMBAYARAN.md` |
| 4 | 87 baris dobel di `videos` | kecil | Saya | Sudah ada index, tinggal dibersihkan |
| 5 | 3.529 video `likes > views` | belum diselidiki | Saya | Kemungkinan kolom tertukar — **belum diverifikasi** |
| 6 | 816 baris `kurs = 18000` | sah, tidak diubah | — | Keputusan user: kurs harian memang berbeda-beda |
| 7 | Backup table di produksi | 9 tabel | Saya | purposefully disimpan untuk rollback |
| 8 | `requireRole` untuk approval payment | 23 fungsi | **Ditunda user** | "belum gapapa masih stabil kok dan gada yang melanggar aturan dan kalo mereka approve sendiri juga ketauan namanya biar kita liat aja siapa yang melanggar aturan" — **sengaja ditunda untuk observasi** |
| 9 | Migrasi payment 840 baris | Rp 512.236.562 | **Ditunda user** | "nanti dulu deh broo" — menunggu permintaan atasan |

---

## 4. Backup table ( purposefully tidak di-drop )

Dipakai untuk rollback. Hapus hanya setelah user yakin.

```
_backup_creators_20261001              _backup_ads_performance_20261001
_backup_campaign_creators_20261001     sales_aman_backup_20260930
_backup_videos_20261001                sales_bk_20260930b
_backup_organic_videos_20261001        sales_excel_backup_20260930
_backup_view_vw_campaign_summary_20261001
```

---

## 5. Cara kerja yang terbukti ( bukan opinion )

Sesi ini: **10 migration gagal** sebelum berhasil, dan **1 gagal lagi** karena
saya salah ketik (`DECLAREomina` — spasi hilang saat edit, rollback, nol data
berubah).

Yang membuat aman **bukan** migration-nya, tapi:

1. **Guard berlapis dalam satu transaksi** — `RAISE EXCEPTION` kalau angka tidak
   sesuai harapan, PostgreSQL membatalkan semuanya.
2. **Backup yang tidak di-drop** — selalu bisa rollback.
3. **Urutan wajib:** read-only query → baca angka → preflight constraint → baru tulis.

Asumsi saya salah **6 kali** sebelum migration pertama jalan. Semuanya tertangkap
karena read-only query dijalankan lebih dulu. Daftar asumsi salah ada di
`SKILL.md` §3.45.

Pelajaran tambahan dari sesi ini:

> **Output terminal yang terpotong menghasilkan kesimpulan salah.**
> Daftar kolom `payment_items` di `docs/sql/42` tertimpa. Suatu kali output psql
> terpotong di tengah daftar, dan kesimpulan "kolom ini tidak ada" ditulis dari
> daftar yang tidak lengkap. Setelah dicek ulang per kolom satu-satu, kolomnya
> **ada**.
> Sekarang setiap kolom yang dicurigai dicek dengan EXISTS per kolom, satu-satu,
> bukan disimpulkan dari daftar.

---

## 6. Cara mengirim SQL ke VPS

```bash
# WAJIB commit SHA, bukan "main" — cache mengabaikan query string di path "main"
curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/<file>.sql" \
  | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
```

| Parameter | Nilai |
|---|---|
| Container DB | `6ve3f9zqfkypblr0f0cea4jm` |
| Database | `db_tnt_project_system` |
| User | `postgres` |
| Repo | `novacore25/tnt-project-tracking` |
| Remote | `root@srv1987378` (168.231.118.146) |
| URL app | `https://campaign.tntkreatif.com` |

Verifikasi file yang benar-benar ter-cache:

```bash
curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/<file>.sql" \
  | grep -c "penanda-unik"     # harus > 0
```
