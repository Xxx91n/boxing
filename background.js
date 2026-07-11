// Boxing — MV3 Service Worker
// Cross-browser guard for chrome.* / browser.*
// Debug: open chrome://extensions → Inspect views: service worker → console
const BG_LOG_PREFIX = '[Boxing:BG]';
function bgLog(...a) { console.log(BG_LOG_PREFIX, ...a); }
function bgErr(...a) { console.error(BG_LOG_PREFIX, ...a); }
(() => {
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null) || null;
  if (!api) return;
  const root = (typeof self !== "undefined" ? self :
    typeof globalThis !== "undefined" ? globalThis : null);
  if (!root) return;

  api.runtime?.onInstalled?.addListener(async (details) => {
    try {
      root.__boxing_last_install__ = { reason: details?.reason || "unknown", at: Date.now() };
    } catch (e) { bgErr('onInstalled:', e); }
  });

  api.action?.onClicked?.addListener(async (tab) => {
    if (api.action && typeof api.action.openPopup === "function") {
      try { await api.action.openPopup(); return; } catch (e) { bgErr('openPopup:', e); }
    }
    if (api.tabs && typeof api.tabs.create === "function") {
      try { await api.tabs.create({ url: api.runtime.getURL("popup/popup.html") }); } catch (e) { bgErr('tabs.create:', e); }
    }
  });

  // BX-DEV-081: Redirect navigation away from NTP to new tab
  // When user clicks browser bookmark / types URL in address bar while on NTP page,
  // the NTP gets replaced. This listener catches that and opens the destination in a new tab.
  const NTP_PATH = 'ntp/index.html';
  api.tabs?.onUpdated?.addListener(async (tabId, changeInfo, tab) => {
    // Only react to URL changes on tabs that were showing NTP
    if (!changeInfo.url) return;
    const wasNtp = tab.url && tab.url.includes(NTP_PATH);
    const isNowNtp = changeInfo.url.includes(NTP_PATH);
    // Tab navigated FROM NTP to something else
    if (wasNtp && !isNowNtp) {
      bgLog('NTP tab navigated away to:', changeInfo.url);
      try {
        // Check user preference from storage
        const stored = await api.storage.sync.get('boxingLayout');
        const layout = stored.boxingLayout || {};
        const ntpNavMode = (layout.settings && layout.settings.ntpNavMode) || 'newTab';
        if (ntpNavMode === 'newTab') {
          // Open destination in new tab, restore NTP in this tab
          await api.tabs.create({ url: changeInfo.url, active: true });
          await api.tabs.update(tabId, { url: api.runtime.getURL(NTP_PATH) });
        }
        // If 'currentTab', let navigation proceed naturally (do nothing)
      } catch (e) { bgErr('NTP redirect:', e); }
    }
  });
})();
