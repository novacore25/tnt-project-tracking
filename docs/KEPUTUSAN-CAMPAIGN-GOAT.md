# KEPUTUSAN-CAMPAIGN-GOAT.md — Arsip Campaign GOAT

> **Dokumentasi resmi hasil audit & analisis forensic 25 file spreadsheet GOAT di `C:\Users\Banzilla\Downloads\campaign goat`.**
> Tanggal audit: 27 Oktober 2026

---

## 1. Latar Belakang & Tujuan

Owner TNT sebelumnya memiliki perusahaan bernama **GOAT**. Sistem Project Tracking System TNT akan difungsikan untuk mengarsipkan seluruh riwayat performa, campaign, kreator, video, dan ads dari GOAT agar tersimpan secara permanen dan terstruktur.

### Prinsip Utama (Guard & Otorisasi):
1. **Khusus Role `executive`:** Menu switch perusahaan `[ TNT | GOAT ]` serta seluruh data campaign/performa GOAT **hanya boleh diakses dan dilihat oleh role `executive`**.
2. **Isolasi Mutlak:** User dengan role lain (`admin`, `manager`, `finance`, `leader`, `creator`) terkunci 100% pada TNT dan tidak boleh mengetahui/melihat keberadaan arsip GOAT.
3. **Kesesuaian Tampilan Dashboard:** Tampilan sub-menu campaign GOAT dibuat sama persis dengan sistem TNT (`/performa`, `/listing`, `/video`, `/ads-report`) dan saling terkoneksi.
4. **Video Berbasis Link Publik:** Video disimpan langsung menggunakan link TikTok asli (`https://www.tiktok.com/@...` atau `https://vt.tiktok.com/...`) tanpa membutuhkan scraping `product_id` atau `content_uid` Partner Center.

---

## 2. Temuan Audit: Analisis Duplikasi & Hubungan Antar-Sheet / Antar-File

Hasil pengecekan skrip forensik terhadap seluruh 25 file menunjukkan adanya hubungan tumpang tindih (*overlap*) baik antar-file maupun antar-sheet dalam file yang sama:

### 2.1 File yang Berpasangan / Identik Antar-File (Cross-File)

| Pasangan File | Temuan Forensic | Keputusan Ingestion |
|---|---|---|
| **`Rose All Day (Internal)`** vs **`GOAT X ROSE ALL DAY (EXTERNAL)`** | • 103 link video identik (overlap).<br>• 100% kreator di file External (66 orang) ada di Internal.<br>• File Internal menyimpan database kerja (ratecard, draft, spend ads harian).<br>• File External menyimpan report final live VT & sales ke brand. | **Satukan ke 1 Campaign:** `Rose All Day x GOAT`.<br>Gunakan data External untuk video & sales, perkaya dengan rate card & spend ads dari file Internal. |
| **`LIGHT+ (EXTERNAL)`** vs **`Light+ x GOAT Agency`** | • File Agency berisi 995 baris katalog master SKU/produk.<br>• File External berisi data kreator (166 orang) & video (279 link). | **Bukan 2 Campaign.** Jadikan 1 campaign `Light+ x GOAT`, di mana file Agency berfungsi sebagai Master SKU. |
| **`Wardah x GOAT MANAGEMENT`** vs **`GOAT X WARDAH 4 GLASTING LIP MATTE`** | • 0 video overlap.<br>• Overlap kreator hanya 15 orang (17%).<br>• Format & produk berbeda (General vs Lip Matte). | **2 Campaign Berbeda:**<br>1. `Wardah x GOAT 1` (163 VT, GMV Rp 329 Jt)<br>2. `Wardah x GOAT 4 (Glasting Lip Matte)` (61 VT, GMV Ads Rp 624 Jt). |
| **`Mooi x JARInhouse (Ext)`** vs **`GOAT X MOOI 2`** | • 0 video overlap.<br>• 0 kreator overlap.<br>• File JARInhouse adalah talent pool awal (53 talent). | **2 Campaign Berbeda:**<br>1. `Mooi x JAR Inhouse`<br>2. `Mooi x GOAT 2` (568 VT, GMV Rp 41 Jt). |

---

### 2.2 Duplikasi Antar-Sheet dalam 1 File (Intra-File Overlap)

Beberapa file memiliki sheet interim/draft yang menumpuk dengan sheet final. **WAJIB dideduplikasi agar angka GMV, video, dan kreator tidak terhitung ganda:**

1. **SALSA 2 (`SALSA 2 (External).xlsx`):**
   * Sheet `R` memiliki 44 kreator & 185 video.
   * Sheet `Report Campaign` memiliki 64 kreator & 360 video.
   * **Overlap:** 38 kreator (86%) dan 154 video sama.
   * **Aturan:** Gunakan `Report Campaign` sebagai master kebenaran. Abaikan sheet `R` untuk mencegah double-counting.
2. **PWS 2 (`PWS 2 (External) GOAT.xlsx`):**
   * Sheet `Report` (46 kreator, 168 video).
   * Sheet `Report Campaign` (49 kreator, 274 video).
   * **Overlap:** 43 kreator (93%) dan 159 video sama.
   * **Aturan:** Gunakan `Report Campaign` sebagai master kebenaran.
3. **DLF (`DLF X GOAT MANAGEMENT (EXTERNAL).xlsx`):**
   * Sheet `R` (69 kreator, 207 video) vs Sheet `Report Campaign` (62 kreator, 250 video).
   * **Overlap:** 49 kreator (71%) dan 138 video sama.
   * **Aturan:** Ambil dari `Report Campaign`, lakukan union distinct link video jika ada video unik di `R`.
