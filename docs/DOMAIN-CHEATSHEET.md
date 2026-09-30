# Domain Cheat Sheet — TNT Project Tracking

> Rujukan cepat untuk sesi yang perlu menjawab "di mana data X disimpan" atau
> "kenapa angka Y tidak cocok" tanpa harus baca ulang seluruh codebase.
> Semua path relatif terhadap `web-app/src/`.

---

## 1. Kata-kata yang Sering Muncul

| Istilah | Apa artinya | Nama teknis |
|---|---|---|
| **VT** | Video TikTok bikinan creator | `videos` |
| **Live** | Sesi live streaming | `live_sessions` + `organic_videos` (`content_type='LIVE_ROOM'`) |
| **Organic** | GMV dari link afiliasi, tanpa iklan | `sales` |
| **Ads / VSA** | GMV dari iklan TikTok Ads | `ads_performance` |
| **GMV** | Gross Merchandise Value, rupiah | `sales.gmv` (bigint) |
| **Komisi** | Fee creator (persen) | `skus.komisi` |
| **Rate card** | Harga tetap per posting | `campaign_creators.price` |
| **PIC** | Person in charge internal | `campaign_creators.notes_pic` |
| **Plafon** | Batas budget | `campaigns.budget_creator_plafon` / `budget_ads_plafon` |
| **Tier** | nano / micro / macro / mega, plus live | `campaign_creators.tier` |
| **Unmapped** | Baris yang belum punya `campaign_id` | `WHERE campaign_id IS NULL` |
| **Batch** | Header pengajuan pembayaran | `payment_batches` |
| **Kurs** | Nilai tukar USD→IDR (default 16000) | `ads_performance.kurs` |
| **Split payment** | Pecah: ratecard + biaya transfer | `payment_items.actual_transfer` / `biaya_transfer` |
| **Client approval** | Persetujuan dari brand | `campaign_creators.client_approval` |
| **Sample** | Produk fisik dikirim ke creator | `creator_addresses`, `campaign_creators.sample_progress` |

---

## 2. Di Mana Data Tinggal

### Master data
| Data | Tabel | Ditulis oleh |
|---|---|---|
| Brand klien | `brands` | `storeActions.ts` |
| Kategori konten | `niches` | `storeActions.ts` |
| Master kreator | `creators` | `creatorActions.ts:428`, `importActions.ts:209` |
| Riwayat follower/GMV | `creator_snapshots` | `creatorActions.ts:456` (**bertumpuk tiap import!**) |
| Riwayat nomor WA | `creator_contacts` | `creatorActions.ts:471` (DELETE-then-INSERT) |
| Rekening bank | `creator_bank_accounts` | `paymentActions.ts:443` |
| Alamat reusable | `creator_address_book` | `databaseActions.ts:304` |
| Produk per campaign | `skus` | `skuActions.ts:140` |

### Campaign
| Data | Tabel | Ditulis oleh |
|---|---|---|
| Campaign | `campaigns` | `storeActions.ts:194` |
| ID TikTok (TAP) | `campaigns.tiktok_campaign_ids` (text[]) | `storeActions.ts:177` |
| Pivot campaign×creator | `campaign_creators` | `importActions.ts:251`, `syncUnmapped.ts:83` |
| Master konsep | `campaign_concepts` | `campaignPageActions.ts:30` |
| Video VT | `videos` | `importActions.ts:318`, `syncUnmapped.ts:152` |
| Video/live dari TikTok | `organic_videos` | `importActions.ts:177` |
| Jadwal live | `live_schedules` | `databaseActions.ts:682` |
| Sesi live | `live_sessions` | `importActions.ts:529` |
| Produk dalam live | `live_session_products` | `importActions.ts:554` |
| Alamat kirim + resi | `creator_addresses` | `addressActions.ts` |

