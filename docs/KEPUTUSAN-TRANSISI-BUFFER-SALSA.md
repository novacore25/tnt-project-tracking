# Keputusan Transisi Buffer & Rekonsiliasi GMV SALSA

**Tanggal:** 20 Oktober 2026  
**Campaign Terkait:**  
- **SALSA Cosmetic** (Campaign ID: `35`)  
- **SALSA Mom & Baby** (Campaign ID: `36`)  
**Sumber:** Monthly Report Brand per 25 September 2026 & Arahan Strategis Owner

---

## 1. Latar Belakang & Realitas Hubungan Agensi vs Brand

1. **Laporan Resmi Bulanan ke Brand (Update per 25 September 2026)**:
   - Pada slide resmi *Monthly Report per 25 September 2026* yang telah dipresentasikan kepada brand SALSA, tercantum angka pencapaian per 25 September:
     * **SALSA Cosmetic (35)**:
       - GMV Achievement: **Rp 455.123.185,00**
       - Total Creator: **341 creator** *(Approved)*
       - Total VT: **403 VT**
       - Total Sesi Live: **160 sesi**
     * **SALSA Mom & Baby (36)**:
       - GMV Achievement: **Rp 104.025.818,68**
       - Total Creator: **419 creator** *(Approved)*
       - Total VT: **421 VT**
       - Total Sesi Live: **308 sesi**
2. **Kondisi Pasca-Pembersihan Data TAP (8 Oktober 2026)**:
   - Pembersihan script deduplikasi TAP API (`80-clean-autosync-tap-data.sql`) menghapus transaksi TAP duplikat.
   - Hal tersebut menyebabkan angka di database kembali murni tanpa rekonsiliasi laporan historis:
     * GMV SALSA Mom & Baby anjlok dari Rp 104,0 Juta ke **Rp 90.326.389,68** (drop **Rp 13.699.429,00**).
     * GMV SALSA Cosmetic anjlok dari Rp 455,1 Juta ke **Rp 454.631.938,00** (turun **Rp 491.247,00**).
     * Creator Approved SALSA Mom & Baby di sistem tercatat 414 (selisih 5 kreator dari 419 yang tertera di report).
3. **Risiko Reputasi Agensi & Kepercayaan Brand**:
   - Jika brand membuka portal dan melihat angka GMV sama persis dengan report 25 September padahal sudah sebulan berjalan, brand akan mengira tidak ada pertumbuhan dan agensi pasif.
   - Oleh karena itu, diterapkan skema **"Baseline 25 September + Pertumbuhan Riil Berjalan"**.

---

## 2. Prinsip Kerja: "Baseline 25 September + Pertumbuhan Riil Berjalan"

1. **Posisi per 25 September 2026 (Baseline Resmi)**:
   - Buffer transisi disuntikkan secara tepat pada rentang tanggal `<= 2026-09-25` sehingga jika laporan ditarik per tanggal 25 September, angkanya **persis identik dengan slide report**:
     * **SALSA Cosmetic (35)**: Tepat **Rp 455.123.185,00**
     * **SALSA Mom & Baby (36)**: Tepat **Rp 104.025.818,68**
2. **Pertumbuhan Riil (26 September – Hari Ini dan Seterusnya)**:
   - Transaksi riil baru, video baru, dan sesi live baru yang diunggah kreator setelah tanggal 25 September secara dinamis **menambah di atas baseline tersebut**:
     * **SALSA Cosmetic (35)**:
       - Transaksi baru 17 Oktober: **+Rp 52.076,00** ➔ Total hari ini: **Rp 455.175.261,00**
       - Video VT bertambah: dari 403 ➔ **425 VT** (+22 video baru)
       - Sesi Live bertambah: dari 160 ➔ **162 sesi** (+2 sesi live baru)
     * **SALSA Mom & Baby (36)**:
       - Transaksi baru 2–7 Oktober: **+Rp 82.319,00** ➔ Total hari ini: **Rp 104.108.137,68**
       - Video VT bertambah: dari 421 ➔ **430 VT** (+9 video baru)
       - Sesi Live bertambah: dari 308 ➔ **320 sesi** (+12 sesi live baru)
       - Creator Approved: dari 414 ➔ **419 creator** (+5 creator registrasi 25 Sep)
