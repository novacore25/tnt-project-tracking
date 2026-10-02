# Sumber Data Awareness & Aturan Tipe Konten

**Ditetapkan pemilik sistem, dikonfirmasi ulang 2 Oktober 2026**

Ini aturan domain yang **tidak boleh dilupakan**. Saya sempat salah menyimpulkan
soal ini dan perlu diperbaiki.

---

## Tiga file, tiga fungsi — tidak boleh dicampur

| File | Isi | Kolom identitas | Punya `Content Type`? |
|---|---|---|---|
| `affiliate_orders_*.xlsx` | **Order + GMV** | `16=Content ID` | ✅ **hanya di sini** |
| `CustomReport_..._Video_*.xlsx` | **Hasil VIDEO** | `13=Video ID` | ❌ tidak ada |
| `CustomReport_..._Live_*.xlsx` | **Hasil LIVE** | `13=Livestream room ID` | ❌ tidak ada |

### Verifikasi langsung ke file (2 Okt 2026)

Dibaca dengan Excel COM, header baris 1:

```
affiliate_orders : ... | 14=Content Type | 15=Carousel | 16=Content ID | ...
CustomReport Video : ... | 13=Video ID | 14=Video name | 15=Post time | ...
CustomReport Live  : ... | 13=Livestream room ID | 14=Livestream name | 15=LIVE time info | ...
```

> ⚠️ **Semua baris `content_type` untuk data live berasal dari TAB yang dipakai,
> BUKAN dari kolom di file.** Dua file Custom Report **tidak punya** kolom tersebut.

---

## Kenapa begitu

> *"content type itu hanya ada di file affiliate order untuk menghitung gmv aja,
> kalo untuk menghitung video dan live kan ada di awareness yaitu file custom report"*

- `Content Type` ada di `affiliate_orders` **karena** dipakai memecah GMV jadi
  live vs video (§3.34 skill).
- Dua Custom Report **sudah terpisah secara file**, jadi tidak butuh kolom tipe —
  file itu sudah tahu dirinya live atau video.

---

## Tampilan di aplikasi

`/input-penjualan` punya **4 tab**:

| Tab | File yang diupload | Mode | `content_type` yang dikirim |
|---|---|---|---|
| Organik Sales | `affiliate_orders` | `sales` | **dari file** (`row['Content Type']`) |
| Awareness Video | `CustomReport Video` | `video` | `'Video'` — hardcode mode |
| Awareness Live | `CustomReport Live` | `live` | `'Livestream'` — hardcode mode |
| Data Live Organik | — | `importLiveOrganicAction` | `'Livestream'` |

Kode: `OrganicImport.tsx:420` (sales, dari file), `:448` (`'Livestream'`),
`:469` (`'Video'`).

> ✅ **Import sudah benar.** Jangan diubah.

---

## ⚠️ Yang MASIH jadi masalah: halaman Video tidak memfilter

Halaman `/campaigns/[id]/video` menyusun daftar dari tabel **`videos`** (input
manual PIC) dengan **tanpa filter `content_type`**:

```js
// VideoClient.tsx:1327-1330
sourceVideos.forEach(v => {
   const cc = listingData.find(c => c.id === v.campaign_creator_id);
   if (!cc || !cc.creators || !isCreatorVisible(cc.creators.username)) return;
   // ^ hanya filter kreator. TIDAK filter livestream.
```

`videoActions.ts:48-56` juga mengambil kolom `content_type` tapi **tidak memakainya**.

**Dampak kalau ada link livestream di tabel `videos`:**
- Muncul di menu Video (salah)
- Terhitung di `allApprovedVideoIds` portal & Performa (salah)
- **Tidak** menyentuh `achievement_video` di view, karena itu juga menghitung
  tabel `videos` — jadi **ya menyentuh**

> Verifikasi: `docs/sql/58-cek-livestream-masuk-hitungan-video.sql`

---

## Pelajaran untuk model berikutnya

> ❗ **Jangan menyimpulkan dari satu baris kode.**
> Saya membaca `importActions.ts:178` → `${v.content_type || 'Video'}` dan
> menyimpulkan semua live dilabeli Video. **SALAH.** Baris itu cuma fallback
> server; yang menentukan adalah `OrganicImport.tsx:448` yang sudah benar.
>
> **Kalau pemilik_system menjelaskan aturan domain, dan kodenya tampak mendukung,
> maka bagian yang "aneh" itu belum tentu bug.** Baca seluruh rantainya dulu.
