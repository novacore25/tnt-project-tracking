# AGENTS.md — TNT Project Tracking System

> **Baca ini sebelum-touch kode apa pun di repo ini.**

## Struktur Repo

| Lokasi | Isi |
|---|---|
| `web-app/` | **Aplikasi Next.js 16** — ini yang di-push & di-deploy. Root Dockerfile hanya `COPY web-app/`. |
| `web-app/src/` | Sumber aplikasi (163 file, ~51.000 baris) |
| `web-app/supabase/migrations/` | **Sumber kebenaran DDL** (43 file) |
| `web-app/scripts/` | 223 file utilitas one-off. **Bukan** bagian dari build. Banyak punya koneksi DB hardcoded — jangan di-commit perubahan baru di sini. |
| `chrome-extension/` | Ekstensi Chrome (versi yang benar) |
| `docs/` | Dokumentasi hasil audit 30 Sep 2026 |
| `graphify-out/` | Cache knowledge graph. Tidak berguna di git. |
| `ARCHITECTURE.md` | **DOKUMEN LAMA (v2.2)** — sebagian tidak akurat. Baca sebagai sejarah. |

## Dokumentasi & Skill

| Dokumen | Kapan dibaca |
|---|---|
| `.opencode/skill/tnt-project/SKILL.md` | **Selalu** — konteks domain, jebakan terverifikasi, aturan kerja |
| `docs/LOG-PERTEMUAN-2026-10-01.md` | **Sesi 30 Sep–1 Okt 2026** — masalah → diagnosis → solusi, angka sebelum/sesudah, item tertunda + pemiliknya |
| `docs/KEPUTUSAN-PEMBAYARAN.md` | **Migrasi payment** — 10 keputusan user yang sudah dikunci + realitas DB terverifikasi |
| `docs/ARCHITECTURE-CURRENT.md` | Paham bentuk sistem, peta domain, jalur ingestion |
| `docs/DOMAIN-CHEATSHEET.md` | "Di mana data X?" / "Kenapa angka Y beda?" |
| `docs/audit/2026-09-30-AUDIT.md` | Laporan audit lengkap (DB, auth, pipeline, frontend) |
| `docs/audit/REMEDIATION-PLAN.md` | Rencana perbaikan 6 fase |
| `web-app/AGENTS.md` | Aturan Next.js 16 (baca `node_modules/next/dist/docs/` dulu) |
| `web-app/.agents/skills/ponytail/SKILL.md` | Gaya kode: native-first, minimalist, reuse, anti-boilerplate |

## Aturan Kerja (tidak bisa dinegosiasikan)

