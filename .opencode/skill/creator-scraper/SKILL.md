---
name: creator-scraper
description: Panduan teknis lengkap, peta selektor DOM TikTok Partner Center, rumus kalkulasi GMV (RIIL vs ESTIMASI), penanganan infinite scroll out-of-order, anti-bot captcha pause/resume, dan arsitektur Staging Creator untuk Chrome Extension TNT Creator Scraper. Wajib dibaca sebelum menyentuh chrome-extension/ atau fitur Staging Creator (/creator-pool/staging).
---

# Skill: TNT Creator Auto-Scraper & Staging System (`creator-scraper`)

> **BACA INI SEBELUM MENYENTUH `chrome-extension/` ATAU `web-app/src/app/creator-pool/staging/`.**
> Seluruh selektor DOM, rumus matematika, dan aturan kerja di skill ini berasal dari ekstraksi *live DOM* TikTok Partner Center (`garfish_app_for_affiliate-cmp`) dan keputusan terkunci owner pada `docs/KEPUTUSAN-SCRAPING-CREATOR-STAGING.md`.

---

## 1. Aturan Mutlak (Tidak Bisa Dinegosiasikan)

1. **Jangan Edit `web-app/chrome-extension/`:** Folder yang benar dan hidup adalah **`chrome-extension/` di root repo**.
2. **`display_name` $\neq$ `nama_asli`:**
   - Nama profil di TikTok (misal `Willie Salim`) wajib disimpan ke kolom **`display_name`**.
   - Kolom **`nama_asli`** khusus untuk nama legal sesuai KTP/NPWP/Kontrak. Jangan pernah menimpa `nama_asli` dengan `display_name` hasil scrape.
3. **Field Bio dan Teks Mentah:**
   - **Bio** (tidak diambil)
   - **`gmv_raw_text`** (tidak disimpan; langsung simpan hasil kalkulasi ke `gmv_30d` + tag `gmv_status` `'RIIL'` atau `'ESTIMASI'`).
   - **Kontak (WhatsApp & Email):** Diekstrak otomatis melalui **IM Chat Room $\rightarrow$ Modal "Contact Info"** dan header profil bisnis. Simpan ke kolom `no_whatsapp` dan `email`.
4. **Jebakan Huruf `"M"` (Rupiah vs Non-Rupiah):**
   - Pada teks **Rupiah (`Rp6,0M`)**: huruf **`M` = Miliar ($\times 10^9$)**, desimal memakai koma (`,`).
   - Pada teks **Non-Rupiah (`74.5M` followers / views / items sold)**: huruf **`M` = Million / Juta ($\times 10^6$)**, desimal memakai titik (`.`).
   - **WAJIB** pisahkan fungsi `parseIdrCurrency()` dan `parseCompactCount()`.
5. **Buku Catatan Anti-Duplikat (`knownUsernames` — Khusus Staging):**
   - Sebelum mulai scraping, ekstensi mengambil seluruh daftar `username` yang sudah ada **khusus di tabel `creator_staging` saja** (bukan `creators` utama).
   - Tujuan scraping ini adalah memasukkan semua kreator ke **Staging Creator** terlebih dahulu; nanti saat diputuskan masuk ke Creator Pool utama (`creators`), data kreator utama akan di-**update** (bukan digantikan/dihapus).
   - Saat memindai kartu di halaman *Find Creators*, jika `username` sudah ada di `knownUsernames` (`creator_staging`), **JANGAN KLIK kartu tersebut** — langsung tandai selesai dan lanjut ke kartu berikutnya.
6. **Simpan ke Local Storage Dulu $\rightarrow$ Tombol "Tambahkan ke Staging":**
   - Selama proses auto-scrape berjalan, setiap kreator yang berhasil di-scrape disimpan ke `chrome.storage.local` (`tnt_staged_queue`) dan username-nya langsung ditambahkan ke `knownUsernames` lokal.
   - Saat user menekan tombol **⏹️ STOP Scraping**, tampilkan tombol **"🚀 Tambahkan ke Staging"** yang mengirim batch tersebut ke database `creator_staging`.
7. **Loop Estafet Tanpa Jeda Statis & Tanpa Berhenti Otomatis:**
   - Begitu tab detail kreator 100% selesai ter-load dan datanya terambil, langsung tutup tab detail dan **langsung klik kartu berikutnya** (tanpa jeda tunggu statis 2 detik; cukup *human micro-jitter* `600ms–1400ms` saat scroll & *mouse event*).
   - **Jangan pernah berhenti otomatis** meskipun scroll mentok di bawah. Scraper harus terus berjalan dan memindai ulang sampai user menekan tombol **⏹️ STOP**.

