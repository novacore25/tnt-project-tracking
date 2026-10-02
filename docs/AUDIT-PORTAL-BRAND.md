# Audit Portal Brand vs Data Internal

**Tanggal:** 2 Oktober 2026
**Ruang lingkup:** `/portal/[id]/dashboard` untuk semua campaign
**Metode:** baca kode + 3 script SQL read-only (`docs/sql/48`, `49`, `50`)
**Status:** **AUDIT SELESAI — PERBAIKAN BELUM DILAKUKAN** (menunggu keputusan user)

---

## Ringkasan Eksekutif

Portal brand **tidak memakai view `vw_campaign_summary` sama sekali.** Ia menarik data
mentah lalu **menghitung ulang sendiri** di dua file:

- `web-app/src/app/portal/actions/portalActions.ts` (query + agregasi server)
- `web-app/src/app/portal/[id]/PortalDashboardClient.tsx` (tampilan)

.Internal punya implementasi terpisah: `PerformaClient.tsx`.

**Akar semua selisih: dua implementasi logika yang sama, ditulis dua kali, tidak pernah
disinkronkan.** Keduanya mem-fetch data yang sama, jadi perbedaannya murni definisi.

Hasil: **9 selisih terverifikasi dengan angka.** Yang paling merusak adalah refund yang
dihitung sebagai penjualan, berdasarkan **seluruh database**.

**Empat angka yang harus diingat:**

| | Nilai |
|---|---:|
| Overstatement GMV portal, se-DB | **21,32%** (Rp 310.173.535) |
| Overstatement terburuk (KEMBANG 7 RUPA, 76) | **89,5%** |
| Baris `organic_videos` yang duplikat | **46,1%** (26.118 dari 56.660) |
| Video yang portal tampilkan | **48,3%** dari sebenarnya |

---

## Temuan

### A. 🔴 Refund dihitung sebagai penjualan — overstatement **21,32%** se-DB

`sales.gmv` untuk `is_refund = true` tersimpan **POSITIF**, bukan negatif:

```
7.054 baris refund  |  6.985 positif  |  0 negatif  |  69 nol
SUM = Rp 310.173.535
```

Karena positif, `SUM(gmv)` tanpa filter **menambah** refund ke penjualan, bukan mengurangi.

| Tempat | Filter `is_refund`? |
|---|---|
| View `vw_campaign_summary` | ✅ `WHERE is_refund = false` |
| `portalActions.ts:118` | ❌ **tidak ada** |
| `PerformaClient.ts` (query sales) | ❌ **tidak ada** |

**Artinya halaman Harian (pakai view) dan halaman Performa/Portal (pakai JS) tidak
pernah bisa sama**, dan selisihnya bertambah seiring refund masuk.

| | Nilai |
|---|---:|
| Portal / Performa (semua baris) | Rp 4.715.384 |
| View / Harian (tanpa refund) | Rp 4.490.131 |
| **Selisih** | **Rp 225.253 (+5,02%)** |

Untuk brand, ini berarti **performance yang ditampilkan lebih bagus dari kenyataan**.

#### Skala keseluruhan database: **overstatement 21,32%**

```
total semua baris (portal) : Rp 1.454.605.235
total refund              : Rp   310.173.535
total benar (view)        : Rp 1.144.431.700
overstatement             :         21,32 %
```

**Per campaign** (portal vs(view), pesanRefund):