> **Dua aturan tambahan dari audit portal 2 Okt 2026 — baca sebelum kerja di `portal/`.**
>
> **0. Portal brand bukan sumber kebenaran.** `/portal/[id]/dashboard` **tidak memakai
>    view sama sekali** — ia fetch data mentah lalu hitung ulang sendiri di
>    `portalActions.ts` + `PortalDashboardClient.tsx`, terpisah dari
>    `PerformaClient.tsx`. **Dua implementasi logika yang sama, ditulis terpisah.**
>
> **0b. View itu `vw_campaign_summary`, bukan `total_gmv`.** `total_gmv` itu **nama kolom**
>    di dalamnya. Kolom yang tersedia: `total_gmv_achievement`, `total_gmv`,
>    `total_gmv_video`, `total_gmv_live`, `total_ads_gmv`, `total_ads_spend`,
>    `achievement_video`, `achievement_creator`, `budget_ads_terpakai`, `sisa_budget_ads`,
>    `tracked_creator_gmv`. **Tidak ada `total_organic_gmv` di view** — hanya di CTE internal.
>    Oles ke view = error, dan section setelahnya hilang. Sudah menewaskan 2 script (`48`, `49`).
>
> **9 selisih portal vs internal — semuanya TERBUKTI dengan angka** (`docs/sql/48`–`50`):
>
> | Temuan | Dampak terukur |
> |---|---|
> | **Refund dihitung sebagai penjualan** | `sales.gmv` untuk `is_refund = true` disimpan **POSITIF**, jadi `SUM(gmv)` tanpa filter **menambah** refund. View pakai `is_refund = false`; **portal & Performa tidak punya filter itu sama sekali** → **21,32% overstatement se-DB** (Rp 310.173.535). **KEMBANG 7 RUPA (76) hampir 2× lebih tinggi dari kenyataan (89,5%).** Campaign kecil justru paling aman — jangan hanya perbaiki yang paling besar. |
> | Views/likes menghitung livestream | likes **10,9×** lebih besar (portal 87.223 vs internal 7.973) |
> | Jumlah video hanya organik | portal **48,3%** dari sebenarnya, dan ada **TIGA angka berbeda** untuk campaign yang sama (portal / internal / `achievement_video` di view — yang itu **tidak** filter approval) |
> | **`organic_videos` 46% baris duplikat** | 26.118 dari 56.660 baris, paling parah **28×**. **Jangan pernah `COUNT(*)` dari tabel ini** — selalu `COUNT(DISTINCT content_uid)`. Sebagian besar duplikat punya `campaign_id` NULL |
> | Status creator tidak difilter | **6.160 baris `not_approved`** tampil di portal |
> | **PIN `1234` untuk 47 dari 49 campaign** | semua portal brand terbuka; `pin` juga bocor ke browser via `SELECT *` → payload RSC, cookie `secure: false` |
> | `target_gmv` NULL di 37 campaign | persentase selalu `0%` |
> | Cabang `tt_campaign_id` di filter live | **0 dari 209 session cocok** — cabang mati, semua masuk lewat `OR` yang tanpa scoping |
> | 169 baris `videos` sia-sia | `link_video IS NULL` **dan** `content_uid IS NULL` → tidak terhitung di portal, internal, **maupun** view |
>
> **Keputusan owner sudah diterapkan 2 Okt 2026** (`docs/KEPUTUSAN-PORTAL.md`):
> refund **ikut masuk** (yang diubah **view**, bukan portal — `total_gmv` se-DB naik
> **21,32%** ke Rp 1.454.605.235, migration `20261003000000`), `not_approved`
> **disembunyikan**, views/likes **tetap** hitung livestream, PIN `1234` **dibiarkan**,
> jumlah video **mengikuti internal**.
>
> **Jangan tambah angka baru di portal sebelum menyamakan logicanya dengan internal.**
> Kalau belum sinkron, tambahkan di internal dulu (satu sumber), lalu pakai ulang.

1. **Jangan pernah `drizzle-kit push` atau `generate`.** `src/db/schema.ts` stale dan tidak
   cocok dengan DB. `push` akan menghapus unique constraint `sales.order_id`.
   Perubahan skema = file SQL baru di `web-app/supabase/migrations/` dengan timestamp monotonic.

2. **Server action baru wajib punya guard server-side.** Buat `requireUser()` / `requireRole()` /
   `requireCampaignAccess()` di `lib/guards.ts` (belum ada — buat dulu). Template yang benar
   sudah ada di `manajemen-akun/actions.ts:8-21` (`getAdminUser`).
   **Jangan tiru pola lama** yang hanya andalkan `canEditCampaign` — itu client-side saja.

3. **Ownership wajib masuk ke `WHERE`**, bukan dicek terpisah. Bandingkan:
   - BENAR: `skuActions.ts:50` — `DELETE ... WHERE id=? AND campaign_id=?`
   - SALAH: `storeActions.ts:304` — `campaignId` hanya untuk `revalidatePath`, tidak masuk `WHERE`

4. **Jangan hardcode secret.** `process.env.X` tanpa fallback literal.
   Saat ini sudah ada 6 lokasi yang melanggar (lihat `docs/audit/2026-09-30-AUDIT.md` §6.1).

