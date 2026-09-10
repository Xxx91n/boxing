#!/usr/bin/env node
// BX-README-i18n: language-switcher sync for README.md + docs/i18n/README.*.md.
// Run: node scripts/gen-i18n-readme.js
//
// HISTORY (ticket 02, 2026.9.12 docs sync): the previous version rebuilt every
// localized README from the English body and wrote it to the repo root, clobbering
// the hand translations under docs/i18n/. That generator is retired. This script
// rewrites ONLY the single line between the README-I18N:START/END markers in each
// file; everything outside the marker block stays byte-exact. Adding a locale =
// append to LOCALES, create docs/i18n/README.<code>.md, run this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- README-I18N:START -->';
const END = '<!-- README-I18N:END -->';

const LOCALES = [
  { code: "en", label: "English", file: "README.md" },
  { code: "zh_CN", label: "简体中文", file: "README.zh_CN.md" },
  { code: "zh_TW", label: "繁體中文", file: "README.zh_TW.md" },
  { code: "ja", label: "日本語", file: "README.ja.md" },
  { code: "ko", label: "한국어", file: "README.ko.md" },
  { code: "fr", label: "Français", file: "README.fr.md" },
  { code: "de", label: "Deutsch", file: "README.de.md" },
  { code: "es", label: "Español", file: "README.es.md" },
  { code: "pt_BR", label: "Português (Brasil)", file: "README.pt_BR.md" },
  { code: "ru", label: "Русский", file: "README.ru.md" },
  { code: "ar", label: "العربية", file: "README.ar.md" },
  { code: "hi", label: "हिन्दी", file: "README.hi.md" },
  { code: "th", label: "ไทย", file: "README.th.md" },
  { code: "vi", label: "Tiếng Việt", file: "README.vi.md" },
];

function switcherLine(current) {
  const parts = LOCALES.map(function (l) {
    if (l.code === current.code) return '**' + l.label + '**';
    let target;
    if (current.code === 'en') target = 'docs/i18n/' + l.file;
    else if (l.code === 'en') target = '../../README.md';
    else target = l.file;
    return '[' + l.label + '](' + target + ')';
  });
  const tr = current.code === 'en' ? 'TRANSLATIONS.md' : '../../TRANSLATIONS.md';
  return '**Languages:** ' + parts.join(' · ') + ' — see [TRANSLATIONS.md](' + tr + ')';
}

function syncFile(filePath, current) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');
  const s = lines.indexOf(START);
  if (s < 0) return 'skip(no markers)';
  const e = lines.indexOf(END, s + 1);
  if (e < 0) return 'skip(no END marker)';
  const want = switcherLine(current);
  if (e === s + 2 && lines[s + 1] === want) return 'ok';
  lines.splice(s + 1, e - s - 1, want);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return 'updated';
}

let updated = 0;
let missing = 0;
for (const l of LOCALES) {
  const p = l.code === 'en'
    ? path.join(ROOT, 'README.md')
    : path.join(ROOT, 'docs', 'i18n', l.file);
  if (!fs.existsSync(p)) { console.log('missing file: ' + p); missing++; continue; }
  const r = syncFile(p, l);
  if (r === 'updated') updated++;
  if (r !== 'ok' && r !== 'updated') console.log(r + ': ' + p);
}
console.log('switcher sync done: ' + updated + ' file(s) rewritten; marker blocks only.');
if (missing) process.exit(1);
