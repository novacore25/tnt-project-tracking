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

### Script yang mengubah data

| File | Ukuran | Status | Isi |
|---|---|---|---|
| `06-remove-autosync-duplicates.sql` | 6008 | **Sudah dijalankan** | Hapus 7.035 baris auto-sync yang punya kembaran di Excel; lepas flag refund pada 4 order orakan |
| `07-remove-isrefund-filter.sql` | 4088 | **Sudah dijalankan** | Hapus predicate `is_refund = false` dari semua view |

### Query audit 30 Sep – 1 Okt 2026 (read-only)

Semua **read-only** — tidak menulis ke DB.

| File | Isi |
|---|---|
| `08-diagnostik-pencocokan.sql` | Diagnostik pencocokan order |
| `09-hapus-duplikat-v2.sql` | Varian penghapusan duplikat |
| `10-diagnostik-quantity.sql` |base commission vs quantity |
| `12-verifikasi-import.sql` | Verifikasi hasil import |
| `13-product-gagal-routing.sql` | Product yang gagal routing |
| `14-daftar-sku-perlu-didaftarkan.sql` | Daftar SKU yang perlu didaftarkan |
| `15-selisih-per-campaign.sql` | Selisih GMV per campaign |
| `16-audit-duplikat-listing.sql` | Audit duplikat listing |
| `17-audit-username-duplikat.sql` | Username duplikat (582 pasangan) |
| `18-laporan-creator-duplikat.sql` | Laporan creator duplikat |
| **`19-urai-asal-total-gmv.sql`** | Mengurai asal Rp 12,5 M di dashboard → **`ads_performance`** |
| `20-dry-run-merge-creator.sql` | Dry-run merge creator (superseded oleh 40) |
| **`21-akurasi-video-profil.sql`** | Buktikan `organic_videos` **nol duplikat** sejati |
| **`22-vi-banyak-sku.sql`** | Buktikan cross-join tag `product_id` |
| `23-tentukan-product-benar.sql` | Menentukan product_id yang benar |
| `24-resolusi-product.sql` | Resolusi product → campaign |
| **`25-cek-tag-palsu.sql`** | Verifikasi sebelum bersihkan tag palsu |
| `26-rollback-tag-palsu.sql` | Rollback tag palsu |
| `27-verifikasi-tag-palsu.sql` | Verifikasi setelah pembersihan |
| **`28-dampak-benar.sql`** | Kampanye yang benar-benar berubah |
| `29-kontradiksi-terakhir.sql` | Bentrok video yang terlewat |
| `30-cek-ads-duplikat.sql` | Cek duplikasi ads |
| `31-ads-ikut-sales.sql` | Apakah order ads superset dari sales |
| `32-ads-kumulatif.sql` | Buktikan `ads_performance` kumulatif per ad |
| `33-sumber-gmv-lain.sql` | Inventaris sumber GMV (error di beberapa section) |
| `34-inventaris-gmv.sql` | Tabel/view yang tidak ada di migration |
| `35-order-hilang.sql` | Lacak **951 order** yang hilang dari `sales` |
| **`36-gmv-tanpa-campaign.sql`** | Rp 224 M tanpa `campaign_id` |
| `37-daftar-produk-daftarkan.sql` | 91 `product_id` yang perlu didaftarkan |
| **`38-daftar-kerja-produk.sql`** | **Daftar kerja** 91 produk + nama dari `raw_data` |
| `39-duplikat-creator.sql` | Pisahkan duplikat creator jadi 3 kelas |
| **`40-preflight-constraint.sql`** | **WAJIB** sebelum migration `UPDATE`/`DELETE` |
| `41-dampak-kurs.sql` | Analisis dampak koreksi `kurs` (sudah dipakai) |
| **`42-verifikasi-payment.sql`** | **WAJIB sebelum migrasi payment** — uji tiap kolom dgn `EXISTS` |

### Yang paling sering dipakai ulang

```
40  sebelum nulis migration yang UPDATE/DELETE   → baca constraint dari katalog, bukan dari file
42  sebelum migrasi payment                       → verifikasi kolom & CHECK constraint
19  saat angka dashboard tidak cocok dengan SUM(sales)
```

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
