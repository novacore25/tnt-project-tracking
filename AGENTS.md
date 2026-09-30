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

7. **TypeScript sudah 89 error** dan `ignoreBuildErrors: true`. Jangan tambah error baru di
   area yang kamu sentuh. Kalau turun di bawah 20, aktifkan `ignoreBuildErrors: false`.

8. **UI language = Bahasa Indonesia**, termasuk komentar dan string user-facing.
   Tidak ada i18n — hardcoded Inline, itu normal di proyek ini.

9. **API route baru wajib cek auth di dalam handler.** `proxy.ts` hanya redirect UX, bukan
   lapisan otorisasi. Jangan andalkan proxy.

10. **Jangan edit `web-app/chrome-extension/`** — itu salinan mati. Yang benar di root.

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
