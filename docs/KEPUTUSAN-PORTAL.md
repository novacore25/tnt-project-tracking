# Keputusan Portal Brand

**Tanggal:** 2 Oktober 2026
**Sumber:** audit `docs/AUDIT-PORTAL-BRAND.md` (`docs/sql/48`, `49`, `50`)

---

## 5 keputusan pemilik

| # | Pertanyaan | Keputusan | Dampak |
|---|---|---|---|
| 1 | Refund ikut atau tidak? | **SEMUA masuk**, sama seperti portal | View diubah — `total_gmv` se-DB naik **Rp 1.144.431.700 → Rp 1.454.605.235 (+21,32%)** |
| 2 | `not_approved` 6.160 baris | **Sembunyikan** | Query portal + filter `approval IN ('approved','pending','alternate')` |
| 3 | Views/likes livestream | **Tetap tampil** | Tidak diubah. Selisih vs internal **dokumentasi, bukan bug** |
| 4 | PIN `1234` | **Gapapa**, itu default dari Campaign Settings | Tidak diubah |
| 5 | Definisi "video tayang" | **Internal** (organik + video manual PIC) | `total_approved` portal disamakan dengan `PerformaClient` |

### 1. Refund masuk — yang diubah adalah VIEW, bukan portal

> *"refund itu ga ngaruh semua data masuk termasuk refund"*

Portal dan Performa **sudah** menjumlahkan semua baris. Yang **exclude refund adalah
view** (`WHERE is_refund = false`). Jadi supaya konsisten, **view yang diubah** —
bukan portal.

**Migration:** `20261003000000_refund_masuk_view.sql`

```diff
  FROM sales
- WHERE is_refund = false
-   AND campaign_id IS NOT NULL
+ WHERE campaign_id IS NOT NULL
  GROUP BY campaign_id
```

**Yang ikut naik** (semua membaca view ini): Harian, Rekap, Dashboard, Timeline,
Portal, Campaign list, dan seluruh angka tracked.

**Penting:** `sales.gmv` untuk `is_refund = true` tersimpan **POSITIF**, jadi
menjumlahkannya **menambah** pendapatan. Ini keputusan akuntansi pemilik yang
saya terima dan tidak diubah — yang saya lakukan hanya menyamakan view supaya
tidak ada lagi dua angka untuk campaign yang sama.

Rollback: `CREATE OR REPLACE VIEW` dengan `WHERE is_refund = false` dikembalikan.

#### ✅ HASIL AKTUAL (2 Okt 2026, ketiga guard LOLOS)

```
SEBELUM : total_gmv Rp 4.160.235.142,36
SESUDAH : total_gmv Rp 4.393.570.140,36
NAIK    :           Rp   233.334.998,00

video   :  865.468.962  ->  1.082.877.810
live    :   54.742.748  ->     70.668.898
ads     : 3.240.023.432,36  (tidak berubah, benar)
```

**Rekonsiliasi yang membuktikan 100% yakin:**

```
refund total di sales                     : Rp 310.173.535
  dengan campaign_id                     : Rp 233.334.998  <- masuk ke view
  campaign_id NULL                       :  Rp 76.838.537  <- tidak masuk
                                           ───────────────
                                           Rp 310.173.535  ✓ COCOK PAS

Naik total_gmv view                      : Rp 233.334.998  ✓ SAMA
```

Jadi angka **Rp 76.838.537** refund ada di `sales` tapi **tidak punya campaign** —
bagian dari masalah lama "Rp 224.219.990 sales tanpa `campaign_id`"
(`docs/sql/36`, `docs/sql/38`). Itu masalah **terpisah**, belum tersentuh.

**Guard:** 1 OK (video+live+ads = total) · 2 OK (tidak ada campaign turun) ·
3 OK (view = sales mentah + ads).

### 2. `not_approved` disembunyikan

> *"note approve sembunyikan aja bro"*

Filter identik dengan `performaActions.ts:18`:

```sql
AND LOWER(COALESCE(cc.approval, '')) IN ('approved', 'pending', 'alternate')
```

**Tidak mengubah angka GMV.** Sales dari kreator `not_approved` sebelumnya sudah
dihitung `unattributed_gmv`, jadi organic GMV tidak bergeser sama sekali. Yang
berubah cuma baris yang tampil di tabel dan angka kartunya.

### 3. Views & likes tetap menampilkan livestream

> *"jika uinya ada di portal brand ya harus tampilin bro"*

Tidak diubah. Konsekuensinya **dokumentasi**:

| | Portal | Internal |
|---|---:|---:|
| Views | 67.939 | 56.228 |
| Likes | 87.223 | 7.973 |

Ini **beda definisi yang disetujui**, bukan bug. Kalau nanti penyebabnya berubah,
ubah di `PerformaClient.tsx:180-198` supaya keduanya sama — **jangan** diubah
di portal.

### 4. PIN `1234` dibiarkan

> *"gapapa pinnya 1234 itukan di set di campaign setting yakan"*

Tidak diubah. Hanya catatan teknis yang perlu diketahui:

- `SELECT *` di `portalActions.ts:50` membawa kolom `pin` ke payload RSC,
  jadi **terbaca di View Source**. Tidak ada efek karena PIN memang diketahui
  brand masing-masing.
- Cookie `secure: false` — hanya masalah kalau situs pernah diakses via HTTP.
- Kalau suatu saat PIN diganti lewat Campaign Settings, **nilai lama masih
  ada di cache browser** selama 7 hari (maxAge cookie).

### 5. Video mengikuti internal

> *"internal broo, soalnya kan di internal itu juga ada input manual kan dan
> logika perhitungannya sama kayak internal"*

Blok baru `3b` di `portalActions.ts`, meniru `PerformaClient.tsx:202-224`:

- id video dari `content_uid`, atau digit dari `link_video`
- skip kalau `sku_id` di luar SKU campaign
- kreator `approved`/`alternate` → masuk hitungan approved
- kreator lain → pending, **tapi hanya kalau id-nya belum masuk approved**
- `perf.video_uids` ikut diisi, supaya `total_vt` per kreator juga ikut benar

`fastVideoCountsData.total_approved` sekarang `allApprovedVideoIds.size`, bukan
`calcUniqueVideos`. Plus `total_pending` dan `pending_with_videos` yang
sebelumnya hardcoded `0` ikut terisi.

**Hasil:** portal naik dari 26.439 ke sekitar 54.736 video (48,3% → ~100%).

---

## Yang TIDAK diubah (dan alasannya)

| Temuan | Kenapa tidak diubah |
|---|---|
| Cabang `tt_campaign_id` mati di filter live session | Butuh scoping yang benar — risiko session ikut hilang. Tertunda. |
| `organic_videos` 46% baris duplikat | Butuh migration sendiri + preflight. Tidak boleh digabung di sini. |
| 169 baris `videos` tanpa link & uid | Perlu keputusan: hapus atau diisi PIC. |
| `target_gmv` NULL di 37 campaign | Perlu data dari pemilik, bukan kode. |
| Biaya ads tidak tampil di portal | Keputusan tampilan. |

---

## Resep untuk model berikutnya

Rule baru untuk portal, berlaku seterusnya:

> **Jangan tambah angka baru di portal sebelum menyamakan dengan internal.**
> Kalau belum sinkron, tambahkan di internal dulu (satu sumber), lalu pakai ulang.

Akar semua selisih di atas: portal punya implementasi logika sendiri yang
ditulis terpisah dari internal. Dua kode, dua definisi, tanpa sumber tunggal.