5. **Jangan tambah `revalidatePath` / `router.refresh()` untuk "fix" refresh.** 101 panggilan
   sudah ada dan tidak berefek untuk UI client. User sudah terbiasa dengan perilaku ini.

6. **Uang:** rupiah bulat = `bigint`. Desimal = `NUMERIC(18,2)`. `ROUND()` di SQL bukan di JS.
   Jangan `float`/JS number untuk akumulasi rupiah.

7. **`pg` return `bigint`/`numeric` sebagai STRING.** `0 + "123"` = `"0123"`. Semua penjumlahan
   rupiah WAJIB lewat `sumNum`/`toNum` dari `web-app/src/utils/computed.ts`. Jangan tulis
   `rows.reduce((s, r) => s + (r.gmv || 0), 0)` — itu merangkai string, bukan menjumlahkan.
   Gejalanya di UI: angka ribuan digit diawali digit `0`.

8. **Total GMV = `SUM(sales.gmv)` + `ads_performance` (Video Shopping Ads)**, non-refund,
   dipecah live/video dari `content_type`. Pemetaan selalu lewat **`product_id`**, bukan `sku_id`.

   > **BUKTI (2 Okt 2026, migration `20261002000000` sudah jalan):**
   > - `sales` ← impor **TikTok Partner Center**, **pure organik**
   > - `ads_performance` ← impor **TikTok Ads Manager** (Video Shopping Ads)
   > - **Order dari video yang di-ads TIDAK masuk Partner Center.** Dua stream terpisah,
   >   jadi ads **harus dijumlahkan** ke total.
   > - Bukti: delta harian ads vs sales beda 100–1500x, nol yang mirip (`docs/sql/46`)
   > - Cara hitung ads: **baris `tanggal TERAKHIR` per `ad_id`** (laporan Ads all-time).
   >   **Kurs memakai kurs pada baris itu sendiri** — tidak dijumlahkan antar tanggal,
   >   tidak diambil dari baris lain.
   >   **JANGAN `MAX`** — `MAX(gross_revenue_usd * kurs)` diam-diam memilih baris dengan
   >   **kurs tertinggi**, jadi angka bisa naik karena kurs naik padahal revenue USD tetap.
   >   Terbukti 2 Okt 2026: 54 dari 316 ad punya nilai IDR lebih kecil di tanggal terakhir
   >   **karena kursnya lebih kecil, bukan karena data hilang** (`docs/sql/47`)
   > - `total_gmv` sekarang = **Rp 4.160.235.142** (sebelumnya Rp 920.211.710)
   > - Biaya ads **173.207.991 → 171.167.128** (ikut aturan tanggal-terakhir, konsisten)
   > - **Ads kosong = normal.** Lakunya menyesuaikan budget, campaign yang belum mulai atau
   >   kehabisan budget memang tidak punya data ads. Jangan dianggap gap impor.
   >
   > Halaman **Harian** dan **Portal Klien** juga `organik + ads` — konsisten.
   > Lihat `SKILL.md` §3A.7. **Kemiripan besaran bukan bukti** — jangan menyimpulkan
   > "datanya sama" cuma karena angkanya mirip.

9. **Sebelum menulis migration yang `UPDATE`/`DELETE` baris, jalankan preflight constraint.**
   `schema.ts` dan `web-app/supabase/migrations/` sama-sama TIDAK bisa dipercaya untuk
   constraint. Baca dari katalog PostgreSQL. Lihat `docs/sql/40-preflight-constraint.sql`.
   Untuk dedupe/merge: **pikir per GRUP bukan per baris**, dan buat peta satu-baris-per-parent
   supaya join tidak menggandakan baris.

   > ⚠️ **Guard jangan pakai `sum(before - after)`.** Itu meniadakan kenaikan dengan
   > penurunan — guard bisa **lolos** padahal ada campaign yang turun. Hitung **jumlah**
   > baris yang turun; satu pun = batal. (Pernah terjadi di `20261002000000`.)

