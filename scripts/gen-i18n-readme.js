#!/usr/bin/env node
// BX-README-i18n: generator for localized README files. Run: node scripts/gen-i18n-readme.js
// Each locale gets a localized cover (tagline from _locales/<lang>/messages.json)
// + the shared English body from README.md, so docs stay synced.
// Adding a new locale = append to LOCALES + create its _locales/<code>/messages.json.

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const EN_README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const enLines = EN_README.split(/\r?\n/);
let bodyStart = -1;
for (let i = 0; i < enLines.length; i++) {
  if (enLines[i].startsWith('## ')) { bodyStart = i; break; }
}
const EN_BODY = bodyStart >= 0 ? enLines.slice(bodyStart).join('\n') : EN_README;

const LOCALES = [
  { code: 'en',     label: 'English',              file: 'README.md' },
  { code: 'zh_CN',  label: '简体中文',             file: 'README.zh_CN.md' },
  { code: 'zh_TW',  label: '繁體中文',             file: 'README.zh_TW.md' },
  { code: 'ja',     label: '日本語',               file: 'README.ja.md' },
  { code: 'ko',     label: '한국어',                file: 'README.ko.md' },
  { code: 'fr',     label: 'Français',             file: 'README.fr.md' },
  { code: 'de',     label: 'Deutsch',              file: 'README.de.md' },
  { code: 'es',     label: 'Español',              file: 'README.es.md' },
  { code: 'pt_BR',  label: 'Português (Brasil)',   file: 'README.pt_BR.md' },
  { code: 'ru',     label: 'Русский',              file: 'README.ru.md' },
  { code: 'ar',     label: 'العربية',              file: 'README.ar.md' },
  { code: 'hi',     label: 'हिन्दी',                 file: 'README.hi.md' },
  { code: 'th',     label: 'ไทย',                  file: 'README.th.md' },
  { code: 'vi',     label: 'Tiếng Việt',           file: 'README.vi.md' },
];

function i18nVal(lang, key) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, '_locales', lang, 'messages.json'), 'utf8'));
    return (m[key] && m[key].message) || null;
  } catch (_) { return null; }
}

function renderSwitcher(currentCode) {
  const parts = LOCALES.map(l =>
    l.code === currentCode ? ('**' + l.label + '**') : ('[' + l.label + '](' + l.file + ')')
  );
  return '**Languages:** ' + parts.join(' · ');
}

function buildLocaleReadme(loc) {
  const brand = i18nVal(loc.code, 'brandName') || 'Boxing';
  const tagline = i18nVal(loc.code, 'brandSub') || 'organize bookmarks hierarchically';
  const emptyHint = i18nVal(loc.code, 'emptyCanvasHint') || '';
  return [
    '# 🥊 ' + brand + ' — ' + tagline,
    '',
    renderSwitcher(loc.code),
    '',
    '### ' + tagline,
    '',
    '> ' + emptyHint,
    '',
    '> ' + loc.label + ' README — canonical feature list and technical specs are in the [English README](README.md).',
    '',
    '---',
    '',
    EN_BODY,
    ''
  ].join('\n');
}

let written = 0;
for (const loc of LOCALES) {
  if (loc.code === 'en') continue;
  fs.writeFileSync(path.join(ROOT, loc.file), buildLocaleReadme(loc), 'utf8');
  written++;
}
console.log('Regenerated ' + written + ' localized READMEs (en README.md untouched).');
