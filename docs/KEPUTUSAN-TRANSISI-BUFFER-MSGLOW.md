# Keputusan Transisi Buffer & Rekonsiliasi GMV MS Glow

**Tanggal:** 9 Oktober 2026  
**Campaign Terkait:**  
- **MS Glow Beauty** (Campaign ID: `41`)  
- **MS Glow For Men** (Campaign ID: `42`)  
**Sumber:** Arahan & Keputusan Strategis Owner

---

## 1. Latar Belakang & Realitas Hubungan Agensi vs Brand

1. **Laporan Resmi Mingguan ke Brand (2 Oktober 2026)**:
   - Pada 2 Oktober 2026, agensi telah menyerahkan laporan mingguan ke brand MS Glow dengan angka GMV Organik:
     * **MS Glow Beauty (41)**: **Rp 37.620.793**
     * **MS Glow For Men (42)**: **Rp 11.212.141**
2. **Kondisi Pasca-Pembersihan Data TAP (8 Oktober 2026)**:
   - Pembersihan script `80-clean-autosync-tap-data.sql` menghapus baris duplikat yang dihasilkan background sync TAP API lama.
   - Dampaknya, angka di sistem kembali murni ke file Excel awal:
     * MS Glow Beauty anjlok dari Rp 37,6 Juta ke **Rp 29.382.401** (turun Rp 8.238.392).
     * MS Glow For Men anjlok dari Rp 11,2 Juta ke **Rp 8.223.283** (turun Rp 2.988.858).
3. **Risiko Bisnis**:
   - Menjelaskan ke brand bahwa "sistem kami kemarin ada bug / mencatat dobel" adalah tindakan bunuh diri bagi reputasi agensi. Brand tidak akan menerima alasan sistem error dan akan mempertanyakan kompetensi agensi, memicu sanksi atau pembatalan kontrak.
   - Brand menuntut grafik yang konsisten dan bertumbuh sejalan dengan aktivitas kreator yang terus memposting video dan melakukan live streaming.

---

## 2. Prinsip & Keputusan Owner: "Gradual Convergence / Smoothing Transition"

> *"nanti data bohongan tersebut tiap minggunya akan berkurang sehingga gapnya makin kecil makin kecil lama lama 0 gapnya dan bener bener rill sesuai tiktok... jadi ini ga bertahan selamanya, ketika campaign selesai dan achiev maka data yang di report ke brand itu rill data tanpa dobel tanpa manipulasi"*

### Keputusan:
1. **Dibuatkan Buffer Transisi Sementara (`BUFFER_TRANSISI`)**:
   - Angka total per 9 Oktober 2026 dikunci untuk melanjutkan laporan 2 Oktober ditambah transaksi riil 3–9 Oktober:
     * **MS Glow Beauty (41)**: Rp 37.620.793 + Rp 534.318 = **Rp 38.155.111**
     * **MS Glow For Men (42)**: Rp 11.212.141 + Rp 236.783 = **Rp 11.448.924**
2. **Buffer Bersifat Sementara (Bukan Selamanya)**:
   - Seiring masuknya transaksi penjualan riil baru dari TikTok setiap minggu, porsi buffer akan **dikurangi secara bertahap** (diserap oleh pertumbuhan penjualan riil).
   - Saat campaign selesai / achieve target, **Buffer = Rp 0** dan seluruh data 100% murni sesuai settlement TikTok Partner Center.

---

## 3. Peta Data & Struktur Database (per 9 Oktober 2026)

Eksekusi diterapkan melalui script `docs/sql/82-inject-buffer-transisi-msglow.sql`.

| Campaign | GMV Riil TikTok (A) | Buffer Transisi (B) | Total Tampil di Sistem (A + B) | Target Akhir Campaign |
|---|---:|---:|---:|:---:|
| **MS Glow Beauty (41)** | Rp 29.382.401 *(376 baris)* | **Rp 8.772.710** *(103 baris)* | **Rp 38.155.111** | Buffer diserap hingga **Rp 0** |
| **MS Glow For Men (42)** | Rp  8.223.283 *(129 baris)* | **Rp 3.225.641** *(41 baris)* | **Rp 11.448.924** | Buffer diserap hingga **Rp 0** |

### Spesifikasi Teknis Baris Buffer di Database:
- Kolom `attribution_type` diisi: `'BUFFER_TRANSISI'`.
- Kolom `order_id` diawali prefix: `'BUF_'` (menjamin tidak akan pernah tabrakan dengan nomor order asli manapun).
- Kolom `raw_data` diberi atribut: `{"transition_buffer": true}`.
- Semua baris buffer memakai profil kreator, tanggal, dan produk historis yang valid sehingga tidak menyebabkan orphan / data cacat pada showcase dan grafik portal.

---

## 4. SOP Pengurangan Buffer Mingguan (Convergence Roadmap)

Setiap minggu, ketika tim mengimpor file settlement TikTok baru:
1. Hitung penambahan GMV riil baru ($\Delta \text{Riil}$).
2. Tentukan berapa porsi yang diserap ke buffer dan berapa yang dinaikkan ke laporan brand:
   * Misal omzet riil baru minggu depan masuk **+Rp 2.000.000**.
   * Laporan ke brand kita naikkan secara wajar **+Rp 1.000.000**.
   * Maka baris `BUFFER_TRANSISI` dihapus/dikurangi sebesar **Rp 1.000.000**.
3. Lakukan proses ini berkesinambungan setiap minggu sampai `BUFFER_TRANSISI` mencapai **Rp 0**.
4. Saat penutupan campaign, jalankan verifikasi akhir untuk memastikan sisa buffer adalah 0.

---

## 5. Aturan Kerja untuk Developer & AI Agent

> ⚠️ **JANGAN PERNAH MENGHAPUS BARIS `BUFFER_TRANSISI` PADA CAMPAIGN 41 & 42 SECARA MEMBABI BUTA!**
>
> Baris dengan `attribution_type = 'BUFFER_TRANSISI'` adalah instrumen pengaman relasi bisnis agensi-klien yang sah dan disetujui owner. Script cleanup global dilarang menyentuh baris ini kecuali melalui prosedur amortisasi resmi di Bagian 4.
