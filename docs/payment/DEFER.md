# Payment historis yang TIDAK masuk sistem — 17 baris / Rp 118.460.000

Status: **DEFER, disengaja.** Semua baris ini ada di `payment_import_staging`
dengan `status_import = 'defer'`, lengkap dengan tanggal, nominal, nama
penerima, dan rekening. Tidak ada yang hilang.

Keputusan owner **3 Oktober 2026**: *"atasannya pengen balance aja semua data
pembayaran dan akurat untuk campaign campaign yang saat ini ada di sistem."*

Prinsipnya: ** kalau nama campaign-nya tidak ada di `campaigns`, jangan dipaksa
masuk.** Memaksakan berarti bikin rekap per campaign berisi angka yang tidak
punya campaign sungguhan.

---

## 1. `METOO` — 4 baris / Rp 89.500.000 (70% dari total defer)

PIC **Natallia** (tidak punya akun → `submitted_by` NULL).

| Tanggal | Username | Penerima | Rekening | Nominal | Bukti TF |
|---|---|---|---|---:|---|
| 2026-03-13 | `jesselinjess` | Jesselin | 5271774568 | 19.500.000 | ada |
| 2026-03-13 | `sindi9rande` | Sindi Komalasari | 4140584156 | 12.000.000 | ada |
| 2026-03-13 | `yusmankusumaa` | usman saepul kusuma | 4372978540 | 16.000.000 | ada |
| 2026-03-27 | `lauratheux` | **PT Potluck Studio Indonesia** | 5491549549 | **42.000.000** | ada |

**Catatan:**
- Username bukan placeholder —前三 adalah akun TikTok orang sungguhan.
- `lauratheux` tercatat atas nama **PT Potluck Studio Indonesia** → ini
  perusahaan, kemungkinan MCN/agency.
- **Keempatnya punya bukti transfer.** Uangnya keluar; yang tidak ada hanya
  campaign-nya.
- Cara bayar semuanya BCA, langsung ke rekening pribadi.

> ⚠️ **Risiko kalau campaign `METOO` ternyata pernah aktif:** Rp 89.500.000
> (= 15% dari semua pembayaran KIME + selebihnya) tidak muncul di rekap manapun.
> Worth ditanyakan ke PIC Natallia: METOO itu campaign apa, dan kenapa tidak
> ada di sistem?

## 2. `TOP UP LION` — 3 baris / Rp 9.000.000

Satu rekening **Virtual Account** `22188593043711741493752` untuk ketiga baris.

| Tanggal | Nominal | PIC | Metode | Bukti TF |
|---|---:|---|---|---|
| 2026-07-21 | 2.000.000 | Fira | BCA | kosong |
| 2026-07-31 | 2.000.000 | David | VA BCA | kosong |
| 2026-08-12 | 5.000.000 | Fira | BCA | kosong |

`nama_penerima` kosong di ketiga baris.

> ⚠️ **Tidak ada bukti transfer sama sekali.** Kalau memang sudah dibayar,
> catatan ini tidak bisa diverifikasi apa pun.

## 3. `TOP UP QONTAK` — 3 baris / Rp 12.210.000

Rekening VA `3816513341175112` dan `3816513341092926`.

| Tanggal | Nominal | PIC | Metode | Bukti TF |
|---|---:|---|---|---|
| 2026-07-21 | 2.220.000 | David | BCA | kosong |
| 2026-07-28 | 5.550.000 | Tiara | VA BCA | kosong |
| 2026-08-12 | 4.440.000 | April | BCA | kosong |

`nama_penerima` kosong di ketiga baris. Kolom `Status` di baris 28 Jul kosong
(bukan `CRM` seperti dua lainnya).

## 4. MCN-related — 5 baris / Rp 7.700.000 — semua PIC **Riska**

| Campaign di sheet | Tanggal | Username | Penerima | Rekening | Nominal |
|---|---|---|---|---|---:|
| `MCN CLOGENT` | 2026-06-09 | `mei_arifin180899` | Meilani | 5425094961 | 4.500.000 |
| `MCN Zoicy` | 2026-03-05 | `nonazawa` | Evi Oktaria | 4591203287 | 2.200.000 |
| `MCN` | 2026-04-21 | `lilmoon (ammiay)` | Rasmi | 2023405510 | 700.000 |
| `Referal MCN` | 2026-02-27 | `bemyung` | Muhammad Andika Wilianto | 3901081803936748 | 100.000 |
| `Referal MCN` | 2026-02-27 | `tazkiafauza` | Fauza Tazkia Nurfadilah | 901256793980 | 100.000 |
| `Referal MCN` | 2026-03-17 | `itssmeesalll` | SALMA WANDA HANIFAH | 1780010587133 | 100.000 |

`MCN` dan `Referal MCN` adalah label jenis kerja (referral ke MCN), bukan nama
campaign. Username-nya username TikTok sungguhan — jadi MCN ini kemungkinan
program, bukan campaign brand.

## 5. `BOA` — 1 baris / Rp 50.000

2026-02-04 · `aboutpipita` · Fitria febriharlia · 3901085975123457 · DANA

**Note di spreadsheet: "dibayar dari brand"** → ini bukan expenses TNT.
**Tidak boleh masuk sistem, bahkan kalau nanti ada campaign `BOA`.**

---

## Total tertahan

```
METOO           4 baris   Rp  89.500.000
TOP UP QONTAK   3 baris   Rp  12.210.000
TOP UP LION     3 baris   Rp   9.000.000
MCN CLOGENT     1 baris   Rp   4.500.000
MCN Zoicy       1 baris   Rp   2.200.000
MCN             1 baris   Rp     700.000
Referal MCN     3 baris   Rp     300.000
BOA             1 baris   Rp      50.000
─────────────────────────────────────────
TOTAL          17 baris   Rp 118.460.000
```

## Kalau nanti ketemu campaign-nya

Isi `payment_import_map_campaign`, ubah `status_import` staging jadi `'siap'`,
lalu generate ulang SQL. Tidak perlu parse ulang spreadsheet.

```sql
-- contoh: kalau METOO ternyata = campaign yang sudah ada
INSERT INTO payment_import_map_campaign (nama_sheet, campaign_id, alasan)
VALUES ('METOO', <id>, 'Dikonfirmasi owner <tanggal>: ...');
```