---

## 2. Peta Selektor DOM TikTok Partner Center (Terverifikasi)

### 2.1 Halaman *Find Creators* (`/affiliate-cmp/creator`)

```javascript
const FIND_CREATORS_SELECTORS = {
  // Scroll container utama (virtualized / infinite scroll)
  scrollContainer: 'div[data-e2e="9d644e6c-6279-450c"] > div[style*="overflow: scroll"]',
  // Baris per kreator (memuat kartu profil di kiri + 3 video di kanan)
  rowItem: 'div[data-e2e="e8faf26e-bf66-5abe"]',
  // Area klik pada kartu untuk membuka tab Creator Detail
  cardClickTarget: 'div[data-e2e="0fca897b-b18b-1087"]',
  // Username kreator di kartu (jika kosong/tidak ada = masih skeleton/loading!)
  username: 'span[data-e2e="fbc99397-6043-1b32"]',
  // Display name di kartu
  displayName: 'span[data-e2e="3b9caa65-c65a-e9dc"]',
  // Level badge (misal "LVL 7")
  levelBadge: 'div[data-e2e="190b477a-d59c-ce17"]',
  // Kategori di kartu
  categoryText: 'span[data-e2e="6e905dae-25bf-454b"]',
  // Ringkasan demografi di kartu (misal "74.5M, Male 34%, 25-34")
  followerDemoSummary: 'span[data-e2e="9e8f2473-a87f-db74"]',
  // GMV di kartu (misal "Rp1JT+" atau "Rp6,0M")
  gmvText: 'span[data-e2e="dfa39213-a263-5c80"]',
  // Items sold di kartu (misal "5.63K")
  itemsSoldText: 'span[data-e2e="84077312-3e9e-6c5e"]',
  // Avg. video views di kartu (misal "12.69K")
  avgViewsText: 'span[data-e2e="ac42cf72-8039-7ab4"]',
};
```

### 2.2 Halaman *Creator Details* (`/affiliate-cmp/creator/detail?cid=...`)

```javascript
const CREATOR_DETAIL_SELECTORS = {
  // Header Profil
  avatarImg: 'img[data-e2e="e7714c21-c02b-bb8b"], .m4b-avatar-image img',
  username: 'span[data-e2e="b7f56c3b-f013-3448"], span.text-head-l',
  displayName: 'span[data-e2e="72a4feaf-82c8-ddda"]',
  levelBadge: 'div[data-e2e="190b477a-d59c-ce17"]',
  followersCount: 'span[data-e2e="7aed0dd7-48ba-6932"]',
  mcnName: 'span[data-e2e="85040a36-fb50-9f7c"]',

  // Section Tabs untuk Scroll Lazy-Load
  collaborationsSection: '#collaborations_tab',
  followersSection: '#followers_tab',
  trendsSection: '#trends_tab',

  // Kartu Metrik (Sales, Collaboration metrics, Video, LIVE)
  metricCard: 'div[data-e2e="f6855061-9011-24ab"]',
  metricLabel: 'span[data-e2e="61148565-2ea3-4c1b"]',
  metricValue: '.creator_video_data_card_trigger_is_display',

  // 4 Donut Charts (masing-masing memiliki node .pcm-pc-label di dalamnya)
  chartSalesChannel: 'div[data-e2e="4ae5aa7b-adbf-5b23"]',
  chartProductCategory: 'div[data-e2e="01d39cce-708e-bf0e"]',
  chartFollowersGender: 'div[data-e2e="cf2d5c63-63ea-cf11"]',
  chartFollowersAge: 'div[data-e2e="27e78e14-baa5-9b09"]',
  donutLabelItem: '.pcm-pc-label',
  donutLabelName: '.pcm-pc-label-name',
  donutLabelPercent: '.pcm-pc-label-percent',

  // Horizontal Bar Chart: Top 5 Locations
  chartTopLocations: 'div[data-e2e="27e78e14-baa5-9b08"]',
  barChartInner: '.ecom-data-horizontal-barchart__chart',
  chartTooltipTitle: '.lightcharts-tooltip-title',
  chartTooltipItem: '.lightcharts-tooltip-item',

  // Deteksi Captcha / Puzzle Verification TikTok
  captchaContainers: [
    '#captcha_container',
    '.captcha_verify_container',
    'iframe[src*="captcha"]',
    '.secsdk-captcha-drag-icon',
    'div[class*="captcha-verify"]'
  ]
};
```