10. **TypeScript sudah 89 error** dan `ignoreBuildErrors: true`. Jangan tambah error baru di
    area yang kamu sentuh. Kalau turun di bawah 20, aktifkan `ignoreBuildErrors: false`.

11. **UI language = Bahasa Indonesia**, termasuk komentar dan string user-facing.
    Tidak ada i18n — hardcoded Inline, itu normal di proyek ini.

12. **API route baru wajib cek auth di dalam handler.** `proxy.ts` hanya redirect UX, bukan
    lapisan otorisasi. Jangan andalkan proxy.

13. **Jangan edit `web-app/chrome-extension/`** — itu salinan mati. Yang benar di root.

14. **Payment: pakai TANGGAL PENGAJUAN, bukan tanggal transfer.** Fallback ke tanggal
    pembayaran kalau kosong. Prinsipnya **rekam, jangan menebak** — lebih baik tanggal
    kurang tepat daripada baris hilang. Alokasi **all-or-nothing per batch**, hanya baris
    `Paid Off` (`Not Yet`, `Cancel`, kosong → cukup NOTA). Baris tanpa campaign **harus
    dilist + didokumentasikan**, tidak pernah dikarang. Semua detail: `docs/KEPUTUSAN-PEMBAYARAN.md`.

15. **Jangan menyimpulkan "kolom X tidak ada" dari daftar output psql.** Output bisa terpotong di
    tengah — itulah akar kesalahan rencana payment §5.2 (`actual_transfer` sebenarnya ADA).
    Uji per kolom dengan `EXISTS`, atau pakai `docs/sql/42-verifikasi-payment.sql`.

16. **Payment: filter baris `TOTAL` dari spreadsheet sebelum migrasi.** Ada baris subtotal
    (`TOTAL 16882900`) di kolom `Tanggal Pembayaran` — kalau lolos, **Rp 29 juta fiktif**
    masuk sistem.

17. **`submitted_by` ditautkan lewat EMAIL, bukan nama** (`auth.ts:89,115`). Placeholder dengan
    email karangan **tidak akan pernah tertaut** — saat orang login, sistem buat profil baru dan
    batch lama menunjuk profil orphan tanpa error. Kalau nama orang tidak ada di `profiles`, pakai
    `submitted_by = NULL` + tulis nama di `batch_label`/`notes`, **jangan** bikin placeholder palsu.

18. **Jangan fuzzy-match nama orang.** Spreadsheet payment pakai nama depan (`Wahyu`, `Marini`),
    `profiles` pakai nama lengkap. **`Marini` ≠ `Maria`** — Marini 22 baris, sudah resign, tidak
    ada di sistem. Selalu pakai peta eksplisit di `docs/KEPUTUSAN-PEMBAYARAN.md` §4A.2.

19. **Spreadsheet payment punya 8 sheet dengan 4 layout kolom berbeda**, dan posisi kolom `PIC`
    berbeda tiap sheet (kol 13 di September, kol 9 di Maret, kol 10 di Februari). **Selalu cari
    kolom per NAMA header**, jangan per nomor.

20. **`requireRole` untuk approval payment sengaja DITUNDA** — user ingin observasi dulu siapa
    yang menyalahgunakan. Jangan menambahkan guard itu diam-diam; angkat kalau ada bukti nyata.

21. **Cegah duplikat dengan upsert, jangan replace.** Perintah eksplisit user: data yang tidak
    lengkap lebih boleh ada daripada data yang hilang saat ditimpa.

