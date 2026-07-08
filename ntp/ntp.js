/** Qlearly Bookmark — Vanilla JS NTP (MV3 cross-browser) */
(async () => {
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null) || null;
  if (!api) return;

  // DOM references
  const appEl = document.getElementById('app');
  const gridEl = document.getElementById('grid');
  const pinBarEl = document.getElementById('pin-bar');
  const searchInput = document.getElementById('q');
  const crumbEl = document.getElementById('crumb');
  const captionEl = document.getElementById('caption');
  const emptyEl = document.getElementById('empty');

  // State
  let allBookmarks = [];
  let currentPath = []; // folder breadcrumb
  let searchQuery = '';
  let selectedIndex = -1;

  // Fetch bookmarks from API
  async function loadBookmarks() {
    try {
      allBookmarks = await api.bookmarks.getTree();
      renderBookmarks();
    } catch (err) {
      console.error('Bookmarks API error:', err);
      gridEl.innerHTML = '<div class="empty-msg">Unable to load bookmarks</div>';
    }
  }

  // Recursively flatten bookmark tree (for search)
  function flattenBookmarks(nodes, result = []) {
    for (const node of nodes || []) {
      result.push({ ...node, path: node.url ? 'leaf' : 'folder' });
      if (node.children) flattenBookmarks(node.children, result);
    }
    return result;
  }

  // Render current folder view
  function renderBookmarks(folder = null) {
    const items = folder?.children || allBookmarks[0]?.children || [];
    selectedIndex = -1;

    if (searchQuery) {
      const flat = flattenBookmarks(allBookmarks);
      const filtered = flat.filter(b =>
        (b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         b.url?.toLowerCase().includes(searchQuery.toLowerCase())) &&
        b.url // only show leaves in search
      );
      renderGrid(filtered.map(b => ({ ...b, isSearchResult: true })));
      crumbEl.textContent = `Search: "${searchQuery}"`;
      captionEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
    } else {
      const displayItems = items.filter(b => b.children || b.url); // folders + bookmarks
      renderGrid(displayItems);
      crumbEl.textContent = folder?.title || 'All Bookmarks';
      captionEl.textContent = `${displayItems.length} item${displayItems.length !== 1 ? 's' : ''}`;
    }
  }

  function renderGrid(items) {
    gridEl.innerHTML = '';
    items.forEach((item, idx) => {
      const isFolder = item.children && !item.url;
      const card = document.createElement('div');
      card.className = `grid-card ${isFolder ? 'grid-card--folder' : 'grid-card--bookmark'}`;
      card.setAttribute('data-index', idx);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', idx === 0 ? 0 : -1);

      const icon = document.createElement('span');
      icon.className = 'grid-card__icon';
      icon.textContent = isFolder ? '📁' : '🔗';
      icon.setAttribute('aria-hidden', 'true');

      const title = document.createElement('span');
      title.className = 'grid-card__title';
      title.textContent = item.title || '(untitled)';

      card.appendChild(icon);
      card.appendChild(title);

      if (item.url) {
        card.addEventListener('click', () => {
          api.tabs?.create?.({ url: item.url, active: true });
        });
      } else if (item.children) {
        card.addEventListener('click', () => {
          currentPath.push(item);
          renderBookmarks(item);
        });
      }

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          card.click();
        }
      });

      gridEl.appendChild(card);
    });

    updateEmptyState(items.length === 0);
  }

  function updateEmptyState(isEmpty) {
    if (isEmpty) {
      emptyEl.textContent = searchQuery ? 'No bookmarks match your search.' : 'No bookmarks in this folder.';
      emptyEl.classList.remove('sr-only');
    } else {
      emptyEl.classList.add('sr-only');
    }
  }

  // Search handler
  function handleSearch(query) {
    searchQuery = query;
    currentPath = [];
    renderBookmarks();
    focusFirstCard();
  }

  // Keyboard navigation
  function focusCard(idx) {
    const cards = Array.from(gridEl.querySelectorAll('[data-index]'));
    selectedIndex = Math.max(-1, Math.min(idx, cards.length - 1));
    cards.forEach((c, i) => {
      c.setAttribute('tabindex', i === selectedIndex ? 0 : -1);
      if (i === selectedIndex) c.focus();
    });
  }

  function focusFirstCard() {
    focusCard(0);
  }

  // Event listeners
  searchInput?.addEventListener('input', (e) => {
    handleSearch(e.target.value);
  });

  searchInput?.addEventListener('keydown', (e) => {
    const cards = Array.from(gridEl.querySelectorAll('[data-index]'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCard(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCard(selectedIndex - 1);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      cards[selectedIndex]?.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      searchInput.value = '';
      handleSearch('');
    }
  });

  // Global "/" to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && e.target === document.body) {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  // Breadcrumb back button (if clicked)
  crumbEl?.addEventListener('click', () => {
    if (currentPath.length > 0) {
      currentPath.pop();
      const parent = currentPath[currentPath.length - 1] || null;
      renderBookmarks(parent);
    }
  });

  // Initialize
  await loadBookmarks();
})();
