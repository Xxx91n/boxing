// Ticket 34 - minimal structural validator for Boxing multilingual READMEs.
// Read-only, zero-dependency. Exit 0 when every check passes, 1 otherwise.
// Run: node .scratch/architecture-recovery/34-locale-structure-check.mjs
// Baseline: English README.md sections; locales may omit documented English-only
// sections (Screenshots grid, Brand Assets, Quarantined tests) per ticket 34 report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const I18N = path.join(REPO, 'docs', 'i18n');

const SEC = {
  'README.md':       { toc: null, privBullets: 4, features: 'What Makes It Different', install: 'Install', usage: 'Usage', privacy: 'Privacy', development: 'Development', prereq: 'Prerequisites', setup: 'Setup', build: 'Build', contributing: 'Contributing', license: 'License' },
  'README.zh_CN.md': { toc: '\u76EE\u5F55', features: '\u529F\u80FD', install: '\u5B89\u88C5', usage: '\u4F7F\u7528', privacy: '\u9690\u79C1', development: '\u5F00\u53D1', prereq: '\u524D\u7F6E\u6761\u4EF6', setup: '\u8BBE\u7F6E', build: '\u6784\u5EFA', contributing: '\u8D21\u732E', license: '\u8BB8\u53EF\u8BC1' },
  'README.zh_TW.md': { toc: '\u76EE\u9304', features: '\u529F\u80FD', install: '\u5B89\u88DD', usage: '\u4F7F\u7528', privacy: '\u96B1\u79C1', development: '\u958B\u767C', prereq: '\u524D\u7F6E\u689D\u4EF6', setup: '\u8A2D\u5B9A', build: '\u5EFA\u7F6E', contributing: '\u8CA2\u737B', license: '\u6388\u6B0A' },
  'README.ja.md':    { toc: '\u76EE\u6B21', features: '\u6A5F\u80FD', install: '\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB', usage: '\u4F7F\u3044\u65B9', privacy: '\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC', development: '\u958B\u767A', prereq: '\u524D\u63D0\u6761\u4EF6', setup: '\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7', build: '\u30D3\u30EB\u30C9', contributing: '\u8CA2\u732E', license: '\u30E9\u30A4\u30BB\u30F3\u30B9' },
  'README.ko.md':    { toc: '\uBAA9\uCC28', features: '\uAE30\uB2A5', install: '\uC124\uCE58', usage: '\uC0AC\uC6A9\uBC95', privacy: '\uAC1C\uC778\uC815\uBCF4', development: '\uAC1C\uBC1C', prereq: '\uD544\uC218 \uC870\uAC74', setup: '\uC124\uC815', build: '\uBE4C\uB4DC', contributing: '\uAE30\uC5EC', license: '\uB77C\uC774\uC120\uC2A4' },
  'README.fr.md':    { toc: 'Sommaire', features: 'Fonctionnalites', install: 'Installation', usage: 'Utilisation', privacy: 'Confidentialite', development: 'Developpement', prereq: 'Prerequis', setup: 'Configuration', build: 'Build', contributing: 'Contribuer', license: 'Licence' },
  'README.de.md':    { toc: 'Inhaltsverzeichnis', features: 'Funktionen', install: 'Installation', usage: 'Verwendung', privacy: 'Datenschutz', development: 'Entwicklung', prereq: 'Voraussetzungen', setup: 'Einrichtung', build: 'Build', contributing: 'Mitwirken', license: 'Lizenz' },
  'README.es.md':    { toc: 'Indice', features: 'Funciones', install: 'Instalacion', usage: 'Uso', privacy: 'Privacidad', development: 'Desarrollo', prereq: 'Requisitos', setup: 'Configuracion', build: 'Build', contributing: 'Contribuir', license: 'Licencia' },
  'README.pt_BR.md': { toc: 'Sumario', features: 'Recursos', install: 'Instalacao', usage: 'Uso', privacy: 'Privacidade', development: 'Desenvolvimento', prereq: 'Pre-requisitos', setup: 'Configuracao', build: 'Build', contributing: 'Contribuir', license: 'Licenca' },
  'README.ru.md':    { toc: '\u0421\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435', features: '\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438', install: '\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430', usage: '\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435', privacy: '\u041A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C', development: '\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0430', prereq: '\u0422\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F', setup: '\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430', build: '\u0421\u0431\u043E\u0440\u043A\u0430', contributing: '\u0423\u0447\u0430\u0441\u0442\u0438\u0435', license: '\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F' },
  'README.ar.md':    { toc: '\u0627\u0644\u0641\u0647\u0631\u0633', features: '\u0627\u0644\u0645\u064A\u0632\u0627\u062A', install: '\u0627\u0644\u062A\u062B\u0628\u064A\u062A', usage: '\u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645', privacy: '\u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629', development: '\u0627\u0644\u062A\u0637\u0648\u064A\u0631', prereq: '\u0627\u0644\u0645\u062A\u0637\u0644\u0628\u0627\u062A', setup: '\u0627\u0644\u0625\u0639\u062F\u0627\u062F', build: '\u0627\u0644\u0628\u0646\u0627\u0621', contributing: '\u0627\u0644\u0645\u0633\u0627\u0647\u0645\u0629', license: '\u0627\u0644\u062A\u0631\u062E\u064A\u0635' },
  'README.hi.md':    { toc: 'Table of Contents', features: 'Features', install: 'Install', usage: 'Usage', privacy: 'Privacy', development: 'Development', prereq: 'Prerequisites', setup: 'Setup', build: 'Build', contributing: 'Contributing', license: 'License' },
  'README.th.md':    { toc: '\u0E2A\u0E32\u0E23\u0E1A\u0E31\u0E0D', features: '\u0E04\u0E38\u0E13\u0E2A\u0E21\u0E1A\u0E31\u0E15\u0E34', install: '\u0E01\u0E32\u0E23\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07', usage: '\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19', privacy: '\u0E04\u0E27\u0E32\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27', development: '\u0E01\u0E32\u0E23\u0E1E\u0E31\u0E12\u0E19\u0E32', prereq: '\u0E02\u0E49\u0E2D\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E1A\u0E37\u0E49\u0E2D\u0E07\u0E15\u0E49\u0E19', setup: '\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32', build: '\u0E1A\u0E34\u0E25\u0E14\u0E4C', contributing: '\u0E01\u0E32\u0E23\u0E21\u0E35\u0E2A\u0E48\u0E27\u0E19\u0E23\u0E48\u0E27\u0E21', license: '\u0E25\u0E34\u0E02\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C' },
  'README.vi.md':    { toc: 'M\u1EE5c l\u1EE5c', features: 'T\u00EDnh n\u0103ng', install: 'C\u00E0i \u0111\u1EB7t', usage: 'S\u1EED d\u1EE5ng', privacy: 'Quy\u1EC1n ri\u00EAng t\u01B0', development: 'Ph\u00E1t tri\u1EC3n', prereq: '\u0110i\u1EC1u ki\u1EC7n ti\u00EAn quy\u1EBFt', setup: 'Thi\u1EBFt l\u1EADp', build: 'Build', contributing: '\u0110\u00F3ng g\u00F3p', license: 'Gi\u1EA5y ph\u00E9p' }
};