### Performa & keuangan
| Data | Tabel | Ditulis oleh |
|---|---|---|
| Order / penjualan | `sales` | `importActions.ts:92` |
| Performa iklan | `ads_performance` | `importActions.ts:465` |
| Topup saldo ads | `ads_topups` | `ads-report/actions.ts:299` |
| Alokasi per campaign | `ads_allocations` | `ads-report/actions.ts:342` |
| Pengeluaran ads manual | `ads_spends` | `databaseActions.ts:582` (**praktis mati**) |
| Batch pembayaran | `payment_batches` | `paymentActions.ts:427` |
| Item pembayaran | `payment_items` | `paymentActions.ts:443,579` |
| Rekening pengirim | `sender_accounts` | `paymentActions.ts:419` |
| Payout request (invoice) | `payout_requests` | `invoiceActions.ts:41` |
| Riwayat mutasi bank | `payout_creator` | `invoiceActions.ts:47` |
| Harian agregat | `daily_performance` (**VIEW**) | — (read-only) |
| Jejak audit | `audit_logs` | `databaseActions.ts:39` |

### Auth
| Data | Tabel | Ditulis oleh |
|---|---|---|
| Profil + role | `profiles` | `auth.ts:70`, `databaseActions.ts:1248` |
| Allowlist | `whitelisted_emails` | `manajemen-akun/actions.ts:93` |
| Scope per campaign | `user_campaigns` | `manajemen-akun/actions.ts:70` |
| Token TikTok | `tiktok_authorizations` (**1 baris global**) | `tiktokShopApi.ts:91` |
| Log sync | `tiktok_sync_logs` | `tiktokAutoSync.ts:838` |
| NextAuth user | `users` / `accounts` / `sessions` | **praktis tidak dipakai** |

---

## 3.ograf Alur Approval Pembayaran

```
  [Staff/Manager]  Buat batch + isi item (ratecard, rekening, nominal)
        │
        ▼  submitBatchToManager            paymentActions.ts:684
  [Manager]       managerApproveItem        :808  → final_status = 'manager_approved'
                  managerFinalizeReview      :828
        │
        ▼  financeSubmitToExecutive? atau langsung
  [Executive 1]   executiveApproveItem1     :850  → 'executive_1_approved'
                  executiveFinalizeReview1   :870
        │
        ▼
  [Finance]       financeToggleItem          :892  (pilih item mana yang dibayar)
                  financeUpdateAmounts       :1141 (isi actual_transfer, biaya_transfer)
                  financeMarkPaid            :1009 → 'paid'
                                       │ syncPaidItemsToCampaignCreators :912
                                       ▼ campaign_creators.status_bayar = 'lunas'
  [Executive]    executiveApproveItem       :1094
```

**Semua fungsi di rantai ini memanggil `auth()` tapi TIDAK PERNAH mengecek hasilnya** (lihat
`docs/audit/REMEDIATION-PLAN.md` §1.3). Global Command Center (`components/GlobalCommandCenter.tsx`)
adalah UI bulk untuk rantai ini.

---

## 4. Query yang Sering Bermasalah

### "Kenapa GMV dashboard tidak sama dengan total di TikTok Partner Center?"
Kemungkinan penyebab, urut dari paling sering:
1. Baris **unmapped** (`campaign_id IS NULL`) — cek `/unmapped` atau query di bawah
2. **Refund** tidak dikurangkan — `sales.is_refund` boolean, cek apakah view menguranginya
3. **Kurs USD** — `ads_performance.kurs` default 16000; kalau TikTok mengubah kurs, `cost_usd × kurs` beda
4. **Time window** — auto-sync default 90 hari (`tiktokAutoSync.ts:251`); order lebih lama butuh Excel import
5. **Duplikasi** — Excel import dan auto-sync punya skema `order_id` berbeda (lihat §6)
6. **View berubah definisi** — `vw_campaign_summary` di-`CREATE OR REPLACE` 6× dalam 6 bulan