| Campaign | Refund | Portal | Seharusnya | Over |
|---|---:|---:|---:|---:|
| KEMBANG 7 RUPA (76) | 17.162.058 | 36.328.700 | 19.166.642 | **89,5%** |
| NUTRIFLAKES (49) | 4.228.677 | 9.780.742 | 5.552.065 | **76,2%** |
| USMILE (77) | 4.379.345 | 11.207.739 | 6.828.394 | **64,1%** |
| NAISDAY (39) | 2.750.947 | 9.039.967 | 6.289.020 | **43,7%** |
| ISWHITE (47) | 7.028.867 | 25.833.666 | 18.804.799 | **37,4%** |
| PWS (38) | 4.066.961 | 15.190.581 | 11.123.620 | **36,6%** |
| SALSA Mom & Baby (36) | 13.681.888 | 56.597.734 | 42.915.846 | **31,9%** |
| WARDAH (37) | 13.859.793 | 59.864.688 | 46.004.895 | **30,1%** |
| SYB (46) | 16.003.393 | 70.054.567 | 54.051.174 | **29,6%** |
| QAHIRA (45) | 30.352.205 | 146.875.930 | 116.523.725 | **26,0%** |
| OMG Skincare (34) | 30.703.667 | 159.166.973 | 128.463.306 | **23,9%** |
| OMG Makeup (33) | 39.982.012 | 223.356.397 | 183.374.385 | **21,8%** |
| KIME (44) | 30.310.154 | 224.944.768 | 194.634.614 | **15,6%** |
| MS Glow Beauty (41) | 8.093.862 | 37.620.793 | 29.526.931 | **27,4%** |
| MILKYBOOST (52) | 225.253 | 4.715.384 | 4.490.131 | **5,0%** |

> ⚠️ **KEMBANG 7 RUPA hampir 2× lebih tinggi dari kenyataan** (89,5%). Kalau brand
> memakai angka itu untuk memutuskan anggaran, Keputusan itu salah separuh.
> Campaign kecil (52) justru yang paling kecil pencongkarannya — jadi campaign kecil
> yang paling aman, bukan yang paling kecil. Jangan hanya perbaiki yang kelihatan besar.

### B. 🔴 Views & likes menghitung livestream — likes 10,9× lebih besar

`portalActions.ts:357-364` menjumlahkan views/likes untuk semua entri.
`PerformaClient.ts:180-198` hanya untuk video (`!isLive`).

| | Portal | Internal | Selisih |
|---|---:|---:|---:|
| Views | 67.939 | 56.228 | +11.711 (+20,8%) |
| Likes | **87.223** | 7.973 | **+79.250 (10,9×)** |

Data livestream-nya sendiri juga bermasalah: **`likes > views`** (79.250 likes vs
11.711 views di campaign 52), dan `content_uid` yang sama muncul **3×** di
`organic_videos`. Jadi selisihnya gabungan dua sebab: definisi berbeda **dan** data
bermasalah.

### C. 🔴 Jumlah video hanya organik — portal **48,3%** dari sebenarnya

Portal: `fastVideoCountsData.total_approved = calcUniqueVideos` (organik saja).
Internal: `allApprovedVideoIds` = organik **+** tabel `videos` (approved).

**Seluruh 49 campaign:**

```
portal    : 26.439 video
internal  : 54.736 video
manual    : 28.297 video
portal menampilkan 48,3% dari jumlah sebenarnya
```

| Campaign | Portal | Internal | Manual |
|---|---:|---:|---:|
| KIME (44) | 9.648 | 19.253 | 9.605 |
| MS Glow Beauty (41) | 806 | 1.601 | 795 |
| WARDAH (37) | 682 | 1.288 | 606 |
| OMG Makeup (33) | 679 | 1.388 | 709 |
| SALSA Mom & Baby (36) | 423 | 837 | 414 |
| SYB (46) | 493 | 985 | 492 |
| KEMBANG 7 RUPA (76) | 288 | 850 | 562 |

**Setiap video yang diinput manual PIC tidak pernah masuk hitungan portal** — padahal
video-nya tampil di tabel. Pola konsisten di semua campaign, bukan kasus campaign 52.

#### ⚠️ Dan ternyata ada **TIGA** angka video berbeda untuk campaign yang sama

`vw_campaign_summary.achievement_video` menghitung `COUNT(v.id) WHERE link_video IS NOT NULL`
— **tanpa memfilter status approval**. Untuk KIME:

| Sumber | Angka |
|---|---:|
| Portal | 9.648 (organik saja) |
| Performa internal | 19.253 (organik + manual approved) |
| **View / Harian** | **9.605** (`link_video NOT NULL`, semua approval) |

