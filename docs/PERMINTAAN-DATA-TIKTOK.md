# Permintaan Data ke TikTok Shop OpenAPI

Dokumen ini berisi **3 file** yang selama ini diunduh manual dari Partner Center,
lengkap dengan kolomnya. Tujuan: mengetahui mana yang bisa diambil otomatis
lewat OpenAPI sehingga upload manual tidak perlu lagi.

---

## FILE 1 — Affiliate Orders (tab "Organik Sales")

Diunduh dari: Affiliate Center → Affiliate orders
Jumlah baris saat ini: 320
Jumlah kolom: **46**

### Kolom yang dipakai sistem kita (WAJIB ada)

| # | Kolom | Contoh nilai |
|---|---|---|
| 1 | Order ID | `586335413540324465` |
| 2 | SKU ID | `1729384958402594561` |
| 3 | Creator Username | `nris9` |
| 4 | Product ID | `1729384958349379329` |
| 5 | Product Name | `【NETTO 130ML - SYB BEST SELLER】` |
| 6 | Price | `24200` |
| 7 | Quantity | `1` |
| 8 | Fully returned or refunded | `No` (nilai: Yes / No) |
| 9 | Shop name | `SYB` |
| 10 | Shop code | `IDLCDYLLQP` |
| 11 | Partner campaign ID | `7631140567631972112` |
| 12 | Order type | `Affiliate order` |
| 13 | Order settlement status | `Unpaid by customer` |
| 14 | Content Type | `Video` |
| 16 | Content ID | `7651536528815967508` |
| 18 | Commission GMV | `26058` |
| 19 | Standard affiliate partner commission rate | `5%` |
| 22 | Est. base commission | `24200` |
| 23 | Est. affiliate partner commission | `1210` |
| 28 | Standard creator affiliate commission rate | `5%` |
| 31 | Est. creator commission | `1210` |
| 43 | Time Created | `30/09/2026 16:53:20` |

### Kolom sisa (dipakai untuk analisis, tidak wajib)

`Affiliate partner shop ads commission rate` · `TikTok bonus rate for affiliate partners` ·
`Est. affiliate partner Shop Ads commission` · `Est. affiliate partner bonus commission` ·
`Est. ISR` · `Est. IVA` · `Creator shop ads commission rate` ·
`TikTok bonus rate for creator affiliate partners` · `Est. creator Shop Ads commission` ·
`Est. creator partner bonus commission` · `Commission base` ·
`Standard commission for affiliate partner` · `Affiliate partner shop ads commission` ·
`Affiliate partner bonus commission` · `Affiliate partner ISR` · `Affiliate partner IVA` ·
`Standard creator commission` · `Shop ads commission for creators` ·
`Affiliate creator partner bonus` · `Carousel` · `Attribution type` ·
`Time order delivered` · `Payment ID` · `Payment Status`

---

## FILE 2 — Custom Report: Video (tab "Awareness Video")

Jumlah baris saat ini: 1.119
Jumlah kolom: **27**

| # | Kolom | Contoh nilai |
|---|---|---|
| 1 | Date | `2026-09-28-2026-09-29` (rentang) |
| 3 | Campaign ID | `7679014622473127687` |
| 4 | Campaign name | `TNT X MD GLOWING` |
| 5 | Campaign duration | `2026-08-28-2027-08-20` |
| 6 | Creator name | `dianasepti210` |
| 7 | Creator follower count | `2428` |
| 8 | Product ID | `1734361841279534400` |
| 9 | Product name | `MD Glowing Paket Juvenile ...` |
| 10 | Shop code | `IDLCFYLLS9` |
| 11 | Shop ID | `7494419775200987456` |
| 12 | Shop name | `MD GlowING` |
| 13 | **Video ID** | `7690506000931065095` |
| 15 | Post time | `2026-09-28 19:00:58` |
| 16 | Level 1 category | `Beauty & Personal Care` |
| 17 | Level 2 category | `Skincare` |
| 18 | **Affiliate video-attributed GMV** | `Rp154.530` |
| 19 | Creator video-attributed orders | `1` |
| 20 | Affiliate video orders | `1` |
| 21 | Estimated affiliate partner commission | `Rp2.555` |
| 22 | Actual affiliate partner commission | `Rp0` |
| 23 | Duration | `19s` |
| 24 | Video views | `26` |
| 25 | Video likes | `4` |
| 26 | Video product RPM | `Rp7.726` |
| 27 | Creator-attributed items sold | `1` |

