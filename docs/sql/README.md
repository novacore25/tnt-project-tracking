# SQL sekali pakai (one-time fix)

Skrip SQL yang dijalankan manual ke database produksi. **Bukan** bagian dari build Next.js.

## Kenapa di sini, bukan di `web-app/scripts/`

Aturan repo melarang menambah file baru di `scripts/`. Tapi skrip ini penting
untuk riwayat — beberapa di antaranya mengubah data produksi. Jadi diletakkan di
`docs/sql/` supaya ikut ter-versioning dan bisa diunduh langsung dari server
tanpa perlu paste panjang lewat SSH.

## Cara menjalankan

```bash
curl -sL https://raw.githubusercontent.com/novacore25/tnt-project-tracking/main/docs/sql/<nama-file>.sql \
  -o /tmp/x.sql
wc -c /tmp/x.sql          # pastikan ukurannya cocok dengan tabel di bawah
cat /tmp/x.sql | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system
```

> Cara ini menggantikan pola base64 6-chunk yang sering rusak karena terminal
> SSH memotong paste panjang. Kalau `--fail` atau ukurannya tidak cocok, jangan lanjut.

## Daftar

| File | Ukuran | Status | Isi |
|---|---|---|---|
| `06-remove-autosync-duplicates.sql` | 6008 | **Siap dijalankan** | Hapus 7.035 baris auto-sync yang punya kembaran di Excel; lepas flag refund pada 4 order orakan |
| `07-remove-isrefund-filter.sql` | 4088 | **Tunggu 06** | Hapus predicate `is_refund = false` dari semua view |

## Urutan

```
06  hapus duplikat auto-sync      (data)
     -> hasil: sisa is_refund = 14 (refund asli dari Excel)
07  hapus filter dari view        (DDL)
     -> hasil: semua halaman konsisten, semua order dihitung
```

Jangan dibalik. 07 tanpa 06 akan menaikkan GMV dashboard **Rp 310 juta palsu**.

## Pengaman

Kedua skrip punya guard `RAISE EXCEPTION` di dalam transaksi. Kalau angka tidak
sesuai harapan, PostgreSQL membatalkan seluruh perubahan secara otomatis dan
tidak ada yang tersimpan.

Guard di `06`:
- sisa `is_refund` harus tepat 14
- tidak boleh ada auto-sync ber-flag refund
- **`quantity` harus tidak berubah** (kembaran sejati membawa quantity yang sama)
- jumlah kreator & produk tidak boleh turun

Guard di `07`:
- tidak boleh ada view yang masih memfilter `is_refund`
- kedua view harus tetap bisa dibaca

## Catatan penting soal 07

Script ini **tidak** menulis ulang definisi view. Ia membaca definisi yang
benar-benar tersimpan di `pg_views`, menghapus hanya predicate `is_refund = false`,
lalu mengeksekusi ulang hasilnya — sehingga kolom dan urutan aggregate dijamin
tidak berubah.

Versi lama (`web-app/scripts/one-time-data-fix/03-hapus-filter-isrefund.sql`)
menulis definisi view secara tangan. Itu berisiko mengubah kolom kalau view di
produksi berbeda sedikit. Jangan pakai versi lama.