4. **PrettyMe (`PRETTYME X GOAT MANAGEMENT.xlsx`) — 2 Campaign dalam 1 File:**
   * Sheet `Exposure Creator List`: 39 kreator, 79 video link.
   * Sheet `Report Campaign Sale 2`: 53 kreator, 72 video link.
   * **Overlap:** 0 kreator & 0 video (0% overlap).
   * **Keputusan:** Dipecah menjadi **2 campaign**:
     * `PrettyMe x GOAT (Exposure)`
     * `PrettyMe x GOAT 2 (Sale)`
5. **Deto Life (`GOAT X DETO LIFE (External).xlsx`) — Multi-Produk Sub-Campaign:**
   * Terdapat 5 sheet report produk: `Detobets` (9 VT), `Gerd Zero` (67 VT), `Diabetolac` (45 VT), `Warung Herba` (3 VT), `Stevia` (13 VT).
   * **Keputusan:** Digabungkan ke dalam payung campaign `Deto Life x GOAT` dengan atribut produk/toko yang tercatat rapi per video/kreator.
6. **LIGHT+ (`LIGHT+ x GOAT (EXTERNAL).xlsx`):**
   * Memiliki `Creator Adress` (Batch 1: 91 kreator) dan `Creator Address BATCH 2` (Batch 2: 68 kreator).
   * Sheet `Daily Report Campaign` (135 VT) dan `Link VT (Terupdate 21 Apr)` (146 VT).
   * **Aturan:** Lakukan union `DISTINCT link_video` dari kedua sheet video.
7. **Ellips (`GOAT X ELLIPS.xlsx`):**
   * Sheet `Creator Address` vs `Copy of Creator Address` memiliki overlap 98% (sheet duplikat backup). Ambil satu saja.

---

## 3. Matriks 14 Campaign Full Performance GOAT

| No | Nama Campaign di Sistem | Brand | Kreator Total (Jual) | Video | GMV Organik | GMV Ads | Total GMV |
|---|---|---|:---:|:---:|---:|---:|---:|
| 1 | **Ellips x GOAT** | Ellips | 197 *(47)* | 92 VT | Rp 688.824.858 | Rp 29.314.150 | **Rp 718.139.008** |
| 2 | **Wardah x GOAT 4 (Glasting)** | Wardah | 88 *(11)* | 61 VT | Rp 517.377 | Rp 624.550.738 | **Rp 625.068.115** |
| 3 | **SALSA x GOAT 2** | SALSA | 297 *(104)* | 392 VT | Rp 154.346.978 | Rp 202.015.375 | **Rp 356.362.353** |
| 4 | **Wardah x GOAT 1** | Wardah | 90 *(46)* | 163 VT | Rp 329.317.055 | Rp 0 | **Rp 329.317.055** |
| 5 | **Rose All Day x GOAT** | Rose All Day | 84 *(58)* | 127 VT | Rp 9.710.748 | Rp 234.504.752 | **Rp 244.215.500** |
| 6 | **PWS x GOAT 2** | PWS | 284 *(39)* | 283 VT | Rp 147.741.540 | Rp 380.233.456 | **Rp 527.974.996** |
| 7 | **Lea Gloria x GOAT** | Lea Gloria | 171 *(73)* | 238 VT | Rp 34.793.504 | Rp 103.284.030 | **Rp 138.077.534** |
| 8 | **DLF x GOAT** | DLF | 233 *(42)* | 323 VT | Rp 113.945.977 | Rp 21.811.253 | **Rp 135.757.230** |
| 9 | **Skin Game x GOAT** | Skin Game | 97 *(26)* | 105 VT | Rp 8.811.142 | Rp 52.210.509 | **Rp 61.021.651** |
| 10 | **Mooi x GOAT 2** | Mooi | 300 *(55)* | 568 VT | Rp 27.805.409 | Rp 13.352.017 | **Rp 41.157.426** |
| 11 | **Deto Life x GOAT** | Deto Life | 99 *(29)* | 136 VT | Rp 7.721.890 | Rp 24.642.276 | **Rp 32.364.166** |
| 12 | **PrettyMe x GOAT 2 (Sale)** | PrettyMe | 54 *(22)* | 72 VT | Rp 24.889.528 | Rp 0 | **Rp 24.889.528** |
| 13 | **Light+ x GOAT** | Light+ | 166 *(11)* | 279 VT | Rp 7.364.685 | Rp 16.649.866 | **Rp 24.014.551** |
| 14 | **FlimColla x GOAT** | FlimColla | 118 *(22)* | 144 VT | Rp 11.014.208 | Rp 11.448.337 | **Rp 22.462.545** |

*(Campaign awareness/seeding tanpa report sales seperti Animate, AHW Skin Lab, PrettyMe Exposure, Fameux, Ebelin, Magic Box, dan LUX tetap dimasukkan sebagai campaign arsip dengan data kreator & link video lengkap).*

---

## 4. Rencana Eksekusi Teknis

1. **Database Schema:**
   - Tambah kolom `company VARCHAR(20) DEFAULT 'TNT'` di tabel `campaigns` via migration resmi di `web-app/supabase/migrations/`.
   - Update view performa (`vw_campaign_summary`) atau filter backend agar mendukung pemisahan entitas.
2. **Otorisasi & Guard:**
   - Company Switcher hanya muncul jika `profile.role === 'executive'`.
   - Server Actions memfilter otomatis `company = 'TNT'` untuk non-executive.
3. **Ingestion Script:**
   - Script otomatisasi berbasis Python/Node.js yang membaca file-file Excel GOAT dengan menerapkan aturan deduplikasi di atas.