const githubSlug = (t) => t.trim().toLowerCase()
  .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
  .replace(/\s/g, '-');

function parseFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const headings = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) headings.push({ line: i + 1, level: m[1].length, title: m[2], slug: githubSlug(m[2]) });
  });
  return { text, lines, headings, slugSet: new Set(headings.map(h => h.slug)) };
}

function bulletsUnder(p, title) {
  const h = p.headings.find(x => x.title === title);
  if (!h) return null;
  let n = 0;
  for (let i = h.line; i < p.lines.length; i++) {
    if (/^#{1,6}\s/.test(p.lines[i])) break;
    if (/^- /.test(p.lines[i])) n++;
  }
  return n;
}

function tocEntries(p, tocTitle) {
  const h = p.headings.find(x => x.title === tocTitle);
  if (!h) return null;
  const out = [];
  for (let i = h.line; i < p.lines.length; i++) {
    if (/^#{1,6}\s/.test(p.lines[i])) break;
    const m = p.lines[i].match(/^- \[(.+?)\]\(#(.+?)\)\s*$/);
    if (m) out.push({ line: i + 1, text: m[1], anchor: m[2] });
  }
  return out;
}

function collectLinks(text) {
  const rel = [], anchors = [], ext = [];
  let m;
  const md = /\[([^\]]*)\]\(([^)]+)\)/g;
  while ((m = md.exec(text))) {
    const t = m[2].trim().split(/\s+/)[0];
    if (t.startsWith('#')) anchors.push(t.slice(1));
    else if (/^https?:\/\//.test(t)) ext.push(t);
    else rel.push(t);
  }
  const img = /(?:src|srcset)="([^"]+)"/g;
  while ((m = img.exec(text))) {
    const t = m[1].trim().split(/\s+/)[0];
    if (!/^https?:/.test(t)) rel.push(t);
  }
  const ah = /<a\s[^>]*href="([^"]+)"/g;
  while ((m = ah.exec(text))) {
    const t = m[1].trim();
    if (t.startsWith('#')) anchors.push(t.slice(1));
    else if (/^https?:\/\//.test(t)) ext.push(t);
    else rel.push(t);
  }
  return { rel, anchors, ext };
}

const tracked = new Set(execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean));

function isTracked(abs) {
  const rel = path.relative(REPO, abs).replace(/\\/g, '/');
  if (tracked.has(rel)) return true;
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const prefix = rel.endsWith('/') ? rel : rel + '/';
    for (const t of tracked) if (t.startsWith(prefix)) return true;
  }
  return false;
}

