const STORAGE_KEYS = {
  QUEUE: 'tnt_scraper_queue',
  KNOWN_USERNAMES: 'tnt_known_usernames',
  KNOWN_UPDATED_AT: 'tnt_known_updated_at',
  AUTO_STATE: 'tnt_auto_state',
};

const DEFAULT_AUTO_STATE = {
  isRunning: false,
  isPausedCaptcha: false,
  hasStoppedWithQueue: false,
  listTabId: null,
  activeDetailTabId: null,
  activeImTabId: null,
  currentUsername: null,
  scrapedCountSession: 0,
  skippedCountSession: 0,
  statusMessage: 'Siap menjalankan Auto-Scrape',
};

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (res) => resolve(res || {}));
  });
}

function setStorage(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve());
  });
}

async function getAutoState() {
  const res = await getStorage([STORAGE_KEYS.AUTO_STATE]);
  return { ...DEFAULT_AUTO_STATE, ...(res[STORAGE_KEYS.AUTO_STATE] || {}) };
}

async function updateAutoState(patch) {
  const prev = await getAutoState();
  const next = { ...prev, ...patch };
  await setStorage({ [STORAGE_KEYS.AUTO_STATE]: next });
  if (next.listTabId) {
    chrome.tabs.sendMessage(next.listTabId, { action: 'STATE_UPDATED', state: next }).catch(() => {});
  }
  return next;
}

/**
 * Mencari tab aplikasi TNT yang sedang terbuka (Production atau Localhost)
 */
function findTntAppTab() {
  return new Promise((resolve) => {
    chrome.tabs.query(
      { url: ['*://campaign.tntkreatif.com/*', 'http://localhost:*/*'] },
      (tabs) => {
        if (tabs && tabs.length > 0) {
          // Prioritaskan tab yang sedang membuka /creator-pool/staging
          const stagingTab = tabs.find((t) => t.url && t.url.includes('/creator-pool/staging'));
          resolve(stagingTab || tabs[0]);
        } else {
          resolve(null);
        }
      }
    );
  });
}

/**
 * Menjalankan script di tab TNT untuk mengambil daftar Buku Catatan (knownUsernames) dari API / DOM Staging
 */
async function syncKnownUsernamesFromTntTab(openStagingIfNeeded = true) {
  let tab = await findTntAppTab();

  if (!tab && openStagingIfNeeded) {
    tab = await new Promise((resolve) => {
      chrome.tabs.create(
        { url: 'https://campaign.tntkreatif.com/creator-pool/staging', active: false },
        (newTab) => {
          const listener = (tabId, info) => {
            if (tabId === newTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => resolve(newTab), 1200);
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        }
      );
    });
  }

  if (!tab || !tab.id) {
    return {
      success: false,
      error: 'Tab aplikasi TNT belum terbuka. Buka halaman Staging Creator terlebih dahulu.',
    };
  }

  try {
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          const res = await fetch('/api/creator-staging', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.usernames)) {
              localStorage.setItem('tnt_known_usernames', JSON.stringify(data.usernames));
              return {
                success: true,
                usernames: data.usernames,
                stagingCount: data.stagingCount || 0,
                poolCount: data.poolCount || 0,
              };
            }
          }
        } catch {
          // Fallback ke DOM atau localStorage jika fetch gagal
        }

        const scriptEl = document.getElementById('tnt-known-usernames-json');
        if (scriptEl && scriptEl.textContent) {
          try {
            const parsed = JSON.parse(scriptEl.textContent);
            if (Array.isArray(parsed.usernames)) {
              return { success: true, usernames: parsed.usernames };
            }
          } catch {}
        }

        const localRaw = localStorage.getItem('tnt_known_usernames');
        if (localRaw) {
          try {
            const arr = JSON.parse(localRaw);
            if (Array.isArray(arr)) {
              return { success: true, usernames: arr };
            }
          } catch {}
        }

        return {
          success: false,
          error: 'Pastikan Anda sudah login di aplikasi TNT (campaign.tntkreatif.com).',
        };
      },
    });

    const result = injectionResults?.[0]?.result;
    if (result && result.success && Array.isArray(result.usernames)) {
      const storage = await getStorage([STORAGE_KEYS.QUEUE]);
      const localQueue = storage[STORAGE_KEYS.QUEUE] || [];
      const queueUsernames = localQueue
        .map((c) => (c?.username ? String(c.username).trim().toLowerCase() : ''))
        .filter(Boolean);

      const merged = Array.from(
        new Set([
          ...result.usernames.map((u) => String(u).trim().toLowerCase()).filter(Boolean),
          ...queueUsernames,
        ])
      );

      const nowIso = new Date().toISOString();
      await setStorage({
        [STORAGE_KEYS.KNOWN_USERNAMES]: merged,
        [STORAGE_KEYS.KNOWN_UPDATED_AT]: nowIso,
      });

      return {
        success: true,
        count: merged.length,
        updatedAt: nowIso,
      };
    }

    return {
      success: false,
      error: result?.error || 'Gagal membaca Buku Catatan dari aplikasi TNT.',
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || 'Gagal menghubungi tab aplikasi TNT.',
    };
  }
}

