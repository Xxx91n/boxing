/** Boxing Popup — Quick access to recent bookmarks */
const POPUP_LOG_PREFIX = '[Boxing:Popup]';
let POPUP_DEBUG_ENABLED = false;
function popupLog(...a) { if (POPUP_DEBUG_ENABLED) console.log(POPUP_LOG_PREFIX, ...a); }
function popupErr(...a) { console.error(POPUP_LOG_PREFIX, ...a); }
try {
  chrome.storage?.sync?.get?.('boxing_debug_mode', r => {
    POPUP_DEBUG_ENABLED = !!(r && r.boxing_debug_mode);
    popupLog('popup debug:', POPUP_DEBUG_ENABLED ? 'enabled' : 'disabled');
  });
} catch(_) {}
(async () => {
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null) || null;
  if (!api) return;

  const recentListEl = document.getElementById('recent-list');
  const openNtpBtn = document.getElementById('open-ntp');

  // Fetch bookmarks and display recent 8
  async function loadRecent() {
    try {
      const tree = await api.bookmarks.getTree();
      const flat = flattenBookmarks(tree);
      
      // Get only bookmarks (not folders), limit to 8
      const recent = flat
        .filter(b => b.url)
        .slice(0, 8);

      if (recent.length === 0) {
        recentListEl.innerHTML = '<div class="empty-msg">No bookmarks yet</div>';
        return;
      }

      recentListEl.innerHTML = '';
      recent.forEach(bookmark => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'popup__item';
        a.href = bookmark.url;
        a.target = '_blank';
        a.rel = 'noopener';
        const icon = document.createElement('span');
        icon.className = 'popup__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🔖';
        const label = document.createElement('span');
        label.className = 'popup__label';
        label.textContent = bookmark.title || 'Untitled';
        a.append(icon, label);
        li.appendChild(a);
        li.querySelector('a').addEventListener('click', (e) => {
          e.preventDefault();
          api.tabs?.create?.({ url: bookmark.url, active: true });
          window.close();
        });
        recentListEl.appendChild(li);
      });
    } catch (err) {
      popupErr('Error loading recent bookmarks:', err);
      recentListEl.innerHTML = '<div class="empty-msg">Error loading bookmarks</div>';
    }
  }

  function flattenBookmarks(nodes, result = []) {
    for (const node of nodes || []) {
      if (node.url) result.push(node);
      if (node.children) flattenBookmarks(node.children, result);
    }
    return result;
  }

  // Open full dashboard
  openNtpBtn?.addEventListener('click', () => {
    api.tabs?.create?.({ url: api.runtime.getURL('ntp/index.html'), active: true });
    window.close();
  });

  // Load on init
  await loadRecent();
})();
