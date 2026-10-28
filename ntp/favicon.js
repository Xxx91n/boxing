// v2: Fastest-CDN race — probe all sources on first request, lock winner for session
const FAVICON_SOURCES = [
  { name: 'bytecook', url: (h) => `https://ico.bytecook.io/${h}` },
  { name: 'duckduckgo', url: (h) => `https://icons.duckduckgo.com/ip3/${h}.ico` },
  { name: 'google', url: (h) => `https://www.google.com/s2/favicons?domain=${h}&sz=32` },
  { name: 'faviconim', url: (h) => `https://favicon.im/${h}` },
];
let fastestCDN = null; // session-locked winner after race
let cdnRaceDone = false;

function getFaviconUrl(url) {
  try { const host = new URL(url).hostname; if (!host) return null; } catch (_) { return null; }
  const host = new URL(url).hostname;
  if (fastestCDN) return fastestCDN.url(host);
  // Default: DuckDuckGo (global, CN-accessible)
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

// v2: Race all CDNs on first favicon request, pick fastest
async function raceCDN(testHost) {
  if (cdnRaceDone) return;
  cdnRaceDone = true;
  let bestTime = Infinity;
  const results = await Promise.allSettled(FAVICON_SOURCES.map(async (src) => {
    const url = src.url(testHost);
    const start = performance.now();
    await new Promise((resolve, reject) => {
      const probe = new Image();
      const timer = setTimeout(() => reject(new Error('timeout')), 2500);
      probe.onload = () => { clearTimeout(timer); resolve(); };
      probe.onerror = () => { clearTimeout(timer); reject(new Error('load failed')); };
      probe.src = url;
    });
    const elapsed = performance.now() - start;
    return { src, elapsed };
  }));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.elapsed < bestTime) {
      bestTime = r.value.elapsed;
      fastestCDN = r.value.src;
    }
  }
  if (window.__BOXING_DEBUG__) console.debug('[Boxing] CDN race winner:', fastestCDN?.name || 'none', Number.isFinite(bestTime) ? bestTime.toFixed(0) + 'ms' : 'n/a');
}

// v2: Validate URL before favicon fetch — skip intranet / non-http / raw IP
function isValidPublicUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return false;
    const h = u.hostname;
    if (!h || h === 'localhost') return false;
    // Skip raw IPv4 / IPv6 addresses
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
    if (h.includes(':')) return false; // IPv6
    // Skip intranet ranges: 10.x, 172.16-31.x, 192.168.x, 127.x
    const parts = h.split('.');
    if (parts.length === 4) {
      const a = +parts[0], b = +parts[1];
      if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch (_) { return false; }
}

