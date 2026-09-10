// Boxing — Pages demo chrome.* web stub (ticket 07 pages-demo).
// Loaded by the generated demo/index.html BEFORE ntp.js. On GitHub Pages there
// is no extension context: chrome.storage is missing (real desktop Chrome
// exposes a partial window.chrome without storage). This shim installs a
// localStorage-backed mock for the APIs the NTP touches so the mirror loads
// and stays interactive standalone.
//
// Scope / SEC-01: the shim only runs on the demo origin (demo/ is excluded
// from dist/, so extension pages never load it). If a real extension context
// is detected it installs nothing.
//
// API surface covered (everything else the NTP calls is already guarded by
// typeof checks in the source — verified by grep over ntp/*.js):
//   chrome.storage.local/sync/managed  get/set/remove/clear (key-faithful:
//       string | string[] | defaults-object | undefined; callback + Promise)
//   chrome.storage.onChanged           same-tab fan-out + cross-tab storage relay
//   chrome.runtime.id/getURL/getManifest/sendMessage/onMessage/openOptionsPage
//   chrome.tabs.create/query/update    create -> window.open
//   chrome.bookmarks.getTree/get/search  empty tree (boxes render from layout)
//   chrome.i18n.getMessage/getUILanguage  "" / navigator.language
//   chrome.alarms                      no-op (sync-engine.js falls back to setInterval)

(function () {
  'use strict';
  var hasReal = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  if (hasReal) return;

  var LS_PREFIX = 'boxing.demo.';
  function lsGet(k) {
    try { var v = localStorage.getItem(LS_PREFIX + k); return v === null ? undefined : JSON.parse(v); } catch (_) { return undefined; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); return true; } catch (_) { return false; }
  }
  function lsRemove(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (_) {} }
  function lsKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var f = localStorage.key(i);
        if (f && f.indexOf(LS_PREFIX) === 0) out.push(f.slice(LS_PREFIX.length));
      }
    } catch (_) {}
    return out;
  }

  var listeners = new Set();

  // cross-tab parity with the ntp.js file:// mock: relay other tabs' writes
  // (same-tab writes fan out directly from set()/remove() below)
  window.addEventListener('storage', function (ev) {
    if (!ev.key || ev.key.indexOf(LS_PREFIX) !== 0) return;
    var k = ev.key.slice(LS_PREFIX.length);
    function parse(v) { if (v === null || v === undefined) return undefined; try { return JSON.parse(v); } catch (_) { return undefined; } }
    var change = {};
    change[k] = { oldValue: parse(ev.oldValue), newValue: parse(ev.newValue) };
    listeners.forEach(function (cb) { try { cb(change, 'local'); } catch (_) {} });
    listeners.forEach(function (cb) { try { cb(change, 'sync'); } catch (_) {} });
  });

  function resolveKeys(keys) {
    var out = {};
    if (keys == null) {
      var all = {};
      lsKeys().forEach(function (k) { all[k] = lsGet(k); });
      return Promise.resolve(all);
    }
    var list;
    if (typeof keys === 'string') list = [keys];
    else if (Array.isArray(keys)) list = keys.slice();
    else list = Object.keys(keys);
    list.forEach(function (k) {
      var stored = lsGet(k);
      if (stored !== undefined) out[k] = stored;
      else if (typeof keys === 'object' && keys !== null) out[k] = keys[k];
    });
    return Promise.resolve(out);
  }

  function makeArea(areaName) {
    return {
      get: function (keys, cb) {
        var p = resolveKeys(keys);
        if (typeof cb === 'function') p.then(function (r) { cb(r); });
        return p;
      },
      set: function (obj, cb) {
        var changed = {};
        Object.keys(obj || {}).forEach(function (k) {
          changed[k] = { oldValue: lsGet(k), newValue: obj[k] };
          lsSet(k, obj[k]);
        });
        listeners.forEach(function (cb2) { try { cb2(changed, areaName); } catch (_) {} });
        var p = Promise.resolve();
        if (typeof cb === 'function') p.then(cb);
        return p;
      },
      remove: function (keys, cb) {
        var list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys.slice() : Object.keys(keys || {});
        var changed = {};
        list.forEach(function (k) { changed[k] = { oldValue: lsGet(k), newValue: undefined }; lsRemove(k); });
        listeners.forEach(function (cb2) { try { cb2(changed, areaName); } catch (_) {} });
        var p = Promise.resolve();
        if (typeof cb === 'function') p.then(cb);
        return p;
      },
      clear: function (cb) {
        lsKeys().forEach(lsRemove);
        var p = Promise.resolve();
        if (typeof cb === 'function') p.then(cb);
        return p;
      }
    };
  }

  function promiseResult(value, cb) {
    var p = Promise.resolve(value);
    if (typeof cb === 'function') p.then(cb);
    return p;
  }

  var shim = {
    storage: {
      local: makeArea('local'),
      sync: makeArea('sync'),
      managed: makeArea('managed'),
      onChanged: {
        addListener: function (cb) { listeners.add(cb); },
        removeListener: function (cb) { listeners.delete(cb); },
        hasListener: function (cb) { return listeners.has(cb); }
      }
    },
    runtime: {
      id: 'boxing-pages-demo',
      getURL: function (p) { return p; },
      getManifest: function () { return { version: 'demo' }; },
      sendMessage: function (msg, cb) { return promiseResult(undefined, cb); },
      onMessage: { addListener: function () {}, removeListener: function () {} },
      openOptionsPage: function () { try { window.open('about:blank', '_blank'); } catch (_) {} }
    },
    tabs: {
      create: function (opts, cb) {
        try {
          var url = (opts && opts.url) || '';
          if (url) window.open(url, (opts && opts.active === false) ? '' : '_blank', 'noopener');
        } catch (_) {}
        return promiseResult({ id: 1 }, cb);
      },
      query: function (q, cb) { return promiseResult([], cb); },
      update: function (id, props, cb) {
        try { if (props && props.url) window.open(props.url, '_blank', 'noopener'); } catch (_) {}
        return promiseResult(undefined, cb);
      }
    },
    bookmarks: {
      getTree: function (cb) { return promiseResult([{ id: '0', title: '', children: [] }], cb); },
      get: function (id, cb) { return promiseResult(null, typeof id === 'function' ? id : cb); },
      search: function (q, cb) { return promiseResult([], cb); }
    },
    i18n: {
      getMessage: function () { return ''; },
      getUILanguage: function () { return (navigator.language || 'en').replace('-', '_'); }
    },
    alarms: {
      create: function () {},
      update: function () {},
      clear: function (name, cb) { return promiseResult(false, cb); },
      clearAll: function (cb) { return promiseResult(true, cb); },
      get: function (name, cb) { return promiseResult(undefined, cb); },
      getAll: function (cb) { return promiseResult([], cb); },
      onAlarm: { addListener: function () {}, removeListener: function () {} }
    },
    extension: { getURL: function (p) { return p; }, isInstalled: true }
  };

  try {
    Object.defineProperty(window, 'chrome', { value: shim, configurable: true, writable: true });
  } catch (_) {
    window.chrome = shim;
  }
})();
