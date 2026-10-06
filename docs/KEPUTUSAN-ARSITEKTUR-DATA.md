# Arsitektur Data Organic — Keputusan & Alasan

Status: 6 Oktober 2026
Pemilik keputusan: owner (kampanye SYB sebagai studi kasus)

---

## 1. Prinsip utama

> *"sistem dari dulu tuh seperti itu — data yang masuk akan mentah plek ketiplek
> seperti Excelnya, dan nanti di bagian tiap-tiap campaign akan memfilternya
> sesuai campaign setting-nya"*

**Raw landing + filter per campaign saat baca.** Bukan filter saat import.

```
IMPORT  (MENTAH)
  organic_videos  : isi apa adanya dari CustomReport TikTok, TIDAK dipaksakan
                    punya campaign_id. product_id + tiktok_campaign_id tersimpan.
  sales           : semua order_id yang pernah di-import. product_id +
                    content_uid + content_type tersimpan.

READ    (SETIAP CAMPAIGN MANDIRI)
  product_id ∈ skus(campaign)      → penyentu utama
  creator       ∈ campaign_creators(campaign)
  content_type  ∈ {Livestream, Video}
  tanggal       ∈ start_date .. end_date
  order_id      → Sales, jadi kunci dedup
```

**Kalau database-nya salah atau tidak jelas, tidak apa-apa — bisa diubah.**
Yang penting logika filternya benar dan angka yang tampil akurat.

---

## 2. Aturan penyentu: HANYA product_id

> *"kenapa saya tidak menggunakan tiktok campaign id, karena kadang ada 1 tiktok
> campaign id itu untuk 2 campaign di sistem ... jadi saya mau pakai product id"*

### Bukti: OGM Makeup vs OMG Skincare

```
33 OGM Makeup     tiktok_campaign_ids = {7584662142017324821}   10 produk make up
34 OMG Skincare   tiktok_campaign_ids = {7584662142017324821}    8 produk skincare
                  produk yang tumpang tindih = 0
```

Dua campaign internal, **satu** TikTok campaign ID, produk terpisah sempurna.
`product_id` = satu-satunya pembeda yang sah.

> ⚠️ **Jangan pernah memakai `tiktok_campaign_id` untuk memetakan campaign.**
> Itu hanya informasi tambahan, bukan kunci.

### Konsekuensi yang disetujui owner

Produk SYB dipakai di dua TikTok campaign (`7631140567631972112` "TNT MEDIA x
SYB" dan `7643606629893670677` "SYB X TNT CREATOR FEST 2026"). Karena produknya
terdaftar di `skus` campaign 46, **room Creator Fest tetap dihitung sebagai SYB**.
Tidak perlu kolom baru, tidak perlu campaign terpisah.

```
SYB live sesuai aturan ini = 847 room unik
  (dari file Excel 2 campaign: 271 + 580 − 4 irisan)
```

### Kalau product_id salah input

> *"jika product idnya salah input ya sudah berarti itu kesalahan PIC bukan
> kesalahan sistem"*

Sistem tidak berwenang menebak. Register produk yang salah = data akan masuk ke
campaign yang salah, dan itu konsekuensi input PIC. Sistem tugasnya hanya
memastikan logikanya benar.

---

## 3. Import video manual

### Aturan prioritas (keputusan owner, 6 Okt 2026)

```
1. Video ID SUDAH ADA di organic_videos (raw TikTok)
   → PAKAI YANG ORGANIK. Import manual diabaikan sepenuhnya.
2. Video ID TIDAK ADA di raw data
   → baru pakai hasil import manual.
   → tetap dihitung di Performa, tapi tidak terhubung ke data TikTok.
3. Live room TIDAK BOLEH masuk tabel `videos` sebagai pending video.
   → harus dihitung sebagai LIVE, tidak sebagai video.
```

> *"JIKA di organik sudah approve kreatornya ya sudah utamakan hitung yang
> organik, jika di organik tidak ada video idnya ya hitung sisanya yang di import
> manual"*

---

## 4. Temuan audit (6 Okt 2026)

### 4.1 `videos` tercemar live room

```
jenis                          baris     uid    approved
Video                       39.844   30.008         22
tidak ada di organic_videos  1.150    1.139         28
LIVESTREAM  <- seharusnya bukan 1.015     358          0
```

358 live room nyangkut di `videos`. **Nol di antaranya approved** — jadi aman
dibersihkan tanpa melanggar aturan "approved jangan diubah".

### 4.2 Bug double count approved/pending

`PerformaClient.tsx:236-241`

```tsx
:236  allApprovedVideoIds.add(id);                        // tidak cek pending
:238  if (!allApprovedVideoIds.has(id)) allPendingVideoIds.add(id);   // cek approved ✓
```

Kalau organic sudah menandai **pending**, lalu manual masukkan **approved** →
ID ada di dua Set → terhitung dua kali. Persis skenario yang harus dihindari.

### 4.3 `sku_id` NULL lolos dari filter produk

`PerformaClient.tsx:222`

```tsx
if (campaignSkuIds.size > 0 && v.sku_id && !campaignSkuIds.has(v.sku_id)) continue;
```

Kalau `v.sku_id` NULL, baris **tidak difilter produk sama sekali** — lolos
tanpa cek. Seharusnya kalau NULL berarti "belum terverifikasi", bukan "lolos".

### 4.4 `start_date` / `end_date` tidak pernah dipakai

Cari seluruh `web-app/src`: `start_date`/`end_date` campaign hanya muncul di
`app/page.tsx:29` (daftar campaign) dan `layout.tsx` (oper ke props). **Tidak ada
query data yang memfilter berdasarkan rentang tanggal campaign.**

### 4.5 `creator_filter_*` hanya filter tampilan

`providers/CampaignFilterProvider.tsx:55-58` — `isCreatorVisible` dipakai untuk
menyembunyikan kreator di UI. Tidak menyentuh query, jadi tidak memengaruhi GMV.

---

## 5. Angka SYB saat ini vs acuan

```
                    Excel (2 campaign)   Database
live                     847                547
video                    491                496
sales (GMV)         Rp 58.449.102     Rp 58.449.102  ✓

Sales SYB sudah 100% bersih:
  product_id di luar campaign   0
  creator tanpa slot            0
  content_uid ke campaign lain  0
  sales tanpa content_uid       0
```

Views/likes sudah benar: `PerformaClient.tsx:156`, `portalActions.ts:351`,
`videoActions.ts:185` semuanya `Math.max`. **Jangan pernah `SUM(video_views)`.**

---

## 6. Urutan perbaikan yang disepakati

| # | Fix | Angka berubah? | Risiko |
|---|---|---|---|
| 1 | Bersihkan `videos` dari 1.015 baris live room | tidak | 🟢 0 approved |
| 2 | `VideoClient.tsx:651` default `approved` → `pending` | tidak | 🟢 |
| 3 | `campaignPageActions.ts:741-758` stop drop CHECK | tidak | 🟡 |
| 4 | Manual video: organic menang, cek dua arah Set | views manual | 🟢 |
| 5 | `sku_id` NULL diperlakukan "belum terverifikasi" | ya | 🟡 |
| 6 | `campaignPageActions.ts:815` `WHERE id` + guard campaign | tidak | 🟢 |
| 7 | `OrganicImport.tsx:488` Priority 2 wajib cek produk | ya | 🟡 |

Owner menyatakan tidak keberatan re-import / refresh data agar raw data masuk
bersih: *"gapapa kok jika saya harus refresh data biar masuknya sesuai dan rapih
raw datanya"*.