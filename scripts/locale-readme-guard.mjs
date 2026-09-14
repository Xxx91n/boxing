#!/usr/bin/env node
// BX-LOCALE-README-GUARD - locale README drift gate (ticket 99 / A-053 / B63).
// Zero dependency. exit 0 = pass, exit 1 = drift.
//   node scripts/locale-readme-guard.mjs [--strict] [--self-test]
//
// Why: ticket 99 research (ctx source: atomcode-99) recommends the invariants-only
// discipline - version literals and distribution claims live in exactly one place
// (README.md + docs/release-status.md); localized READMEs link to them and never
// restate them. This gate makes that machine-checkable so the 13-locale drift seen
// in B63 cannot silently return.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
const SELFTEST = process.argv.includes('--self-test');

const LOCALES = ['zh_CN', 'zh_TW', 'ja', 'ko', 'fr', 'de', 'es', 'pt_BR', 'ru', 'ar', 'hi', 'th', 'vi'];
const AMO = 'addons.mozilla.org';
const EDGE = 'microsoftedge.microsoft.com/addons/detail/';
const CALVER = /(?<![\d.])20\d{2}\.\d{1,2}\.\d{1,2}(?!\d)/g;
const ARTIFACT = /boxing-(chrome|firefox)-[\w.%/-]*\.(zip|crx|xpi)\b|releases\/download\//i;
const MARK_START = '<!-- README-I18N:START -->';
const MARK_END = '<!-- README-I18N:END -->';

function h2Count(text) {
  return text.split('\n').filter(function (line) { return /^##\s/.test(line); }).length;
}

function checkLocale(name, text) {
  const out = [];
  const cal = text.match(CALVER);
  if (cal) {
    out.push(['BX-LOCALE-002', name + ': version literal(s) ' + Array.from(new Set(cal)).join(', ') + ' - locales must link, not restate']);
  }
  const art = text.match(ARTIFACT);
  if (art) {
    out.push(['BX-LOCALE-003', name + ': obsolete release-artifact reference "' + art[0] + '"']);
  }
  if (text.indexOf(AMO) < 0) out.push(['BX-LOCALE-004', name + ': missing AMO store URL']);
  if (text.indexOf(EDGE) < 0) out.push(['BX-LOCALE-004', name + ': missing Edge store URL']);
  if (text.indexOf(MARK_START) < 0 || text.indexOf(MARK_END) < 0) {
    out.push(['BX-LOCALE-005', name + ': missing README-I18N marker block']);
  }
  return out;
}

function checkEnglish(text, published) {
  const out = [];
  const badge = text.match(/store_published-v(20\d{2}\.\d{1,2}\.\d{1,2})/);
  if (!badge) {
    out.push(['BX-LOCALE-006', 'README.md: store_published badge literal not found']);
  } else if (published && badge[1] !== published) {
    out.push(['BX-LOCALE-006', 'README.md store_published ' + badge[1] + ' != docs/release-status.md published ' + published]);
  }
  return out;
}

function publishedFromStatus() {
  const p = path.join(ROOT, 'docs', 'release-status.md');
  if (!fs.existsSync(p)) return null;
  const line = fs.readFileSync(p, 'utf8').split('\n').filter(function (l) {
    return l.indexOf('上一已发布版本') >= 0;
  })[0];
  if (!line) return null;
  const m = line.match(CALVER);
  return m ? m[0] : null;
}

function run() {
  const findings = [];
  const enPath = path.join(ROOT, 'README.md');
  if (!fs.existsSync(enPath)) {
    console.log('BX-LOCALE-001 block: README.md missing');
    return 1;
  }
  const en = fs.readFileSync(enPath, 'utf8');
  const enH2 = h2Count(en);
  const published = publishedFromStatus();
  checkEnglish(en, published).forEach(function (f) { findings.push(f); });
  LOCALES.forEach(function (code) {
    const name = 'README.' + code + '.md';
    const p = path.join(ROOT, 'docs', 'i18n', name);
    if (!fs.existsSync(p)) {
      findings.push(['BX-LOCALE-001', name + ': missing docs/i18n/' + name]);
      return;
    }
    const text = fs.readFileSync(p, 'utf8');
    checkLocale(name, text).forEach(function (f) { findings.push(f); });
    const h2 = h2Count(text);
    if (h2 !== enH2) {
      findings.push(['BX-LOCALE-007', name + ': H2 count ' + h2 + ' != English baseline ' + enH2, 'warn']);
    }
  });
  let blocked = 0;
  let warned = 0;
  findings.forEach(function (f) {
    if (f[2] === 'warn' && !STRICT) { warned++; console.log('WARN  ' + f[0] + '  ' + f[1]); return; }
    blocked++;
    console.log('BLOCK ' + f[0] + '  ' + f[1]);
  });
  console.log('locale README gate: ' + LOCALES.length + ' locales checked, store_published baseline ' + (published || 'unknown') + '; ' + blocked + ' blocking, ' + warned + ' warning(s).');
  return blocked > 0 ? 1 : 0;
}

function selfTest() {
  const clean = MARK_START + '\n' + MARK_END + '\n' +
    '[AMO](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/) ' +
    '[Edge](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)';
  const cases = [
    ['BX-LOCALE-002', 'version literal detected', clean + '\nLatest published release: v2026.9.11 (GitHub).'],
    ['BX-LOCALE-003', 'obsolete artifact name detected', clean + '\nDownload boxing-firefox-2026.9.11.xpi from the release.'],
    ['BX-LOCALE-004', 'missing store URL detected', MARK_START + '\n' + MARK_END],
    ['BX-LOCALE-005', 'missing marker block detected', '[AMO](https://addons.mozilla.org/x) [Edge](https://microsoftedge.microsoft.com/addons/detail/x)']
  ];
  let bad = 0;
  cases.forEach(function (c) {
    const hits = checkLocale('synthetic', c[2]).filter(function (f) { return f[0] === c[0]; });
    if (hits.length === 0) { console.log('SELFTEST FAIL ' + c[0] + ' - ' + c[1]); bad++; }
    else console.log('self-test ok ' + c[0] + ' - ' + c[1]);
  });
  const cleanHits = checkLocale('synthetic', clean);
  if (cleanHits.length !== 0) { console.log('SELFTEST FAIL clean content should pass, got ' + JSON.stringify(cleanHits)); bad++; }
  else console.log('self-test ok aligned content passes');
  const drifted = checkEnglish('store_published-v2026.9.11 (as of 2026--09--13)', '2026.9.12');
  if (drifted.length === 0) { console.log('SELFTEST FAIL BX-LOCALE-006 store_published drift not detected'); bad++; }
  else console.log('self-test ok BX-LOCALE-006 - store_published vs release-status mismatch detected');
  return bad === 0 ? 0 : 1;
}

if (SELFTEST) {
  const rc = selfTest();
  console.log(rc === 0 ? 'self-test PASS' : 'self-test FAIL');
  process.exit(rc);
}
process.exit(run());