### 2.3 Halaman *IM Chat Room* (`/partner/im?shop_id=...&creator_id=...`) & Modal Contact Info

```javascript
const IM_CONTACT_SELECTORS = {
  // Container panel profil kanan di IM
  workbenchContainer: '#workbench-container',
  // Tombol Contact Info resmi (di bawah nama/avatar kreator pada workbench)
  contactButton: 'button[data-e2e="efbe2e11-4d42-b98a"]',
  // Modal dialog Contact Info (Arco Design)
  contactModal: '.arco-modal, div[role="dialog"], .arco-modal-content',
  // Baris item kontak (Email / Phone)
  contactRow: 'div[data-e2e="0813a01f-c400-7bbc"]',
  contactLabel: 'span[data-e2e="874d2990-4769-42bc"]',
  contactValue: 'div[data-e2e="73c486d0-8321-37aa"]',
  // Tombol close modal
  modalCloseBtn: '.arco-modal-close-icon, span.arco-icon-hover.arco-modal-close-icon',
};
```
- **Alur Kerja Smart-Wait:**
  1. Halaman detail selesai mengekstrak metrik 30D $\rightarrow$ simpan payload ke `sessionStorage` & `chrome.storage.local`.
  2. Tab yang sama dialihkan ke `/partner/im?shop_id={pid}&creator_id={cid}&market=4&enter_from=find_creator_detail`.
  3. Tunggu hingga panel kanan IM chat termuat 100% berdasarkan struktur DOM HTML murni (spinner `.arco-spin-loading` hilang, username muncul, dan elemen bawah seperti `Followers`/`Send linking invite` selesai ter-render; adaptif tanpa batas detik kaku).
  4. Begitu workbench selesai ter-load 100%:
     - Jika tombol kontak ada $\rightarrow$ klik otomatis dan buka modal *Contact Info*.
     - Jika tombol kontak tidak ada $\rightarrow$ langsung log `tidak memiliki kontak`, simpan metrik dasar, tutup tab, dan lanjut ke kreator berikutnya.
  5. Jika modal *Contact Info* terbuka $\rightarrow$ ekstrak nomor telepon/WhatsApp (`no_whatsapp`) dan email (`email`).
  6. Kirim `SCRAPE_DETAIL_SUCCESS` dengan `closeTab: true` $\rightarrow$ tutup tab IM otomatis $\rightarrow$ background script menginstruksikan list tab membuka kreator berikutnya!


---

## 3. Implementasi Referensi Fungsi Parser & Kalkulasi

### 3.1 Parser Mata Uang Rupiah (`parseIdrCurrency`) vs Angka Non-Rupiah (`parseCompactCount`)

```javascript
/**
 * Khusus untuk string Rupiah Indonesia di TikTok Partner Center (misal "Rp6,0M", "Rp179,8rb", "Rp16,0JT").
 * PENTING: "M" di sini adalah MILIAR (10^9), BUKAN Juta!
 * Mengembalikan null jika nilai disensor ("Rp1JT+", "--", atau kosong).
 */
function parseIdrCurrency(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (!text || text === '--' || text.includes('+')) return null;

  // Hapus "Rp", spasi, dan ubah koma desimal Indonesia menjadi titik
  // Catatan: jika ada titik ribuan (misal Rp150.000 tanpa suffix), tangani dengan tepat
  const upper = text.toUpperCase().replace(/^RP\s*/i, '').trim();
  let multiplier = 1;
  if (upper.endsWith('TRILIUN') || upper.endsWith('T')) {
    if (!upper.endsWith('JT')) multiplier = 1_000_000_000_000;
  }
  if (upper.endsWith('JT')) {
    multiplier = 1_000_000;
  } else if (upper.endsWith('RB') || upper.endsWith('K')) {
    multiplier = 1_000;
  } else if (upper.endsWith('M')) {
    multiplier = 1_000_000_000; // MILIAR!
  }

  let numStr = upper.replace(/[A-Z]+$/g, '').trim();
  if (multiplier > 1) {
    // Format kompak dengan desimal koma: "179,8" -> "179.8"
    numStr = numStr.replace(/\./g, '').replace(',', '.');
  } else {
    // Angka biasa tanpa suffix: hapus titik ribuan, ganti koma desimal
    numStr = numStr.replace(/\./g, '').replace(',', '.');
  }

  const val = parseFloat(numStr);
  return Number.isFinite(val) ? Math.round(val * multiplier) : null;
}

/**
 * Khusus untuk metrik Non-Rupiah (Followers, Items sold, Views).
 * Contoh: "74.5M" -> 74.500.000, "5.63K" -> 5.630.
 * PENTING: "M" di sini adalah MILLION / JUTA (10^6)!
 */
function parseCompactCount(rawText) {
  if (!rawText || typeof rawText !== 'string') return 0;
  const text = rawText.trim().toUpperCase();
  if (!text || text === '--') return 0;

  let multiplier = 1;
  if (text.endsWith('B')) multiplier = 1_000_000_000;
  else if (text.endsWith('M')) multiplier = 1_000_000;
  else if (text.endsWith('K') || text.endsWith('RB')) multiplier = 1_000;

  const numStr = text.replace(/[A-Z+%]+$/g, '').replace(/,/g, '').trim();
  const val = parseFloat(numStr);
  return Number.isFinite(val) ? Math.round(val * multiplier) : 0;
}

/**
 * Mem-parse rentang Rupiah seperti "Rp179,8rb-Rp269,8rb" atau "Rp300-Rp16,0JT"
 */
function parseIdrRange(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '--') {
    return { min: null, max: null, midpoint: null };
  }
  const parts = rawText.split('-').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    const min = parseIdrCurrency(parts[0]);
    const max = parseIdrCurrency(parts[1]);
    if (min !== null && max !== null) {
      return { min, max, midpoint: (min + max) / 2 };
    }
  } else if (parts.length === 1) {
    const val = parseIdrCurrency(parts[0]);
    if (val !== null) {
      return { min: val, max: val, midpoint: val };
    }
  }
  return { min: null, max: null, midpoint: null };
}
```

