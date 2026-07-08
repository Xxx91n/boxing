// Boxing — MV3 Service Worker
// Cross-browser guard for chrome.* / browser.*
(() => {
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null) || null;
  if (!api) return;
  const root = (typeof self !== "undefined" ? self :
    typeof globalThis !== "undefined" ? globalThis : null);
  if (!root) return;

  api.runtime?.onInstalled?.addListener(async (details) => {
    try {
      root.__qlearly_last_install__ = { reason: details?.reason || "unknown", at: Date.now() };
    } catch (_) {}
  });

  api.action?.onClicked?.addListener(async (tab) => {
    if (api.action && typeof api.action.openPopup === "function") {
      try { await api.action.openPopup(); return; } catch (_) {}
    }
    if (api.tabs && typeof api.tabs.create === "function") {
      try { await api.tabs.create({ url: api.runtime.getURL("popup/popup.html") }); } catch (_) {}
    }
  });
})();