/**
 * Mengirim antrean lokal (tnt_scraper_queue) ke halaman Staging Creator (/creator-pool/staging)
 */
async function pushQueueToStaging(customQueue) {
  const storage = await getStorage([STORAGE_KEYS.QUEUE]);
  const queue = Array.isArray(customQueue) ? customQueue : storage[STORAGE_KEYS.QUEUE] || [];

  if (!queue || queue.length === 0) {
    return { success: false, error: 'Antrean lokal kosong.' };
  }

  const targetStagingUrl = 'https://campaign.tntkreatif.com/creator-pool/staging';
  let tab = await findTntAppTab();

  const injectAndSubmit = async (targetTab) => {
    await chrome.tabs.update(targetTab.id, { active: true });
    if (targetTab.windowId) {
      await chrome.windows.update(targetTab.windowId, { focused: true }).catch(() => {});
    }

    await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: async (batchItems) => {
        // Simpan ke localStorage bridge agar halaman /creator-pool/staging otomatis memproses
        localStorage.setItem('tnt_staging_incoming_batch', JSON.stringify(batchItems));
        if (window.location.pathname.startsWith('/creator-pool/staging')) {
          window.dispatchEvent(new CustomEvent('TNT_PUSH_TO_STAGING'));
        } else {
          window.location.href = '/creator-pool/staging';
        }
      },
      args: [queue],
    });
  };

  if (tab && tab.id) {
    await injectAndSubmit(tab);
  } else {
    await new Promise((resolve) => {
      chrome.tabs.create({ url: targetStagingUrl, active: true }, (newTab) => {
        const listener = (tabId, info) => {
          if (tabId === newTab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            injectAndSubmit(newTab).then(resolve);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    });
  }

  // Kosongkan antrean lokal setelah dikirim ke Staging
  await setStorage({ [STORAGE_KEYS.QUEUE]: [] });
  await updateAutoState({
    hasStoppedWithQueue: false,
    statusMessage: `🚀 ${queue.length} kreator berhasil dikirim ke Staging Creator!`,
  });

  return { success: true, count: queue.length };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    const action = request?.action;

    if (action === 'SYNC_KNOWN_USERNAMES') {
      const res = await syncKnownUsernamesFromTntTab(true);
      sendResponse(res);
      return;
    }

    if (action === 'CLEAR_KNOWN_USERNAMES') {
      await setStorage({
        [STORAGE_KEYS.KNOWN_USERNAMES]: [],
        [STORAGE_KEYS.KNOWN_UPDATED_AT]: null,
      });
      const nextState = await updateAutoState({
        skippedCountSession: 0,
        statusMessage: '🗑️ Buku Catatan berhasil dikosongkan (0 username).',
      });
      sendResponse({ success: true, count: 0, state: nextState });
      return;
    }

    if (action === 'PASSIVE_UPDATE_KNOWN_USERNAMES') {
      const incoming = Array.isArray(request.usernames) ? request.usernames : [];
      const storage = await getStorage([STORAGE_KEYS.QUEUE]);
      const queue = storage[STORAGE_KEYS.QUEUE] || [];
      const merged = Array.from(
        new Set(
          [
            ...incoming.map((u) => String(u).trim().toLowerCase()),
            ...queue.map((c) => String(c?.username || '').trim().toLowerCase()),
          ].filter(Boolean)
        )
      );
      await setStorage({
        [STORAGE_KEYS.KNOWN_USERNAMES]: merged,
        [STORAGE_KEYS.KNOWN_UPDATED_AT]: new Date().toISOString(),
      });
      sendResponse({ success: true, count: merged.length });
      return;
    }

    if (action === 'GET_FULL_STATUS') {
      const storage = await getStorage([
        STORAGE_KEYS.AUTO_STATE,
        STORAGE_KEYS.QUEUE,
        STORAGE_KEYS.KNOWN_USERNAMES,
        STORAGE_KEYS.KNOWN_UPDATED_AT,
      ]);
      sendResponse({
        state: { ...DEFAULT_AUTO_STATE, ...(storage[STORAGE_KEYS.AUTO_STATE] || {}) },
        queue: storage[STORAGE_KEYS.QUEUE] || [],
        knownCount: (storage[STORAGE_KEYS.KNOWN_USERNAMES] || []).length,
        knownUsernames: storage[STORAGE_KEYS.KNOWN_USERNAMES] || [],
        knownUpdatedAt: storage[STORAGE_KEYS.KNOWN_UPDATED_AT] || null,
      });
      return;
    }

    if (action === 'START_AUTO_SCRAPE') {
      const listTabId = sender?.tab?.id || request.tabId || null;

      const newState = await updateAutoState({
        isRunning: true,
        isPausedCaptcha: false,
        hasStoppedWithQueue: false,
        listTabId,
        activeDetailTabId: null,
        currentUsername: null,
        scrapedCountSession: 0,
        skippedCountSession: 0,
        statusMessage: '▶️ Auto-Scrape berjalan... Memindai daftar kreator',
      });
      sendResponse({ success: true, state: newState });
      return;
    }

    if (action === 'STOP_AUTO_SCRAPE') {
      const storage = await getStorage([STORAGE_KEYS.QUEUE]);
      const queueLen = (storage[STORAGE_KEYS.QUEUE] || []).length;
      const newState = await updateAutoState({
        isRunning: false,
        isPausedCaptcha: false,
        hasStoppedWithQueue: queueLen > 0,
        activeDetailTabId: null,
        currentUsername: null,
        statusMessage:
          queueLen > 0
            ? `⏹️ Scraping dihentikan. ${queueLen} kreator siap ditambahkan ke Staging.`
            : '⏹️ Scraping dihentikan.',
      });
      sendResponse({ success: true, state: newState, queueCount: queueLen });
      return;
    }

    if (action === 'RECORD_SKIPPED_DUPLICATE') {
      const prev = await getAutoState();
      const nextCount = (prev.skippedCountSession || 0) + (Number(request.count) || 1);
      const nextState = await updateAutoState({
        skippedCountSession: nextCount,
        statusMessage: `⏭️ Skip @${request.username || 'kreator'} (sudah ada di Buku Catatan)`,
      });
      sendResponse({ success: true, state: nextState });
      return;
    }

    if (action === 'CARD_CLICKED_WAITING_DETAIL') {
      const username = request.username || '';
      const nextState = await updateAutoState({
        currentUsername: username,
        statusMessage: `⏳ Membuka tab detail @${username}...`,
      });
      sendResponse({ success: true, state: nextState });
      return;
    }

    if (action === 'DETAIL_TAB_CAPTCHA_DETECTED') {
      const detailTabId = sender?.tab?.id || null;
      if (detailTabId) {
        chrome.tabs.update(detailTabId, { active: true }).catch(() => {});
      }
      const nextState = await updateAutoState({
        isPausedCaptcha: true,
        activeDetailTabId: detailTabId,
        statusMessage: '⏸️ CAPTCHA TERDETEKSI! Selesaikan puzzle di tab detail untuk lanjut otomatis.',
      });
      sendResponse({ success: true, state: nextState });
      return;
    }

    if (action === 'DETAIL_TAB_CAPTCHA_RESOLVED') {
      const nextState = await updateAutoState({
        isPausedCaptcha: false,
        statusMessage: '✅ Captcha selesai! Melanjutkan ekstraksi profil kreator...',
      });
      sendResponse({ success: true, state: nextState });
      return;
    }

    if (action === 'DETAIL_TAB_OPENED_IM') {
      const detailTabId = sender?.tab?.id || null;
      await updateAutoState({
        activeDetailTabId: null,
        statusMessage: `💬 Membuka IM Chat room @${request.username}...`,
      });
      // Tutup tab detail sekarang karena IM tab baru sudah dibuka oleh TikTok!
      if (detailTabId) {
        chrome.tabs.remove(detailTabId).catch(() => {});
      }
      sendResponse({ success: true });
      return;
    }

    if (action === 'IM_TAB_ACTIVE') {
      const imTabId = sender?.tab?.id || null;
      await updateAutoState({
        activeImTabId: imTabId,
        statusMessage: `🔍 Membuka Contact Info @${request.username}...`,
      });
      sendResponse({ success: true });
      return;
    }

    if (action === 'SCRAPE_DETAIL_SUCCESS') {
      const creator = request.payload;
      const detailTabId = sender?.tab?.id || null;

      if (!creator || !creator.username) {
        sendResponse({ success: false, error: 'Username kreator kosong.' });
        return;
      }

      const cleanUser = String(creator.username).trim().toLowerCase().replace(/^@/, '');
      creator.username = cleanUser;

      const storage = await getStorage([
        STORAGE_KEYS.QUEUE,
        STORAGE_KEYS.KNOWN_USERNAMES,
        STORAGE_KEYS.AUTO_STATE,
      ]);

      const queue = storage[STORAGE_KEYS.QUEUE] || [];
      const filteredQueue = queue.filter(
        (item) => String(item?.username || '').toLowerCase() !== cleanUser
      );
      filteredQueue.push(creator);

      const known = storage[STORAGE_KEYS.KNOWN_USERNAMES] || [];
      if (!known.includes(cleanUser)) {
        known.push(cleanUser);
      }

      await setStorage({
        [STORAGE_KEYS.QUEUE]: filteredQueue,
        [STORAGE_KEYS.KNOWN_USERNAMES]: known,
      });

      const prevState = { ...DEFAULT_AUTO_STATE, ...(storage[STORAGE_KEYS.AUTO_STATE] || {}) };
      const newScrapedCount = (prevState.scrapedCountSession || 0) + 1;

      const nextState = await updateAutoState({
        isPausedCaptcha: false,
        activeDetailTabId: null,
        activeImTabId: null,
        currentUsername: null,
        scrapedCountSession: newScrapedCount,
        statusMessage: `✅ Berhasil scrape @${cleanUser} (Total antrean: ${filteredQueue.length})`,
      });

      // Jika sedang dalam mode Auto-Scrape (atau diminta tutup tab), langsung tutup tab detail & lanjutkan tab Find Creators!
      if ((prevState.isRunning || request.closeTab) && detailTabId) {
        chrome.tabs.remove(detailTabId).catch(() => {});
      }

      if (prevState.isRunning && prevState.listTabId) {
        chrome.tabs.update(prevState.listTabId, { active: true }).catch(() => {});
        chrome.tabs
          .sendMessage(prevState.listTabId, {
            action: 'CONTINUE_NEXT_CARD',
            lastScrapedUsername: cleanUser,
            queueCount: filteredQueue.length,
          })
          .catch(() => {});
      }

      sendResponse({
        success: true,
        queueCount: filteredQueue.length,
        knownCount: known.length,
        state: nextState,
      });
      return;
    }

    if (action === 'PUSH_TO_STAGING' || action === 'IMPORT_ALL') {
      const res = await pushQueueToStaging(request.payload);
      sendResponse(res);
      return;
    }

    sendResponse({ success: false, error: 'Action tidak dikenali.' });
  })();

  return true;
});