---

## FILE 3 — Custom Report: LIVE (tab "Awareness Live")

Jumlah baris saat ini: 194
Jumlah kolom: **27**

Struktur sama persis dengan File 2, kecuali:

| # | Kolom | Contoh nilai |
|---|---|---|
| 13 | **Livestream room ID** | `7690438433676462868` |
| 14 | Livestream name | |
| 15 | LIVE time info | `2026-09-28 11:29:52-2026-09-28 13:09:57` (rentang) |
| 18 | **Creator LIVE-attributed GMV** | `Rp264.786` |
| 19 | Creator LIVE-attributed orders | `7` |
| 20 | Affiliate LIVE orders | `7` |
| 21 | Duration | `1h39min` |
| 22 | LIVE views | `442` |
| 23 | LIVE likes | |
| 24 | LIVE product RPM | |

---

# ❓ Pertanyaan untuk TikTok

## P1 — Yang paling penting
**Apakah OpenAPI bisa mengembalikan GMV **atribusi affiliate** dan GMV
**atribusi creator** secara **terpisah** untuk 1 order / 1 konten?**

File di atas memuat keduanya (`Affiliate video-attributed GMV` dan
`Creator video-attributed orders`). API kami sekarang hanya mengembalikan
satu nilai, dan angkanya **selalu berbeda** dari file.

## P2 — Endpoint mana
Untuk masing-masing file, endpoint OpenAPI mana yang mengembalikan data ini?
Apakah sama dengan:
- `GET /order/search` (order list)
- `GET /{seller_open_id}/creator_content_statistics` (performa konten)
- atau endpoint lain?

## P3 — Rate limit
Berapa **rate limit** dan **pagination limit** per endpoint? Berapa order
yang bisa diambil per hari? Kami butuh sekitar 1.000 order/hari.

## P4 — Data historis
Berapa maximally hari ke belakang yang bisa diambil? Kami sudah punya data
sampai September 2026, tidak perlu mengunduh ulang.

## P5 — Scheduled vs manual
Apakah OpenAPI bisa dipanggil otomatis terjadwal (cron) dari server kami,
atau hanya bisa dipanggil manual dari terminal?

## P6 — Placeholder yang jalan sekarang
Config OpenAPI yang aktif:
`TNT Media (Agency)`

---

# 📌 Yang sudah kami punya

Kami sudah punya integrasi OpenAPI yang berjalan otomatis **4× sehari**
(jadwal 07:00, 12:00, 15:00, 18:00 WIB). Yang sudah berhasil diambil:

**Order:** order_id · product_id · creator_username · content_uid · price ·
quantity · gmv · refund status · content_type · order_status ·
commission_rate · attribution_type · tiktok_campaign_id

**Konten (awareness):** content_uid · video_views · video_likes ·
video_product_rpm · post_time · content_type · duration_str

Jadi **bagian besar sudah ada**. Yang hilang justru yang spesifik:

| Yang hilang | Kenapa penting |
|---|---|
| Pisahan GMV affiliate vs creator | Rekonsiliasi beda Rp 100-an per order |
| Commission breakdown lengkap | Untuk Hitung komisi kreator di sistem pembayaran |
| Livestream room ID | Kunci untuk menyatukan data live |
| Shop ID / Shop name | Kunci pemetaan produk ke campaign |
| Category level 1 / 2 | Untuk filter dan laporan |
| Creator follower count | Untuk segmentasi kreator |

Kalau P1 jawabannya **tidak bisa**, mohon tahu batasannya supaya kami
tidak terus mencari tanpa ujung.