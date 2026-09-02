/** Boxing — popup + bookmark-row DOM module (ticket 13, architecture-recovery).
 * Extracted verbatim from render.js (ticket 08): bookmark rows (renderBookmarks),
 * inline bookmark edit/add popups (showBookmarkEditPopup/showAddBookmarkPopup) and the
 * bookmark-row drag-to-reorder handler (onBmRowDragStart).
 * Popup tracker trio (addPopupTracker/removePopupTracker/repositionAllPopups) STAYS in
 * render.js — repositionAllPopups runs on box-drag/pan/zoom hot paths (canvas transform).
 * Cross-scope deps (render.js getLargeBox/renderInnerSurface/showBoxDeletedWarning +
 * addPopupTracker/removePopupTracker, ntp.js makeId/api/debug/debugWarn) injected once via
 * initPopupsFacade() before any runtime call. */
import { layout, MAX_BOOKMARKS } from './state.js';
import { i18n } from './i18n.js';
import { normalizeBookmarkUrl } from './utils.js';
import { saveLayout } from './storage.js';
import { loadFavicon } from './favicon.js';

// Injected render.js/ntp.js-scope deps (set once at boot, before any runtime call).
let getLargeBox, renderInnerSurface, showBoxDeletedWarning, addPopupTracker, removePopupTracker,
    makeId, api, debug, debugWarn;