// Jika tab IM ditutup, atau jika tab detail ditutup tanpa membuka IM, langsung bebaskan Find Creators!
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getAutoState();
  if (state.isRunning) {
    const isImTabClosed = Boolean(state.activeImTabId && state.activeImTabId === tabId);
    const isDetailTabClosedWithoutIm = Boolean(!state.activeImTabId && state.activeDetailTabId === tabId);

    if (isImTabClosed || isDetailTabClosedWithoutIm) {
      await updateAutoState({
        activeDetailTabId: null,
        activeImTabId: null,
        currentUsername: null,
        isPausedCaptcha: false,
        statusMessage: 'Melanjutkan antrean kreator berikutnya...',
      });
      if (state.listTabId) {
        chrome.tabs.sendMessage(state.listTabId, { action: 'CONTINUE_NEXT_CARD' }).catch(() => {});
      }
    }
  }
});

// Deteksi saat tab baru terbuka dari klik kartu Find Creators
chrome.tabs.onCreated.addListener(async (tab) => {
  const state = await getAutoState();
  if (state.isRunning && !state.activeDetailTabId && tab.id !== state.listTabId) {
    await updateAutoState({ activeDetailTabId: tab.id });
  }
});

// Saat ekstensi di-install / di-reload di chrome://extensions, otomatis re-inject content.js
// ke semua tab TikTok Partner Center yang sedang terbuka agar tidak terjadi "Extension context invalidated"
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ['*://partner.tiktokshop.com/*'] }, (tabs) => {
    for (const tab of tabs || []) {
      if (tab.id) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
          })
          .catch(() => {});
      }
    }
  });
});