### 3.2 Kalkulasi GMV (`RIIL` vs `ESTIMASI`) & Pecahan Sales Channel

```javascript
/**
 * Menghitung gmv_30d, gmv_status ('RIIL' | 'ESTIMASI'), serta rincian LIVE / Video / Showcase.
 */
function calculateCreatorGmv({ rawGmvText, itemsSold30d, rawGmvPerCustomerText, pctLive, pctVideo, pctShowcase }) {
  const exactGmv = parseIdrCurrency(rawGmvText);
  const gmvPerCust = parseIdrRange(rawGmvPerCustomerText);

  let gmv_30d = 0;
  let gmv_status = 'RIIL';

  if (exactGmv !== null) {
    // Kasus 1: GMV terbuka (misal "Rp6,0M")
    gmv_30d = exactGmv;
    gmv_status = 'RIIL';
  } else if (gmvPerCust.midpoint !== null && itemsSold30d > 0) {
    // Kasus 2: GMV disensor ("Rp1JT+" atau "--"), hitung dari nilai tengah GMV per customer * Items sold
    gmv_30d = Math.round(itemsSold30d * gmvPerCust.midpoint);
    gmv_status = 'ESTIMASI';
  } else {
    // Kasus 3: Keduanya "--" (memang belum ada penjualan)
    gmv_30d = 0;
    gmv_status = 'RIIL';
  }

  const safeLivePct = Number(pctLive) || 0;
  const safeVideoPct = Number(pctVideo) || 0;
  const safeShowcasePct = Number(pctShowcase) || 0;

  const gmv_30d_live = Math.round(gmv_30d * (safeLivePct / 100));
  const gmv_30d_video = Math.round(gmv_30d * (safeVideoPct / 100));
  const gmv_30d_showcase = Math.round(gmv_30d * (safeShowcasePct / 100));

  return {
    gmv_30d,
    gmv_status,
    gmv_30d_live,
    gmv_30d_video,
    gmv_30d_showcase,
    gmv_per_customer_min: gmvPerCust.min,
    gmv_per_customer_max: gmvPerCust.max,
  };
}
```

### 3.3 Ekstraksi Donut Chart (`.pcm-pc-label`) & Top 5 Locations (`top_locations`)

