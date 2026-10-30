// Boxing — URL auto-title extraction & rule engine.
// Zero-dependency pure module: parses URLs, applies Chrome match-pattern subset,
// extracts 8 preset title types with eTLD+1 awareness.

export const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'me.uk', 'net.uk', 'ac.uk', 'gov.uk',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz',
  'com.tw', 'org.tw', 'idv.tw',
  'com.hk', 'org.hk', 'edu.hk',
  'co.kr', 'ne.kr', 'or.kr',
  'com.br', 'net.br', 'org.br',
  'com.sg', 'edu.sg', 'gov.sg',
  'com.mx', 'org.mx', 'gob.mx',
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in',
  'com.tr', 'org.tr', 'net.tr',
  'com.ru', 'net.ru', 'org.ru',
  'com.de', 'co.za', 'com.ar', 'com.sa'
]);

export const EXTRACTION_TYPES = [
  'domain-main',
  'full-host',
  'subdomain',
  'first-path',
  'last-path',
  'first-two-paths',
  'domain-first-path',
  'full-url'
];

export const DEFAULT_AUTO_TITLE_RULES = [
  { pattern: 'https://github.com/*/*', type: 'first-two-paths' },
  { pattern: 'https://*/*', type: 'domain-main' }
];

// D8 (ticket 84): rule-engine boundaries. Wildcards expand to `.*`, so cap both
// total pattern length and wildcard count: over-limit rules are rejected by
// matchPattern and the engine predictably degrades to the next rule / fallback.
export const MAX_PATTERN_LENGTH = 256;
export const MAX_PATTERN_WILDCARDS = 8;

/**
 * Parse a hostname into full host, eTLD+1 domain main, and subdomain parts.
 * IP literals, bracketed forms, and host:port inputs are treated as a single
 * host with no subdomain; multi-part TLDs (e.g. co.uk) keep their public suffix.
 * @param {string} hostname hostname string (may include brackets or port)
 * @returns {{fullHost: string, domainMain: string, subdomain: string}} parsed parts
 */
export function parseDomain(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return { fullHost: '', domainMain: '', subdomain: '' };
  }
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes('.') || /^(\d+\.){3}\d+$/.test(host) || host.includes(':')) {
    return { fullHost: host, domainMain: host, subdomain: '' };
  }
  const parts = host.split('.');
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    if (MULTI_PART_TLDS.has(lastTwo)) {
      const sld = parts[parts.length - 3];
      const sub = parts.slice(0, parts.length - 3).join('.');
      return { fullHost: host, domainMain: sld, subdomain: sub };
    }
  }
  if (parts.length >= 2) {
    const sld = parts[parts.length - 2];
    const sub = parts.slice(0, parts.length - 2).join('.');
    return { fullHost: host, domainMain: sld, subdomain: sub };
  }
  return { fullHost: host, domainMain: host, subdomain: '' };
}

// D8 (ticket 84): a malformed percent-encoding (e.g. `%zz`) makes decodeURIComponent
// throw URIError; degrade to hostname/domain instead of surfacing an uncaught exception.
/**
 * Decode a single percent-encoded path segment.
 * Returns an empty string when the encoding is malformed (decodeURIComponent throws),
 * letting callers fall back to the domain instead of surfacing an uncaught URIError.
 * @param {string} segment raw percent-encoded segment
 * @returns {string} decoded segment, or '' on malformed input
 */
function safeDecode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch (_) {
    return '';
  }
}

/**
 * Extract an auto-title from a parsed URL for the given extraction type.
 * Path decoding failures and empty path segments fall back to the domain main
 * (or hostname when no domain main is available).
 * @param {URL} url parsed URL object
 * @param {string} type one of EXTRACTION_TYPES
 * @returns {string} extracted title or fallback value
 */
export function extractTitleByType(url, type) {
  const domainInfo = parseDomain(url.hostname);
  const segments = url.pathname.split('/').filter(Boolean);
  const fallback = domainInfo.domainMain || url.hostname;

  switch (type) {
    case 'domain-main':
      return fallback;
    case 'full-host':
      return domainInfo.fullHost || url.hostname;
    case 'subdomain':
      return domainInfo.subdomain || fallback;
    case 'first-path': {
      if (segments.length === 0) return fallback;
      return safeDecode(segments[0]) || fallback;
    }
    case 'last-path': {
      if (segments.length === 0) return fallback;
      let last = safeDecode(segments[segments.length - 1]);
      last = last.replace(/\.(html?|php|aspx?|jsp)$/i, '');
      return last || fallback;
    }
    case 'first-two-paths': {
      if (segments.length === 0) return fallback;
      const first = safeDecode(segments[0]);
      if (!first) return fallback;
      if (segments.length === 1) return first;
      const second = safeDecode(segments[1]);
      if (!second) return fallback;
      return `${first}/${second}`;
    }
    case 'domain-first-path': {
      if (segments.length === 0) return fallback;
      const first = safeDecode(segments[0]);
      return first ? `${fallback}/${first}` : fallback;
    }
    case 'full-url':
      return url.href;
    default:
      return fallback;
  }
}