```sql
-- Cek unmapped
SELECT campaign_id, COUNT(*), SUM(gmv) FROM sales WHERE campaign_id IS NULL
GROUP BY campaign_id ORDER BY 2 DESC;

-- Cek refund tidak dikurangkan
SELECT COUNT(*), SUM(gmv) FROM sales WHERE is_refund = true AND campaign_id = <id>;

-- Cek duplikasi order_id
SELECT order_id, COUNT(*) FROM sales GROUP BY order_id HAVING COUNT(*) > 1 LIMIT 20;
```

### "Kenapa 'Total GMV' per video berbeda antara tab Video dan tab Performa?"
Karena tiga definisi berbeda:
- `get_campaign_video_stats` (`20260910_fix_video_stats_sku_filter.sql`)
- `get_campaign_creator_performance` (`20260730093600_fix_sales_agg_rpc.sql`)
- `get_performance_summary_v2` (`20260731150500`)
Masing-masing punya filter sendiri. Periksa definisi filter di file migration masing-masing
sebelum membandingkan angka.

### "Kenapa saya tidak bisa edit / tombol disabled?"
`AuthProvider.canEditCampaign()` (`AuthProvider.tsx:71-80`) Hide-or-disable kalau:
- bukan role `manager`/`finance`/`executive`/`admin`
- DAN `user_campaigns` tidak punya `all_campaigns = true`
- DAN `user_campaigns` tidak punya `campaign_id` yang cocok

**Fix:** `/manajemen-akun` → assign campaign ke user. **Catatan:** ini hanya UI —
server action tetap bisa dipanggil langsung (lihat §7).

### "Kenapa video/live tidak muncul di halaman Video padahal ada di organic_videos?"
- `tiktokAutoSync.ts:717-722` **melempar** video yang `campaign_id IS NULL` (silent drop, cuma `console.log`)
- `videos` tabel harus punya baris yang cocok `content_uid`. Auto-populate hanya jalan
  di jalur Excel import (`importActions.ts:285-336`, `isVideoMode`), **bukan** di auto-sync TikTok
- `videos` tidak ada unique constraint → cek duplikat manual

### "Kenapa data ke-redirect ke halaman /pending?"
Currently **tidak pernah** — `auth.ts:72` selalu set `status='approved'`. Halaman `/pending`
adalah halaman mati. Kalau user memang perlu flow persetujuan, itu fitur yang belum
diimplementasikan (lihat `REMEDIATION-PLAN.md` §5.10).

---

## 5. Pola Code yang Harus Diikuti

### Server action dengan guard
```ts
'use server';
import { requireRole, requireCampaignAccess } from '@/lib/guards';

export async function updateSomething(campaignId: number, payload: X) {
  const { profile } = await requireCampaignAccess(campaignId);
  try {
    const [data] = await db.execute(sql`
      UPDATE something SET ... WHERE id = ${payload.id} AND campaign_id = ${campaignId}
      RETURNING *
    `) as any[];
    revalidatePath(`/campaigns/${campaignId}/...`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
```
> **Ownership WAJIB masuk ke `WHERE`**, bukan dicek terpisah. Lihat `skuActions.ts:50` (benar)
> vs `storeActions.ts:304` (salah — `campaignId` cuma untuk `revalidatePath`).

### Komponen yang baca store
```tsx
'use client';
import { useDatabaseStore } from '@/store/useDatabaseStore';
const { campaigns, updateCampaign } = useDatabaseStore();
const campaign = campaigns.find(c => c.id === campaignId);
```
> ⚠️ `campaigns` di-store **hanya berisi Campaign Summary** (dari `getInitialStoreData`) —
> bukan semua kolom. Kalau butuh kolom lain, fetch sendiri.

### Halaman yang ambil data sendiri
```tsx
'use client';
const { profile, canEditCampaign } = useAuth();

useEffect(() => {
  loadData();               // server action
  // ...
}, [campaignId]);
```
> Mayoritas halaman besar (video, listing, daily, performa) punya local state sendiri,
> **bukan** dari store. Jangan cari data halaman di store — tidak ada di sana.

