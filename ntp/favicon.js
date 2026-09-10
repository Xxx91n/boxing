// BX-DEV-111 v2: Fastest-CDN race — probe all sources on first request, lock winner for session
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

// BX-DEV-111 v2: Race all CDNs on first favicon request, pick fastest
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

// BX-DEV-111 v2: Validate URL before favicon fetch — skip intranet / non-http / raw IP
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
// BX-DEV-121 (Bug12): persistent favicon URL cache in localStorage with TTLs.
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
// BX-DEV-121: hydrate the mem cache on first script load.
try { loadFaviconCacheFromStorage(); } catch (e) { /* silent: favicon cache hydration, regenerates on demand */ }

async function loadFavicon(img, url, opts) {
  // BX-DEV-126 (B10): parallel CDN race via Promise.any — fastest token wins, no serial waterfall.
  // BX ticket 12 (single-flight + SWR): concurrent same-host loads share ONE in-flight probe
  // (Map<host, Promise>, forgotten on settle so a failed probe never parks later callers). A
  // stale-but-usable hydrate hit paints first, then triggers exactly one background
  // revalidation via { background: true } re-entry, which skips the cache check and
  // joins/starts the shared probe; its result overwrites the cache AND repaints this img.
  const background = !!(opts && opts.background);
  if (!isValidPublicUrl(url)) { img.style.display = 'none'; return; }
  const host = new URL(url).hostname;
  if (!background) {
    const entry = faviconCache.get(host);
    if (entry) {
      // Cache hit — instant render, zero network. Stale hits paint too (SWR), refreshed below.
      if (entry.url === null) img.style.display = 'none'; else img.src = entry.url;
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
  if (winner === null) img.style.display = 'none'; else img.src = winner;
}

export { loadFavicon };