export function initPopupsFacade(deps) {
  getLargeBox = deps.getLargeBox; renderInnerSurface = deps.renderInnerSurface;
  showBoxDeletedWarning = deps.showBoxDeletedWarning; addPopupTracker = deps.addPopupTracker;
  removePopupTracker = deps.removePopupTracker;
  makeId = deps.makeId; api = deps.api; debug = deps.debug; debugWarn = deps.debugWarn;
}
  export function renderBookmarks(body, largeId, sb) {
    body.innerHTML = '';
    const bms = sb.bookmarks || [];

    for (let i = 0; i < bms.length; i++) {
      const bm = bms[i];

      const row = document.createElement('div');
      row.className = 'bm-row';
      // click bookmark → open tab
      row.style.cursor = 'pointer';
      row.addEventListener('click', e => {
        if (e.target.closest('.bm-row__edit-btn') || e.target.closest('.bm-row__grip')) return;
        const safeUrl = normalizeBookmarkUrl(bm.url);
        if (!safeUrl) { debugWarn('blocked invalid bookmark URL', bm.url); return; }
        (async function (url) {
          // BX-DEV-120: respect explicit settings.urlOpenMode first (default 'newTab').
          // Fall back to legacy per-browser default only when the setting is unset AND
          // Firefox exposes browserSettings.openBookmarksInNewTabs (Chrome has no equivalent).
          const mode = layout.settings && layout.settings.urlOpenMode;
          if (mode === 'sameTab') {
            if (api.tabs?.update) { api.tabs.update({ url }); }
            else { window.location.href = url; }
            return;
          }
          if (mode === 'newTab') {
            try {
              if (api.tabs?.create) { api.tabs.create({ url, active: true }); return; }
            } catch (e) { debug('tabs.create failed, fallback to window.open', e?.message); }
            window.open(url, '_blank', 'noopener');
            return;
          }
          // Unset — legacy browser default. Firefox respects openBookmarksInNewTabs; Chrome opens current tab.
          let openInNewTab = false;
          try {
            if (typeof browser !== 'undefined' && browser.browserSettings?.openBookmarksInNewTabs) {
              const s = await browser.browserSettings.openBookmarksInNewTabs.get({});
              openInNewTab = s.value;
            }
          } catch (e) { /* silent: inner render variant, non-critical */ }
          if (openInNewTab) {
            api.tabs?.create ? api.tabs.create({ url, active: true }) : window.open(url, '_blank');
          } else {
            if (api.tabs?.update) { api.tabs.update({ url }); }
            else { window.location.href = url; }
          }
        })(safeUrl);
      });

      const dot = document.createElement('span');

      // Drag grip (⊛⋮) — leftmost handle for reordering bookmarks (BX-DEV-056)
      const grip = document.createElement('span');
      grip.className = 'bm-row__grip';
      grip.textContent = '⋮⋮';
      grip.title = i18n('dragToReorder');
      grip.style.cssText = 'cursor:grab;color:var(--color-muted);font-size:10px;padding:0 3px;flex-shrink:0;line-height:1;user-select:none;opacity:0.5;';
      grip.addEventListener('mouseenter', () => { grip.style.opacity = '1'; });
      grip.addEventListener('mouseleave', () => { grip.style.opacity = '0.5'; });
      grip.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        onBmRowDragStart(e, row, sb, largeId);
      });

      dot.className = 'bm-row__dot';
      dot.setAttribute('aria-hidden', 'true');

      const fav = document.createElement('img');
      fav.className = 'bm-row__favicon';
      // BX-DEV-107: multi-source async favicon with session cache
      fav.src = '';  // placeholder, loaded async below
      fav.width = 16; fav.height = 16;
      fav.style.flexShrink = '0';
      fav.style.display = 'none';  // hidden until loaded
      fav.onload = () => { fav.style.display = ''; };
      fav.onerror = () => { fav.style.display = 'none'; };
      // async load, non-blocking
      loadFavicon(fav, bm.url);

      const tEl = document.createElement('span');
      tEl.className = 'bm-row__title';
      tEl.textContent = bm.title || bm.url;

      // edit button (three dots)
      const editBtn = document.createElement('button');
      editBtn.className = 'bm-row__edit-btn';
      editBtn.title = i18n('editBookmarkLabel');
      editBtn.textContent = '⋯';
      editBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:14px;color:var(--color-muted);padding:0 4px;flex-shrink:0;';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        showBookmarkEditPopup(bm, i, sb, largeId);
      });

      row.append(grip, dot, fav, tEl, editBtn);
      body.appendChild(row);
    }

    // add bookmark button — opens popup for title+URL
    const addRow = document.createElement('div');
    addRow.className = 'bm-add-row';
    addRow.addEventListener('mousedown', e => e.stopPropagation());

    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.title = i18n('addBookmarkBtn');
    addBtn.className = 'bm-add-btn';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      showAddBookmarkPopup(sb, largeId);
    });

    addRow.appendChild(addBtn);
    body.appendChild(addRow);
  }

  // Inline bookmark edit popup
  export function showBookmarkEditPopup(bm, index, sb, largeId) {
    // Remove any existing popup
    document.querySelectorAll('.bm-edit-popup').forEach(p => p.remove());

    // BX-DEV-111j: find small-box DOM for smart popup positioning
    const smallBoxEl = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
    const boxRect = smallBoxEl ? smallBoxEl.getBoundingClientRect() : null;

    const popup = document.createElement('div');
    popup.className = 'bm-edit-popup';
    popup.style.cssText = 'position:fixed;z-index:200;background:var(--color-elevated);border:1px solid var(--color-hairline);border-radius:var(--radius-tile);box-shadow:var(--shadow-pop);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);min-width:260px;';
    popup.dataset.attachedSbId = sb.id;

    // Title input
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = bm.title || '';
    titleInput.placeholder = i18n('bookmarkTitlePlaceholder');
    titleInput.style.cssText = 'padding:4px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;';
    titleInput.addEventListener('mousedown', e => e.stopPropagation());

    // URL input
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = bm.url || '';
    urlInput.placeholder = i18n('bookmarkUrlPlaceholder');
    urlInput.style.cssText = 'padding:4px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;';
    urlInput.addEventListener('mousedown', e => e.stopPropagation());

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:4px;justify-content:flex-end;';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = i18n('bookmarkSave');
    saveBtn.style.cssText = 'padding:4px 12px;background:var(--color-accent);color:#F7F3ED;border:0;border-radius:4px;font-size:12px;cursor:pointer;';
    saveBtn.addEventListener('click', e => {
      e.stopPropagation();
      const normalizedUrl = normalizeBookmarkUrl(urlInput.value);
      if (!normalizedUrl) { urlInput.style.borderColor = 'red'; return; }
      // BX-DEV-111k: validate box still exists before saving edited bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      bm.title = titleInput.value.trim() || normalizedUrl;
      bm.url = normalizedUrl;
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    });
    // Enter key to save (BX-DEV-057)
    // Feat-4: Enter on title field advances focus to URL field (not save). Enter on URL saves.
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); urlInput.focus(); urlInput.select(); } });
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = i18n('bookmarkDelete');
    deleteBtn.style.cssText = 'padding:4px 12px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      // BX-DEV-111k: validate box still exists before deleting bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      sb.bookmarks.splice(index, 1);
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n('confirmCancel');
    cancelBtn.style.cssText = 'padding:4px 12px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    cancelBtn.addEventListener('click', e => { e.stopPropagation(); popup.remove(); removePopupTracker(popup); });

    btnRow.append(saveBtn, deleteBtn, cancelBtn);
    popup.append(titleInput, urlInput, btnRow);

    // BX-DEV-111j: position popup beside small box — right side if fits, else left
    const PW = 280, PH = 200, MARGIN = 12;
    function positionEditPopup() {
      const el = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
      const br = el ? el.getBoundingClientRect() : boxRect;
      if (br) {
        const rightSpace = window.innerWidth - br.right - MARGIN;
        if (rightSpace >= PW + MARGIN) {
          popup.style.left = (br.right + MARGIN) + 'px';
        } else {
          popup.style.left = Math.max(MARGIN, br.left - PW - MARGIN) + 'px';
        }
        popup.style.top = Math.max(MARGIN, Math.min(window.innerHeight - PH - MARGIN, br.top)) + 'px';
      } else {
        popup.style.left = Math.min(window.innerWidth - PW, 200) + 'px';
        popup.style.top = Math.min(window.innerHeight - PH, 300) + 'px';
      }
    }
    positionEditPopup();

    document.body.appendChild(popup);
    addPopupTracker(popup, positionEditPopup);

    // BX-DEV-127 (B7): close on outside MOUSEDOWN only — using 'click' closed the popup
    // when the user dragged-selected text starting inside an input and ending outside, because
    // the click target is the mouseup location (outside the popup). mousedown fires at the
    // press origin (inside the input, which popup.contains()), so drag-select no longer dismisses.
    const closeHandler = (ev) => {
      if (popup.contains(ev.target)) return; // press began inside popup → keep open
      popup.remove();
      removePopupTracker(popup);
      document.removeEventListener('mousedown', closeHandler, true);
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler, true), 50);
    titleInput.focus();
  }

  // Add bookmark popup (title + URL)
  export function showAddBookmarkPopup(sb, largeId) {
    document.querySelectorAll('.bm-edit-popup').forEach(p => p.remove());

    // BX-DEV-111j: find small-box DOM for smart popup positioning
    const smallBoxEl = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
    const boxRect = smallBoxEl ? smallBoxEl.getBoundingClientRect() : null;

    const popup = document.createElement('div');
    popup.className = 'bm-edit-popup';
    popup.style.cssText = 'position:fixed;z-index:200;background:var(--color-elevated);border:1px solid var(--color-hairline);border-radius:var(--radius-tile);box-shadow:var(--shadow-pop);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);min-width:300px;';
    popup.dataset.attachedSbId = sb.id;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = i18n('bookmarkTitlePlaceholder');
    titleInput.style.cssText = 'padding:6px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:13px;background:var(--color-surface);color:var(--color-ink);outline:none;';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = i18n('bookmarkUrlPlaceholder');
    urlInput.style.cssText = 'padding:6px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:13px;background:var(--color-surface);color:var(--color-ink);outline:none;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:4px;justify-content:flex-end;';

    const addBtn = document.createElement('button');
    addBtn.textContent = i18n('addBookmarkBtn');
    addBtn.style.cssText = 'padding:5px 14px;background:var(--color-accent);color:#F7F3ED;border:0;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      if (!url) return;
      const normalizedUrl = normalizeBookmarkUrl(url);
      if (!normalizedUrl) { urlInput.style.borderColor = 'red'; return; }
      // BX-DEV-111j: validate large box still exists before saving bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) { debug('max bookmarks'); return; }
      sb.bookmarks.push({ id: makeId('bm'), title: title || new URL(normalizedUrl).hostname, url: normalizedUrl });
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    });

    // Enter key in either input = add bookmark (BX-DEV-057)
    const addBmAction = () => {
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      if (!url) return;
      const normalizedUrl = normalizeBookmarkUrl(url);
      if (!normalizedUrl) { urlInput.style.borderColor = 'red'; return; }
      // BX-DEV-111j: validate large box still exists before saving bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) { debug('max bookmarks'); return; }
      sb.bookmarks.push({ id: makeId('bm'), title: title || new URL(normalizedUrl).hostname, url: normalizedUrl });
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    };
    // Update addBtn click to delegate:
    // Feat-4: Enter on title advances to URL field; Enter on URL adds the bookmark.
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); urlInput.focus(); urlInput.select(); } });
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBmAction(); } });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n('confirmCancel');
    cancelBtn.style.cssText = 'padding:5px 14px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    cancelBtn.addEventListener('click', e => { e.stopPropagation(); popup.remove(); removePopupTracker(popup); });

    btnRow.append(addBtn, cancelBtn);
    popup.append(titleInput, urlInput, btnRow);

    // BX-DEV-111j: position popup beside small box — right side if fits, else left
    const PW2 = 320, PH2 = 200, MG2 = 12;
    function positionAddPopup() {
      const el = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
      const br = el ? el.getBoundingClientRect() : boxRect;
      if (br) {
        const rightSpace = window.innerWidth - br.right - MG2;
        if (rightSpace >= PW2 + MG2) {
          popup.style.left = (br.right + MG2) + 'px';
        } else {
          popup.style.left = Math.max(MG2, br.left - PW2 - MG2) + 'px';
        }
        popup.style.top = Math.max(MG2, Math.min(window.innerHeight - PH2 - MG2, br.top)) + 'px';
      } else {
        popup.style.left = Math.max(MG2, (window.innerWidth - PW2) / 2) + 'px';
        popup.style.top = Math.max(MG2, (window.innerHeight - PH2) / 2) + 'px';
      }
    }
    positionAddPopup();

    document.body.appendChild(popup);
    addPopupTracker(popup, positionAddPopup);

    // BX-DEV-127 (B7): mousedown-only close — drag-select inside inputs no longer dismisses popup.
    const closeHandler2 = (ev) => {
      if (!popup.contains(ev.target)) {
        popup.remove();
        removePopupTracker(popup);
        document.removeEventListener('mousedown', closeHandler2, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler2, true), 50);
    titleInput.focus();
  }

  // Bookmark row drag-to-reorder (BX-DEV-056)
  // Drag grip on left of each bm-row; drag swaps positions in array
  export function onBmRowDragStart(e, row, sb, largeId) {
    // BX-DEV-111k: validate large box still exists before allowing bookmark reorder
    if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
    const body = row.parentElement;
    const rows = [...body.querySelectorAll('.bm-row')];
    const dragIdx = rows.indexOf(row);
    if (dragIdx < 0) return;
    const startY = e.clientY;
    const origOpacity = row.style.opacity;
    row.style.opacity = '0.5';
    row.style.zIndex = '10';
    document.body.style.cursor = 'grabbing';
    const onMove = (ev) => {
      row.style.transform = `translateY(${ev.clientY - startY}px)`;
      const rects = rows.map(r => r.getBoundingClientRect());
      rows.forEach(r => r.style.outline = 'none');
      for (let i = 0; i < rects.length; i++) {
        if (i !== dragIdx && ev.clientY < rects[i].bottom && ev.clientY > rects[i].top) {
          rows[i].style.outline = '2px dashed var(--color-accent)';
          rows[i].style.outlineOffset = '-2px';
          break;
        }
      }
    };
    const onUp = (ev) => {
      // Prevent click-from-drag on bookmark row (BX-DEV-065)
      const moved = Math.abs(ev.clientY - startY) > 4;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      row.style.transform = '';
      row.style.opacity = origOpacity;
      row.style.zIndex = '';
      rows.forEach(r => r.style.outline = 'none');
      if (moved) {
        // Block the subsequent click event that would open the bookmark
        ev.preventDefault(); ev.stopPropagation();
        setTimeout(() => {
          const blocker = (ce) => { ce.stopPropagation(); row.removeEventListener('click', blocker, true); };
          row.addEventListener('click', blocker, { once: true, capture: true });
        }, 0);
      }
      let targetIdx = dragIdx;
      const rects = rows.map(r => r.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        if (i !== dragIdx && ev.clientY < rects[i].bottom && ev.clientY > rects[i].top) { targetIdx = i; break; }
      }
      if (targetIdx !== dragIdx) {
        const bms = sb.bookmarks, item = bms[dragIdx];
        bms.splice(dragIdx, 1); bms.splice(targetIdx, 0, item);
        saveLayout();
        // BX-DEV-111k: only re-render bookmarks for this small box — don't rebuild entire surface
        const smallBoxEl = row.closest('.small-box');
        const bodyEl = smallBoxEl?.querySelector('.small-box__body');
        if (bodyEl) { renderBookmarks(bodyEl, largeId, sb); } else { const lb = getLargeBox(largeId); if (lb) renderInnerSurface(lb); }
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
