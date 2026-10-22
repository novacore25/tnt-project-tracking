(() => {
  const currentRuntimeId =
    typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id
      ? chrome.runtime.id
      : 'active';
  if (
    window.__TNT_SCRAPING_CREATOR_LOADED__ &&
    window.__TNT_SCRAPING_CREATOR_RUNTIME_ID__ === currentRuntimeId
  ) {
    return;
  }
  window.__TNT_SCRAPING_CREATOR_LOADED__ = true;
  window.__TNT_SCRAPING_CREATOR_RUNTIME_ID__ = currentRuntimeId;

  // Jika ekstensi baru saja di-reload, hapus panel lama agar listener baru yang aktif
  const stalePanel = document.getElementById('tnt-scraping-creator-panel');
  if (stalePanel) stalePanel.remove();

  function isExtensionContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function safeSendMessage(message, callback) {
    if (!isExtensionContextValid()) {
      isListLoopActive = false;
      waitingForDetailTab = false;
      const box = document.getElementById('tnt-status-box');
      if (box) {
        box.textContent =
          '🔄 Ekstensi baru saja di-reload/update. Silakan refresh (F5) halaman TikTok ini.';
      }
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: 'Ekstensi baru di-reload — silakan refresh (F5) halaman ini.',
        });
      }
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (res) => {
        try {
          const err = chrome.runtime?.lastError;
          if (err && String(err.message || '').toLowerCase().includes('context invalidated')) {
            isListLoopActive = false;
            waitingForDetailTab = false;
            const box = document.getElementById('tnt-status-box');
            if (box) {
              box.textContent =
                '🔄 Ekstensi baru saja di-reload/update. Silakan refresh (F5) halaman TikTok ini.';
            }
          }
        } catch (_) {}
        if (typeof callback === 'function') callback(res);
      });
    } catch (e) {
      isListLoopActive = false;
      waitingForDetailTab = false;
      const box = document.getElementById('tnt-status-box');
      if (box) {
        box.textContent =
          '🔄 Ekstensi baru saja di-reload/update. Silakan refresh (F5) halaman TikTok ini.';
      }
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: 'Ekstensi baru di-reload — silakan refresh (F5) halaman ini.',
        });
      }
    }
  }

  // ============================================================================
  // 1. SELEKTOR DOM TERVERIFIKASI (TikTok Partner Center)
  // ============================================================================
  const FIND_CREATORS_SELECTORS = {
    scrollContainer: 'div[data-e2e="9d644e6c-6279-450c"] > div[style*="overflow: scroll"]',
    rowItem: 'div[data-e2e="e8faf26e-bf66-5abe"]',
    cardClickTarget: 'div[data-e2e="0fca897b-b18b-1087"]',
    username: 'span[data-e2e="fbc99397-6043-1b32"]',
    displayName: 'span[data-e2e="3b9caa65-c65a-e9dc"]',
    levelBadge: 'div[data-e2e="190b477a-d59c-ce17"]',
  };

  const CREATOR_DETAIL_SELECTORS = {
    avatarImg: 'img[data-e2e="e7714c21-c02b-bb8b"], .m4b-avatar-image img',
    username: 'span[data-e2e="b7f56c3b-f013-3448"], span.text-head-l',
    displayName: 'span[data-e2e="72a4feaf-82c8-ddda"]',
    levelBadge: 'div[data-e2e="190b477a-d59c-ce17"]',
    followersCount: 'span[data-e2e="7aed0dd7-48ba-6932"]',
    mcnName: 'span[data-e2e="85040a36-fb50-9f7c"]',

    collaborationsSection: '#collaborations_tab',
    followersSection: '#followers_tab',
    trendsSection: '#trends_tab',

    metricCard: 'div[data-e2e="f6855061-9011-24ab"]',
    metricLabel: 'span[data-e2e="61148565-2ea3-4c1b"]',
    metricValue: '.creator_video_data_card_trigger_is_display',

    chartSalesChannel: 'div[data-e2e="4ae5aa7b-adbf-5b23"]',
    chartProductCategory: 'div[data-e2e="01d39cce-708e-bf0e"]',
    chartFollowersGender: 'div[data-e2e="cf2d5c63-63ea-cf11"]',
    chartFollowersAge: 'div[data-e2e="27e78e14-baa5-9b09"]',

    chartTopLocations: 'div[data-e2e="27e78e14-baa5-9b08"]',
    barChartInner: '.ecom-data-horizontal-barchart__chart',
    chartTooltipTitle: '.lightcharts-tooltip-title',
    chartTooltipItem: '.lightcharts-tooltip-item',

    captchaContainers: [
      '#captcha_container',
      '.captcha_verify_container',
      'iframe[src*="captcha"]',
      '.secsdk-captcha-drag-icon',
      'div[class*="captcha-verify"]',
    ],
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // ============================================================================
  // 2. FUNGSI PARSER ANGKA & KALKULASI GMV (RIIL vs ESTIMASI)
  // ============================================================================

  /**
   * Parser khusus mata uang Rupiah Indonesia ("Rp6,0M", "Rp179,8rb", "Rp16,0JT").
   * PENTING: "M" pada Rupiah adalah MILIAR (10^9)!
   * Mengembalikan null jika nilai disensor ("Rp1JT+", "--", atau kosong).
   */
  function parseIdrCurrency(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    const text = rawText.trim();
    if (!text || text === '--' || text.includes('+')) return null;

    const upper = text.toUpperCase().replace(/^RP\s*/i, '').trim();
    let multiplier = 1;
    if (upper.endsWith('TRILIUN') || (upper.endsWith('T') && !upper.endsWith('JT'))) {
      multiplier = 1_000_000_000_000;
    } else if (upper.endsWith('JT')) {
      multiplier = 1_000_000;
    } else if (upper.endsWith('RB') || upper.endsWith('K')) {
      multiplier = 1_000;
    } else if (upper.endsWith('M')) {
      multiplier = 1_000_000_000; // MILIAR!
    }

    const numStr = upper
      .replace(/[A-Z]+$/g, '')
      .trim()
      .replace(/\./g, '')
      .replace(',', '.');

    const val = parseFloat(numStr);
    return Number.isFinite(val) ? Math.round(val * multiplier) : null;
  }

  /**
   * Parser khusus metrik Non-Rupiah (Followers, Items sold, Views).
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

  function calculateCreatorGmv({
    rawGmvText,
    itemsSold30d,
    rawGmvPerCustomerText,
    pctLive,
    pctVideo,
    pctShowcase,
  }) {
    const exactGmv = parseIdrCurrency(rawGmvText);
    const gmvPerCust = parseIdrRange(rawGmvPerCustomerText);

    let gmv_30d = 0;
    let gmv_status = 'RIIL';

    if (exactGmv !== null) {
      gmv_30d = exactGmv;
      gmv_status = 'RIIL';
    } else if (gmvPerCust.midpoint !== null && itemsSold30d > 0) {
      gmv_30d = Math.round(itemsSold30d * gmvPerCust.midpoint);
      gmv_status = 'ESTIMASI';
    } else {
      gmv_30d = 0;
      gmv_status = 'RIIL';
    }

    const safeLivePct = Number(pctLive) || 0;
    const safeVideoPct = Number(pctVideo) || 0;
    const safeShowcasePct = Number(pctShowcase) || 0;

    return {
      gmv_30d,
      gmv_status,
      gmv_30d_live: Math.round(gmv_30d * (safeLivePct / 100)),
      gmv_30d_video: Math.round(gmv_30d * (safeVideoPct / 100)),
      gmv_30d_showcase: Math.round(gmv_30d * (safeShowcasePct / 100)),
      gmv_per_customer_min: gmvPerCust.min,
      gmv_per_customer_max: gmvPerCust.max,
    };
  }

  // ============================================================================
  // 3. JEMBATAN OTOMATIS DI WEB APP TNT (campaign.tntkreatif.com / localhost)
  // ============================================================================
  function initTntWebAppBridge() {
    const syncDomBook = () => {
      const scriptEl = document.getElementById('tnt-known-usernames-json');
      if (scriptEl && scriptEl.textContent) {
        try {
          const parsed = JSON.parse(scriptEl.textContent);
          if (Array.isArray(parsed.usernames)) {
            chrome.runtime.sendMessage({
              action: 'PASSIVE_UPDATE_KNOWN_USERNAMES',
              usernames: parsed.usernames,
            });
          }
        } catch {}
      }
    };

    syncDomBook();
    setTimeout(syncDomBook, 2500);
  }

  if (
    window.location.hostname.includes('tntkreatif.com') ||
    window.location.hostname === 'localhost'
  ) {
    initTntWebAppBridge();
    return;
  }

  // ============================================================================
  // 4. EKSTRAKSI DATA LENGKAP DI HALAMAN DETAIL KREATOR (/creator/detail)
  // ============================================================================
  function isCaptchaVisible() {
    for (const sel of CREATOR_DETAIL_SELECTORS.captchaContainers) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return true;
    }
    const bodyText = document.body?.innerText || '';
    if (
      bodyText.includes('Drag the slider to fit the puzzle') ||
      bodyText.includes('Verify to continue:')
    ) {
      return true;
    }
    return false;
  }

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

  async function extractMcnWithTooltip() {
    const mcnEl = document.querySelector(CREATOR_DETAIL_SELECTORS.mcnName);
    if (!mcnEl) return null;
    const rawText = (mcnEl.textContent || '').trim();
    if (!rawText || rawText === '--') return null;

    // Jika teks terpotong elipsis, hover untuk baca tooltip penuh
    if (rawText.endsWith('...') || mcnEl.scrollWidth > mcnEl.clientWidth) {
      const rect = mcnEl.getBoundingClientRect();
      mcnEl.dispatchEvent(
        new MouseEvent('mouseenter', {
          clientX: rect.left + 5,
          clientY: rect.top + 5,
          bubbles: true,
        })
      );
      mcnEl.dispatchEvent(
        new MouseEvent('mouseover', {
          clientX: rect.left + 5,
          clientY: rect.top + 5,
          bubbles: true,
        })
      );
      await sleep(180);
      const tooltipEl = document.querySelector('.arco-tooltip-content, [role="tooltip"]');
      const tooltipText = tooltipEl?.textContent?.trim();
      if (tooltipText && tooltipText.length >= rawText.replace('...', '').length) {
        return tooltipText;
      }
    }
    return rawText;
  }

  async function extractTop5Locations() {
    const container = document.querySelector(CREATOR_DETAIL_SELECTORS.chartTopLocations);
    if (!container) return [];

    // Strategi 1: Baca dari React Fiber Props
    const chartEl = container.querySelector(CREATOR_DETAIL_SELECTORS.barChartInner) || container;
    const fiberKey = Object.keys(chartEl).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$')
    );
    if (fiberKey) {
      let curr = chartEl[fiberKey];
      for (let depth = 0; depth < 16 && curr; depth++) {
        const props = curr.memoizedProps || curr.pendingProps;
        const rawData = props?.data || props?.chartData || props?.option?.series?.[0]?.data;
        if (Array.isArray(rawData) && rawData.length > 0) {
          const parsed = rawData
            .map((item) => ({
              loc: String(item.name || item.label || item.location || item.x || '').trim(),
              pct:
                Math.round(
                  (parseFloat(String(item.value ?? item.y ?? item.percent ?? 0).replace('%', '')) ||
                    0) * 100
                ) / 100,
            }))
            .filter((x) => x.loc)
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 5);
          if (parsed.length > 0) return parsed;
        }
        curr = curr.return;
      }
    }

    // Strategi 2: Simulasi Sweep Vertikal pada <canvas> (Pastikan scroll berhenti dulu)
    container.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(220);

    const canvas = container.querySelector('canvas');
    if (!canvas) return [];

    const locationsMap = new Map();
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const rect = canvas.getBoundingClientRect();
      if (rect.height < 20 || rect.width < 20) break;

      const clientX = rect.left + rect.width * 0.35;
      const clientY = rect.top + (rect.height / steps) * (i + 0.5);
      const eventInit = {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
        view: window,
      };

      canvas.dispatchEvent(new PointerEvent('pointerenter', eventInit));
      canvas.dispatchEvent(new MouseEvent('mouseenter', eventInit));
      canvas.dispatchEvent(new PointerEvent('pointermove', eventInit));
      canvas.dispatchEvent(new MouseEvent('mousemove', eventInit));
      await sleep(55);

      const titleEl =
        container.querySelector(CREATOR_DETAIL_SELECTORS.chartTooltipTitle) ||
        document.querySelector(CREATOR_DETAIL_SELECTORS.chartTooltipTitle);
      const valEl =
        container.querySelector(CREATOR_DETAIL_SELECTORS.chartTooltipItem) ||
        document.querySelector(CREATOR_DETAIL_SELECTORS.chartTooltipItem);
      const locName = titleEl?.textContent?.trim();
      const pctVal = parseFloat((valEl?.textContent || '').replace(/[^0-9.]/g, ''));
      if (locName && Number.isFinite(pctVal) && !locationsMap.has(locName)) {
        locationsMap.set(locName, Math.round(pctVal * 100) / 100);
        if (locationsMap.size >= 5) break;
      }
    }

    return Array.from(locationsMap.entries())
      .map(([loc, pct]) => ({ loc, pct }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }

  /**
   * Menunggu halaman Detail Kreator ter-load 100% (termasuk Smart Pause jika muncul Captcha
   * dan scroll bertahap ke bawah agar semua chart lazy-load ter-render).
   */
  async function waitAndScrapeCreatorDetailPage(statusCallback) {
    const notify = (msg) => {
      if (typeof statusCallback === 'function') statusCallback(msg);
    };

    // Bebaskan memori tab detail dari video showcase TikTok yang berat
    freezeAndPruneMedia();

    notify('⏳ Menunggu profil kreator ter-load...');

    let waitedMs = 0;
    let wasPausedCaptcha = false;

    while (true) {
      if (isCaptchaVisible()) {
        if (!wasPausedCaptcha) {
          wasPausedCaptcha = true;
          safeSendMessage({ action: 'DETAIL_TAB_CAPTCHA_DETECTED' });
        }
        notify('⏸️ CAPTCHA TERDETEKSI! Geser puzzle secara manual untuk melanjutkan otomatis...');
        await sleep(1000);
        continue;
      }

      if (wasPausedCaptcha) {
        wasPausedCaptcha = false;
        safeSendMessage({ action: 'DETAIL_TAB_CAPTCHA_RESOLVED' });
      }

      const usernameEl = document.querySelector(CREATOR_DETAIL_SELECTORS.username);
      const metricCards = document.querySelectorAll(CREATOR_DETAIL_SELECTORS.metricCard);
      const uText = usernameEl?.textContent?.trim();

      if (uText && metricCards.length >= 8) {
        break;
      }

      if (waitedMs >= 8500 && !wasPausedCaptcha) {
        // Jika lebih dari 8.5 detik belum muncul, kemungkinan ada verifikasi/jaringan lambat; beri peringatan
        notify('⏳ Menunggu elemen profil / cek jika ada verifikasi...');
      }

      await sleep(400);
      waitedMs += 400;
    }

    // Scroll bertahap ke bawah agar section metrik & demografi ter-render (#collaborations_tab & #followers_tab)
    // HINDARI scroll ke #trends_tab agar puluhan video viral tidak dimuat ke RAM browser
    notify('📜 Menggulir halaman agar grafik penjualan & demografi ter-load 100%...');
    const sections = [
      CREATOR_DETAIL_SELECTORS.collaborationsSection,
      CREATOR_DETAIL_SELECTORS.followersSection,
    ];

    for (const sel of sections) {
      const secEl = document.querySelector(sel);
      if (secEl) {
        secEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(320);
      }
    }

    // Pastikan kembali fokus ke #followers_tab agar canvas Top Locations berada di viewport saat di-sweep
    const followersSec = document.querySelector(CREATOR_DETAIL_SELECTORS.followersSection);
    if (followersSec) {
      followersSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Tunggu sampai chart demografi (gender/age/locations) ter-render di DOM (maksimal 3.5 detik)
    let chartWait = 0;
    while (chartWait < 3500) {
      const genderLabels = document.querySelectorAll(
        `${CREATOR_DETAIL_SELECTORS.chartFollowersGender} .pcm-pc-label`
      );
      const ageLabels = document.querySelectorAll(
        `${CREATOR_DETAIL_SELECTORS.chartFollowersAge} .pcm-pc-label`
      );
      const locCanvas = document.querySelector(
        `${CREATOR_DETAIL_SELECTORS.chartTopLocations} canvas`
      );
      if ((genderLabels.length > 0 || ageLabels.length > 0) && locCanvas) {
        break;
      }
      await sleep(300);
      chartWait += 300;
    }

    notify('🔍 Mengekstrak metrik, sales channel, demografi, & Top 5 Lokasi...');

    // 1. Header Info
    const tiktok_cid = new URLSearchParams(window.location.search).get('cid') || null;
    const avatar_url =
      document.querySelector(CREATOR_DETAIL_SELECTORS.avatarImg)?.getAttribute('src') || null;
    const username = (
      document.querySelector(CREATOR_DETAIL_SELECTORS.username)?.textContent || ''
    )
      .trim()
      .toLowerCase()
      .replace(/^@/, '');
    const display_name =
      (document.querySelector(CREATOR_DETAIL_SELECTORS.displayName)?.textContent || '').trim() ||
      null;
    const levelRaw =
      document.querySelector(CREATOR_DETAIL_SELECTORS.levelBadge)?.textContent?.trim() || '';
    const level = parseInt(levelRaw.replace(/\D/g, ''), 10) || null;
    const followersRaw =
      document.querySelector(CREATOR_DETAIL_SELECTORS.followersCount)?.textContent?.trim() || '0';
    const followers = parseCompactCount(followersRaw);
    const mcn = await extractMcnWithTooltip();

    // 2. 16 Kartu Metrik
    const metricsMap = {};
    document.querySelectorAll(CREATOR_DETAIL_SELECTORS.metricCard).forEach((card) => {
      const label = card.querySelector(CREATOR_DETAIL_SELECTORS.metricLabel)?.textContent?.trim();
      const val = card.querySelector(CREATOR_DETAIL_SELECTORS.metricValue)?.textContent?.trim();
      if (label) {
        metricsMap[label] = val || '--';
      }
    });

    const items_sold_30d = parseCompactCount(metricsMap['Items sold']);
    const gpm_30d = parseIdrCurrency(metricsMap['GPM']) || 0;
    const avg_commission_rate =
      parseFloat(String(metricsMap['Avg. commission rate'] || '').replace(/[^0-9.]/g, '')) || null;

    const products_promoted_count =
      parseInt(String(metricsMap['Products'] || '0').replace(/\D/g, ''), 10) || 0;
    const brand_collaborations_count =
      parseInt(String(metricsMap['Brand collaborations'] || '0').replace(/\D/g, ''), 10) || 0;
    const prodPriceRange = parseIdrRange(metricsMap['Product price']);

    const video_gpm = parseIdrCurrency(metricsMap['Video GPM']) || 0;
    const videos_count_30d =
      parseInt(String(metricsMap['Videos'] || '0').replace(/\D/g, ''), 10) || 0;
    const avg_video_views = parseCompactCount(metricsMap['Avg. video views']);
    const avg_video_engagement_rate =
      parseFloat(String(metricsMap['Avg. video engagement rate'] || '').replace(/[^0-9.]/g, '')) ||
      null;

    const live_gpm = parseIdrCurrency(metricsMap['LIVE GPM']) || 0;
    const live_streams_count_30d =
      parseInt(String(metricsMap['LIVE streams'] || '0').replace(/\D/g, ''), 10) || 0;
    const avg_live_views = parseCompactCount(metricsMap['Avg. LIVE views']);
    const avg_live_engagement_rate =
      parseFloat(String(metricsMap['Avg. LIVE engagement rate'] || '').replace(/[^0-9.]/g, '')) ||
      null;

    // 3. Donut Chart 1: GMV per sales channel (LIVE, Video, Product cards)
    let pct_live = 0;
    let pct_video = 0;
    let pct_showcase = 0;
    const channelItems = extractDonutChartLabels(CREATOR_DETAIL_SELECTORS.chartSalesChannel);
    channelItems.forEach((item) => {
      const lower = item.name.toLowerCase();
      if (lower.includes('live')) pct_live = item.pct;
      else if (lower.includes('video')) pct_video = item.pct;
      else if (lower.includes('card') || lower.includes('showcase')) pct_showcase = item.pct;
    });

    // 4. Kalkulasi GMV 30D (RIIL vs ESTIMASI) & Pecahan Rupiah per Channel
    const gmvCalc = calculateCreatorGmv({
      rawGmvText: metricsMap['GMV'],
      itemsSold30d: items_sold_30d,
      rawGmvPerCustomerText: metricsMap['GMV per customer'],
      pctLive: pct_live,
      pctVideo: pct_video,
      pctShowcase: pct_showcase,
    });

    // 5. Donut Chart 2: GMV by product category -> Niche Utama Otomatis
    const categoryItems = extractDonutChartLabels(CREATOR_DETAIL_SELECTORS.chartProductCategory)
      .map((x) => ({ category: x.name, pct: x.pct }))
      .sort((a, b) => b.pct - a.pct);

    let primary_niche = categoryItems[0]?.category || null;
    if (!primary_niche) {
      // Fallback dari teks kategori di bawah nama profil jika chart kosong
      const headerCatEl = document.querySelector('span.text-neutral-text3.text-body-s-regular');
      if (headerCatEl && headerCatEl.textContent) {
        primary_niche = headerCatEl.textContent.split(',')[0].trim() || null;
      }
    }

    // 6. Donut Chart 3: Followers Gender
    let audience_male_pct = null;
    let audience_female_pct = null;
    const genderItems = extractDonutChartLabels(CREATOR_DETAIL_SELECTORS.chartFollowersGender);
    genderItems.forEach((item) => {
      const lower = item.name.toLowerCase();
      if (lower.includes('female')) audience_female_pct = item.pct;
      else if (lower.includes('male')) audience_male_pct = item.pct;
    });

    // 7. Donut Chart 4: Followers Age
    let age_18_24_pct = null;
    let age_25_34_pct = null;
    let age_35_44_pct = null;
    let age_45_54_pct = null;
    let age_55_plus_pct = null;
    const ageItems = extractDonutChartLabels(CREATOR_DETAIL_SELECTORS.chartFollowersAge);
    ageItems.forEach((item) => {
      const clean = item.name.replace(/\s+/g, '');
      if (clean.includes('18-24')) age_18_24_pct = item.pct;
      else if (clean.includes('25-34')) age_25_34_pct = item.pct;
      else if (clean.includes('35-44')) age_35_44_pct = item.pct;
      else if (clean.includes('45-54')) age_45_54_pct = item.pct;
      else if (clean.includes('55+')) age_55_plus_pct = item.pct;
    });

    const sortedAges = [...ageItems].sort((a, b) => b.pct - a.pct);
    const audience_age = sortedAges[0]?.name || null;

    // 8. Horizontal Bar Chart: Top 5 Locations
    const top_locations = await extractTop5Locations();

    return {
      username,
      display_name,
      tiktok_cid,
      link_account: `https://www.tiktok.com/@${username}`,
      avatar_url,
      mcn,
      no_whatsapp: null,
      email: null,
      level,
      followers,
      primary_niche,
      ...gmvCalc,
      pct_live,
      pct_video,
      pct_showcase,
      items_sold_30d,
      gpm_30d,
      avg_commission_rate,
      products_promoted_count,
      brand_collaborations_count,
      product_price_min: prodPriceRange.min,
      product_price_max: prodPriceRange.max,
      video_gpm,
      videos_count_30d,
      avg_video_views,
      avg_video_engagement_rate,
      live_gpm,
      live_streams_count_30d,
      avg_live_views,
      avg_live_engagement_rate,
      audience_male_pct,
      audience_female_pct,
      audience_age,
      age_18_24_pct,
      age_25_34_pct,
      age_35_44_pct,
      age_45_54_pct,
      age_55_plus_pct,
      top_locations,
      gmv_by_category: categoryItems,
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Normalisasi nomor telepon / WhatsApp:
   * - Format Indonesia (08, 8, 62, +62): distandarkan menjadi 628xxxxxxxxxx
   * - Format Luar Negeri (selain 08/8/62, misal +1, +60, +65, dsb): simpan seluruh angka apa adanya
   * 
   * @param {string} text - Teks input
   * @param {boolean} isDedicatedContactLine - Jika true (baris modal kontak), izinkan angka murni. Jika false (teks bebas/body/bio), WAJIB ada kata kunci (wa/whatsapp/telp/kontak/phone).
   */
  function normalizeIndonesianPhone(text, isDedicatedContactLine = false) {
    if (!text) return null;

    let match = null;
    if (isDedicatedContactLine) {
      // Khusus baris terisolir di dalam modal Contact Info resmi TikTok
      match =
        text.match(/(?:whatsapp|wa|phone|kontak|telp|hp)?[:\s]*(\+?[0-9][0-9\s-]{7,18})/i) ||
        text.match(/(\+?[0-9][0-9\s-]{7,18})/);
    } else {
      // Teks halaman bebas / bio: WAJIB didahului kata kunci kontak agar angka acak UI/timestamp tidak terambil!
      match = text.match(/(?:whatsapp|wa|phone|kontak|telp|hp)[:\s]*(\+?[0-9][0-9\s-]{7,18})/i);
    }

    if (!match) return null;

    const matchedStr = (match[1] || match[0]).trim();
    const raw = matchedStr.replace(/\D/g, '');
    if (raw.length < 8 || raw.length > 17) return null;

    // Jika diawali '+' eksplisit internasional tapi bukan +62 (misal +60 Malaysia, +1 USA, +86 China, dsb)
    if (matchedStr.startsWith('+') && !raw.startsWith('62')) {
      return raw;
    }

    // Aturan Indonesia:
    if (raw.startsWith('08')) return '62' + raw.slice(1);
    if (raw.startsWith('628')) return raw;
    if (raw.startsWith('62')) return raw;
    // Nomor HP Indonesia diawali 8 (operator: 81, 82, 83, 85, 87, 88, 89)
    if (/^8[1235789]\d{7,11}$/.test(raw)) return '62' + raw;
    if (raw.startsWith('8') && !raw.startsWith('86') && raw.length >= 10 && raw.length <= 13) return '62' + raw;

    // Nomor luar negeri lainnya tanpa tanda + (misal 6012..., 1415..., 6591..., 8613...): simpan seluruh angka murni apa adanya
    return raw;
  }

  /**
   * Ekstraksi informasi kontak yang mungkin ada langsung di teks header halaman profil kreator.
   * Hanya mengambil jika secara eksplisit terdapat kata kunci WA/Email di teks.
   */
  function extractHeaderContactInfo() {
    const text = document.body ? document.body.innerText || '' : '';
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const email = emailMatch ? emailMatch[1].trim().toLowerCase() : null;
    const no_whatsapp = normalizeIndonesianPhone(text, false);
    return { email, no_whatsapp };
  }

  /**
   * Mencari tombol chat (ikon speech bubble) di sebelah tombol 'Invite' / 'Undang' di header detail kreator.
   */
  function findDetailChatButton() {
    const exact = document.querySelector(
      'button[data-e2e="7c3eed8f-42a4-eb88"], button[data-e2e*="7c3eed8f"]'
    );
    if (exact) return exact;

    const byHref = document.querySelector('a[href*="/partner/im"], a[href*="creator_id="]');
    if (byHref) return byHref;

    const allButtons = Array.from(document.querySelectorAll('button, a'));
    const inviteBtn = allButtons.find((b) => {
      const t = (b.textContent || '').trim().toLowerCase();
      return t === 'invite' || t === 'undang' || t.startsWith('invite') || t.startsWith('undang');
    });

    if (inviteBtn && inviteBtn.parentElement) {
      const siblings = Array.from(inviteBtn.parentElement.children).filter((el) => el !== inviteBtn);
      for (const el of siblings) {
        if (
          el.querySelector('svg') ||
          el.classList.contains('arco-btn-icon') ||
          el.tagName === 'BUTTON' ||
          el.tagName === 'A'
        ) {
          return el;
        }
      }
    }

    const byAria = document.querySelector(
      'button[aria-label*="chat" i], button[aria-label*="message" i], button[title*="chat" i], button[title*="pesan" i]'
    );
    if (byAria) return byAria;

    return null;
  }

  /**
   * Mencari tombol Contact Info di panel profil kanan IM chat (workbench-container).
   */
  function findImContactRoundButton() {
    // 1. Selektor presisi tinggi terverifikasi dari DOM TikTok Partner Center
    const exactBtn =
      document.querySelector('button[data-e2e="efbe2e11-4d42-b98a"]') ||
      document.querySelector('#workbench-container button[data-e2e="efbe2e11-4d42-b98a"]') ||
      document.querySelector('div[data-e2e="2cc1c2ec-0582-15cc"] button') ||
      document.querySelector('div[class*="basicInfoContainer"] button') ||
      document.querySelector('#workbench-container div[class*="basicInfo"] button');
    if (exactBtn) return exactBtn;

    // 2. Cari tombol di area basic info panel kanan (workbench) yang bukan tombol teks 'invite' / 'leads'
    const workbench =
      document.querySelector('#workbench-container') ||
      document.querySelector('div[data-e2e="ad5a2677-54bf-3441"]');
    if (workbench) {
      const buttons = Array.from(workbench.querySelectorAll('button'));
      for (const btn of buttons) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        // Tombol kontak hanya berisi ikon tanpa teks panjang
        if (!txt.includes('invite') && !txt.includes('leads') && !txt.includes('send') && txt.length < 5) {
          if (
            btn.querySelector('svg') ||
            btn.querySelector('img') ||
            btn.classList.contains('arco-btn-secondary') ||
            btn.classList.contains('m4b-button')
          ) {
            return btn;
          }
        }
      }
    }

    const byAttr = document.querySelector(
      'button[aria-label*="contact" i], button[title*="contact" i], button[aria-label*="kontak" i], button[title*="kontak" i]'
    );
    if (byAttr) return byAttr;

    const circleButtons = Array.from(
      document.querySelectorAll(
        'button.arco-btn-circle, button.arco-btn-shape-circle, button[class*="circle"], div[role="button"][class*="circle"]'
      )
    );

    // Filter tombol di panel kanan layar (profile sidebar)
    for (const btn of circleButtons) {
      const rect = btn.getBoundingClientRect();
      if (rect.right > window.innerWidth * 0.45 && rect.top > 30 && rect.top < 450) {
        const style = window.getComputedStyle(btn);
        const bg = style.backgroundColor || '';
        const isBlue =
          bg.includes('22, 93, 255') ||
          bg.includes('22, 119, 255') ||
          bg.includes('79, 70, 229') ||
          bg.includes('rgb(22,') ||
          btn.classList.contains('arco-btn-primary');
        if (isBlue) return btn;
      }
    }

    // Cari tombol lingkaran dengan ikon SVG yang bukan tiga titik '...'
    for (const btn of circleButtons) {
      const rect = btn.getBoundingClientRect();
      if (rect.right > window.innerWidth * 0.45 && rect.top > 30 && rect.top < 450) {
        const svg = btn.querySelector('svg');
        if (svg) {
          const text = btn.innerText || '';
          if (!text.includes('...') && rect.width < 50) {
            return btn;
          }
        }
      }
    }

    return null;
  }

  /**
   * Mendeteksi apakah panel profil kanan (workbench) sudah 100% selesai dimuat berdasarkan HTML DOM murni
   * (spinner loading hilang, username muncul, dan elemen paling bawah/metrics sudah selesai ter-render).
   */
  function isWorkbenchFullyLoaded(targetUsername) {
    const workbench =
      document.querySelector('#workbench-container') ||
      document.querySelector('div[data-e2e="ad5a2677-54bf-3441"]');
    if (!workbench) return false;

    // 1. Pastikan spinner loading bawaan TikTok sudah hilang
    const spinner = workbench.querySelector('.arco-spin-loading');
    if (spinner) return false;

    // 2. Pastikan elemen paling bawah profil (Followers / Metrics / Tombol Invite) sudah selesai dirender
    const text = (workbench.innerText || '').toLowerCase();
    const hasBottomElements = Boolean(
      workbench.querySelector('div[data-e2e="3770aecc-519e-af66"]') ||
      workbench.querySelector('button[data-e2e="2d88091c-bfe8-d89d"]') ||
      workbench.querySelector('span[data-e2e="be6a5e3b-f55e-92e3"]') ||
      text.includes('followers') ||
      text.includes('send linking invite') ||
      text.includes('view profile')
    );

    // 3. Pastikan username kreator target sudah muncul di workbench
    const cleanTarget = String(targetUsername || '').trim().toLowerCase().replace(/^@/, '');
    const hasUsername = cleanTarget ? text.includes(cleanTarget) : true;

    return hasBottomElements && hasUsername;
  }

  /**
   * Menunggu loading IM chat room selesai berdasarkan HTML DOM murni,
   * lalu mengklik Contact Info jika ada, atau langsung lanjut jika kreator tidak memiliki kontak.
   * Dijamin selalu menutup tab serta lanjut ke antrean berikutnya.
   */
  async function waitAndScrapeImContactInfo(pendingData, notify = () => {}) {
    notify(`⏳ Menunggu IM roomchat @${pendingData.username} selesai dimuat...`);

    let elapsed = 0;
    const maxTimeout = 25000; // Toleransi hingga 25 detik agar jaringan lambat tidak terputus
    let roundBtn = null;
    let isFullyLoaded = false;

    try {
      while (elapsed < maxTimeout) {
        // Gunakan isCaptchaVisible() yang terdefinisi
        if (typeof isCaptchaVisible === 'function' && isCaptchaVisible()) {
          notify('⏸️ Captcha terdeteksi pada IM. Silakan selesaikan puzzle...');
          safeSendMessage({ action: 'DETAIL_TAB_CAPTCHA_DETECTED' });
          await sleep(1000);
          continue;
        }

        // 1. Cek apakah tombol kontak sudah langsung terdeteksi
        roundBtn = findImContactRoundButton();
        if (roundBtn) {
          break;
        }

        // 2. Cek apakah halaman workbench profil kanan sudah 100% selesai dimuat berdasarkan struktur HTML
        if (isWorkbenchFullyLoaded(pendingData.username)) {
          isFullyLoaded = true;
          await sleep(600);
          roundBtn = findImContactRoundButton();
          // Jika tombol kontak ada, langsung keluar loop dan klik!
          if (roundBtn) break;

          // Hanya jika workbench sudah 100% render sempurna DAN minimal 8 detik berlalu tanpa tombol kontak:
          if (elapsed >= 8000) {
            break;
          }
        }

        elapsed += 400;
        notify(
          `⏳ Menunggu IM roomchat @${pendingData.username} selesai dimuat (${Math.round(
            elapsed / 1000
          )}s)...`
        );
        await sleep(400);
      }

      if (!roundBtn) {
        if (isFullyLoaded) {
          notify(`ℹ️ IM selesai dimuat 100%. @${pendingData.username} tidak memiliki tombol kontak di profil.`);
        } else {
          notify(`⚠️ IM roomchat @${pendingData.username} timeout. Melanjutkan antrean...`);
        }
        return;
      }

      notify(`💬 Roomchat & profil @${pendingData.username} siap! Membuka Contact Info...`);
      await sleep(randomBetween(500, 800));

      // 1. Eksekusi langsung di Main World via background (memiliki akses penuh ke React handler & kebal CSP)
      safeSendMessage({ action: 'TRIGGER_MAIN_WORLD_CLICK' });
      triggerDeepClick(roundBtn);

      // Tunggu modal "Contact Info" muncul (hingga 6 detik)
      let modalWait = 0;
      let modalEl = null;
      while (modalWait < 6000) {
        modalEl =
          document.querySelector('.arco-modal') ||
          document.querySelector('div[role="dialog"]') ||
          document.querySelector('.arco-modal-content');
        if (
          modalEl &&
          (modalEl.querySelector('div[data-e2e="0813a01f-c400-7bbc"]') ||
            modalEl.querySelector('.arco-modal-title') ||
            (modalEl.innerText && modalEl.innerText.toLowerCase().includes('contact')))
        ) {
          break;
        }
        // Jika belum muncul setelah 1.2 detik atau 2.4 detik, coba trigger ulang via Main World
        if (modalWait === 1200 || modalWait === 2400) {
          safeSendMessage({ action: 'TRIGGER_MAIN_WORLD_CLICK' });
          triggerDeepClick(roundBtn);
        }
        await sleep(250);
        modalWait += 250;
      }

      // 1. Ekstraksi spesifik dari baris data-e2e terverifikasi dari TikTok Partner Center
      if (modalEl) {
        const contactRows = modalEl.querySelectorAll(
          'div[data-e2e="0813a01f-c400-7bbc"], .arco-modal-body > div, div[class*="contact"]'
        );
        contactRows.forEach((row) => {
          const rowText = (row.textContent || '').trim();
          if (rowText.includes('@') && !pendingData.email) {
            const em = rowText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
            if (em) pendingData.email = em[1].trim().toLowerCase();
          }

          const parsedWa = normalizeIndonesianPhone(rowText, true);
          if (parsedWa && !pendingData.no_whatsapp) {
            pendingData.no_whatsapp = parsedWa;
          }
        });
      }

      // 2. Fallback regex dari seluruh isi teks modal (menangani format Whatsapp: 822..., 08..., +62...)
      const modalText = modalEl ? modalEl.innerText || modalEl.textContent || '' : '';
      if (!pendingData.email) {
        const emailMatch = modalText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (emailMatch) {
          pendingData.email = emailMatch[1].trim().toLowerCase();
        }
      }

      if (!pendingData.no_whatsapp) {
        pendingData.no_whatsapp = normalizeIndonesianPhone(modalText, true);
      }

      // Tutup modal menggunakan selektor resmi TikTok
      const closeBtn = document.querySelector(
        '.arco-modal-close-icon, span.arco-icon-hover.arco-modal-close-icon, span[aria-label="Close"]'
      );
      if (closeBtn) simulateHumanClick(closeBtn);

      notify(`✅ Kontak @${pendingData.username}: WA: ${pendingData.no_whatsapp || '-'} | Email: ${pendingData.email || '-'}`);
    } catch (err) {
      console.error('Error during IM contact scrape:', err);
      notify(`⚠️ Error ekstraksi IM: ${err?.message || err}. Menyimpan data profil...`);
    } finally {
      sessionStorage.removeItem('tnt_pending_creator_scrape');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove('tnt_pending_creator_scrape');
      }

      await sleep(randomBetween(400, 700));

      // DIJAMIN SELALU TERTUTUP: Tab IM ditutup dan sinyal lanjut ke antrean berikutnya dikirim!
      safeSendMessage({
        action: 'SCRAPE_DETAIL_SUCCESS',
        payload: pendingData,
        closeTab: true,
      });
    }
  }

  // ============================================================================
  // 5. ENGINE AUTO-SCRAPE DI HALAMAN FIND CREATORS (/affiliate-cmp/creator)
  // ============================================================================
  let isListLoopActive = false;
  let waitingForDetailTab = false;
  let detailWatchdogTimer = null;
  let mediaPruneInterval = null;

  /**
   * Mencegah crash browser "Out of Memory" (OOM):
   * Halaman Find Creators TikTok Partner Center memuat 3 video preview per kartu.
   * Setiap baris scroll menambah puluhan elemen <video> yang me-load streaming H.264/HLS,
   * memakan video decoders dan buffer RAM hingga menembus batas heap browser (~1.5GB - 2GB).
   *
   * Solusi:
   * 1. Matikan autoplay & preload seluruh video di halaman.
   * 2. Pause video yang sedang aktif.
   * 3. Buang elemen <video> dan <audio> dari kartu yang sudah selesai diproses (data-tnt-processed="true")
   *    serta putus stream-nya (src = '', load(), remove()).
   */
  function freezeAndPruneMedia() {
    try {
      // 1. Pause dan matikan buffering semua video di halaman
      const allVideos = document.querySelectorAll('video');
      for (const v of allVideos) {
        try {
          if (!v.paused) v.pause();
          v.autoplay = false;
          v.preload = 'none';
          v.removeAttribute('autoplay');
          v.removeAttribute('preload');
        } catch (_) {}
      }

      // 2. Buang elemen <video> & <audio> dari kartu yang sudah selesai diproses / di-skip
      const processedCards = document.querySelectorAll('[data-tnt-processed="true"]');
      for (const card of processedCards) {
        const mediaElements = card.querySelectorAll('video, audio');
        for (const m of mediaElements) {
          try {
            m.pause();
            m.removeAttribute('src');
            m.src = '';
            m.load();
            m.remove();
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function getScrollContainer() {
    const direct = document.querySelector(FIND_CREATORS_SELECTORS.scrollContainer);
    if (direct) return direct;
    const tableScroll = document.querySelector('.arco-table-body, div[class*="table-body"], .arco-table-scroll');
    if (tableScroll && tableScroll.scrollHeight > tableScroll.clientHeight + 50) return tableScroll;
    const wrapper = document.querySelector('div[data-e2e="9d644e6c-6279-450c"]');
    if (wrapper) {
      const divs = wrapper.querySelectorAll('div');
      for (const d of divs) {
        if (d.scrollHeight > d.clientHeight + 50) return d;
      }
    }
    return document.scrollingElement || document.documentElement;
  }

  /**
   * Deep click KHUSUS untuk tombol bulat Contact Info di IM panel workbench TikTok
   * yang memerlukan urutan event pointer/mouse atau trigger React handler.
   */
  function triggerDeepClick(element) {
    if (!element) return;

    // 1. Coba panggil langsung React handler jika ada di DOM node
    try {
      const reactPropsKey = Object.keys(element).find(
        (k) => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers')
      );
      if (reactPropsKey && element[reactPropsKey]?.onClick) {
        element[reactPropsKey].onClick({
          stopPropagation: () => {},
          preventDefault: () => {},
        });
      }
    } catch (_) {}

    const rect = element.getBoundingClientRect();
    const clientX = rect.left + (rect.width > 0 ? rect.width / 2 : 15);
    const clientY = rect.top + (rect.height > 0 ? rect.height / 2 : 15);
    const opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
    };

    try {
      element.focus();
    } catch (_) {}

    // Dispatch satu kali urutan Pointer & Mouse Event terarah ke tombol
    try {
      element.dispatchEvent(new PointerEvent('pointerdown', opts));
      element.dispatchEvent(new MouseEvent('mousedown', opts));
      element.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }));
      element.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
      element.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
      if (typeof element.click === 'function') element.click();
    } catch (_) {}

    // Fallback inline script execution ke konteks halaman murni jika belum terpanggil
    try {
      const script = document.createElement('script');
      script.textContent = `(() => {
        const btn = document.querySelector('button[data-e2e="efbe2e11-4d42-b98a"]') ||
                    document.querySelector('#workbench-container button');
        if (!btn) return;
        const k = Object.keys(btn).find(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'));
        if (k && btn[k]?.onClick) {
          btn[k].onClick({ stopPropagation: () => {}, preventDefault: () => {} });
        }
      })();`;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (_) {}
  }

  /**
   * Klik standar alami manusia (satu kali klik bersih) untuk kartu, tombol biasa, dan link
   * Mencegah pembukaan banyak tab duplikat!
   */
  function simulateHumanClick(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + Math.max(5, Math.min(rect.width - 5, rect.width * 0.5));
    const clientY = rect.top + Math.max(5, Math.min(rect.height - 5, rect.height * 0.5));
    const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY };

    try {
      element.dispatchEvent(new MouseEvent('mouseover', opts));
      element.dispatchEvent(new MouseEvent('mouseenter', opts));
      element.dispatchEvent(new MouseEvent('mousedown', opts));
      element.dispatchEvent(new MouseEvent('mouseup', opts));
      element.click();
    } catch (_) {
      if (typeof element.click === 'function') element.click();
    }
  }

  function badgeRowCard(rowEl, text, bgColor, borderColor) {
    let badge = rowEl.querySelector('.tnt-row-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'tnt-row-badge';
      badge.style.cssText =
        'position:absolute;top:6px;right:12px;z-index:20;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.15);pointer-events:none;';
      rowEl.style.position = 'relative';
      rowEl.appendChild(badge);
    }
    badge.textContent = text;
    badge.style.background = bgColor;
    if (borderColor) {
      rowEl.style.outline = `2px solid ${borderColor}`;
      rowEl.style.borderRadius = '8px';
    }
  }

  /**
   * Melakukan Infinite Scroll + Jiggle (scroll ke atas sedikit lalu ke bawah lagi)
   * agar sensor infinite scroll TikTok tidak macet.
   */
  async function performInfiniteScrollWithJiggle() {
    const scroller = getScrollContainer();
    if (!scroller) return;

    // Bersihkan buffer RAM sebelum scroll memuat baris-baris baru
    freezeAndPruneMedia();

    const beforeRows = document.querySelectorAll(
      `${FIND_CREATORS_SELECTORS.rowItem}, tbody tr, .arco-table-body tr`
    ).length;
    updateFloatingStatus('📜 Scroll ke bawah untuk memuat baris kreator baru...');

    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    await sleep(1000);

    const afterFirstScroll = document.querySelectorAll(
      `${FIND_CREATORS_SELECTORS.rowItem}, tbody tr, .arco-table-body tr`
    ).length;
    if (afterFirstScroll <= beforeRows) {
      // Sensor mentok -> lakukan Scroll Jiggle (naik ~260px lalu turun lagi)
      updateFloatingStatus('🔄 Scroll mentok — melakukan Scroll Jiggle (naik sedikit & turun lagi)...');
      scroller.scrollBy({ top: -260, behavior: 'smooth' });
      await sleep(480);
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      await sleep(900);
    }

    // Bersihkan lagi video player yang baru masuk ke DOM agar RAM tetap dingin
    freezeAndPruneMedia();
  }

  /**
   * Mengambil semua kartu profil kreator individual:
   * - Mendukung Mode Grid View (3 kartu per baris)
   * - Mendukung Mode Table/List View (1 baris per kreator)
   */
  function getAllCreatorCardElements() {
    const cardItems = [];

    // 1. Cek Mode Table View (baris tabel horizontal: tr, .arco-table-tr, [role="row"])
    const tableRows = Array.from(
      document.querySelectorAll('tbody tr, .arco-table-body tr, div[role="row"], div[class*="arco-table-tr"]')
    ).filter((r) => !r.closest('thead') && !r.classList.contains('arco-table-header'));

    if (tableRows.length > 0) {
      for (const row of tableRows) {
        // Cari username di dalam baris tabel
        const usernameSpan =
          row.querySelector(FIND_CREATORS_SELECTORS.username) ||
          row.querySelector('span[class*="text-neutral-text1"]') ||
          row.querySelector('a[href*="/detail"] span') ||
          Array.from(row.querySelectorAll('span, a')).find((el) => {
            const t = el.textContent?.trim() || '';
            return t.startsWith('@') && t.length > 1;
          });

        if (usernameSpan) {
          const clickTarget =
            row.querySelector('a[href*="/detail"]') ||
            row.querySelector(FIND_CREATORS_SELECTORS.cardClickTarget) ||
            usernameSpan.closest('a') ||
            usernameSpan;

          cardItems.push({
            cardEl: row,
            usernameSpan,
            clickTarget,
          });
        }
      }
    }

    // 2. Jika bukan Table View, gunakan Mode Grid View (3 kartu individual per baris)
    if (cardItems.length === 0) {
      const rows = Array.from(document.querySelectorAll(FIND_CREATORS_SELECTORS.rowItem));
      for (const row of rows) {
        const children = Array.from(row.children);
        for (const card of children) {
          const usernameSpan = card.querySelector(FIND_CREATORS_SELECTORS.username);
          if (usernameSpan) {
            const clickTarget =
              card.querySelector(FIND_CREATORS_SELECTORS.cardClickTarget) ||
              card.querySelector('div[class*="cursor-pointer"]') ||
              card;

            cardItems.push({
              cardEl: card,
              usernameSpan,
              clickTarget,
            });
          }
        }
      }
    }

    // 3. Fallback jika struktur DOM berbeda
    if (cardItems.length === 0) {
      const usernameSpans = Array.from(document.querySelectorAll(FIND_CREATORS_SELECTORS.username));
      for (const uSpan of usernameSpans) {
        let card =
          uSpan.closest('tr') ||
          uSpan.closest('div[class*="cursor-pointer"]') ||
          uSpan.closest('div[class*="rounded-8"]') ||
          uSpan.parentElement?.parentElement;
        cardItems.push({
          cardEl: card || uSpan,
          usernameSpan: uSpan,
          clickTarget: card || uSpan,
        });
      }
    }

    return cardItems;
  }

  /**
   * Memindai kartu individual dari atas ke bawah (3 kartu per baris grid).
   * Menangani loading baris acak (Out-of-Order): jika ada baris yang belum selesai render (skeleton),
   * WAJIB ditunggu dulu, jangan di-skip!
   */
  async function scanAndProcessNextCreatorCard() {
    if (!isListLoopActive || waitingForDetailTab) return;

    const fullStatus = await new Promise((resolve) => {
      safeSendMessage({ action: 'GET_FULL_STATUS' }, (res) => resolve(res || {}));
    });

    if (!fullStatus?.state?.isRunning) {
      isListLoopActive = false;
      refreshFloatingPanelUI(fullStatus);
      return;
    }

    const knownSet = new Set(
      (fullStatus.knownUsernames || []).map((u) => String(u).trim().toLowerCase())
    );

    const allCards = getAllCreatorCardElements();

    for (let i = 0; i < allCards.length; i++) {
      if (!isListLoopActive) return;

      const { cardEl, usernameSpan, clickTarget } = allCards[i];
      if (cardEl.getAttribute('data-tnt-processed') === 'true') {
        continue;
      }

      // Cek apakah kartu ini masih skeleton / belum selesai ter-load
      let rawUsername = usernameSpan?.textContent?.trim() || '';

      if (!rawUsername) {
        updateFloatingStatus(
          `⏳ Kartu ke-${i + 1} belum selesai ter-load (skeleton). Menunggu sampai ter-render...`
        );
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        let skeletonWait = 0;
        while (skeletonWait < 5000 && isListLoopActive) {
          await sleep(300);
          skeletonWait += 300;
          rawUsername = usernameSpan?.textContent?.trim() || '';
          if (rawUsername) break;
        }

        if (!rawUsername) {
          continue;
        }
      }

      const cleanUsername = rawUsername.toLowerCase().replace(/^@/, '');

      // Cek di Buku Catatan (knownUsernames): jika sudah ada, LANGSUNG SKIP tanpa membuka tab!
      if (knownSet.has(cleanUsername)) {
        cardEl.setAttribute('data-tnt-processed', 'true');
        badgeRowCard(cardEl, `⏭️ Sudah di Staging (@${cleanUsername})`, '#10b981', '#10b981');
        safeSendMessage({
          action: 'RECORD_SKIPPED_DUPLICATE',
          username: cleanUsername,
          count: 1,
        });
        freezeAndPruneMedia();
        continue;
      }

      // Kreator belum ada di Buku Catatan -> Klik profilnya untuk membuka tab detail!
      if (!clickTarget) {
        cardEl.setAttribute('data-tnt-processed', 'true');
        freezeAndPruneMedia();
        continue;
      }

      cardEl.setAttribute('data-tnt-processed', 'true');
      freezeAndPruneMedia();
      waitingForDetailTab = true;

      badgeRowCard(cardEl, `⏳ Scraping @${cleanUsername}...`, '#4f46e5', '#6366f1');
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Micro-jitter alami manusia (0.65s - 1.25s) sebelum klik kartu
      await sleep(randomBetween(650, 1250));
      if (!isListLoopActive) {
        waitingForDetailTab = false;
        return;
      }

      safeSendMessage({
        action: 'CARD_CLICKED_WAITING_DETAIL',
        username: cleanUsername,
      });

      simulateHumanClick(clickTarget);

      // Watchdog: jika dalam 25 detik tidak ada sinyal balik (dan tidak sedang pause captcha), lanjut pindai
      if (detailWatchdogTimer) clearTimeout(detailWatchdogTimer);
      detailWatchdogTimer = setTimeout(async () => {
        if (!isExtensionContextValid()) return;
        const check = await new Promise((resolve) => {
          safeSendMessage({ action: 'GET_FULL_STATUS' }, (res) => resolve(res || {}));
        });
        if (check?.state?.isRunning && !check?.state?.isPausedCaptcha && waitingForDetailTab) {
          waitingForDetailTab = false;
          scanAndProcessNextCreatorCard();
        }
      }, 25000);

      return;
    }

    // Jika semua baris yang ada di DOM sudah diproses -> Jangan berhenti! Lakukan Infinite Scroll + Jiggle
    if (isListLoopActive && !waitingForDetailTab) {
      await performInfiniteScrollWithJiggle();
      if (isListLoopActive && !waitingForDetailTab) {
        setTimeout(() => scanAndProcessNextCreatorCard(), 600);
      }
    }
  }

  // ============================================================================
  // 5B. TARGETED SCRAPER MODE (Pencarian Username Spesifik & Scroll 25 Baris)
  // ============================================================================
  let isTargetModeRunning = false;
  let targetQueueList = [];
  let currentTargetIndex = 0;
  let currentActiveTarget = null;

  function findPartnerCenterSearchInput() {
    const candidates = [
      'input[placeholder*="Creator" i]',
      'input[placeholder*="search" i]',
      'input[placeholder*="cari" i]',
      'input[placeholder*="kreator" i]',
      'input[placeholder*="username" i]',
      '.arco-input-inner',
      'input.arco-input',
      'input[type="search"]',
    ];
    for (const selector of candidates) {
      const els = Array.from(document.querySelectorAll(selector));
      for (const el of els) {
        if (el.offsetParent !== null && !el.closest('#tnt-scraping-creator-panel')) {
          return el;
        }
      }
    }
    return null;
  }

  function setNativeInputValue(inputEl, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(inputEl, value);
    } else {
      inputEl.value = value;
    }
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function triggerSearchSubmit(inputEl) {
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true }));

    const btn =
      inputEl.closest('.arco-input-group, .arco-input-wrapper')?.querySelector('.arco-icon-search, button, svg') ||
      inputEl.parentElement?.querySelector('button, svg');
    if (btn && typeof btn.click === 'function') {
      try {
        btn.click();
      } catch (_) {}
    }
  }

  async function processNextTargetStep() {
    if (!isTargetModeRunning) return;

    if (currentTargetIndex >= targetQueueList.length) {
      isTargetModeRunning = false;
      currentActiveTarget = null;
      safeSendMessage({ action: 'SET_ACTIVE_TARGET', target: null });
      updateFloatingStatus(
        `🎉 Selesai! Seluruh antrean target (${targetQueueList.length} kreator) telah selesai diproses. Klik tombol "Tambahkan ke Staging" di bawah!`
      );
      const startBtn = document.getElementById('tnt-btn-start');
      const stopBtn = document.getElementById('tnt-btn-stop');
      const runTargetBtn = document.getElementById('tnt-btn-run-targets');
      if (startBtn) startBtn.style.display = 'block';
      if (stopBtn) stopBtn.style.display = 'none';
      if (runTargetBtn) runTargetBtn.style.display = 'none';
      syncPanelWithBackground();
      return;
    }

    const target = targetQueueList[currentTargetIndex];
    currentActiveTarget = target;
    const cleanUser = String(target.username || '').trim().toLowerCase().replace(/^@/, '');

    // Simpan target aktif ke background agar saat detail tab selesai discrape, campaign_name & campaign_tags tersemat
    safeSendMessage({ action: 'SET_ACTIVE_TARGET', target });

    updateFloatingStatus(
      `🔍 [${currentTargetIndex + 1}/${targetQueueList.length}] Mencari target: @${cleanUser} (${target.campaign_name || 'Campaign'})...`
    );

    // 1. Temukan search input di TikTok Partner Center
    let searchInput = findPartnerCenterSearchInput();
    if (!searchInput) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sleep(600);
      searchInput = findPartnerCenterSearchInput();
    }

    if (!searchInput) {
      updateFloatingStatus(`⚠️ Search bar TikTok Partner Center tidak ditemukan di layar ini.`);
      isTargetModeRunning = false;
      return;
    }

    // 2. Masukkan username (wajib huruf kecil semua & tanpa spasi) ke search input & submit pencarian
    searchInput.focus();
    // Klik tombol clear jika ada di wrapper input
    const clearBtn = searchInput.parentElement?.querySelector('.arco-input-clear-btn, [class*="clear"]');
    if (clearBtn && typeof clearBtn.click === 'function') {
      try { clearBtn.click(); } catch (_) {}
    }
    setNativeInputValue(searchInput, '');
    await sleep(120);
    setNativeInputValue(searchInput, cleanUser.toLowerCase());
    await sleep(250);
    triggerSearchSubmit(searchInput);

    // Tunggu render hasil pencarian
    await sleep(1800);

    // 3. Evaluasi baris: Cek baris 1, jika belum ketemu scroll hingga 25 baris
    const scroller = getScrollContainer() || window;
    let foundCard = null;
    let checkedCount = 0;
    const maxInspectRows = 25;

    for (let scrollAttempt = 0; scrollAttempt < 8; scrollAttempt++) {
      if (!isTargetModeRunning) return;

      const currentCards = getAllCreatorCardElements();
      for (let i = checkedCount; i < currentCards.length && i < maxInspectRows; i++) {
        const c = currentCards[i];
        const cardUsername = (c.usernameSpan?.textContent || '').trim().toLowerCase().replace(/^@/, '');
        if (cardUsername === cleanUser) {
          foundCard = c;
          break;
        }
      }

      if (foundCard) break;
      checkedCount = Math.min(currentCards.length, maxInspectRows);
      if (checkedCount >= maxInspectRows) break;

      // Belum ketemu di baris yang tampak -> scroll ke bawah perlahan untuk memuat baris berikutnya
      updateFloatingStatus(
        `📜 @${cleanUser} belum ada di baris awal. Scroll mencari... (sudah cek ${checkedCount}/${maxInspectRows} baris)`
      );
      if (scroller.scrollBy) {
        scroller.scrollBy({ top: 320, behavior: 'smooth' });
      } else {
        window.scrollBy({ top: 320, behavior: 'smooth' });
      }
      await sleep(800);
    }

    // 4. Jika kartu target ditemukan:
    if (foundCard) {
      updateFloatingStatus(`🎯 Ditemukan @${cleanUser}! Membuka detail profil...`);
      foundCard.cardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(400);

      waitingForDetailTab = true;
      safeSendMessage({
        action: 'CARD_CLICKED_WAITING_DETAIL',
        username: cleanUser,
      });

      // Buka detail tab
      if (foundCard.clickTarget && typeof foundCard.clickTarget.click === 'function') {
        foundCard.clickTarget.click();
      } else {
        const link = foundCard.cardEl?.querySelector('a[href*="/detail"]');
        if (link) link.click();
      }

      // Pasang timeout watchdog jika detail tab tidak merespons dalam 45 detik
      if (detailWatchdogTimer) clearTimeout(detailWatchdogTimer);
      detailWatchdogTimer = setTimeout(async () => {
        if (waitingForDetailTab && isTargetModeRunning) {
          updateFloatingStatus(`⏱️ Timeout membuka @${cleanUser}. Melanjutkan ke target berikutnya...`);
          waitingForDetailTab = false;
          safeSendMessage({ action: 'UPDATE_TARGET_STATUS', username: cleanUser, status: 'failed' });
          currentTargetIndex++;
          processNextTargetStep();
        }
      }, 45000);

      return;
    }

    // 5. Jika tidak ditemukan setelah 25 baris:
    updateFloatingStatus(`⚠️ @${cleanUser} tidak ditemukan setelah 25 baris pencarian. Lewati...`);
    safeSendMessage({ action: 'UPDATE_TARGET_STATUS', username: cleanUser, status: 'failed' });
    currentTargetIndex++;
    await sleep(1000);
    processNextTargetStep();
  }

  // ============================================================================
  // 6. FLOATING PANEL UI ("TNT Scrapping Creator")
  // ============================================================================
  let panelRoot = null;

  function ensureFloatingPanel() {
    if (document.getElementById('tnt-scraping-creator-panel')) return;

    panelRoot = document.createElement('div');
    panelRoot.id = 'tnt-scraping-creator-panel';
    panelRoot.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 340px;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 16px;
      padding: 16px;
      z-index: 999999;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
    `;

    panelRoot.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="background:#4f46e5;color:#fff;font-weight:800;padding:3px 8px;border-radius:6px;font-size:11px;">TNT</span>
          <strong style="font-size:14px;letter-spacing:-0.2px;">TNT Scrapping Creator</strong>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button id="tnt-btn-toggle-settings" title="Buka / Sembunyikan Pengaturan" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:3px 8px;color:#cbd5e1;cursor:pointer;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;transition:all 0.2s;">
            <span>⚙️</span>
            <span id="tnt-settings-btn-label">Pengaturan</span>
          </button>
          <span id="tnt-mode-pill" style="font-size:10px;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:999px;color:#cbd5e1;">Siap</span>
          <button id="tnt-btn-minimize-panel" title="Perkecil Panel" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:0 4px;line-height:1;">—</button>
          <button id="tnt-btn-close-panel" title="Sembunyikan Panel dari Layar" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:0 4px;line-height:1;font-weight:700;">✕</button>
        </div>
      </div>

      <div id="tnt-panel-body">
        <!-- SECTION PENGATURAN (Bisa dimunculkan / disembunyikan via tombol ⚙️ Pengaturan) -->
        <div id="tnt-settings-section" style="display:none;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;">⚙️ PENGATURAN SCRAPING</span>
            <span style="font-size:10px;color:#64748b;cursor:pointer;" id="tnt-btn-close-settings">✕ Tutup</span>
          </div>

          <!-- Setting 1: Toggle Kontak IM -->
          <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
            <label for="tnt-toggle-contacts" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:#f1f5f9;font-weight:600;user-select:none;">
              <input type="checkbox" id="tnt-toggle-contacts" checked style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span>💬 Buka Kontak (IM Chat)</span>
            </label>
            <span id="tnt-toggle-hint" style="font-size:10px;color:#34d399;font-weight:700;">Lengkap (WA/Email)</span>
          </div>

          <!-- Setting 2: Manajemen Buku Catatan -->
          <div style="display:flex;gap:6px;">
            <button id="tnt-btn-sync-book" style="flex:1;padding:7px 8px;border-radius:7px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f8fafc;font-weight:600;font-size:10.5px;cursor:pointer;">
              🔄 Ambil Buku Catatan
            </button>
            <button id="tnt-btn-clear-book" title="Kosongkan Buku Catatan di Ekstensi" style="padding:7px 8px;border-radius:7px;border:1px solid rgba(244,63,94,0.35);background:rgba(244,63,94,0.12);color:#fda4af;font-weight:600;font-size:10.5px;cursor:pointer;">
              🗑️ Hapus Catatan
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:rgba(255,255,255,0.05);padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
            <div style="color:#94a3b8;font-size:10px;font-weight:600;">📖 BUKU CATATAN</div>
            <div style="font-size:15px;font-weight:800;color:#a5b4fc;margin-top:2px;"><span id="tnt-known-count">0</span> <small style="font-size:10px;font-weight:500;color:#64748b;">username</small></div>
          </div>
          <div style="background:rgba(255,255,255,0.05);padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
            <div style="color:#94a3b8;font-size:10px;font-weight:600;">📦 ANTREAN LOCAL</div>
            <div style="font-size:15px;font-weight:800;color:#34d399;margin-top:2px;"><span id="tnt-queue-count">0</span> <small style="font-size:10px;font-weight:500;color:#64748b;">kreator</small></div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;background:rgba(255,255,255,0.04);padding:6px 10px;border-radius:8px;margin-bottom:10px;font-size:11px;color:#cbd5e1;">
          <span>✅ Sesi Ini: <strong id="tnt-session-scraped" style="color:#fff;">0</strong></span>
          <span>⏭️ Skip Duplikat: <strong id="tnt-session-skipped" style="color:#38bdf8;">0</strong></span>
        </div>

        <div id="tnt-status-box" style="background:rgba(79,70,229,0.15);border:1px solid rgba(99,102,241,0.3);color:#e2e8f0;padding:8px 10px;border-radius:8px;margin-bottom:12px;font-size:11px;line-height:1.4;min-height:34px;">
          Siap melakukan scraping kreator TikTok Partner Center.
        </div>

        <!-- Section Mode Antrean Target Update -->
        <div id="tnt-target-section" style="background:rgba(99,102,241,0.08);border:1px dashed rgba(99,102,241,0.35);border-radius:10px;padding:8px 10px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:5px;">
              <span>🎯</span>
              <strong style="color:#c7d2fe;font-size:11px;">Update Antrean Target</strong>
            </div>
            <span id="tnt-target-badge" style="font-size:10px;background:#4f46e5;color:#fff;font-weight:700;padding:1px 6px;border-radius:999px;">0 target</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button id="tnt-btn-fetch-targets" title="Ambil antrean kreator yang disiapkan dari Creator Pool" style="flex:1;padding:6px 8px;border-radius:7px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;font-size:10.5px;font-weight:600;cursor:pointer;">
              📥 Tarik Target
            </button>
            <button id="tnt-btn-run-targets" style="display:none;flex:1.2;padding:6px 8px;border-radius:7px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:10.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(99,102,241,0.4);">
              ▶️ Mulai Target
            </button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="tnt-btn-start" style="width:100%;padding:10px 12px;border-radius:10px;border:none;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.4);">
            ▶️ Mulai Auto-Scrape (Tanpa Henti)
          </button>

          <button id="tnt-btn-stop" style="display:none;width:100%;padding:10px 12px;border-radius:10px;border:none;background:linear-gradient(135deg,#e11d48,#f43f5e);color:#fff;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(225,29,72,0.4);">
            ⏹️ STOP Scraping
          </button>

          <button id="tnt-btn-push-staging" style="display:none;width:100%;padding:11px 12px;border-radius:10px;border:none;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,0.4);">
            🚀 Tambahkan ke Staging (0 Kreator)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(panelRoot);

    // Toggle Pengaturan Scraping (Buka / Sembunyikan)
    const settingsSec = document.getElementById('tnt-settings-section');
    const settingsBtn = document.getElementById('tnt-btn-toggle-settings');

    function setSettingsVisibility(show) {
      if (!settingsSec || !settingsBtn) return;
      settingsSec.style.display = show ? 'block' : 'none';
      settingsBtn.style.background = show ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)';
      settingsBtn.style.borderColor = show ? '#6366f1' : 'rgba(255, 255, 255, 0.15)';
      settingsBtn.style.color = show ? '#a5b4fc' : '#cbd5e1';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ tnt_ui_settings_open: show });
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tnt_ui_settings_open'], (res) => {
        setSettingsVisibility(Boolean(res.tnt_ui_settings_open));
      });
    }

    settingsBtn?.addEventListener('click', () => {
      const isVisible = settingsSec.style.display !== 'none';
      setSettingsVisibility(!isVisible);
    });

    document.getElementById('tnt-btn-close-settings')?.addEventListener('click', () => {
      setSettingsVisibility(false);
    });

    // Toggle Minimize Panel
    const minBtn = document.getElementById('tnt-btn-minimize-panel');
    const panelBody = document.getElementById('tnt-panel-body');

    function setPanelMinimized(isMin) {
      if (!panelRoot || !panelBody || !minBtn) return;
      panelBody.style.display = isMin ? 'none' : 'block';
      panelRoot.style.width = isMin ? 'auto' : '340px';
      panelRoot.style.padding = isMin ? '8px 12px' : '16px';
      minBtn.textContent = isMin ? '◻' : '—';
      minBtn.title = isMin ? 'Perbesar Panel' : 'Perkecil Panel';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ tnt_ui_panel_minimized: isMin });
      }
    }

    minBtn?.addEventListener('click', () => {
      const isCurrentlyMin = panelBody.style.display === 'none';
      setPanelMinimized(!isCurrentlyMin);
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tnt_ui_panel_minimized'], (res) => {
        if (res.tnt_ui_panel_minimized) setPanelMinimized(true);
      });
    }

    // Tombol Close Panel (✕) & Launcher Bubble Mini
    let launcherBubble = document.getElementById('tnt-launcher-bubble');
    if (!launcherBubble) {
      launcherBubble = document.createElement('div');
      launcherBubble.id = 'tnt-launcher-bubble';
      launcherBubble.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4f46e5, #6366f1);
        color: #fff;
        display: none;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 11px;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45);
        z-index: 999999;
        border: 2px solid rgba(255, 255, 255, 0.3);
        user-select: none;
        transition: transform 0.2s;
      `;
      launcherBubble.title = 'Buka TNT Scrapping Creator';
      launcherBubble.textContent = 'TNT';
      launcherBubble.addEventListener('mouseenter', () => {
        launcherBubble.style.transform = 'scale(1.1)';
      });
      launcherBubble.addEventListener('mouseleave', () => {
        launcherBubble.style.transform = 'scale(1)';
      });
      document.body.appendChild(launcherBubble);
    }

    function setPanelHidden(isHidden) {
      if (!panelRoot) return;
      if (isHidden) {
        panelRoot.style.display = 'none';
        if (launcherBubble) launcherBubble.style.display = 'flex';
      } else {
        panelRoot.style.display = 'block';
        if (launcherBubble) launcherBubble.style.display = 'none';
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ tnt_ui_panel_hidden: isHidden });
      }
    }

    window.__tntSetPanelHidden = setPanelHidden;

    document.getElementById('tnt-btn-close-panel')?.addEventListener('click', () => {
      setPanelHidden(true);
    });

    launcherBubble?.addEventListener('click', () => {
      setPanelHidden(false);
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tnt_ui_panel_hidden'], (res) => {
        if (res.tnt_ui_panel_hidden) setPanelHidden(true);
      });
    }

    // Load & listen toggle opsi Buka Kontak (IM Chat)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tnt_opt_scrape_contacts'], (res) => {
        const isChecked = res.tnt_opt_scrape_contacts !== false; // default true
        const chk = document.getElementById('tnt-toggle-contacts');
        const hint = document.getElementById('tnt-toggle-hint');
        if (chk) chk.checked = isChecked;
        if (hint) {
          hint.textContent = isChecked ? 'Lengkap (WA/Email)' : '⚡ Cepat (Detail Saja)';
          hint.style.color = isChecked ? '#34d399' : '#f59e0b';
        }
      });
    }

    document.getElementById('tnt-toggle-contacts')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const hint = document.getElementById('tnt-toggle-hint');
      if (hint) {
        hint.textContent = isChecked ? 'Lengkap (WA/Email)' : '⚡ Cepat (Detail Saja)';
        hint.style.color = isChecked ? '#34d399' : '#f59e0b';
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ tnt_opt_scrape_contacts: isChecked });
      }
    });

    document.getElementById('tnt-btn-sync-book').addEventListener('click', () => {
      updateFloatingStatus('🔄 Mengambil daftar username dari Staging Creator...');
      safeSendMessage({ action: 'SYNC_KNOWN_USERNAMES' }, (res) => {
        if (res && res.success) {
          updateFloatingStatus(`✅ Buku Catatan sinkron: ${res.count} username tercatat.`);
          syncPanelWithBackground();
        } else {
          updateFloatingStatus(`⚠️ ${res?.error || 'Gagal sinkronisasi Buku Catatan.'}`);
        }
      });
    });

    document.getElementById('tnt-btn-clear-book').addEventListener('click', () => {
      safeSendMessage({ action: 'CLEAR_KNOWN_USERNAMES' }, () => {
        // Reset tanda skip pada semua kartu yang sedang tampil di halaman agar bisa di-scrape ulang
        document.querySelectorAll('[data-tnt-processed]').forEach((el) => {
          el.removeAttribute('data-tnt-processed');
          el.style.outline = '';
        });
        document.querySelectorAll('.tnt-row-badge').forEach((b) => b.remove());
        updateFloatingStatus('🗑️ Buku Catatan dikosongkan (0 username).');
        syncPanelWithBackground();
      });
    });

    document.getElementById('tnt-btn-start').addEventListener('click', () => {
      const isDetailPage = window.location.pathname.includes('/creator/detail');
      if (isDetailPage) {
        runManualSingleDetailScrape();
        return;
      }

      safeSendMessage({ action: 'START_AUTO_SCRAPE' }, (res) => {
        if (res && res.success) {
          isListLoopActive = true;
          waitingForDetailTab = false;
          // Nyalakan pembersih memori periodik (setiap 2.5 detik) agar RAM browser tidak OOM
          if (!mediaPruneInterval) {
            mediaPruneInterval = setInterval(() => freezeAndPruneMedia(), 2500);
          }
          freezeAndPruneMedia();
          syncPanelWithBackground();
          scanAndProcessNextCreatorCard();
        }
      });
    });

    document.getElementById('tnt-btn-stop').addEventListener('click', () => {
      isListLoopActive = false;
      isTargetModeRunning = false;
      waitingForDetailTab = false;
      if (detailWatchdogTimer) clearTimeout(detailWatchdogTimer);
      if (mediaPruneInterval) {
        clearInterval(mediaPruneInterval);
        mediaPruneInterval = null;
      }
      freezeAndPruneMedia();
      safeSendMessage({ action: 'STOP_AUTO_SCRAPE' }, () => {
        syncPanelWithBackground();
      });
      const runTargetBtn = document.getElementById('tnt-btn-run-targets');
      if (runTargetBtn && targetQueueList.length > 0) {
        runTargetBtn.style.display = 'block';
      }
    });

    // Listener Mode Antrean Target
    const fetchTargetsBtn = document.getElementById('tnt-btn-fetch-targets');
    const runTargetsBtn = document.getElementById('tnt-btn-run-targets');
    const targetBadge = document.getElementById('tnt-target-badge');

    fetchTargetsBtn?.addEventListener('click', () => {
      updateFloatingStatus('🔄 Menarik antrean target dari Creator Pool...');
      safeSendMessage({ action: 'FETCH_SCRAPE_TARGETS' }, (res) => {
        if (res && res.success && Array.isArray(res.targets) && res.targets.length > 0) {
          // Pastikan semua username target huruf kecil murni tanpa @ dan tanpa spasi
          targetQueueList = res.targets.map((t) => ({
            ...t,
            username: String(t.username || '').trim().toLowerCase().replace(/^@/, ''),
          }));
          currentTargetIndex = 0;
          if (targetBadge) {
            targetBadge.textContent = `${res.targets.length} target`;
            targetBadge.style.background = '#10b981';
          }
          if (runTargetsBtn) {
            runTargetsBtn.style.display = 'block';
            runTargetsBtn.textContent = `▶️ Mulai (${res.targets.length})`;
          }
          const cName = res.targets[0]?.campaign_name || 'Campaign';
          updateFloatingStatus(
            `🎯 Menemukan ${res.targets.length} kreator target untuk [${cName}]. Klik "Mulai" untuk auto-search & scrape!`
          );
        } else {
          targetQueueList = [];
          if (targetBadge) {
            targetBadge.textContent = '0 target';
            targetBadge.style.background = '#4f46e5';
          }
          if (runTargetsBtn) runTargetsBtn.style.display = 'none';
          updateFloatingStatus(
            'ℹ️ Belum ada antrean target. Buka Creator Pool di TNT App, pilih/filter kreator lalu klik "Siapkan Antrean Update".'
          );
        }
      });
    });

    runTargetsBtn?.addEventListener('click', () => {
      if (targetQueueList.length === 0) {
        updateFloatingStatus('⚠️ Antrean target kosong. Tarik target terlebih dahulu.');
        return;
      }

      safeSendMessage({ action: 'START_AUTO_SCRAPE' }, (res) => {
        isTargetModeRunning = true;
        isListLoopActive = false;
        waitingForDetailTab = false;
        currentTargetIndex = 0;

        const startBtn = document.getElementById('tnt-btn-start');
        const stopBtn = document.getElementById('tnt-btn-stop');
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';
        if (runTargetsBtn) runTargetsBtn.style.display = 'none';

        // Mulai targeted loop
        processNextTargetStep();
      });
    });

    document.getElementById('tnt-btn-push-staging').addEventListener('click', () => {
      const btn = document.getElementById('tnt-btn-push-staging');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Mengirim ke Staging Creator...';
      }
      safeSendMessage({ action: 'PUSH_TO_STAGING' }, (res) => {
        if (btn) btn.disabled = false;
        if (res && res.success) {
          updateFloatingStatus(`🚀 Berhasil mengirim ${res.count} kreator ke Staging Creator!`);
        } else {
          updateFloatingStatus(`⚠️ ${res?.error || 'Gagal mengirim ke Staging.'}`);
        }
        syncPanelWithBackground();
      });
    });
  }

  function updateFloatingStatus(text) {
    const box = document.getElementById('tnt-status-box');
    if (box) box.textContent = text;
  }

  function refreshFloatingPanelUI(fullStatus) {
    ensureFloatingPanel();
    const state = fullStatus?.state || {};
    const queue = fullStatus?.queue || [];
    const knownCount = fullStatus?.knownCount || 0;
    const isDetailPage = window.location.pathname.includes('/creator/detail');

    const knownEl = document.getElementById('tnt-known-count');
    const queueEl = document.getElementById('tnt-queue-count');
    const scrapedEl = document.getElementById('tnt-session-scraped');
    const skippedEl = document.getElementById('tnt-session-skipped');
    const pillEl = document.getElementById('tnt-mode-pill');
    const startBtn = document.getElementById('tnt-btn-start');
    const stopBtn = document.getElementById('tnt-btn-stop');
    const pushBtn = document.getElementById('tnt-btn-push-staging');

    if (knownEl) knownEl.textContent = knownCount.toLocaleString('id-ID');
    if (queueEl) queueEl.textContent = queue.length.toLocaleString('id-ID');
    if (scrapedEl) scrapedEl.textContent = (state.scrapedCountSession || 0).toLocaleString('id-ID');
    if (skippedEl) skippedEl.textContent = (state.skippedCountSession || 0).toLocaleString('id-ID');

    if (state.statusMessage) {
      updateFloatingStatus(state.statusMessage);
    }

    if (state.isPausedCaptcha) {
      if (pillEl) {
        pillEl.textContent = '⏸️ CAPTCHA';
        pillEl.style.background = '#f59e0b';
        pillEl.style.color = '#fff';
      }
    } else if (state.isRunning) {
      if (pillEl) {
        pillEl.textContent = '🟢 RUNNING';
        pillEl.style.background = '#10b981';
        pillEl.style.color = '#fff';
      }
    } else {
      if (pillEl) {
        pillEl.textContent = '⏹️ IDLE';
        pillEl.style.background = 'rgba(255,255,255,0.12)';
        pillEl.style.color = '#cbd5e1';
      }
    }

    if (startBtn && stopBtn) {
      if (isDetailPage && !state.isRunning) {
        startBtn.style.display = 'block';
        startBtn.textContent = '⚡ Scrape Profil Kreator Ini';
        stopBtn.style.display = 'none';
      } else if (state.isRunning) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else {
        startBtn.style.display = 'block';
        startBtn.textContent = '▶️ Mulai Auto-Scrape (Tanpa Henti)';
        stopBtn.style.display = 'none';
      }
    }

    // Tampilkan tombol "Tambahkan ke Staging" ketika scraping sudah STOP dan ada data di local queue
    if (pushBtn) {
      if (!state.isRunning && queue.length > 0) {
        pushBtn.style.display = 'block';
        pushBtn.textContent = `🚀 Tambahkan ke Staging (${queue.length} Kreator)`;
      } else {
        pushBtn.style.display = 'none';
      }
    }
  }

  function syncPanelWithBackground() {
    safeSendMessage({ action: 'GET_FULL_STATUS' }, (res) => {
      if (res) refreshFloatingPanelUI(res);
    });
  }

  async function runManualSingleDetailScrape() {
    try {
      const data = await waitAndScrapeCreatorDetailPage(updateFloatingStatus);
      const headerContact = extractHeaderContactInfo();
      if (headerContact.email && !data.email) data.email = headerContact.email;
      if (headerContact.no_whatsapp && !data.no_whatsapp) data.no_whatsapp = headerContact.no_whatsapp;

      safeSendMessage(
        { action: 'SCRAPE_DETAIL_SUCCESS', payload: data, closeTab: false },
        () => {
          updateFloatingStatus(
            `✅ @${data.username} berhasil disimpan ke Local (GMV: Rp ${Number(
              data.gmv_30d || 0
            ).toLocaleString('id-ID')} [${data.gmv_status}])`
          );
          syncPanelWithBackground();
        }
      );
    } catch (err) {
      updateFloatingStatus(`❌ Gagal scrape: ${err?.message || err}`);
    }
  }

  // ============================================================================
  // 7. LISTENER PESAN DARI BACKGROUND & AUTO-TRIGGER DETAIL TAB
  // ============================================================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TOGGLE_PANEL_VISIBILITY') {
      const panel = document.getElementById('tnt-scraping-creator-panel');
      const isHidden = panel && panel.style.display === 'none';
      if (typeof window.__tntSetPanelHidden === 'function') {
        window.__tntSetPanelHidden(!isHidden);
      }
      sendResponse({ ok: true, isHidden: !isHidden });
      return;
    }

    if (request.action === 'STATE_UPDATED') {
      syncPanelWithBackground();
      sendResponse({ ok: true });
      return;
    }

    if (request.action === 'CONTINUE_NEXT_CARD') {
      if (detailWatchdogTimer) clearTimeout(detailWatchdogTimer);
      waitingForDetailTab = false;
      syncPanelWithBackground();

      // PROTEKSI ANTI-OOM CHROME:
      // Chrome V8 heap memiliki batas native memory ~2GB yang terakumulasi setelah ~70 tab dibuka-tutup.
      // Solusi: Setiap 30 kreator, tab Find Creators me-refresh halamannya sendiri (Soft Reload).
      // Reload ini seketika memusnahkan seluruh 2GB garbage RAM dan memulihkan proses ke 60MB!
      safeSendMessage({ action: 'GET_FULL_STATUS' }, async (fullStatus) => {
        const sessionCount = fullStatus?.state?.scrapedCountSession || 0;
        const lastPurge = parseInt(sessionStorage.getItem('tnt_last_ram_purge_count') || '0', 10);

        if (sessionCount >= 30 && sessionCount - lastPurge >= 30) {
          sessionStorage.setItem('tnt_last_ram_purge_count', String(sessionCount));
          const scroller = getScrollContainer();
          if (scroller) {
            sessionStorage.setItem('tnt_restore_scroll_top', String(scroller.scrollTop || 0));
          }
          updateFloatingStatus(
            `🧹 Auto RAM Recycling (${sessionCount} kreator): Me-refresh tab untuk mengosongkan 2GB memori browser...`
          );
          await sleep(1000);
          window.location.reload();
          return;
        }

        if (isTargetModeRunning) {
          if (currentActiveTarget && currentActiveTarget.username) {
            safeSendMessage({
              action: 'UPDATE_TARGET_STATUS',
              username: currentActiveTarget.username,
              status: 'completed',
            });
          }
          currentTargetIndex++;
          // Beri jeda 1.4 detik agar Garbage Collector Chrome & OS membebaskan RAM tab yang baru ditutup
          await sleep(1400);
          processNextTargetStep();
          return;
        }

        if (isListLoopActive) {
          scanAndProcessNextCreatorCard();
        }
      });

      sendResponse({ ok: true });
      return;
    }
  });

  async function bootstrapTikTokPartnerPage() {
    ensureFloatingPanel();
    const fullStatus = await new Promise((resolve) => {
      safeSendMessage({ action: 'GET_FULL_STATUS' }, (res) => resolve(res || {}));
    });
    refreshFloatingPanelUI(fullStatus);

    const isDetailPage = window.location.pathname.includes('/creator/detail');
    const isImPage = window.location.pathname.includes('/partner/im');

    // Skenario A: Halaman IM Chat Room
    if (isImPage) {
      let pendingData = null;
      let readAttempts = 0;

      while (!pendingData && readAttempts < 15) {
        const pendingRaw = sessionStorage.getItem('tnt_pending_creator_scrape');
        if (pendingRaw) {
          try {
            pendingData = JSON.parse(pendingRaw);
          } catch (_) {}
        }

        if (!pendingData && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const localStore = await new Promise((resolve) => {
            chrome.storage.local.get(['tnt_pending_creator_scrape'], (r) => resolve(r || {}));
          });
          if (localStore?.tnt_pending_creator_scrape) {
            pendingData = localStore.tnt_pending_creator_scrape;
          }
        }

        if (pendingData) break;
        await sleep(250);
        readAttempts++;
      }

      if (pendingData) {
        safeSendMessage({ action: 'IM_TAB_ACTIVE', username: pendingData.username });
        await waitAndScrapeImContactInfo(pendingData, updateFloatingStatus);
      }
      return;
    }

    // Skenario B: Halaman Detail Kreator
    const shouldAutoScrapeDetail =
      isDetailPage &&
      (fullStatus?.state?.isRunning ||
        Boolean(fullStatus?.state?.currentUsername) ||
        Boolean(fullStatus?.activeTarget));

    if (shouldAutoScrapeDetail) {
      try {
        const scrapedData = await waitAndScrapeCreatorDetailPage(updateFloatingStatus);

        // Cek opsi Buka Kontak (IM Chat) yang dipilih user di panel
        let shouldScrapeContacts = true;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const optStore = await new Promise((resolve) => {
            chrome.storage.local.get(['tnt_opt_scrape_contacts'], (r) => resolve(r || {}));
          });
          shouldScrapeContacts = optStore.tnt_opt_scrape_contacts !== false;
        }

        // JIKA OPSI KONTAK TIDAK DICENTANG (MODE CEPAT):
        // Jangan pernah sentuh kontak / jangan ambil angka acak! Langsung simpan analitik & tutup tab seketika.
        if (!shouldScrapeContacts) {
          scrapedData.no_whatsapp = null;
          scrapedData.email = null;
          updateFloatingStatus(`⚡ Mode Cepat: Menyimpan @${scrapedData.username} & lanjut kreator berikutnya...`);
          safeSendMessage({
            action: 'SCRAPE_DETAIL_SUCCESS',
            payload: scrapedData,
            closeTab: true,
          });
          return;
        }

        const headerContact = extractHeaderContactInfo();
        if (headerContact.email && !scrapedData.email) scrapedData.email = headerContact.email;
        if (headerContact.no_whatsapp && !scrapedData.no_whatsapp) scrapedData.no_whatsapp = headerContact.no_whatsapp;

        sessionStorage.setItem('tnt_pending_creator_scrape', JSON.stringify(scrapedData));
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await new Promise((resolve) => {
            chrome.storage.local.set({ tnt_pending_creator_scrape: scrapedData }, resolve);
          });
        }

        updateFloatingStatus(`💬 Membuka IM Chat room @${scrapedData.username} untuk mengambil Kontak...`);

        const chatBtn = findDetailChatButton();
        if (chatBtn) {
          // Klik tombol chat di header detail yang membuka tab IM baru di browser
          simulateHumanClick(chatBtn);

          // Beri jeda 900ms agar tab IM baru terbuka, lalu sinyal ke background untuk menutup tab detail ini!
          await sleep(900);
          safeSendMessage({ action: 'DETAIL_TAB_OPENED_IM', username: scrapedData.username });
        } else {
          // Jika kreator ini benar-benar tidak memiliki tombol chat di header detail
          updateFloatingStatus(`ℹ️ @${scrapedData.username} tidak memiliki tombol chat. Menyimpan data...`);
          safeSendMessage({
            action: 'SCRAPE_DETAIL_SUCCESS',
            payload: scrapedData,
            closeTab: true,
          });
        }
      } catch (err) {
        updateFloatingStatus(`❌ Error ekstraksi detail: ${err?.message || err}`);
      }
    } else if (!isDetailPage && fullStatus?.state?.isRunning) {
      // Halaman Find Creators saat Auto-Scrape menyala
      isListLoopActive = true;
      waitingForDetailTab = false;
      if (!mediaPruneInterval) {
        mediaPruneInterval = setInterval(() => freezeAndPruneMedia(), 2500);
      }
      freezeAndPruneMedia();

      // Jika baru saja Auto RAM Purge, pulihkan scroll position
      const savedScroll = sessionStorage.getItem('tnt_restore_scroll_top');
      if (savedScroll) {
        sessionStorage.removeItem('tnt_restore_scroll_top');
        const scroller = getScrollContainer();
        if (scroller) {
          scroller.scrollTop = Number(savedScroll) || 0;
          await sleep(600);
        }
      }

      scanAndProcessNextCreatorCard();
    } else {
      // Pada kondisi standby pun lakukan pembersihan media agar tab tetap enteng
      freezeAndPruneMedia();
    }
  }

  // Jalankan saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapTikTokPartnerPage);
  } else {
    bootstrapTikTokPartnerPage();
  }
})();
