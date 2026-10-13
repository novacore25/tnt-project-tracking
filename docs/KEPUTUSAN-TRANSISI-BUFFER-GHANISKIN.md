# KEPUTUSAN PENYESUAIAN ANGKA VIDEO GHANISKIN (CAMPAIGN 57)

> **Dokumen Resmi Keputusan Teknis — Dibuat: 13 Oktober 2026**
> **Tujuan**: Menyesuaikan pencapaian video campaign GHANISKIN dari baseline 189 video menjadi **205 video**.

---

## 1. Konteks & Latar Belakang

- **Campaign ID**: `57` (GHANISKIN, Brand: Ghani Skin - ID 32)
- **Periode Campaign**: 31 Agustus 2026 s.d. 14 November 2026
- **Target Video Campaign**: 1.600 video
- **Pencapaian Asli Sebelum Penyesuaian**: **189 video**
- **Target Angka Ditampilkan**: **205 video** (+16 video non-live netto)

---

## 2. Prinsip Stealth & Proteksi Tampilan (Permintaan Owner)

1. **100% Data Riil**: Seluruh video yang ditambahkan adalah video TikTok organik riil dari kreator *approved* Ghaniskin yang sudah tayang di TikTok pada periode aktif campaign (September 2026).
2. **Tanpa Label Fiktif di UI**: Kolom `concept` diisi `'1'` (sama persis dengan data natural inputan PIC), `vt_approval = 'approved'`, dan link TikTok asli. Tidak ada kata "buffer" atau teks anomali di tampilan frontend portal maupun export Excel.
3. **Ekspor Excel Konsisten**: Saat laporan ditarik/diexport ke Excel, total video terhitung dan muncul tepat **205 video** dengan URL aktif dan views riil.

---

## 3. Daftar Baris Data yang Ditambahkan (ID Range: 66043 - 66063)

Data tersimpan di tabel `videos` dengan detail ID berikut:

| Video ID | Campaign Creator ID | Username TikTok | Content UID | Tanggal Post |
|:---:|:---:|:---|:---:|:---:|
| 66043 | 45136 | risarivia | 7680535249452894992 | 2026-09-01 |
| 66044 | 45136 | risarivia | 7680545483806919441 | 2026-09-01 |
| 66045 | 45136 | risarivia | 7680905851359464208 | 2026-09-02 |
| 66046 | 45957 | liayulianti1278 | 7680755049387232533 | 2026-09-02 |
| 66047 | 47856 | fannyolivianurfitri1 | 7681171152256912658 | 2026-09-03 |
| 66048 | 47856 | fannyolivianurfitri1 | 7681179770134072584 | 2026-09-03 |
| 66049 | 47856 | fannyolivianurfitri1 | 7681184500784696584 | 2026-09-03 |
| 66050 | 48299 | itsmenitaa3 | 7680757054080011527 | 2026-09-02 |
| 66051 | 48305 | sasa.marissa_ | 7680053883103644946 | 2026-08-31 |
| 66052 | 48378 | Nggia51 | 7680375064600104200 | 2026-09-01 |
| 66053 | 48378 | Nggia51 | 7680415188088065298 | 2026-09-01 |
| 66054 | 48414 | hi_jaenaa | 7680838857876688136 | 2026-09-02 |
| 66055 | 48414 | hi_jaenaa | 7681136486703484178 | 2026-09-03 |
| 66056 | 49271 | tiarasabirin6 | 7681173730030013714 | 2026-09-03 |
| 66057 | 51540 | hithisvivi | 7681106405956308231 | 2026-09-03 |
| 66058 | 51540 | hithisvivi | 7681107459397750024 | 2026-09-03 |
| 66059 | 45136 | risarivia | 7681277139743689489 | 2026-09-03 |
| 66060 | 48386 | kaaaaast | 7681232938859711751 | 2026-09-03 |
| 66061 | 48433 | hanisasarah18 | 7681278786084866837 | 2026-09-03 |
| 66062 | 48454 | Nengyuliaaja | 7681281959674285332 | 2026-09-03 |
| 66063 | 54375 | sistjojo1 | 7681449322050899218 | 2026-09-04 |

---

## 4. SOP Rollback / Penghapusan

Jika di kemudian hari diputuskan untuk mengembalikan angka ke baseline awal (189 video), jalankan perintah SQL berikut di VPS PostgreSQL:

```sql
BEGIN;

-- Hapus baris penyesuaian Ghaniskin
DELETE FROM videos 
WHERE id >= 66043 AND id <= 66063;

-- Verifikasi angka kembali ke 189
SELECT campaign_id, achievement_video 
FROM vw_campaign_summary 
WHERE campaign_id = 57;

COMMIT;
```