const faviconCache = new Map(); // volatile: cleared on browser restart (session-scoped)
const _faviconHotPool = new Map(); // host -> HTMLImageElement
// (Bug12): persistent favicon URL cache in localStorage with TTLs.
//   hit  (url != null) → 7-day TTL
//   miss (url == null) → 90-day TTL (avoid re-racing 404 sites)
// BX ticket 12: expired entries stay usable as stale within the SWR ceilings below.
const FAV_CACHE_KEY = 'boxingFaviconCache.v1';
const FAV_HIT_TTL = 7 * 24 * 3600 * 1000;     // 7 days
const FAV_MISS_TTL = 90 * 24 * 3600 * 1000;   // 90 days
const FAV_MAX_ENTRIES = 2000; // bounded — no unbounded localStorage growth
// BX ticket 12 (SWR): past the fresh TTL an entry stays paintable as stale until the SWR
// ceiling; hydrate keeps stale entries and loadFavicon revalidates them once in background.
// Hit: fresh 7d then stale 7–90d. Miss: fresh 90d then stale 90–180d (hard expiry per the
// atomcode favicon research; the 7d/90d fresh windows themselves are unchanged).
const FAV_HIT_SWR_TTL = 90 * 24 * 3600 * 1000;   // stale-while-revalidate ceiling for hits
const FAV_MISS_SWR_TTL = 180 * 24 * 3600 * 1000; // hard expiry for negative-cache entries
function favFreshTtl(url) { return url === null ? FAV_MISS_TTL : FAV_HIT_TTL; }
function favStaleCeiling(url) { return url === null ? FAV_MISS_SWR_TTL : FAV_HIT_SWR_TTL; }
const inflight = new Map(); // BX ticket 12: host -> Promise<url|null> single-flight dedupe
let __favPersistPending = false;
function loadFaviconCacheFromStorage() {
  try {
    const raw = localStorage.getItem(FAV_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const now = Date.now();
    const entries = (obj && obj.entries) || {};
    for (const host of Object.keys(entries)) {
      const e = entries[host];
      if (!e || typeof e.ts !== 'number') continue;
      if (e.url !== null && typeof e.url !== 'string') continue; // malformed entry — drop
      // BX ticket 12 (SWR hydrate): keep expired-but-within-ceiling entries as stale — they
      // paint immediately and get one background refresh. Past the ceiling: drop, re-race lazily.
      if (now - e.ts > favStaleCeiling(e.url)) continue;
      faviconCache.set(host, { url: e.url, ts: e.ts });
    }
  } catch (_) { /* corrupt cache — ignore; will rebuild lazily */ }
}
function persistFaviconCacheNow() {
  try {
    const entries = {};
    // Trim to most recent FAV_MAX_ENTRIES to keep the JSON bounded.
    let pairs = Array.from(faviconCache.entries());
    // BX ticket 12: memory now carries per-entry ts, so recency is exact — keep newest 2000 by ts.
    if (pairs.length > FAV_MAX_ENTRIES) {
      pairs.sort((a, b) => b[1].ts - a[1].ts);
      pairs = pairs.slice(0, FAV_MAX_ENTRIES);
    }
    const now = Date.now();
    for (const [host, e] of pairs) entries[host] = { url: e.url, ts: e.ts };
    localStorage.setItem(FAV_CACHE_KEY, JSON.stringify({ entries, savedAt: now }));
  } catch (_) { /* quota exceeded — fail-soft; mem cache still works this session */ }
}
function persistFaviconCacheDebounced() {
  if (__favPersistPending) return;
  __favPersistPending = true;
  setTimeout(() => { __favPersistPending = false; persistFaviconCacheNow(); }, 400);
}
// hydrate the mem cache on first script load.
try { loadFaviconCacheFromStorage(); } catch (e) { /* silent: favicon cache hydration, regenerates on demand */ }

// ── #58: bounded pixel layer ───────────────────────────────────────────────
// Best-effort 32×32 PNG data URIs captured from the SAME winning URL, within the
// authorization the browser already grants. This is a discardable accelerator for the
// URL cache above, never a second source of truth: a corrupt, expired, unreadable,
// undecodable, oversized or quota-blocked pixel always falls back to the URL/SWR path.
// It shares localStorage with the favicon URL cache and is capped at 1 MiB; the layout
// itself lives in chrome.storage.local, and the emergency localStorage layout snapshot
// reclaims this layer first when a quota failure blocks its own write.
const FAV_PIXEL_KEY = 'boxingFaviconPixels.v1';
const FAV_PIXEL_SIZE = 32;
const FAV_PIXEL_MAX_ENTRY = 16 * 1024;    // stored data-URI bytes for one host
const FAV_PIXEL_MAX_TOTAL = 1024 * 1024;  // whole serialized layer (discardable)
const FAV_PIXEL_PREFIX = 'data:image/png;base64,';
const faviconPixels = new Map(); // host -> { data: dataUri, ts: write time }
const pixelInflight = new Map(); // host -> Promise<void>; dedupes captures, never awaited by display
let __favPixelPersistPending = false;

function serializeFaviconPixels(pairs) {
  const entries = {};
  for (const [host, e] of pairs) entries[host] = { data: e.data, ts: e.ts };
  return JSON.stringify({ entries, savedAt: Date.now() });
}
// Pairs arrive oldest-write first. The budget covers the whole serialized layer; measure
// each exact entry chunk once and keep the newest contiguous run, so eviction is strictly
// oldest-write-first and a newer entry never loses to an older one. Not an LRU.
function fitFaviconPixelsToBudget(pairs) {
  const chunks = pairs.map(([host, e]) => JSON.stringify(host) + ':' + JSON.stringify(e));
  const envelope = '{"entries":{},"savedAt":' + Date.now() + '}';
  let total = envelope.length;
  let keepFrom = pairs.length;
  for (let i = pairs.length - 1; i >= 0; i--) {
    const cost = chunks[i].length + (keepFrom < pairs.length ? 1 : 0); // comma between entries
    if (total + cost > FAV_PIXEL_MAX_TOTAL) break;
    total += cost;
    keepFrom = i;
  }
  const kept = pairs.slice(keepFrom);
  return { kept, payload: serializeFaviconPixels(kept) };
}
function loadFaviconPixelsFromStorage() {
  try {
    const raw = localStorage.getItem(FAV_PIXEL_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const now = Date.now();
    const entries = (obj && obj.entries) || {};
    let changed = false;
    const candidates = [];
    // Keep only successful PNG entries inside the hit SWR ceiling.
    for (const host of Object.keys(entries)) {
      const e = entries[host];
      if (!e || typeof e.data !== 'string' || !e.data.startsWith(FAV_PIXEL_PREFIX) ||
          typeof e.ts !== 'number' || !Number.isFinite(e.ts) ||
          e.data.length > FAV_PIXEL_MAX_ENTRY || now - e.ts > FAV_HIT_SWR_TTL) {
        changed = true;
        continue;
      }
      candidates.push([host, { data: e.data, ts: e.ts }]);
    }
    candidates.sort((a, b) => a[1].ts - b[1].ts);
    const { kept } = fitFaviconPixelsToBudget(candidates);
    if (kept.length !== candidates.length) changed = true;
    for (const [host, e] of kept) faviconPixels.set(host, e);
    if (changed) persistFaviconPixelsNow();
  } catch (_) { /* corrupt pixel layer — ignore; captures rebuild it lazily */ }
}
function persistFaviconPixelsNow() {
  try {
    const candidates = Array.from(faviconPixels.entries())
      .filter(([, e]) => e.data.length <= FAV_PIXEL_MAX_ENTRY)
      .sort((a, b) => a[1].ts - b[1].ts);
    const { kept, payload } = fitFaviconPixelsToBudget(candidates);
    const keptHosts = new Set(kept.map((p) => p[0]));
    for (const host of Array.from(faviconPixels.keys())) {
      if (!keptHosts.has(host)) faviconPixels.delete(host);
    }
    localStorage.setItem(FAV_PIXEL_KEY, payload);
  } catch (_) {
    // Quota or serialization failure: drop the whole pixel layer (it is discardable) so
    // it can never hold space the user's other saves need. The URL cache is untouched.
    faviconPixels.clear();
    try { localStorage.removeItem(FAV_PIXEL_KEY); } catch (_) { /* storage unavailable — nothing else to release */ }
  }
}
function persistFaviconPixelsDebounced() {
  if (__favPixelPersistPending) return;
  __favPixelPersistPending = true;
  setTimeout(() => { __favPixelPersistPending = false; persistFaviconPixelsNow(); }, 400);
}
try { loadFaviconPixelsFromStorage(); } catch (e) { /* silent: pixel hydrate, captures rebuild it */ }

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
// Decode + downscale to one uniform 32×32 PNG. Returns null for anything that does not
// decode, so a 200 with an empty body or a 404 HTML page cannot become a pixel.
async function encodePixelPng(blob) {
  let source = null;
  let objectUrl = null;
  try {
    if (typeof createImageBitmap === 'function') {
      try { source = await createImageBitmap(blob); } catch (_) { source = null; } // SVG etc. — fall through
    }
    if (!source) {
      objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = objectUrl;
      await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
      source = img;
    }
    if (!source || !source.width || !source.height) return null;
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(FAV_PIXEL_SIZE, FAV_PIXEL_SIZE)
      : Object.assign(document.createElement('canvas'), { width: FAV_PIXEL_SIZE, height: FAV_PIXEL_SIZE });
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, FAV_PIXEL_SIZE, FAV_PIXEL_SIZE);
    ctx.drawImage(source, 0, 0, FAV_PIXEL_SIZE, FAV_PIXEL_SIZE);
    const out = canvas.convertToBlob
      ? await canvas.convertToBlob({ type: 'image/png' })
      : await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!out || !out.size) return null;
    return FAV_PIXEL_PREFIX + bytesToBase64(new Uint8Array(await out.arrayBuffer()));
  } catch (_) {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (source && typeof source.close === 'function') source.close();
  }
}
async function captureFaviconPixel(host, url) {
  try {
    if (!isValidPublicUrl(url)) return;
    // Default cache mode: the winning probe just loaded this URL, so the browser can reuse
    // those bytes instead of paying a second network transfer for the same icon.
    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp || !resp.ok) return; // 404 HTML is a successful fetch, not a pixel
    const mime = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) return;
    const blob = await resp.blob();
    if (!blob || blob.size === 0) return; // 200 with an empty body is not a pixel
    const dataUri = await encodePixelPng(blob);
    if (!dataUri || dataUri.length > FAV_PIXEL_MAX_ENTRY) return;
    faviconPixels.set(host, { data: dataUri, ts: Date.now() });
    persistFaviconPixelsDebounced();
  } catch (_) { /* best effort — the URL cache stays authoritative */ }
}
function captureFaviconPixelOnce(host, url) {
  if (pixelInflight.has(host)) return;
  const task = captureFaviconPixel(host, url);
  pixelInflight.set(host, task);
  const forget = () => { if (pixelInflight.get(host) === task) pixelInflight.delete(host); };
  task.then(forget, forget);
}
function paintProbeImage(img, host, probe) {
  img.src = probe.src;
  img.style.display = '';
  img.classList.remove('is-loading');
  img.classList.add('is-cached');
  _faviconHotPool.set(host, probe);
}
function paintFaviconPixel(img, host, pixel) {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => { paintProbeImage(img, host, probe); resolve(true); };
    probe.onerror = () => resolve(false);
    probe.src = pixel.data;
  });
}