```javascript
/**
 * Membaca daftar pasangan { name, pct } dari container donut chart TikTok Partner Center.
 */
function extractDonutChartLabels(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return [];
  const labels = container.querySelectorAll('.pcm-pc-label');
  const results = [];
  labels.forEach((el) => {
    const name = el.querySelector('.pcm-pc-label-name')?.textContent?.trim() || '';
    const pctText = el.querySelector('.pcm-pc-label-percent')?.textContent?.trim() || '0%';
    const pct = parseFloat(pctText.replace('%', '').replace(',', '.')) || 0;
    if (name) results.push({ name, pct });
  });
  return results;
}

/**
 * Mengambil Top 5 Lokasi dari Horizontal Bar Chart (#followers_tab).
 * Strategi 1: Baca dari React Fiber props.
 * Strategi 2 (Fallback): Sweep 5 titik vertikal pada <canvas> dan baca .lightcharts-tooltip-title & .lightcharts-tooltip-item.
 */
async function extractTop5Locations() {
  const container = document.querySelector('div[data-e2e="27e78e14-baa5-9b08"]');
  if (!container) return [];

  // Strategi 1: Cek React Fiber props
  const chartEl = container.querySelector('.ecom-data-horizontal-barchart__chart') || container;
  const fiberKey = Object.keys(chartEl).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
  if (fiberKey) {
    let curr = chartEl[fiberKey];
    for (let depth = 0; depth < 15 && curr; depth++) {
      const props = curr.memoizedProps || curr.pendingProps;
      const rawData = props?.data || props?.chartData || props?.option?.series?.[0]?.data;
      if (Array.isArray(rawData) && rawData.length > 0) {
        const parsed = rawData
          .map((item) => ({
            loc: item.name || item.label || item.location || item.x || '',
            pct: parseFloat(String(item.value ?? item.y ?? item.percent ?? 0).replace('%', '')) || 0,
          }))
          .filter((x) => x.loc)
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 5);
        if (parsed.length > 0) return parsed;
      }
      curr = curr.return;
    }
  }

  // Strategi 2: Simulasi MouseMove Sweep pada <canvas>
  const canvas = container.querySelector('canvas');
  if (!canvas) return [];
  const rect = canvas.getBoundingClientRect();
  if (rect.height < 20 || rect.width < 20) return [];

  const locationsMap = new Map();
  const steps = 10; // Sweep 10 titik vertikal untuk memastikan semua 5 bar kena hover
  for (let i = 0; i < steps; i++) {
    const clientX = rect.left + rect.width * 0.35;
    const clientY = rect.top + (rect.height / steps) * (i + 0.5);
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
    await new Promise((r) => setTimeout(r, 45));

    const titleEl = container.querySelector('.lightcharts-tooltip-title');
    const valEl = container.querySelector('.lightcharts-tooltip-item');
    const locName = titleEl?.textContent?.trim();
    const pctVal = parseFloat((valEl?.textContent || '').replace(/[^0-9.]/g, ''));
    if (locName && Number.isFinite(pctVal) && !locationsMap.has(locName)) {
      locationsMap.set(locName, Math.round(pctVal * 100) / 100);
    }
  }

  return Array.from(locationsMap.entries())
    .map(([loc, pct]) => ({ loc, pct }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
}
```

---

## 4. Penanganan *Infinite Scroll*, Loading Baris Acak, & Captcha

1. **Jangan Pernah Skip Baris yang Masih *Skeleton*:**
   - Saat mengiterasi `div[data-e2e="e8faf26e-bf66-5abe"]` dari atas ke bawah, jika baris belum memiliki `data-tnt-processed="true"` dan elemen `span[data-e2e="fbc99397-6043-1b32"]` masih kosong, **tunggu di baris tersebut** (scroll ke tengah layar + polling sampai 5 detik).
   - Karena TikTok me-render baris secara acak (misal baris 24 muncul sebelum baris 22), setiap kali selesai 1 aksi, pemindaian selalu dimulai ulang dari baris pertama yang belum memiliki `data-tnt-processed="true"`.
2. **Mekanisme *Infinite Scroll Jiggle*:**
   - Saat semua baris yang ter-render di DOM sudah memiliki `data-tnt-processed="true"`, lakukan:
     1. Scroll ke paling bawah `scrollContainer`.
     2. Tunggu `900ms`. Jika tidak ada baris baru yang muncul, **scroll NAIK `260px`**, tunggu `450ms`, lalu **scroll TURUN kembali ke mentok bawah**.
     3. Tetap dalam keadaan aktif (jangan berhenti) sampai user menekan tombol **⏹️ STOP**.
3. **Deteksi Captcha & *Auto-Resume*:**
   - Jika salah satu selektor di `CREATOR_DETAIL_SELECTORS.captchaContainers` terlihat di DOM (atau jika dalam 8 detik elemen username belum muncul), ubah state menjadi `PAUSED_CAPTCHA`, **jangan tutup tab detail**, dan tampilkan instruksi di panel agar user menggeser *puzzle*.
   - Lakukan polling tiap `1000ms`; begitu elemen profil muncul, otomatis lanjutkan scrape dan tutup tab.
