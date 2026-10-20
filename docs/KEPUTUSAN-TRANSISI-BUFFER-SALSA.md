# Keputusan Transisi Buffer & Rekonsiliasi GMV SALSA

**Tanggal:** 20 Oktober 2026  
**Campaign Terkait:**  
- **SALSA Cosmetic** (Campaign ID: `35`)  
- **SALSA Mom & Baby** (Campaign ID: `36`)  
**Sumber:** Monthly Report Brand per 25 September 2026 & Keputusan Strategis Owner

---

## 1. Latar Belakang & Realitas Hubungan Agensi vs Brand

1. **Laporan Resmi Bulanan ke Brand (Update per 25 September 2026)**:
   - Pada slide resmi *Monthly Report per 25 September 2026* yang telah dipresentasikan kepada brand SALSA, tercantum angka pencapaian:
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
3. **Risiko Reputasi Agensi**:
   - Menurunkan angka pada portal brand setelah laporan resmi 25 September diserahkan dapat merusak kredibilitas agensi di mata brand SALSA. Brand menuntut kontinuitas data yang konsisten dan bertumbuh seiring waktu.

---

## 2. Prinsip & Keputusan Owner: "Gradual Convergence / Smoothing Transition"

Mengikuti preseden **MS Glow (Campaign 41 & 42)** dan **Ghani Skin (Campaign 57)**:

1. **Diberikan Buffer Transisi Sementara (`BUFFER_TRANSISI`)**:
   - Angka total per 20 Oktober 2026 dikunci untuk menyamakan baseline laporan resmi 25 September:
     * **SALSA Cosmetic (35)**: Rp 454.631.938 + **Rp 491.247** = **Rp 455.123.185,00**
     * **SALSA Mom & Baby (36)**: Rp 90.326.389,68 + **Rp 13.699.429,00** = **Rp 104.025.818,68**
2. **100% Menggunakan Transaksi Riil Historis**:
   - 99%+ baris buffer direstorasi langsung dari data transaksi historis TAP di `_backup_sales_20261007` yang memang aktif saat laporan 25 September dibuat.
   - Memakai produk resmi: *Paket Sedekah Glowing* & *Body Bleach* (Cosmetic), serta *Minyak Telon Salsa Baby* (Mom & Baby).
   - Memakai kreator resmi: `aboutmy_littlegirl`, `usrabinaya`, `runqueenn` (Mom & Baby) dan kreator resmi (Cosmetics).
3. **Sinkronisasi Approved Creator (Campaign 36)**:
   - Meng-approve 5 kreator yang terdaftar pada 25 September 2026 (`mama_annora09`, `nisa_annisa145`, `perlengkapanmombaby`, `ririnrerain`, `azhira`) sehingga jumlah creator approved tepat menjadi **419 creator**.
4. **Buffer Bersifat Sementara**:
   - Seiring masuknya transaksi penjualan baru mingguan dari TikTok settlement, buffer akan diserap bertahap hingga konvergen ke **Rp 0** saat campaign closing.

---

## 3. Peta Data & Struktur Database (per 20 Oktober 2026)

Eksekusi diterapkan melalui script `docs/sql/95-inject-buffer-transisi-salsa.sql`.

| Campaign | Baseline Riil Sebelum Buffer | Buffer Transisi Disuntikkan | Total Akhir Tampil di Sistem | Status Creator |
|---|---:|---:|---:|:---:|
| **SALSA Cosmetic (35)** | Rp 454.631.938,00 | **Rp 491.247,00** *(20 baris)* | **Rp 455.123.185,00** | 341 *(Target: 300)* |
| **SALSA Mom & Baby (36)** | Rp 90.326.389,68 | **Rp 13.699.429,00** *(949 baris)* | **Rp 104.025.818,68** | **419** *(Target: 361)* |

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
> Baris dengan `attribution_type = 'BUFFER_TRANSISI'` pada Campaign 35 (SALSA Cosmetic) dan Campaign 36 (SALSA Mom & Baby) adalah instrumen resmi untuk menjaga konsistensi laporan bulanan 25 September 2026.
> Script maintenance atau cleanup otomatis dilarang menghapus baris-baris ini tanpa instruksi langsung dari owner.