function applyDecodedFavicon(img, host, src) {
  const probe = new Image();
  probe.src = src;
  probe.decode().then(() => paintProbeImage(img, host, probe)).catch(() => {
    img.classList.remove('is-loading');
    img.style.display = 'none';
  });
}

async function loadFavicon(img, url, opts) {
  // Parallel CDN race via Promise.any — fastest token wins, no serial waterfall.
  // BX ticket 12 (single-flight + SWR): concurrent same-host loads share ONE in-flight probe
  // (Map<host, Promise>, forgotten on settle so a failed probe never parks later callers). A
  // stale-but-usable hydrate hit paints first, then triggers exactly one background
  // revalidation via { background: true } re-entry, which skips the cache check and
  // joins/starts the shared probe; its result overwrites the cache AND repaints this img.
  const background = !!(opts && opts.background);
  if (!isValidPublicUrl(url)) {
    img.classList.remove('is-loading');
    img.style.display = 'none';
    return;
  }
  const host = new URL(url).hostname;
  if (!background) {
    const entry = faviconCache.get(host);
    const pixel = faviconPixels.get(host);
    // #58: a usable pixel paints first and returns; a missing or failing pixel falls through
    // to the URL cache. A negative probe NEWER than the pixel outranks it — never resurrect an
    // icon a later probe failed to confirm — while a newer pixel still outranks an old miss.
    // The 7d/90d SWR clock decides when a painted pixel is refreshed; capture is detached.
    const missNewerThanPixel = !!(pixel && entry && entry.url === null && Number(entry.ts) >= pixel.ts);
    if (pixel && !missNewerThanPixel) {
      if (Date.now() - pixel.ts <= FAV_HIT_SWR_TTL && await paintFaviconPixel(img, host, pixel)) {
        if (Date.now() - pixel.ts > FAV_HIT_TTL && !inflight.has(host)) {
          loadFavicon(img, url, { background: true });
        }
        return;
      }
      // Corrupt, undecodable or past the ceiling: discard and use the existing URL path.
      faviconPixels.delete(host);
      persistFaviconPixelsDebounced();
    }
    if (entry) {
      // Cache hit — instant render, zero network. Stale hits paint too (SWR), refreshed below.
      if (entry.url === null) {
        img.classList.remove('is-loading');
        img.style.display = 'none';
      } else {
        const pooled = _faviconHotPool.get(host);
        if (pooled && pooled.complete) {
          img.src = pooled.src;
          img.style.display = '';
          img.classList.remove('is-loading');
          img.classList.add('is-cached');
        } else {
          applyDecodedFavicon(img, host, entry.url);
        }
      }
      if (Date.now() - entry.ts > favFreshTtl(entry.url) && !inflight.has(host)) {
        loadFavicon(img, url, { background: true });
      }
      return;
    }
  }
  // Single-flight: join the in-flight probe for this host, or start one below.
  let task = inflight.get(host);
  if (!task) {
    task = (async () => {
      // Trigger session CDN speed race on first-ever favicon request (sets fastestCDN).
      if (!cdnRaceDone) raceCDN(host);
      // Build token list: racy winner first (if resolved), then other sources, then direct /favicon.ico.
      const tokens = [];
      if (fastestCDN) tokens.push(fastestCDN.url(host));
      for (const src of FAVICON_SOURCES) {
        const u = src.url(host);
        if (!tokens.includes(u)) tokens.push(u);
      }
      tokens.push(`https://${host}/favicon.ico`);
      // Probe helper — resolves with the winning url, rejects on timeout/error.
      function probe(url) {
        return new Promise((resolve, reject) => {
          const probe = new Image();
          const timer = setTimeout(() => reject(new Error('timeout')), 3000);
          probe.onload = () => { clearTimeout(timer); resolve(url); };
          probe.onerror = () => { clearTimeout(timer); reject(new Error('fail')); };
          probe.src = url;
        });
      }
      try {
        // Promise.any: returns first fulfilled (winning url). Removed serial waterfall blocking.
        const winningUrl = await Promise.any(tokens.map(probe));
        faviconCache.set(host, { url: winningUrl, ts: Date.now() }); try { persistFaviconCacheDebounced(); } catch (e) { /* silent: favicon cache persist, debounced retry */ }
        return winningUrl;
      } catch (_) {
        // All tokens failed — negative-cache the miss with 90-day TTL so we do not re-race dead hosts.
        faviconCache.set(host, { url: null, ts: Date.now() }); try { persistFaviconCacheDebounced(); } catch (e) { /* silent: favicon cache persist, debounced retry */ }
        return null;
      }
    })();
    inflight.set(host, task);
    const forget = () => { if (inflight.get(host) === task) inflight.delete(host); }; // failure Forget
    task.then(forget, forget);
  }
  const winner = await task;
  if (winner === null) {
    img.classList.remove('is-loading');
    // #58: a stale pixel already on screen stays usable when its revalidation fails;
    // the URL path keeps its existing hide-on-failure behaviour.
    if (!(img.src && img.src.startsWith('data:image/'))) img.style.display = 'none';
  } else {
    applyDecodedFavicon(img, host, winner);
    // Detached on purpose: capture never gates the paint that just happened, and a
    // failed or refused capture leaves the URL display exactly as it was.
    captureFaviconPixelOnce(host, winner);
  }
}

export { loadFavicon };
