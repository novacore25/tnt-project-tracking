# Catatan Rencana Fitur Kontrak Kreator (Docxtemplater)

> **Status: ON HOLD (Dicatat sesuai permintaan user 9 Okt 2026).**
> Diskusi awal mengenai teknologi generator dokumen kontrak kreator menggunakan template Word `.docx`.

---

## 1. Latar Belakang & Kebutuhan
- File template master: `C:\Users\Banzilla\Downloads\Kontrak Kreator Campaign.docx`.
- Terdapat 21 variabel dinamis yang harus diisi otomatis dari database/sistem (nama pihak 1/2, PIC, brand, tier, rate card, termin pembayaran DP/pelunasan, klausul video/live, denda, rekening, dll).

## 2. Pilihan Teknologi: `docxtemplater` + `pizzip`
- **Kelebihan**:
  1. Tata letak 100% presisi (WYSIWYG) sesuai dokumen Word asli tanpa merusak margin, kop surat, tabel, font, dan penomoran klausul.
  2. Sangat ringan (hanya manipulasi XML zip string, RAM ~5-15MB, waktu eksekusi <150ms).
  3. Dapat dieksekusi 100% di browser client (laptop user), sehingga **beban VPS 0%**.
  4. Mendukung conditional tag (`{#ada_dp}...{/ada_dp}`) dan looping deliverables.
- **Kekurangan & Solusi Teruji**:
  1. *Output bawaan `.docx`*: Dibuat dual download (`Download Word .docx` untuk PIC jika ingin diedit manual di MS Word, dan tombol `Cetak / Simpan PDF` via browser print CSS atau headless converter ringan).
  2. *XML chunks memecah tag*: Selalu ketik tag di plain text/Notepad sebelum paste ke Word master template, serta pasang parser `nullGetter: () => "-"` agar data kosong tidak membuat crash.
  3. *Modul berbayar*: Gunakan core open-source gratis. Kop surat TNT dan logo ditempel permanen di Word master template. Format rupiah/tanggal diformat sebelum disuplai ke docxtemplater.
