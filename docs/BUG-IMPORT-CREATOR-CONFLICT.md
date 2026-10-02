# Bug Import Penjualan — `idx_creators_username_lower_unique`

**Tanggal:** 2 Oktober 2026
**Status:** ✅ SUDAH DIPERBAIKI — `b62cf63`
**Gejala:** semua import gagal, thousands of rows "DATA GAGAL"

---

## Gejala

```
duplicate key value violates unique constraint
"idx_creators_username_lower_unique"
[Error | INSERT INTO creators (username, nama_asli, link_account, added_by) ← VALUES ()]
```

| Tab | Tersimpan | Gagal |
|---|---:|---:|
| Organik Sales | 0 | **429** (3 batch) |
| Awareness Video | 3 | **10.650** |
| Awareness Live | 84 | **300** |

---

## Akar masalah

Migration `20261001220000_merge_proven_duplicate_creators.sql` — **pekerjaan audit
yang sudah selesai** — menambah index baru untuk mencegah duplikat kapital:

```sql
CREATE UNIQUE INDEX idx_creators_username_lower_unique
  ON creators (lower(username));
```

Sekarang `creators` punya **DUA** unique index:

| Index | Definisi | Menangkap |
|---|---|---|
| `creators_username_key` | `UNIQUE (username)` | `budi` = `budi` ✅ |
| `idx_creators_username_lower_unique` | `UNIQUE (lower(username))` | `Budi` = `budi` ✅ |

**Tapi kode import masih menunjuk yang lama:**

```js
// SEBELUM - salah
ON CONFLICT (username) DO NOTHING
```

`ON CONFLICT (username)` hanya cocok dengan index pertama. Bentrok **kapitalisasi**
lolos dari sana, lalu ditolak index kedua → error.

---

## Mengapa 429 baris gagal padahal masalahnya sedikit

```
1 kreator bentrok  →  SELURUH 150 baris dalam batch itu rollback
3 batch            →  429 baris dilaporkan "gagal"
```

**1 batch = 1 transaksi.** Satu username bermasalah membuat **seluruh baris di
sebelahnya ikut hilang**. Jadi 10.650 baris awareness gagal bukan karena 10.650
masalah, tapi karena beberapa kreator saja.

---

## Bukti dari database (`docs/sql/57`)

```
§1  Dua unique index, satu case-sensitive satu LOWER    → penyebab
§2  16.311 creator, 796 username masih huruf BESAR
§5  0 pasangan bentrok setelah di-lowercase             → normalisasi aman
§8  campaign_creators 1.727 | sales 1.693 | organic_videos 4.834 baris terkait
```

Contoh username yang masih huruf besar:

```
Serbaserbishp · Byliyah · Xyme.dytaa · Rina_audinaaaa · Floraluxe.lmj
Iniicaaaaa_19 · Ayunitanf · Alyaakaniaa_ · Racunmomyrevan · Haulbyping
```

---

## Perbaikan

**Semua 12 titik `INSERT INTO creators` sekarang pakai `lower(username)`.**

### Yang perlu ON CONFLICT diperbaiki (pola salah)

| File | Baris | Semula |
|---|---|---|
| `importActions.ts` | 219 | `ON CONFLICT (username) DO NOTHING` |
| `syncUnmapped.ts` | 88 | `ON CONFLICT (username) DO UPDATE` |
| `creatorActions.ts` | 271, 405, 468 | `ON CONFLICT (username) DO UPDATE` |
| `campaignPageActions.ts` | 1275, 1811, 2047 | `ON CONFLICT (username) DO UPDATE` |

### Yang sama sekali tidak punya ON CONFLICT (lebih berbahaya)

| File | Baris | Perbaikan |
|---|---|---|
| `addressActions.ts` | 478 | + `ON CONFLICT (lower(username)) DO UPDATE` |
| `databaseActions.ts` | 71 | + `ON CONFLICT (lower(username)) DO UPDATE` |
| `databaseActions.ts` | 1160 | + `ON CONFLICT (lower(username)) DO UPDATE` |
| `paymentActions.ts` | 751 | + `ON CONFLICT (lower(username)) DO UPDATE` |

> Yang tadinya `DO NOTHING` sekarang pakai `DO UPDATE SET kolom = COALESCE(EXCLUDED.kolom, kolom)`
> supaya import ulang **memperbaiki** record, bukan membuang data baru.

---

## Jebakan yang terjadi selama memperbaiki

| Kesalahan | Gejala | Cara deteksi |
|---|---|---|
| Backtick penutup hilang di template literal | 286 TS error (dari 84) | `tsc --noEmit` |
| Komentar berisi backtick **masuk ke dalam** template SQL | 5 TS error | `tsc --noEmit` |

Keduanya ketangkap sebelum commit. TypeScript kembali ke **84 (baseline)**.

> ⚠️ **Pelajaran:** jangan pernah menulis komentar dengan karakter backtick di
> dekat template literal SQL. Backtick akan menutup template lebih awal.
> Sama seperti pelajaran "SELECT tanpa FROM" (§KEPUTUSAN-PORTAL) — **cek
> otomatis lebihandal daripada niat.**

---

## Yang BELUM dikerjakan (opsional)

**Normalisasi 796 username huruf besar jadi lowercase.**

Aman (§5 = 0 duplikat setelah di-lowercase). Tapi menyentuh 8.254 baris di
tabel lain, dan **tidak diperlukan** — setelah fix `ON CONFLICT (lower(username))`
import sudah jalan normal.

_baris terkait_: `campaign_creators` 1.727 · `sales` 1.693 · `organic_videos` 4.834

Perlu kalau mau konsistensi data. **Tidak urgental.**
