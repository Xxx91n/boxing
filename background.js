// Boxing — MV3 Service Worker
// Cross-browser guard for chrome.* / browser.*
// Debug: open chrome://extensions → Inspect views: service worker → console
const BG_LOG_PREFIX = '[Boxing:BG]';
// Debug mode toggle — set boxing_debug_mode in storage.sync to enable
let BG_DEBUG_ENABLED = false;
function bgLog(...a) { if (BG_DEBUG_ENABLED) console.log(BG_LOG_PREFIX, ...a); }
function bgErr(...a) { console.error(BG_LOG_PREFIX, ...a); } // errors always log
try {
  chrome.storage?.sync?.get?.('boxing_debug_mode', r => {
    BG_DEBUG_ENABLED = !!(r && r.boxing_debug_mode);
    bgLog('background debug:', BG_DEBUG_ENABLED ? 'enabled' : 'disabled');
  });
} catch(_) {}
(() => {
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null) || null;
  if (!api) return;
  const root = (typeof self !== "undefined" ? self :
    typeof globalThis !== "undefined" ? globalThis : null);
  if (!root) return;

  // ── ADR-0009: chrome.alarms for auto-backup (survives NTP page close) ──
  // The NTP page creates the alarm; the background SW listens and sends a message
  // back to any open NTP tab to trigger performBackup. If no NTP tab is open, the
  // backup is deferred until the next NTP open.
  if (typeof chrome !== 'undefined' && chrome.alarms && chrome.alarms.onAlarm) {
    chrome.alarms.onAlarm.addListener(function(alarm) {
      if (alarm.name !== 'boxing-auto-backup') return;
      bgLog('Auto-backup alarm fired');
      // Try to send message to any open NTP tab to trigger backup
      try {
        chrome.tabs.query({}, function(tabs) {
          if (!tabs) return;
          for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            if (tab.url && (tab.url.indexOf('chrome://newtab') === 0 || tab.url.indexOf('moz-extension://') === 0 || tab.url.indexOf('chrome-extension://') === 0)) {
              chrome.tabs.sendMessage(tab.id, { action: 'boxing-auto-backup-trigger' }, function() {
                if (chrome.runtime.lastError) { /* tab may not have listener */ }
              });
            }
          }
        });
      } catch (e) { bgErr('Auto-backup alarm handler error', e); }
    });
  }

  // ── WebDAV message proxy ────────────────────────────────────
  // The background service worker bypasses page-level CSP and CORS
  // restrictions that block cross-origin fetch from extension pages.
  // BX-DEV-115: Route WebDAV test/backup through background to fix
  // "NetworkError when attempting to fetch resource" in Firefox MV3.

  // SECURITY (BX-AUD-01/02/03) — v3.7.10: harden the background WebDAV proxy against abuse.
  const BG_MAX_URL = 2048;
  const BG_MAX_BODY = 2 * 1024 * 1024; // 2 MiB; Service Worker memory-budget safe.
  // BX-AUD-01: refuse hostnames that resolve to private / loopback / link-local addresses.
  const BG_PRIVATE_HOST_RE = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|fc00:|fd00:)/i;

  function isSafeWebDAVUrl(urlStr) {
    if (typeof urlStr !== 'string' || urlStr.length > BG_MAX_URL) return false;
    let u;
    try { u = new URL(urlStr); } catch (_) { return false; }
    if (u.protocol !== 'https:') return false;          // BX-AUD-01: scheme lock
    if (u.username || u.password) return false;           // no embedded credentials
    const host = (u.hostname || '').toLowerCase();
    if (BG_PRIVATE_HOST_RE.test(host)) return false;     // BX-AUD-01: private / host-only literals
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    return true;
  }

  function guardWebDAVRequest(msg, requireBodyOK) {
    if (!msg || !isSafeWebDAVUrl(msg.url)) {
      return { success: false, error: 'blocked unsafe WebDAV url', blocked: true };
    }
    if (requireBodyOK) {
      if (typeof msg.body !== 'string' || msg.body.length > BG_MAX_BODY) {
        return { success: false, error: 'blocked oversized WebDAV body', blocked: true };
      }
    }
    return null;
  }

  // BX-AUD-01: only messages sent from our own extension (sender.id === our runtime id) may use the WebDAV proxy.
  // This blocks other installed extensions or arbitrary extension pages from driving Boxing as a blind fetch proxy.
  function isOwnSender(sender) {
    if (!sender) return false;
    if (typeof sender.id === 'string' && typeof api.runtime?.id === 'string') {
      return sender.id === api.runtime.id;
    }
    // Firefox browser.* sometimes leaves sender.id empty for self-frames — accept when the url is our origin.
    if (!sender.id) {
      const ourBase = api.runtime?.getURL?.('') || 'chrome-extension://';
      return !sender.url || String(sender.url).startsWith(ourBase);
    }
    return false;
  }

  function makeAuthHeader(user, pass) {
    if (!user) return null;
    return 'Basic ' + btoa(user + ':' + pass);
  }

  async function handleWebDAVTest(msg) {
    const { url, user, pass } = msg;
    bgLog('WebDAV test via BG:', { url, user: user ? '(set)' : '(empty)' });
    const auth = makeAuthHeader(user, pass);

    // Try PROPFIND first (standard WebDAV method, returns 207 on success)
    // Send an XML PROPFIND body so servers that reject bodyless PROPFIND still respond.
    try {
      const pfHeaders = new Headers({
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      });
      if (auth) pfHeaders.set('Authorization', auth);
      const pfBody = '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><displayname/></prop></propfind>';
      const pfResp = await fetch(url, {
        method: 'PROPFIND',
        headers: pfHeaders,
        body: pfBody,
        redirect: 'manual' // BX-AUD-02: refuse transparent 3xx; Authorization never follows.
      });
      bgLog('WebDAV test PROPFIND response:', pfResp.status);
      if (pfResp.status === 0 || pfResp.type === 'opaqueredirect') {
        return { status: 0, ok: false, error: 'webdav redirect blocked' };
      }
      // 207 = Multi-Status (WebDAV success), 200 also OK
      if (pfResp.status === 207 || pfResp.status === 200) {
        return { status: pfResp.status, ok: true };
      }
      // 401/403 = auth failed, 404 = path not found — return these directly
      if (pfResp.status === 401 || pfResp.status === 403 || pfResp.status === 404) {
        return { status: pfResp.status, ok: false };
      }
      // 405 = Method Not Allowed — fall through to OPTIONS
    } catch (e) {
      bgErr('WebDAV test PROPFIND failed:', e.message);
    }

    // Fallback: OPTIONS (servers without PROPFIND at the collection root)
    try {
      const optHeaders = new Headers();
      if (auth) optHeaders.set('Authorization', auth);
      const resp = await fetch(url, { method: 'OPTIONS', headers: optHeaders, redirect: 'manual' });
      bgLog('WebDAV test OPTIONS response:', resp.status);
      if (resp.status === 0 || resp.type === 'opaqueredirect') {
        return { status: 0, ok: false, error: 'webdav redirect blocked' };
      }
      return { status: resp.status, ok: resp.ok };
    } catch (e) {
      bgErr('WebDAV test OPTIONS failed:', e.message);
      throw e;
    }
  }

  async function handleWebDAVPut(msg) {
    const { url, user, pass, body } = msg;
    bgLog('WebDAV PUT via BG:', { url, size: body?.length || 0 });
    const h = new Headers({ 'Content-Type': 'application/json', 'Overwrite': 'T' });
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const resp = await fetch(url, { method: 'PUT', headers: h, body, redirect: 'manual' });
    bgLog('WebDAV PUT response:', resp.status);
    if (resp.status === 0 || resp.type === 'opaqueredirect') {
      return { status: 0, ok: false, error: 'webdav redirect blocked' };
    }
    return { status: resp.status, ok: resp.ok };
  }

  // BX-DEV-SYNC: GET cloud backup file for sync comparison. Returns status + body text on success.
  async function handleWebDAVGet(msg) {
    const { url, user, pass } = msg;
    bgLog('WebDAV GET via BG:', { url });
    const h = new Headers();
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const resp = await fetch(url, { method: 'GET', headers: h, redirect: 'manual' });
    bgLog('WebDAV GET response:', resp.status);
    if (resp.status === 0 || resp.type === 'opaqueredirect') {
      return { status: 0, ok: false, body: null, error: 'webdav redirect blocked' };
    }
    if (resp.status === 404) { return { status: 404, ok: false, body: null }; }
    if (resp.status === 401 || resp.status === 403) { return { status: resp.status, ok: false, body: null }; }
    const body = await resp.text();
    return { status: resp.status, ok: resp.ok, body };
  }

  // Dispatch table mirroring kiss-translator's messageHandlers pattern.
  async function dispatch(msg, sender) {
    if (!msg || !msg.type) return { success: false, error: 'Empty message type' };
    bgLog('BG message:', msg.type);
    // BX-AUD-01: reject external senders — other extensions cannot use Boxing as a fetch proxy.
    if (!isOwnSender(sender)) {
      bgErr('BG: rejected external sender', sender && { id: sender.id, url: sender.url });
      return { success: false, error: 'external sender blocked', blocked: true };
    }
    // BX-AUD-01/03: per-handler scheme + private-address + length guards.
    if (msg.type === 'webdav-test' || msg.type === 'webdav-get') {
      const block = guardWebDAVRequest(msg, false);
      if (block) return block;
    } else if (msg.type === 'webdav-put') {
      const block = guardWebDAVRequest(msg, true);
      if (block) return block;
    }
    try {
      if (msg.type === 'webdav-test') {
        const result = await handleWebDAVTest(msg);
        return { success: true, ...result };
      } else if (msg.type === 'webdav-put') {
        const result = await handleWebDAVPut(msg);
        return { success: true, ...result };
      } else if (msg.type === 'webdav-get') {
        const result = await handleWebDAVGet(msg);
        return { success: true, ...result };
      }
      return { success: false, error: 'Unknown message type: ' + msg.type };
    } catch (e) {
      bgErr('WebDAV BG error:', e);
      return { success: false, error: e.message || String(e) };
    }
  }

  // BX-DEV-115: Cross-browser message listener.
  // Returns a Promise on Firefox/browser.* native API (Promise resolves → frame receives it).
  // On Chrome chrome.* API, where the listener must return true and use sendResponse,
  // we also call sendResponse so the callback path keeps working.
  api.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
    const promise = dispatch(msg, sender);
    // Chrome callback-style path: sendResponse is called when the promise resolves,
    // and we return true to keep the message channel open for the async response.
    if (typeof sendResponse === 'function') {
      promise.then(result => {
        try { sendResponse(result); } catch (_) {}
      });
      return true; // keep channel open for async sendResponse
    }
    // Firefox/browser-native path: returning the Promise resolves the response.
    return promise;
  });

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

})();
