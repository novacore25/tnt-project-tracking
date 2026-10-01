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

8. **Total GMV = `SUM(sales.gmv)` saja** (non-refund, dipecah live/video dari `content_type`).
   Jangan menjumlahkan `ads_performance.gross_revenue_usd` (itu kumulatif per ad DAN revenue
   yang sama dengan `sales`) atau custom report (`organic_videos`, `live_session_products`
   = awareness, bukan sales). Pemetaan selalu lewat **`product_id`**, bukan `sku_id`.

9. **Sebelum menulis migration yang `UPDATE`/`DELETE` baris, jalankan preflight constraint.**
   `schema.ts` dan `web-app/supabase/migrations/` sama-sama TIDAK bisa dipercaya untuk
   constraint. Baca dari katalog PostgreSQL. Lihat `docs/sql/40-preflight-constraint.sql`.
   Untuk dedupe/merge: **pikir per GRUP bukan per baris**, dan buat peta satu-baris-per-parent
   supaya join tidak menggandakan baris.

10. **TypeScript sudah 89 error** dan `ignoreBuildErrors: true`. Jangan tambah error baru di
    area yang kamu sentuh. Kalau turun di bawah 20, aktifkan `ignoreBuildErrors: false`.

11. **UI language = Bahasa Indonesia**, termasuk komentar dan string user-facing.
    Tidak ada i18n — hardcoded Inline, itu normal di proyek ini.

12. **API route baru wajib cek auth di dalam handler.** `proxy.ts` hanya redirect UX, bukan
    lapisan otorisasi. Jangan andalkan proxy.

13. **Jangan edit `web-app/chrome-extension/`** — itu salinan mati. Yang benar di root.

14. **Payment: pakai TANGGAL PENGAJUAN, bukan tanggal transfer.** Kolom `Tgl Actual Payment`
    kosong untuk April–Juni, jadi fallback ke tanggal pengajuan. Prinsipnya **rekam, jangan
    menebak** — lebih baik tanggal kurang tepat daripada baris hilang. Alokasi **all-or-nothing
    per batch per tanggal**, hanya baris `Paid Off`. Baris tanpa campaign **harus dilist +
    didokumentasikan**, tidak pernah dikarang. Semua detail: `docs/KEPUTUSAN-PEMBAYARAN.md`.

15. **Jangan menyimpulkan "kolom tidak ada" dari daftar output psql.** Output bisa terpotong di
    tengah — itulah akar kesalahan rencana payment §5.2 (`actual_transfer` sebenarnya ADA).
    Uji per kolom dengan `EXISTS`, atau pakai `docs/sql/42-verifikasi-payment.sql`.

16. **`requireRole` untuk approval payment sengaja DITUNDA** — user ingin observasi dulu siapa
    yang menyalahgunakan. Jangan menambahkan guard itu diam-diam; angkat kalau ada bukti nyata.

17. **Cegah duplikat dengan upsert, jangan replace.** Perintah eksplisit user: data yang tidak
    lengkap lebih boleh ada daripada data yang hilang saat ditimpa.

18. **Dokumentasikan setiap sesi di tempat yang benar, di sesi yang sama.** Kalau tidak ada
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

```powershell
# Credential helper sudah dikonfigurasi. JANGAN tulis PAT di URL atau di file.
git add -A
git commit -m "..."
git push coolify main
```

> ⚠️ **Jangan pernah menulis GitHub PAT di `.agents/AGENTS.md`, `.git/config`, atau commit message.**
> PAT yang ada di sana **harus dirotasi** (lihat `docs/audit/REMEDIATION-PLAN.md` §FASE 2).
> Ganti dengan credential helper atau GitHub CLI auth.

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