Tiga layar, tiga angka, untuk campaign yang sama. Sumber perbedaan ini perlu
diputusan owner: **mana yang jadi definisi resmi "jumlah video tayang"?**

#### 🟡 169 video tanpa data — tidak terhitung di mana pun

`videos` dengan `link_video IS NULL` **dan** `content_uid IS NULL`:

```
52 MILKYBOOST : 73      57 GHANISKIN : 45      33 OMG Makeup : 23
54 MD Glow     :  8      56 Zeluxe    :  5      36 SALSA Mom  :  4
41 MS Glow     :  3      + 7 campaign lain, masing-masing 1-2
```

Baris kosong total — tidak ada link, tidak ada uid. Tidak masuk hitungan portal,
tidak masuk internal, **tidak masuk view** (karena `link_video IS NULL`). Jadi ini
baris sia-sia di DB; perlu diputuskan apakah dihapus atau diisi PIC.

### D. 🟡 Status creator tidak difilter — 6.160 baris tampil

`performaActions.ts:18` memfilter `LOWER(approval) IN ('approved','pending','alternate')`.
Portal **tidak memfilter sama sekali**.

```
approved     15.196 baris  (43 campaign)
not_approved  6.160 baris  (24 campaign)   ← hanya di portal
pending       1.254 baris  (30 campaign)
alternate       620 baris  (19 campaign)
```

Campaign 52: **764 baris `not_approved`** yang tidak dilihatPIC di internal.

### E. 🔴 47 dari 49 campaign masih memakai PIN `1234`

```
DEFAULT 1234 : 47 campaign   ← semua produksi
(kosong)     :  2 campaign   (50 Biodef, 51 GLOWIES)
```

Tambahan: `SELECT * FROM campaigns` di `portalActions.ts:50` menarik kolom `pin`, lalu
`campaign` dikirim ke client component → **PIN ada di payload RSC, terbaca di View
Source**. Cookie `secure: false` dan menyimpan PIN plaintext.

### F. 🟡 `target_gmv` NULL di 37 dari 49 campaign

`PortalDashboardClient.tsx:127` → `campaign?.target_gmv ? ... : 0`. Persentase
achievement selalu **0%** untuk campaign tanpa target, termasuk campaign aktif seperti
KIME, MS Glow Beauty, Zeluxe, GHANISKIN.

### G. 🟡 Cabang `tt_campaign_id` di filter live session tidak pernah kena

```sql
WHERE ls.tt_campaign_id = ${campaignId}::text    -- 0 dari 209 session COCOK
   OR ls.creator_username IN (...)                -- satu-satunya yang bekerja
```

`tt_campaign_id` **bukan** id internal kita. Semua live session masuk lewat cabang `OR`,
yang **tidak punya scoping campaign**. Kalau kreator ada di 2 campaign, session-nya
bocor ke keduanya.

### H. 🔴 `organic_videos` duplikat masif — **46% baris** terlibat

Ini bukan isu kecil. Content UID yang sama muncul berkali-kali dengan views identik.

```
content_uid yang dobel        : 8.655
total baris organic_videos   : 56.660
baris terlibat duplikasi     : 26.118   (46,1%)
dari itu livestream           : 12.124
```

**Paling parah: satu livestream muncul 28×.**

```
7645587310418922260 | 28 salinan | views identik | 2026-05-30
7645587708681964308 | 24 salinan
7646011954334665488 | 23 salinan
7645588612309879572 | 22 salinan
```

Contoh di campaign 52 (3 salinan identik masing-masing):

```
7683360846117882645 | Livestream | 1498 | 11118 | bumala_2
7683738592042879764 | Livestream |  524 | 7371 | tinajagongasuh
7683427829509933844 | Livestream | 1084 | 6017 | iam_irwansky
```

