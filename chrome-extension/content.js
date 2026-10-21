(() => {
  if (window.__TNT_SCRAPING_CREATOR_LOADED__) return;
  window.__TNT_SCRAPING_CREATOR_LOADED__ = true;

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
          if (Array.isArray(parsed.usernames) && parsed.usernames.length > 0) {
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

    // Strategi 2: Simulasi Sweep Vertikal pada <canvas>
    const canvas = container.querySelector('canvas');
    if (!canvas) return [];
    const rect = canvas.getBoundingClientRect();
    if (rect.height < 20 || rect.width < 20) return [];

    const locationsMap = new Map();
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const clientX = rect.left + rect.width * 0.35;
      const clientY = rect.top + (rect.height / steps) * (i + 0.5);
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
      await sleep(45);

      const titleEl = container.querySelector(CREATOR_DETAIL_SELECTORS.chartTooltipTitle);
      const valEl = container.querySelector(CREATOR_DETAIL_SELECTORS.chartTooltipItem);
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

  /**
   * Menunggu halaman Detail Kreator ter-load 100% (termasuk Smart Pause jika muncul Captcha
   * dan scroll bertahap ke bawah agar semua chart lazy-load ter-render).
   */
  async function waitAndScrapeCreatorDetailPage(statusCallback) {
    const notify = (msg) => {
      if (typeof statusCallback === 'function') statusCallback(msg);
    };

    notify('⏳ Menunggu profil kreator ter-load...');

    let waitedMs = 0;
    let wasPausedCaptcha = false;

    while (true) {
      if (isCaptchaVisible()) {
        if (!wasPausedCaptcha) {
          wasPausedCaptcha = true;
          chrome.runtime.sendMessage({ action: 'DETAIL_TAB_CAPTCHA_DETECTED' });
        }
        notify('⏸️ CAPTCHA TERDETEKSI! Geser puzzle secara manual untuk melanjutkan otomatis...');
        await sleep(1000);
        continue;
      }

      if (wasPausedCaptcha) {
        wasPausedCaptcha = false;
        chrome.runtime.sendMessage({ action: 'DETAIL_TAB_CAPTCHA_RESOLVED' });
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

    // Scroll bertahap ke bawah agar seluruh section lazy-load (#collaborations_tab, #followers_tab, #trends_tab) ter-render 100%
    notify('📜 Menggulir halaman agar seluruh grafik & demografi ter-load 100%...');
    const sections = [
      CREATOR_DETAIL_SELECTORS.collaborationsSection,
      CREATOR_DETAIL_SELECTORS.followersSection,
      CREATOR_DETAIL_SELECTORS.trendsSection,
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

  // ============================================================================
  // 5. ENGINE AUTO-SCRAPE DI HALAMAN FIND CREATORS (/affiliate-cmp/creator)
  // ============================================================================
  let isListLoopActive = false;
  let waitingForDetailTab = false;
  let detailWatchdogTimer = null;

  function getScrollContainer() {
    const direct = document.querySelector(FIND_CREATORS_SELECTORS.scrollContainer);
    if (direct) return direct;
    const wrapper = document.querySelector('div[data-e2e="9d644e6c-6279-450c"]');
    if (wrapper) {
      const divs = wrapper.querySelectorAll('div');
      for (const d of divs) {
        if (d.scrollHeight > d.clientHeight + 50) return d;
      }
    }
    return document.scrollingElement || document.documentElement;
  }

  function simulateHumanClick(element) {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + Math.max(10, Math.min(rect.width - 10, rect.width * 0.35));
    const clientY = rect.top + Math.max(8, Math.min(rect.height - 8, rect.height * 0.5));
    const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY };

    element.dispatchEvent(new MouseEvent('mouseover', opts));
    element.dispatchEvent(new MouseEvent('mouseenter', opts));
    element.dispatchEvent(new MouseEvent('mousedown', opts));
    element.dispatchEvent(new MouseEvent('mouseup', opts));
    element.click();
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

    const beforeRows = document.querySelectorAll(FIND_CREATORS_SELECTORS.rowItem).length;
    updateFloatingStatus('📜 Scroll ke bawah untuk memuat baris kreator baru...');

    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    await sleep(1000);

    const afterFirstScroll = document.querySelectorAll(FIND_CREATORS_SELECTORS.rowItem).length;
    if (afterFirstScroll <= beforeRows) {
      // Sensor mentok -> lakukan Scroll Jiggle (naik ~260px lalu turun lagi)
      updateFloatingStatus('🔄 Scroll mentok — melakukan Scroll Jiggle (naik sedikit & turun lagi)...');
      scroller.scrollBy({ top: -260, behavior: 'smooth' });
      await sleep(480);
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      await sleep(900);
    }
  }

  /**
   * Memindai kartu dari atas ke bawah.
   * Menangani loading baris acak (Out-of-Order): jika ada baris yang belum selesai render (skeleton),
   * WAJIB ditunggu dulu, jangan di-skip!
   */
  async function scanAndProcessNextCreatorCard() {
    if (!isListLoopActive || waitingForDetailTab) return;

    const fullStatus = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_FULL_STATUS' }, (res) => resolve(res || {}));
    });

    if (!fullStatus?.state?.isRunning) {
      isListLoopActive = false;
      refreshFloatingPanelUI(fullStatus);
      return;
    }

    const knownSet = new Set(
      (fullStatus.knownUsernames || []).map((u) => String(u).trim().toLowerCase())
    );

    const allRows = Array.from(document.querySelectorAll(FIND_CREATORS_SELECTORS.rowItem));

    for (let i = 0; i < allRows.length; i++) {
      if (!isListLoopActive) return;

      const row = allRows[i];
      if (row.getAttribute('data-tnt-processed') === 'true') {
        continue;
      }

      // Cek apakah baris ini masih skeleton / belum selesai ter-load (karena loading TikTok kadang acak misal 24 dulu baru 22)
      let usernameEl = row.querySelector(FIND_CREATORS_SELECTORS.username);
      let rawUsername = usernameEl?.textContent?.trim() || '';

      if (!rawUsername) {
        updateFloatingStatus(
          `⏳ Baris ke-${i + 1} belum selesai ter-load (skeleton). Menunggu sampai ter-render...`
        );
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });

        let skeletonWait = 0;
        while (skeletonWait < 5000 && isListLoopActive) {
          await sleep(300);
          skeletonWait += 300;
          usernameEl = row.querySelector(FIND_CREATORS_SELECTORS.username);
          rawUsername = usernameEl?.textContent?.trim() || '';
          if (rawUsername) break;
        }

        if (!rawUsername) {
          // Masih belum render setelah 5 detik, biarkan tanpa tanda data-tnt-processed agar siklus berikutnya dicek lagi
          continue;
        }
      }

      const cleanUsername = rawUsername.toLowerCase().replace(/^@/, '');

      // Cek di Buku Catatan (knownUsernames): jika sudah ada, LANGSUNG SKIP tanpa membuka tab!
      if (knownSet.has(cleanUsername)) {
        row.setAttribute('data-tnt-processed', 'true');
        badgeRowCard(row, `⏭️ Sudah di Staging (@${cleanUsername})`, '#10b981', '#10b981');
        chrome.runtime.sendMessage({
          action: 'RECORD_SKIPPED_DUPLICATE',
          username: cleanUsername,
          count: 1,
        });
        continue;
      }

      // Kreator belum ada di Buku Catatan -> Klik profilnya untuk membuka tab detail!
      const clickTarget =
        row.querySelector(FIND_CREATORS_SELECTORS.cardClickTarget) || usernameEl;

      if (!clickTarget) {
        row.setAttribute('data-tnt-processed', 'true');
        continue;
      }

      row.setAttribute('data-tnt-processed', 'true');
      waitingForDetailTab = true;

      badgeRowCard(row, `⏳ Scraping @${cleanUsername}...`, '#4f46e5', '#6366f1');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Micro-jitter alami manusia (0.65s - 1.25s) sebelum klik kartu
      await sleep(randomBetween(650, 1250));
      if (!isListLoopActive) {
        waitingForDetailTab = false;
        return;
      }

      chrome.runtime.sendMessage({
        action: 'CARD_CLICKED_WAITING_DETAIL',
        username: cleanUsername,
      });

      simulateHumanClick(clickTarget);

      // Watchdog: jika dalam 25 detik tidak ada sinyal balik (dan tidak sedang pause captcha), lanjut pindai
      if (detailWatchdogTimer) clearTimeout(detailWatchdogTimer);
      detailWatchdogTimer = setTimeout(async () => {
        const check = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'GET_FULL_STATUS' }, (res) => resolve(res || {}));
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
        <span id="tnt-mode-pill" style="font-size:10px;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:999px;color:#cbd5e1;">Siap</span>
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

      <div style="display:flex;flex-direction:column;gap:8px;">
        <button id="tnt-btn-sync-book" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.07);color:#f8fafc;font-weight:600;font-size:11px;cursor:pointer;">
          🔄 Ambil Buku Catatan dari Staging
        </button>

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
    `;

    document.body.appendChild(panelRoot);

    document.getElementById('tnt-btn-sync-book').addEventListener('click', () => {
      updateFloatingStatus('🔄 Mengambil daftar username dari Staging Creator...');
      chrome.runtime.sendMessage({ action: 'SYNC_KNOWN_USERNAMES' }, (res) => {
        if (res && res.success) {
          updateFloatingStatus(`✅ Buku Catatan sinkron: ${res.count} username tercatat.`);
          syncPanelWithBackground();
        } else {
          updateFloatingStatus(`⚠️ ${res?.error || 'Gagal sinkronisasi Buku Catatan.'}`);
        }
      });
    });

    document.getElementById('tnt-btn-start').addEventListener('click', () => {
      const isDetailPage = window.location.pathname.includes('/creator/detail');
      if (isDetailPage) {
        runManualSingleDetailScrape();
        return;
      }

      chrome.runtime.sendMessage({ action: 'START_AUTO_SCRAPE' }, (res) => {
        if (res && res.success) {
          isListLoopActive = true;
          waitingForDetailTab = false;
          syncPanelWithBackground();
          scanAndProcessNextCreatorCard();
        }
      });
    });

    document.getElementById('tnt-btn-stop').addEventListener('click', () => {
      isListLoopActive = false;
      waitingForDetailTab = false;
      if (detailWatchdogTimer) clearTimeout(detailWatchdogTimer);
      chrome.runtime.sendMessage({ action: 'STOP_AUTO_SCRAPE' }, () => {
        syncPanelWithBackground();
      });
    });

    document.getElementById('tnt-btn-push-staging').addEventListener('click', () => {
      const btn = document.getElementById('tnt-btn-push-staging');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Mengirim ke Staging Creator...';
      }
      chrome.runtime.sendMessage({ action: 'PUSH_TO_STAGING' }, (res) => {
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
    chrome.runtime.sendMessage({ action: 'GET_FULL_STATUS' }, (res) => {
      if (res) refreshFloatingPanelUI(res);
    });
  }

  async function runManualSingleDetailScrape() {
    try {
      const data = await waitAndScrapeCreatorDetailPage(updateFloatingStatus);
      chrome.runtime.sendMessage(
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
    if (request.action === 'STATE_UPDATED') {
      syncPanelWithBackground();
      sendResponse({ ok: true });
      return;
    }

    if (request.action === 'CONTINUE_NEXT_CARD') {
      if (detailWatchdogTimer) clearTimeout(detailWatchdogTimer);
      waitingForDetailTab = false;
      syncPanelWithBackground();
      // Tanpa jeda statis 2 detik: langsung pindai dan klik kartu berikutnya!
      if (isListLoopActive) {
        scanAndProcessNextCreatorCard();
      }
      sendResponse({ ok: true });
      return;
    }
  });

  async function bootstrapTikTokPartnerPage() {
    ensureFloatingPanel();
    const fullStatus = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_FULL_STATUS' }, (res) => resolve(res || {}));
    });
    refreshFloatingPanelUI(fullStatus);

    const isDetailPage = window.location.pathname.includes('/creator/detail');

    if (isDetailPage && fullStatus?.state?.isRunning) {
      // Tab Detail ini dibuka otomatis oleh Auto-Scrape -> langsung jalankan ekstraksi & tutup tab setelah beres!
      try {
        const scrapedData = await waitAndScrapeCreatorDetailPage(updateFloatingStatus);
        chrome.runtime.sendMessage({
          action: 'SCRAPE_DETAIL_SUCCESS',
          payload: scrapedData,
          closeTab: true,
        });
      } catch (err) {
        updateFloatingStatus(`❌ Error ekstraksi detail: ${err?.message || err}`);
      }
    } else if (!isDetailPage && fullStatus?.state?.isRunning) {
      // Jika halaman Find Creators di-refresh saat Auto-Scrape masih menyala
      isListLoopActive = true;
      waitingForDetailTab = false;
      scanAndProcessNextCreatorCard();
    }
  }

  // Jalankan saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapTikTokPartnerPage);
  } else {
    bootstrapTikTokPartnerPage();
  }
})();