### SQL dengan list IN
```ts
// BENAR — db/index.ts
import { sqlInList } from '@/db';
const rows = await db.execute(sql`
  SELECT * FROM x WHERE id IN ${sqlInList(ids)}
`);
// Array kosong → IN (NULL) → 0 baris (fail-closed). AMAN.
```

---

## 6. Jebakan Duplikasi Data

### order_id punya 2 skema berbeda
| Jalur | Format | Lokasi |
|---|---|---|
| Excel import | `${orderIdRaw}_${skuIdStr}_${rawProductId}_${tiktokCampaignId}` | `OrganicImport.tsx:425` |
| Auto-sync TikTok | ID TikTok mentah | `tiktokAutoSync.ts:348` |

→ Kalau keduanya jalan untuk periode yang sama, **order yang sama masuk 2× dan GMV dobel**.

### organic_videos dengan product_id NULL
`ON CONFLICT (content_uid, product_id)` (`importActions.ts:183`) tidak pernah terpicu kalau
`product_id` NULL, karena `NULL != NULL` di unique index. → **duplikat setiap sync**.
Fix: partial unique index (`WHERE product_id IS NOT NULL`) + index kedua, atau `NULLS NOT DISTINCT`.

### check-then-insert tanpa constraint
Lokasi: `importActions.ts:251,289,310`, `syncUnmapped.ts:83,143,147`.
Pola `SELECT ... LIMIT 1` lalu `INSERT` — dua request paralel bisa lolos SELECT yang sama.
Fix: unique constraint + `ON CONFLICT DO NOTHING`.

---

## 7. Obervasi Keamanan yang Relevant untuk Debugging

Kalau mysteriously sebuah action berhasil padahal kamu tidak expect-nya:
1. **Server action tidak punya auth.** Cek `file:line` — grep `await auth()` di file itu.
   Kalau tidak ada, siapa pun yang login bisa memanggilnya.
2. **`campaignId` dari client dipercaya.** Kalau `WHERE`-nya tidak memuat `campaign_id`,
   itu bug scoping, bukan fitur.
3. **Periksa `user_campaigns` di DB, bukan `canEditCampaign`.** Guard client cuma mengubah
   tampilan. Yang menentukan adalah isi `user_campaigns.user_id` (uuid dari `profiles.id`).
4. **`auth()` vs `requireUser()`.** `auth()` mengembalikan `null` kalau tidak login — kode
   seperti `const userId = session?.user?.id` **tidak throw**, hanya dapat `undefined`.

Untukizu user yang "seharusnya tidak bisa akses tapi bisa":
```sql
-- Cek role
SELECT email, role, status FROM profiles WHERE email = '<email>';
-- Cek scope
SELECT * FROM user_campaigns WHERE user_id = (SELECT id FROM profiles WHERE email = '<email>');
```

---

## 8. Referensi Cepat

| Butuh | Buka |
|---|---|
| Peta domain lengkap | `docs/ARCHITECTURE-CURRENT.md` §3 |
| Alur ingestion | `docs/ARCHITECTURE-CURRENT.md` §5 |
| Otorisasi (siapa bisa apa) | `docs/ARCHITECTURE-CURRENT.md` §6.4 |
| Pipeline TikTok detail | `docs/ARCHITECTURE-CURRENT.md` §7 |
| Semua temuan audit | `docs/audit/2026-09-30-AUDIT.md` |
| Rencana perbaikan | `docs/audit/REMEDIATION-PLAN.md` |
| Konteks untuk AI agent | `.opencode/skill/tnt-project/SKILL.md` |
| DDL database (benar) | `web-app/supabase/migrations/` (43 file) |
|_next.js 16 docs | `web-app/node_modules/next/dist/docs/` |
| Gaya kode minimal | `web-app/.agents/skills/ponytail/SKILL.md` |