> **Sebagian besar duplikat punya `campaign_id` = NULL.** Itu sebabnya kolom campaign
> kosong di output §26. Duplikasi + `campaign_id` kosong = data yang tidak bisa
> diatribusikan ke campaign mana pun, meski jelas berasal dari TikTok.
>
> **Dampaknya ke angka:** agregasi portal memakai `Math.max()` per `content_uid`, jadi
> **Views tidak terganda** — itu sebabnya views portal hanya +20%, bukan +2.000%.
> Tapi kalau ada laporan lain yang menjumlahkan baris (`SUM`), angkanya meledak.
> **Jangan pernah pakai `SELECT COUNT(*)` dari `organic_videos` sebagai "jumlah video" —
> selalu `COUNT(DISTINCT content_uid)`.**

**§15 menunjukkan `likes > views` di 20+ campaign** — itu kemungkinan efek samping
duplikasi: likes dijumlahkan per baris di beberapa tempat, views di-place dengan
`Math.max()`. Perlu diverifikasi saat membersihkan.

### I. 🟡 Nilai hardcoded nol

`pending_with_videos: 0` · `total_pending: 0` · `dailyPerf: []` · `liveHistory: []`

Kartu UI yang memakainya selalu menampilkan nol, bukan data sebenarnya.

---

## Yang BUKAN Temuan (sudah diverifikasi aman)

- **Filter SKU tidak membuang apa pun** di campaign 52 — 0 dari 37 baris sales
  terbuang. 5 SKU terdaftar, semua product_id cocok.
- **Campaign 52 tidak punya data ads sama sekali** (0 baris `ads_performance`).
  Semua selisih di atas murni organic. Hanya 9 campaign punya data ads.
- `normalizeKurs` sudah dipakai benar di portal (`portalActions.ts:406`).

---

## Jebakan Penulisan SQL (terjadi di sesi ini)

| Jebakan | Akibat |
|---|---|
| `SELECT ... FROM total_gmv` | View bernama `vw_campaign_summary`. Error → section §5, §10 hilang |
| `total_organic_gmv` | Hanya ada di CTE internal, **tidak** ada di view. Error → §12, §14 hilang |
| `AND COALESCE(BTRIM(product_id,'')),'' <> ''` | Tanda koma salah posisi → syntax error |

**Aturan:** sebelum query ke view, **baca definisi view** di
`web-app/supabase/migrations/20261002000000_total_gmv_plus_ads.sql` (baris 163-209)
untuk nama kolom yang benar.

---

## Saran Perbaikan (menunggu persetujuan user)

Prioritas — yang **tidak perlu keputusan user**, hanya soal kebenaran data:

1. **Tambah `is_refund = false`** di query `sales` portal **dan** Performa.
   (Menghemat Rp 310 juta angka overstatement. Tidak ada kontraindikasi —
   view sudah pakai filter ini.)
2. **Filter `approval IN ('approved','pending','alternate')`** di `portalActions`.
   (Menyamakan dengan internal. Tapi hati-hati: brand mungkin **mau** melihat
   `not_approved` sebagai daftar kandidat. **Tanya user dulu.**)
3. **Buang `pin` dari `SELECT *`** dan set `secure: true` di cookie.
   (Tidak ada kontraindikasi — PIN tidak boleh bocor ke browser.)

Prioritas — **butuh keputusan user**:

4. **Views/likes:livestream ikut atau tidak?** Buang lebih benar secara data
   (`likes > views` korup), tapi ini menentukan apa yang dilihat brand.
5. **PIN `1234` → diganti?** 47 campaign butuh PIN baru, dan harus dikirim ke brand.
6. **`target_gmv` diisi atau disembunyikan?** Kalau disembunyikan, jangan tampilkan
   "0%" karena menyesatkan.

Prioritas — perlu riset dulu:

7. **Jumlah video** — samakan dengan internal (tambah video manual approved).
8. **Bersihkan livestream terduplikasi** di `organic_videos`.
9. **Filter `live_sessions`** — buang cabang `tt_campaign_id` yang mati, dan
   tambahkan scoping yang benar.

---

## Pembaruan Skill

Ringkasan dan jebakan ditulis di `.opencode/skill/tnt-project/SKILL.md` **§3B**,
dan aturan kerjanya di `AGENTS.md` bagian atas "Aturan Kerja".
