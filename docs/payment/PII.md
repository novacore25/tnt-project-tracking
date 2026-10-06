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

## Riwayat git — PII yang SUDAH masuk history (6 Okt 2026)

Ternyata `*.csv` sudah di-ignore, tapi **cache `.txt` di `docs/payment/` tidak
pernah di-ignore** — dan salah satu di antaranya mengandung PII asli:

| File | Temuan | Commit pertama |
|---|---|---|
| `docs/payment/analisis-duplikat-rekening.txt` | **18 NIK 16 digit** (kode wilayah 390108 = Bekasi), nomor rekening bank, nama penerima | `fde90cd` |
| `docs/payment/analisis-l3.txt` | 4 NIK 16 digit | `fde90cd` |
| `docs/payment/analisis-l1.txt`, `analisis-l2.txt`, `analisis-pws-september.txt`, `verifikasi-73.txt` | tanpa NIK, tapi tetap turunan mentah Excel | `fde90cd` |
| `docs/payment/live-syb-rooms.txt` | 271 room ID TikTok (bukan PII), tetap tidak perlu di git | `70d9f1d` |

Semua file di atas **sudah di-`git rm --cached`** dan `.gitignore` sekarang
menutup `docs/payment/*.txt`. File tetap ada di disk owner.

> ⚠️ **Isi lama MASIH ADA di git history.** `git rm` hanya menghapus di HEAD.
> Menghapus dari history butuh `git filter-repo` yang write ulang SEMUA SHA —
> karena itu repo ini private dan hanya punya satu remote, keputusan ada di
> tangan owner. Lihat bagian "Kalau PII terlanjur ter-commit" di bawah.

Cara memastikan file .txt di `docs/payment/` tidak naik lagi:

```powershell
git check-ignore -v docs\payment\analisis-duplikat-rekening.txt
```

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
