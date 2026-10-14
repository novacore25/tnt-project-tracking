# Log Pertemuan & Eksekusi — 14 Oktober 2026

> **Status: SELESAI & TERVERIFIKASI.**  
> Seluruh pembaruan format lembar kerja & draf **Perjanjian Kerja Sama Join Campaign (Revisi Terbaru)** telah diintegrasikan secara penuh pada modul Dokumen (`/dokumen`), Batch Contract Workspace, dan Modal Perjanjian Kreator, sesuai dokumen resmi (PDF, HTML, JSON) dari manajemen.

---

## 1. Ringkasan Eksekusi Hari Ini

| No | Modul / Berkas | Permintaan / Perubahan | Solusi & Penyesuaian Teknis | Status |
|:--:|---|---|---|:---:|
| 1 | **Mesin Renderer PDF Kontrak** (`CreatorContractPdfDocument.tsx`) | Revisi total format perjanjian kerja sama join campaign mengikuti template resmi 10 halaman dengan tetap menyertakan Kop Surat / Header resmi TNT di setiap halaman dan standar margin TNT. | Dirombak total menggunakan `@react-pdf/renderer` dengan 10 `<Page>` standar A4 (`size="A4"`, margin horizontal kiri & kanan `72 pt` / 2.54 cm Word standard, margin bawah `72 pt` / 2.54 cm dengan footer resmi di `bottom: 35 pt`, gap atas `35.5 pt` / 1.25 cm, font `Times-Roman` 10.5pt, line height 1.38). Memuat **Kop Surat Resmi TNT (Logo Base64 + Official Partner info + divider)** di bagian atas setiap halaman, seluruh klausul resmi Pasal 1 s.d. 13, perincian rekening bank di Pasal 6, klausul larangan doxing & pencemaran nama baik di Pasal 10 ayat (3), blok tanda tangan Direktur Stevani & Kreator, **Lampiran I** (tabel 13 baris ketentuan campaign & deliverables), dan **Lampiran II** (Do and Don't Kreator). | ✅ Terverifikasi |
| 2 | **Generator Workspace Kontrak** (`ContractGeneratorWorkspace.tsx`) | Formulir pengisian data perjanjian individual dengan auto-fill kreator, pengaturan Lampiran I, dan live preview. | Ditambahkan input terstruktur untuk: jenis campaign (*Fee/Barter/Fee dan Barter*), rincian deliverable (*Qty VT, Photo Slide, Live*), durasi konten & durasi terbilang, batas waktu revisi, jangka waktu tayang publik, jadwal draft & posting, skema pembayaran, dan inisial PIC drafter (*JC-TNT/[Init]/[Romawi]/[Tahun]*). Dilengkapi live preview 10 halaman dan tombol unduh PDF instan. | ✅ Terverifikasi |
| 3 | **Batch Generator Kontrak** (`ContractWorkspace.tsx`) | Sinkronisasi massal unduh dokumen PDF (.ZIP) per kampanye ke format revisi baru. | Default Pihak Pertama disesuaikan ke `PT TNT KREATIF DIGITAL`, Direktur `Stevani`, prefix nomor `JC-TNT/[Init]/[Romawi]/[Tahun]`, serta pemetaan lengkap field Lampiran I dan rekening bank pada setiap file PDF yang dikemas dalam ZIP. | ✅ Terverifikasi |
| 4 | **Modal Perjanjian Kreator** (`CreatorContractModal.tsx`) | Modal pembuatan kontrak cepat dari listing kreator campaign. | Format nomor diperbarui ke `JC-TNT`, default representasi Pihak Pertama ke `PT TNT KREATIF DIGITAL` (Stevani, Direktur), dan kelengkapan data Lampiran I dipetakan secara otomatis. | ✅ Terverifikasi |
| 5 | **Form Pengajuan Pembayaran** (`BatchForm.tsx`) | Menampilkan status dan nominal sequential pembayaran kreator untuk "Ratecard Diajukan" dan "Ratecard Lunas" (misal: `#1 Rp 200.000, #2 Rp 50.000` bila pembayaran > 1x, atau nominal tunggal bila 1x) di tabel pemilihan kreator `/campaigns/[id]/keuangan`. | Menambahkan helper `formatHistoryNominals()` yang memformat riwayat transaksi kreator secara kronologis. Bila > 1 item, memformat dengan `#1 Rp X, #2 Rp Y`. Bila 1 item, menampilkan nominal tunggal. Mendukung badge amber `Ratecard Diajukan:` untuk batch berjalan dan badge emerald `Ratecard Lunas:` beserta label `(Bisa Diajukan Lagi)` untuk repeat order. | ✅ Terverifikasi |

---

## 2. Rincian Teknis & Anatomi Perjanjian (Revisi 10 Halaman)

Struktur dokumen `@react-pdf/renderer` dipetakan secara terpisah menjadi 10 halaman dokumen legal presisi A4 tanpa pemotongan teks (*overflow-safe*):

1. **Halaman 1 — Judul & Pihak Perjanjian:**
   - Judul resmi: **PERJANJIAN KERJA SAMA JOIN CAMPAIGN**
   - Format Nomor: `___/JC-TNT/[Inisial Drafter]/[Bulan Romawi]/[Tahun]` (contoh: `001/JC-TNT/SF/X/2026`)
   - **Pihak Pertama:** **PT TNT KREATIF DIGITAL**, berkedudukan di Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Cibodas, Tangerang, Banten 15139. Diwakili oleh **Stevani** selaku **Direktur**.
   - **Pihak Kedua:** **KREATOR** (Nama lengkap, NIK KTP, Alamat KTP, Akun TikTok `@username`, No WhatsApp, Email).
   - Pembuka & Premis (*Menimbang / Bahwa*).
2. **Halaman 2 — Definisi & Hak Cipta:**
   - **Pasal 1:** Definisi istilah (*Perjanjian, Pihak Pertama, Pihak Kedua, Para Pihak, Klien/Brand, Campaign, Konten, Brief, Draft, Platform, Hak Kekayaan Intelektual, Biaya Jasa/Fee*).
   - **Pasal 2:** Ruang Lingkup Kerja Sama & Kepemilikan Konten (Hak cipta dan lisensi komersial eksklusif selama campaign berlangsung).
3. **Halaman 3 — Brief, Kewajiban & Timeline:**
   - **Pasal 3:** Pelaksanaan Pekerjaan dan Brief (Penyampaian brief, kepatuhan konsep, dan standar kualitas).
   - **Pasal 4:** Timeline dan Batas Waktu (Jadwal penyerahan draft, batas revisi maksimal 2x minor, dan jadwal penayangan publik).
4. **Halaman 4 — Kontrol Konten & Penayangan:**
   - **Pasal 5:** Kontrol Konten dan Penayangan (Persetujuan tertulis sebelum posting, kewajiban menyematkan hashtag/tautan produk/keranjang kuning, larangan promosi kompetitor langsung, serta kewajiban menjaga konten tetap aktif minimal 60 hari kalender).
5. **Halaman 5 — Pembayaran & Rekening Bank:**
   - **Pasal 6:** Biaya Jasa dan Ketentuan Pembayaran:
     - Biaya honorarium total (Rp & huruf terbilang).
     - Rincian rekening bank Pihak Kedua (Nama Bank, Nomor Rekening, Atas Nama Rekening).
     - Termin pembayaran (100% setelah seluruh kewajiban selesai diunggah dan disetujui, H+14 s.d. H+21).
     - Ketentuan pajak (PPh Pasal 21/23 ditanggung masing-masing pihak sesuai regulasi).
6. **Halaman 6 — Pernyataan, Jaminan & Larangan Doxing:**
   - **Pasal 7:** Pernyataan dan Jaminan Pihak Kedua (Bebas plagiarisme, orisinalitas, tidak melanggar hak cipta pihak ketiga).
   - **Pasal 8:** Pembatalan dan Pemutusan Perjanjian (Wanprestasi, keterlambatan tanpa konfirmasi, hak pengalihan campaign).
7. **Halaman 7 — Takedown Konten & Kerahasiaan:**
   - **Pasal 9:** Takedown Konten (Kondisi force takedown atas permintaan brand/regulator).
   - **Pasal 10:** Kerahasiaan, Etika, dan Larangan Pencemaran Nama Baik:
     - Larangan membocorkan brief, ratecard, strategi internal campaign.
     - **Pasal 10 ayat (3):** Larangan eksplisit melakukan pencemaran nama baik, pelecehan digital, membuka data pribadi (*doxing*), atau membuat postingan media sosial negatif mengenai Pihak Pertama maupun Klien/Brand.
8. **Halaman 8 — Force Majeure, Yurisdiksi & Lembar Tanda Tangan:**
   - **Pasal 11:** Keadaan Memaksa (*Force Majeure*).
   - **Pasal 12:** Hukum yang Berlaku dan Penyelesaian Sengketa (Musyawarah mufakat, yurisdiksi Pengadilan Negeri Tangerang).
   - **Pasal 13:** Pengurangan Fee dan Sanksi Wanprestasi (Ganti rugi proporsional dan kompensasi pembatalan sepihak).
   - **Lembar Tanda Tangan Para Pihak:**
     - PIHAK PERTAMA: PT TNT KREATIF DIGITAL (**Stevani**, Direktur).
     - PIHAK KEDUA: Kreator yang bersangkutan.
9. **Halaman 9 — Lampiran I (Ketentuan & Rincian Campaign):**
   - Format tabel resmi 13 baris mencakup:
     1. Brand
     2. Jenis Campaign (*Fee / Barter / Fee dan Barter*)
     3. Periode Campaign
     4. Fee Total
     5. Fee per Deliverable
     6. Skema Pembayaran
     7. Jumlah & Jenis Deliverable (*Video TikTok, Photo Slide, Sesi Live*)
     8. Durasi Konten (*detik & terbilang*)
     9. Hashtag & Tag Wajib
     10. Jadwal Penyerahan Draft
     11. Batas Waktu Revisi
     12. Jangka Waktu Tayang Konten
     13. Catatan Tambahan / Special Instructions
10. **Halaman 10 — Lampiran II (Do and Don't Kreator Campaign):**
    - **DO (Hal yang Wajib Dilakukan) — Poin 1 s.d. 9:**
      Kepatuhan brief, interaksi audiens, audio komersial bebas klaim, pencahayaan & audio jernih, tautan keranjang kuning/link afiliasi, notifikasi tepat waktu, arsip raw file video.
    - **DON'T (Hal yang Dilarang) — Poin 1 s.d. 11:**
      Posting tanpa approval, menampilkan brand kompetitor dalam frame, watermark platform lain, menghapus/mengarsipkan konten sebelum periode selesai, ujaran kebencian/SARA, klaim berlebihan tanpa bukti klinis/BPOM, menggunakan fake engagement/bot view.

---

## 3. Verifikasi & Integritas Build

- **TypeScript Compilation:** `npx tsc --noEmit` dijalankan; seluruh file dokumen dan kontrak (`CreatorContractPdfDocument.tsx`, `ContractGeneratorWorkspace.tsx`, `ContractWorkspace.tsx`, `CreatorContractModal.tsx`) lulus dengan **0 error**.
- **Kepatuhan Client-Side Rendering:** Pembuatan PDF 100% diproses di browser user (`@react-pdf/renderer` dan `jszip`), sehingga beban CPU dan RAM VPS Coolify tetap 0%.
- **Keamanan Kredensial:** Tidak ada secret, token, atau hardcoded credentials yang ditambahkan ke repositori.