function resolveRel(fromFile, target) {
  let clean;
  try { clean = decodeURIComponent(target.split('#')[0]); } catch { clean = target.split('#')[0]; }
  if (!clean) return { ok: false, why: 'empty target' };
  const abs = path.normalize(path.join(path.dirname(fromFile), clean));
  const exists = fs.existsSync(abs);
  return { ok: exists && isTracked(abs), exists, tracked: isTracked(abs), rel: path.relative(REPO, abs).replace(/\\/g, '/') };
}

const results = [];
for (const [name, sec] of Object.entries(SEC)) {
  const file = name === 'README.md' ? path.join(REPO, 'README.md') : path.join(I18N, name);
  const p = parseFile(file);
  const fails = [];
  const bad = (id, msg) => fails.push(id + ' ' + msg);

  if (p.headings.filter(h => h.level === 1).length !== 1 || p.headings.find(h => h.level === 1).title !== 'Boxing')
    bad('C1', 'H1 must be exactly one "# Boxing"');
  const collapsed = p.headings.filter(h => h.title.length > 80);
  if (collapsed.length) bad('C2', 'collapsed heading(s) at L' + collapsed.map(h => h.line).join(',') + ' (len ' + collapsed.map(h => h.title.length).join('/') + ')');
  const seen = new Map();
  for (const h of p.headings) {
    if (seen.has(h.title)) bad('C3', 'duplicate heading "' + h.title + '" at L' + seen.get(h.title) + ' and L' + h.line);
    else seen.set(h.title, h.line);
  }
  const order = ['features', 'install', 'usage', 'privacy', 'development', 'contributing', 'license'];
  const found = order.map(k => { const h = p.headings.find(x => x.title === sec[k]); return h ? h.line : null; });
  found.forEach((ln, i) => { if (ln === null) bad('C4', 'missing section "' + sec[order[i]] + '"'); });
  const sorted = found.filter(x => x !== null);
  if (sorted.length !== found.length || String(sorted) !== String([...sorted].sort((a, b) => a - b)))
    bad('C4', 'section order diverges from English baseline: ' + found.join(','));
  for (const st of ['### Chrome / Edge (Chromium)', '### Firefox', '### ' + sec.prereq, '### ' + sec.setup, '### ' + sec.build])
    if (!p.headings.some(h => sec.level === undefined && (h.level === 3 && h.title === st.slice(4)))) bad('C4', 'missing subsection "' + st.slice(4) + '"');

  if (sec.toc !== null) {
    const toc = tocEntries(p, sec.toc);
    if (!toc || toc.length === 0) bad('C5', 'TOC "' + sec.toc + '" has no entries');
    else for (const e of toc) {
      if (e.text.length > 60) bad('C5', 'TOC L' + e.line + ' entry is paragraph-sized (len ' + e.text.length + ')');
      if (!p.slugSet.has(e.anchor)) bad('C5', 'TOC L' + e.line + ' anchor "#' + e.anchor + '" does not match any heading');
    }
  }
  const ub = bulletsUnder(p, sec.usage), pb = bulletsUnder(p, sec.privacy);
  if (ub !== 11) bad('C6', 'usage bullets = ' + ub + ' (expected 11)');
  if (pb !== (sec.privBullets || 5)) bad('C6', 'privacy bullets = ' + pb + ' (expected ' + (sec.privBullets || 5) + ')');

  const links = collectLinks(p.text);
  for (const t of links.rel) {
    const r = resolveRel(file, t);
    if (!r.exists) bad('C7', 'relative link target missing: ' + t + ' -> ' + r.rel);
    else if (!r.tracked) bad('C7', 'relative link target not git-tracked: ' + r.rel);
  }
  for (const a of links.anchors) if (!p.slugSet.has(a)) bad('C8', 'in-page anchor "#' + a + '" does not match any heading');

  const sel = p.lines.find(l => l.includes('**Languages:**'));
  if (!sel) bad('C9', 'language selector line missing');
  else {
    const selLinks = [...sel.matchAll(/\]\(([^)]+)\)/g)].map(x => x[1]);
    if (selLinks.length !== 14) bad('C9', 'selector link count = ' + selLinks.length + ' (expected 14: 13 languages + TRANSLATIONS.md)');
    for (const t of selLinks) {
      const r = resolveRel(file, t);
      if (!r.exists) bad('C9', 'selector link target missing: ' + t);
      else if (!r.tracked) bad('C9', 'selector link target not tracked: ' + r.rel);
    }
  }
  if (/\s n- /.test(p.text)) bad('C10', 'literal " n- " list-merge artifact present');

  results.push({ name, fails });
}

let pass = 0;
for (const r of results) {
  if (r.fails.length === 0) { pass++; console.log('PASS ' + r.name); }
  else for (const f of r.fails) console.log('FAIL ' + r.name + ' :: ' + f);
}
console.log('--- ' + pass + '/' + results.length + ' files pass; total findings: ' + results.reduce((n, r) => n + r.fails.length, 0));
process.exit(pass === results.length ? 0 : 1);