22. **Dokumentasikan setiap sesi di tempat yang benar, di sesi yang sama.** Kalau tidak ada
    konteks chat, dokumentasi satu-satunya cara model berikutnya tahu apa yang sudah terjadi.

    | Jenis info | Tujuan |
    |---|---|
    | Jebakan teknis, asumsi salah | `.opencode/skill/tnt-project/SKILL.md` §3 |
    | Keputusan user + alasannya | `docs/KEPUTUSAN-*.md` |
    | Timeline masalah → solusi + angka | `docs/LOG-PERTEMUAN-*.md` |
    | Rencana yang masih jalan | `C:\Users\Banzilla\.opencode\plan\` |

    **Entry basi lebih buruk dari tidak ada entry** — kalau suatu temuan sudah berstatus selesai,
    tulis ulang entry lamanya, jangan tambahkan yang bertentangan.

## Git

> **Pakai SSH, bukan HTTPS.** Setup selesai 2 Okt 2026.

```powershell
# Remote
coolify  git@github.com:novacore25/tnt-project-tracking.git
origin   git@github.com:novacore25/tnt-project-tracking.git

git add -A
git commit -m "..."
git push coolify main      # Coolify auto-deploy dari push ke main
```

**Kunci SSH:** `~/.ssh/id_ed25519_github`, sudah terdaftar di akun `novacore25`.
`~/.ssh/config` memetakan `Host github.com` ke kunci itu dengan `IdentitiesOnly yes`,
jadi `id_ed25519` yang lain tidak ikut terpakai.

Uji cepat kalau push gagal:

```powershell
ssh -T git@github.com     # harusnya: "Hi novacore25! You've successfully authenticated"
```

> `exit code 1` itu **normal** — GitHub memang tidak menyediakan shell.
> Yang penting baris sapaannya muncul.
>
> ⚠️ **Jangan pernah menulis GitHub PAT di `.git/config`, `AGENTS.md`, atau commit message.**
> Repo sudah bersih dari PAT (dicek 2 Okt 2026, tidak ada di file maupun config).
> Kalau suatu saat perlu token, pakai **SSH** — jangan pernah URL `https://token@github.com`.

## sebelum Commit

- [ ] `npm run typecheck` di `web-app/` — tidak menambah error baru
- [ ] Tidak ada secret literal di file yang diubah
- [ ] Kalau ada perubahan DB: file migration baru, bukan edit `schema.ts`
- [ ] Kalau ada server action baru: guard sudah terpasang
- [ ] Kalau menulis migration `UPDATE`/`DELETE`: **preflight constraint sudah dijalankan**
      (`docs/sql/40-preflight-constraint.sql`) dan hasilnya dicatat di header migration
- [ ] Kalau menyumplah angka rupiah: pakai `sumNum`/`toNum`, bukan `reduce` dengan `+` langsung
- [ ] Kalau mengirim SQL ke VPS: pakai **commit SHA** di URL `raw.githubusercontent.com`,
      bukan `main` — path `main` di-cache dan query string diabaikan
- [ ] Kalau menyentuh payment: **`docs/KEPUTUSAN-PEMBAYARAN.md` sudah dibaca**, tanggal pakai
      pengajuan, baris tanpa padanan dilist
- [ ] Kalau migrasi payment: **baris `TOTAL` dari spreadsheet sudah difilter**, dan peta PIC
      dipakai eksplisit (jangan fuzzy-match `Marini` → `Maria`)
- [ ] Kalau menemukan jebakan/keputusan baru: **sudah ditulis** ke `SKILL.md` §3 atau
      `docs/LOG-PERTEMUAN-*.md` di sesi yang sama — bukan ditunda ke sesi berikutnya

### Cara mengirim SQL ke VPS

```bash
# WAJIB commit SHA, bukan "main". Cache mengabaikan query string di path "main".
curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/<file>.sql" | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system

# Migration yang harus batal kalau guard gagal:
... -v ON_ERROR_STOP=1
```

Untuk SQL panjang, taruh `\pset pager off`, `\t on`, dan `\set ON_ERROR_STOP off` +
`\echo` per section supaya error di satu bagian tidak menghilangkan bagian lain.