/**
 * Match a Chrome match-pattern subset against a URL string.
 * Patterns longer than MAX_PATTERN_LENGTH or containing more than
 * MAX_PATTERN_WILDCARDS wildcards are rejected before matching.
 * @param {string} pattern rule pattern, e.g. 'https://github.com/<*>/<*>'
 * @param {string} urlStr candidate URL string
 * @returns {boolean} true when the pattern matches the URL
 */
export function matchPattern(pattern, urlStr) {
  let url;
  try {
    url = new URL(urlStr);
  } catch (_) {
    return false;
  }
  if (!pattern || typeof pattern !== 'string') return false;
  pattern = pattern.trim();
  if (pattern === '<all_urls>') return true;
  // D8: reject pathological rules before they can compile into an expensive matcher.
  if (pattern.length > MAX_PATTERN_LENGTH) return false;
  let wildcardCount = 0;
  for (const ch of pattern) {
    if (ch === '*') wildcardCount++;
  }
  if (wildcardCount > MAX_PATTERN_WILDCARDS) return false;

  const schemeSep = pattern.indexOf('://');
  if (schemeSep === -1) return false;
  const schemePart = pattern.slice(0, schemeSep);
  const rest = pattern.slice(schemeSep + 3);

  // Scheme
  if (schemePart === '*') {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  } else {
    if (url.protocol !== schemePart + ':') return false;
  }

  const slashIdx = rest.indexOf('/');
  const hostPart = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  const pathPart = slashIdx === -1 ? '/*' : rest.slice(slashIdx);

  // Host
  const hostname = url.hostname.toLowerCase();
  const hostPattern = hostPart.toLowerCase();

  if (hostPattern === '*') {
    // any host matches
  } else if (hostPattern.startsWith('*.')) {
    const baseHost = hostPattern.slice(2);
    if (hostname !== baseHost && !hostname.endsWith('.' + baseHost)) {
      return false;
    }
  } else {
    if (hostname !== hostPattern) return false;
  }

  // Path
  if (pathPart === '/*') return true;

  const regexStr = '^' + pathPart.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
  return new RegExp(regexStr).test(url.pathname);
}

/**
 * Derive an auto-title from a URL string using the supplied rules.
 * Falls back to DEFAULT_AUTO_TITLE_RULES when rules are empty, and to the
 * domain main / hostname when no rule yields a non-empty title.
 * @param {string} urlStr candidate URL string
 * @param {Array<{pattern: string, type: string}>} rules ordered title rules
 * @param {boolean} enabled whether auto-title derivation is enabled
 * @returns {string} derived title, or '' for invalid input
 */
export function deriveTitleFromUrl(urlStr, rules, enabled = true) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  let url;
  try {
    url = new URL(urlStr);
  } catch (_) {
    return '';
  }
  if (!enabled) {
    return url.hostname || '';
  }

  const activeRules = Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_AUTO_TITLE_RULES;
  for (const rule of activeRules) {
    if (rule && rule.pattern && rule.type && matchPattern(rule.pattern, urlStr)) {
      const title = extractTitleByType(url, rule.type);
      if (title) return title;
    }
  }
  return extractTitleByType(url, 'domain-main') || url.hostname;
}

/**
 * Wire URL/title inputs to derive auto-titles on input (debounced) and blur.
 * Tracks user edits so manually typed titles are not overwritten.
 * @param {HTMLElement} urlInput URL input element
 * @param {HTMLElement} titleInput title input element
 * @param {() => object} getSettings function returning current settings
 * @returns {void}
 */
export function attachAutoTitleHelper(urlInput, titleInput, getSettings) {
  if (!urlInput || !titleInput) return;
  let lastAutoTitle = '';
  let userEdited = !!titleInput.value.trim();
  let debounceTimer = null;

  titleInput.addEventListener('input', () => {
    if (titleInput.value.trim() !== lastAutoTitle) {
      userEdited = true;
    }
  });

  function updateTitle() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) return;
    const settings = typeof getSettings === 'function' ? (getSettings() || {}) : {};
    const enabled = settings.autoTitleEnabled !== false;
    const rules = settings.autoTitleRules;

    const derived = deriveTitleFromUrl(rawUrl, rules, enabled);
    if (!derived) return;

    if (!userEdited || !titleInput.value.trim() || titleInput.value.trim() === lastAutoTitle) {
      titleInput.value = derived;
      lastAutoTitle = derived;
      userEdited = false;
    }
  }

  urlInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateTitle, 300);
  });

  urlInput.addEventListener('blur', () => {
    clearTimeout(debounceTimer);
    updateTitle();
  });
}
// Submit-time / shared call-site helper: derived title, else hostname, else raw string.
/**
 * Shared call-site helper: return the derived title, else the hostname, else the raw string.
 * Never throws on invalid URLs.
 * @param {string} urlStr candidate URL string
 * @param {object} settings settings object carrying autoTitleRules / autoTitleEnabled
 * @returns {string} derived title, hostname, or raw string
 */
export function deriveTitleOrHostname(urlStr, settings) {
  const s = settings || {};
  try {
    return deriveTitleFromUrl(urlStr, s.autoTitleRules, s.autoTitleEnabled !== false) || safeHostname(urlStr) || urlStr;
  } catch (_) { return safeHostname(urlStr) || urlStr; }
}

function safeHostname(urlStr) {
  try { return new URL(urlStr).hostname; } catch (_) { return ''; }
}