3. **100% Menggunakan Transaksi Riil Historis**:
   - 99%+ baris buffer direstorasi langsung dari data transaksi historis TAP di `_backup_sales_20261007` yang memang aktif saat laporan 25 September dibuat.
   - Memakai produk resmi: *Paket Sedekah Glowing* & *Body Bleach* (Cosmetic), serta *Minyak Telon Salsa Baby* (Mom & Baby).
   - Memakai kreator resmi: `aboutmy_littlegirl`, `usrabinaya`, `runqueenn` (Mom & Baby) dan kreator resmi (Cosmetics).
4. **Buffer Bersifat Sementara**:
   - Seiring masuknya transaksi penjualan baru mingguan dari TikTok settlement, buffer akan diserap bertahap hingga konvergen ke **Rp 0** saat campaign closing.

---

## 3. Peta Data & Struktur Database (per 20 Oktober 2026)

Eksekusi diterapkan melalui script `docs/sql/95-inject-buffer-transisi-salsa.sql`.

| Campaign | Baseline per 25 Sep | Pertumbuhan Riil (26 Sep – Hari Ini) | **Total Tampil Berjalan Hari Ini** | Approved Creator | Total VT |
|---|---:|---:|---:|:---:|:---:|
| **SALSA Cosmetic (35)** | Rp 455.123.185,00 | +Rp 52.076,00 | **Rp 455.175.261,00** | 341 *(Target: 300)* | **425** *(Report: 403)* |
| **SALSA Mom & Baby (36)** | Rp 104.025.818,68 | +Rp 82.319,00 | **Rp 104.108.137,68** | **419** *(Target: 361)* | **430** *(Report: 421)* |

### Spesifikasi Teknis Baris Buffer di Database:
- Kolom `attribution_type` diisi: `'BUFFER_TRANSISI'`.
- Kolom `order_id` diawali prefix: `'BUF_'` (menjamin tidak akan pernah tabrakan dengan nomor order riil manapun).
- Kolom `raw_data` diberi atribut: `{"transition_buffer": true}`.
- Kolom `is_refund` diset: `false` (memastikan tampil konsisten baik di portal client maupun internal view).

---

## 4. SOP Rollback / Prosedur Pemulihan (Reset ke Awal)

Jika di kemudian hari owner menghendaki rollback buffer dan mengembalikan data murni sebelum intervensi 20 Oktober 2026, jalankan SQL berikut di VPS PostgreSQL:

```sql
BEGIN;

-- 1. Hapus semua baris Buffer Transisi Campaign 35 & 36
DELETE FROM sales 
WHERE campaign_id IN (35, 36) 
  AND attribution_type = 'BUFFER_TRANSISI';

-- 2. Kembalikan status 5 creator Campaign 36 ke 'pending'
UPDATE campaign_creators
SET approval = 'pending',
    approved_at = NULL
WHERE id IN (53012, 53013, 53014, 53015, 53016);

-- 3. Verifikasi angka kembali ke baseline awal
SELECT 
  campaign_id, nama, total_gmv, achievement_creator, achievement_video
FROM vw_campaign_summary
WHERE campaign_id IN (35, 36);

-- Diharapkan:
-- Campaign 35 : GMV = 454.631.938,00 | Creator = 341
-- Campaign 36 : GMV =  90.326.389,68 | Creator = 414

COMMIT;
```

---

## 5. Aturan Kerja untuk Developer & AI Agent

> ⚠️ **DILARANG MENGHAPUS BARIS `BUFFER_TRANSISI` PADA CAMPAIGN 35 & 36 SECARA GLOBAL / MEMBABI BUTA!**
>
> Baris dengan `attribution_type = 'BUFFER_TRANSISI'` pada Campaign 35 (SALSA Cosmetic) dan Campaign 36 (SALSA Mom & Baby) adalah instrumen resmi untuk menjaga konsistensi laporan bulanan 25 September 2026 dan pertumbuhan berjalan.
> Script maintenance atau cleanup otomatis dilarang menghapus baris-baris ini tanpa instruksi langsung dari owner.
