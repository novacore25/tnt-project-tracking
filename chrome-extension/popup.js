const STORAGE_KEY = 'tnt_scraper_queue';
const KNOWN_KEY = 'tnt_known_usernames';

document.addEventListener('DOMContentLoaded', () => {
  const queueList = document.getElementById('queue-list');
  const queueCount = document.getElementById('queue-count');
  const knownCount = document.getElementById('known-count');
  const syncBtn = document.getElementById('sync-book-btn');
  const clearBookBtn = document.getElementById('clear-book-btn');
  const syncMsg = document.getElementById('sync-msg');
  const clearBtn = document.getElementById('clear-all-btn');
  const sendBtn = document.getElementById('send-all-btn');

  function formatIdr(val) {
    const num = Math.round(Number(val) || 0);
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  function showMessage(text) {
    if (!syncMsg) return;
    syncMsg.style.display = 'block';
    syncMsg.textContent = text;
  }

  function renderQueue(queue, knownArr) {
    queueCount.innerText = queue.length;
    if (knownCount && Array.isArray(knownArr)) {
      knownCount.innerText = knownArr.length.toLocaleString('id-ID');
    }
    queueList.innerHTML = '';

    if (queue.length === 0) {
      queueList.innerHTML =
        '<div style="text-align: center; color: #888; padding: 20px; font-size: 12px;">Antrean lokal kosong.<br/>Jalankan Auto-Scrape di halaman Find Creators TikTok Partner Center.</div>';
      sendBtn.disabled = true;
      sendBtn.innerText = '🚀 Tambahkan ke Staging';
      return;
    }

    sendBtn.disabled = false;
    sendBtn.innerText = `🚀 Tambahkan ke Staging (${queue.length} Kreator)`;

    queue.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'queue-item';
      const statusBadge = item.gmv_status === 'ESTIMASI' ? 'ESTIMASI' : 'RIIL';

      div.innerHTML = `
        <div class="item-info" style="min-width:0;">
          <span class="item-name" style="font-weight:700;">@${item.username} ${item.display_name ? `(${item.display_name})` : ''}</span>
          <span class="item-username" style="font-size:11px;color:#475569;">
            ${formatIdr(item.gmv_30d)} [${statusBadge}] ${item.primary_niche ? `• ${item.primary_niche}` : ''}
          </span>
        </div>
        <button class="item-delete" data-username="${item.username}" title="Hapus dari antrean">❌</button>
      `;
      queueList.appendChild(div);
    });

    document.querySelectorAll('.item-delete').forEach((btn) => {
      btn.onclick = (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        chrome.storage.local.get([STORAGE_KEY, KNOWN_KEY], (res) => {
          let q = res[STORAGE_KEY] || [];
          q = q.filter((c) => c.username !== username);
          chrome.storage.local.set({ [STORAGE_KEY]: q }, () => {
            renderQueue(q, res[KNOWN_KEY] || []);
          });
        });
      };
    });
  }

  function reloadFromStorage() {
    chrome.storage.local.get([STORAGE_KEY, KNOWN_KEY], (res) => {
      renderQueue(res[STORAGE_KEY] || [], res[KNOWN_KEY] || []);
    });
  }

  reloadFromStorage();

  if (syncBtn) {
    syncBtn.onclick = () => {
      syncBtn.disabled = true;
      showMessage('🔄 Mengambil Buku Catatan dari Staging Creator...');
      chrome.runtime.sendMessage({ action: 'SYNC_KNOWN_USERNAMES' }, (res) => {
        syncBtn.disabled = false;
        if (res && res.success) {
          showMessage(`✅ Buku Catatan diperbarui: ${res.count} username.`);
          reloadFromStorage();
        } else {
          showMessage(`⚠️ ${res?.error || 'Gagal sinkronisasi Buku Catatan.'}`);
        }
      });
    };
  }

  if (clearBookBtn) {
    clearBookBtn.onclick = () => {
      if (confirm('Yakin ingin menghapus seluruh Buku Catatan di ekstensi?')) {
        chrome.runtime.sendMessage({ action: 'CLEAR_KNOWN_USERNAMES' }, () => {
          showMessage('🗑️ Buku Catatan dikosongkan (0 username).');
          reloadFromStorage();
        });
      }
    };
  }

  clearBtn.onclick = () => {
    if (confirm('Yakin ingin mengosongkan antrean lokal?')) {
      chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
        reloadFromStorage();
      });
    }
  };

  sendBtn.onclick = () => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const queue = res[STORAGE_KEY] || [];
      if (queue.length > 0) {
        sendBtn.innerText = '⏳ Mengirim ke Staging...';
        sendBtn.disabled = true;

        chrome.runtime.sendMessage({ action: 'PUSH_TO_STAGING', payload: queue }, (response) => {
          if (response && response.success) {
            window.close();
          } else {
            showMessage(`⚠️ ${response?.error || 'Gagal mengirim ke Staging.'}`);
            reloadFromStorage();
          }
        });
      }
    });
  };
});
