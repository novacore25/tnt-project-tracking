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

---

## Temuan

### A. 🔴 Refund dihitung sebagai penjualan — Rp 310.173.535

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
| **Selisih** | **Rp 225.253 (+5,0%)** |

Untuk brand, ini berarti **performance yang ditampilkan lebih bagus dari kenyataan**.

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

### C. 🔴 Jumlah video hanya organik — portal ~50% dari sebenarnya

Portal: `fastVideoCountsData.total_approved = calcUniqueVideos` (organik saja).
Internal: `allApprovedVideoIds` = organik **+** tabel `videos` (approved).

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

### H. 🟡 Livestream terduplikasi di `organic_videos`

Content UID yang sama muncul 3× dengan views/likes identik. Contoh (campaign 52):

```
7683360846117882645 | Livestream | 1498 | 11118 | bumala_2      (3 baris identik)
7683738592042879764 | Livestream |  524 | 7371 | tinajagongasuh (3 baris identik)
7683427829509933844 | Livestream | 1084 | 6017 | iam_irwansyah   (3 baris identik)
```

Agregasi portal memakai `Math.max()` per `content_uid` sehingga angka Views tidak
terganda — tapi baris tetap dobel di DB dan perlu dibersihkan.

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
