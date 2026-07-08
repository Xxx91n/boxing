/** Boxing Popup — Quick access to recent bookmarks */
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
        li.innerHTML = `
          <a class="popup__item" href="${bookmark.url}" target="_blank" rel="noopener">
            <span class="popup__icon" aria-hidden="true">🔖</span>
            <span class="popup__label">${bookmark.title || 'Untitled'}</span>
          </a>
        `;
        li.querySelector('a').addEventListener('click', (e) => {
          e.preventDefault();
          api.tabs?.create?.({ url: bookmark.url, active: true });
          window.close();
        });
        recentListEl.appendChild(li);
      });
    } catch (err) {
      console.error('Error loading recent bookmarks:', err);
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
