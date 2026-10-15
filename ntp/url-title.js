// Boxing — URL auto-title extraction & rule engine (ADR-0023, D-005/6/7/8).
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

export function extractTitleByType(url, type) {
  const domainInfo = parseDomain(url.hostname);
  const segments = url.pathname.split('/').filter(Boolean);

  switch (type) {
    case 'domain-main':
      return domainInfo.domainMain || url.hostname;
    case 'full-host':
      return domainInfo.fullHost || url.hostname;
    case 'subdomain':
      return domainInfo.subdomain || domainInfo.domainMain || url.hostname;
    case 'first-path':
      return segments.length > 0 ? decodeURIComponent(segments[0]) : (domainInfo.domainMain || url.hostname);
    case 'last-path': {
      if (segments.length === 0) return domainInfo.domainMain || url.hostname;
      let last = decodeURIComponent(segments[segments.length - 1]);
      last = last.replace(/\.(html?|php|aspx?|jsp)$/i, '');
      return last || domainInfo.domainMain || url.hostname;
    }
    case 'first-two-paths': {
      if (segments.length === 0) return domainInfo.domainMain || url.hostname;
      if (segments.length === 1) return decodeURIComponent(segments[0]);
      return `${decodeURIComponent(segments[0])}/${decodeURIComponent(segments[1])}`;
    }
    case 'domain-first-path': {
      const dm = domainInfo.domainMain || url.hostname;
      if (segments.length > 0) {
        return `${dm}/${decodeURIComponent(segments[0])}`;
      }
      return dm;
    }
    case 'full-url':
      return url.href;
    default:
      return domainInfo.domainMain || url.hostname;
  }
}

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
export function deriveTitleOrHostname(urlStr, settings) {
  const s = settings || {};
  try {
    return deriveTitleFromUrl(urlStr, s.autoTitleRules, s.autoTitleEnabled !== false) || safeHostname(urlStr) || urlStr;
  } catch (_) { return safeHostname(urlStr) || urlStr; }
}

function safeHostname(urlStr) {
  try { return new URL(urlStr).hostname; } catch (_) { return ''; }
}
