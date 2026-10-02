# PII di repositori ini

Tanggal: 2 Oktober 2026

## Aturan

**Data yang masuk ke database produksi TIDAK perlu masuk ke git history.**

`git history` itu permanen. Sekali `nik` dan nomor rekening masuk, penghapusan
file di commit berikutnya tidak menghapusnya dari history — harus `filter-repo`,
dan itu promulgated ulang ke semua orang yang sudah clone.

Repo ini private, tapi "private" bukan alasan untuk menaruh NIK orang di sana.

## File yang mengandung PII

| File | Isi | Status |
|---|---|---|
| `docs/payment/parsed-826.csv` | 826 baris + nama penerima, nomor rekening, NIK, alamat | **di-ignore** (`*.csv`) |
| `docs/sql/73-insert-payment-historis.sql` | INSERT final ke `payment_items`, berisi PII | **di-ignore** |

## Yang AMAN di-commit

File di `docs/sql/` yang hanya berisi query `SELECT` atau SQL ke tabel staging
tidak punya PII, jadi tetap di-commit dan dikirim lewat `curl`:

| File | Isi |
|---|---|
| `docs/sql/67-isi-staging-payment.sql` | 826 baris ke staging, tanpa PII |
| `docs/sql/68-cocokkan-payment.sql` | Query read-only |
| `docs/sql/69-cek-username-agency.sql` | Query read-only |
| `docs/sql/70-bentrokan-excel-vs-sistem.sql` | Query read-only |
| `docs/sql/71-daftar-exclude-duplikat.sql` | Query read-only |

Staging **sengaja tidak punya kolom PII**. Kolom `nama_penerima`,
`nomor_rekening`, `nik`, `alamat`, `link_ktp` sengaja tidak ikut saat
mengisi staging. Baris-baris itu hanya disisihkan di file lokal 73.

## Cara menjalankan file yang di-ignore

Tidak lewat `curl` dari GitHub. Dari mesin owner:

```powershell
Get-Content docs\sql\73-insert-payment-historis.sql -Raw |
  wsl -e bash -c "docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1"
```

Kalau `wsl` tidak tersedia, kirim file lewat `scp` lalu jalankan di VPS.

## Kalau PII terlanjur ter-commit

1. `git log --oneline -S '<NIK>'` → cari commit-nya
2. Ganti isi file dengan versi tanpa PII
3. `git commit --amend` kalau belum ter-push
4. Kalau sudah ter-push: `git filter-repo --path <file> --invert-paths`
   lalu wajib minta semua orang `clone` ulang
