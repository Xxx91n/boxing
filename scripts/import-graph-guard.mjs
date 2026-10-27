#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ntpDir = path.join(root, 'ntp');
const testDir = path.join(root, 'test', 'tests');
const mapPath = path.join(root, 'test', 'cluster-map.json');
const files = fs.readdirSync(ntpDir).filter((name) => name.endsWith('.js')).sort();
const nodes = new Set(files);
const edges = new Map(files.map((name) => [name, []]));
const linesByFile = new Map();
const violations = [];
const add = (rule, file, line, message) => violations.push({ rule, file, line, message });

// B-10 (ticket 47, spec #40): the frozen reader is gate-side proof material.
// Production new-tab modules and the service worker may never import it, so the
// rollback oracle cannot become a production dependency. Match by module
// basename so every relative spelling from any directory depth is caught.
const FROZEN_READER_BASENAME = 'legacy-reader-frozen.mjs';
const PRODUCTION_SCOPE_RE = /^(?:ntp\/[^/]+\.js|background\.js)$/;
const STATIC_IMPORT_RE = /\bimport\s*(?:[^'"]*?\bfrom\s*)?(['"])([^'"]+)\1/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*([`'"])([^`'"$]+)\1\s*\)/g;
// Re-exporting is exposure too: `export { x } from '.../legacy-reader-frozen.mjs'`
// hands the frozen reader to production consumers as surely as an import does.
const EXPORT_FROM_RE = /\bexport\s*(?:\*|\{[^}]*\})(?:\s*as\s*[\w$]+)?\s*from\s*(['"])([^'"]+)\1/g;

function isFrozenReaderSpecifier(specifier) {
  const basename = String(specifier).split(/[\\/]/).pop() || '';
  return basename === FROZEN_READER_BASENAME || basename === 'legacy-reader-frozen';
}

// Regex literals are code, not strings. A pattern such as /[&<>"']/ contains a
// quote; without regex awareness the scanner enters a bogus string mode at that
// quote and masks the rest of the line as literal text, hiding a real import that
// follows. When `/` is not the start of a comment, decide with the standard
// previous-token heuristic whether it opens a regex literal. Regex may start at
// file start, after an operator/punctuator, or after a keyword; it is division
// after an identifier, number, `)`, `]`, or a closing quote.
const REGEX_PRECEDING_PUNCT = new Set('(,=:[!&|?{};+-*%<>~^');
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await',
]);
const WORD_CHAR_RE = /[A-Za-z0-9_$]/;

function regexMayStart(lastToken) {
  if (!lastToken) return true; // start of file: nothing to divide
  if (lastToken.type === 'word') return REGEX_PRECEDING_KEYWORDS.has(lastToken.value);
  if (lastToken.type === 'punct') return REGEX_PRECEDING_PUNCT.has(lastToken.value);
  return false; // value (identifier/number/literal/`)`/`]`): division
}

// Scan source into two same-length views:
//   * text — comment and regex characters blanked to spaces (newlines preserved,
//     offsets unchanged), while string/template literal contents stay verbatim; and
//   * mask — '1' where the character is code, '0' in comments/regexes and inside
//     literals. A regex hit is only real when its keyword lands on code, which is
//     what keeps a quoted or commented mention of the frozen reader from becoming
//     a false positive.
function scanCode(text) {
  let out = '';
  let mask = '';
  const push = (ch, isCode) => { out += ch; mask += isCode ? '1' : '0'; };
  let mode = 'code';
  let lastToken = null; // { type: 'word' | 'punct' | 'value', value? }
  let word = '';
  let inClass = false;
  // Template substitutions (`${...}`) are executable code, not literal text.
  // Each open frame is the brace depth of one substitution; nested templates push
  // additional frames, and the matching `}` returns to the enclosing template.
  const templateFrames = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (mode === 'code') {
      // Comments are checked before the regex rule: `//` and `/*` win over `/`.
      if (ch === '/' && next === '/') { mode = 'line'; push(' ', false); i += 1; push(' ', false); continue; }
      if (ch === '/' && next === '*') { mode = 'block'; push(' ', false); i += 1; push(' ', false); continue; }
      if (WORD_CHAR_RE.test(ch)) { word += ch; push(ch, true); continue; }
      // A non-word character ends the pending identifier/number token.
      if (word) { lastToken = { type: 'word', value: word }; word = ''; }
      if (/\s/.test(ch)) { push(ch, true); continue; }
      if (ch === '/' && regexMayStart(lastToken)) {
        mode = 'regex'; inClass = false; push(' ', false); continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') { mode = ch; push(ch, false); continue; }
      // Inside a template substitution, braces are real code structure: track the
      // depth and hand control back to the template when the matching `}` closes it.
      if (templateFrames.length > 0) {
        if (ch === '{') {
          templateFrames[templateFrames.length - 1] += 1;
        } else if (ch === '}') {
          templateFrames[templateFrames.length - 1] -= 1;
          if (templateFrames[templateFrames.length - 1] === 0) {
            templateFrames.pop();
            mode = '`';
            push(ch, false);
            continue;
          }
        }
      }
      // `)` and `]` end a value: a following `/` is division, not a regex.
      if (ch === ')' || ch === ']') { push(ch, true); lastToken = { type: 'value' }; continue; }
      push(ch, true);
      lastToken = { type: 'punct', value: ch };
      continue;
    }
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; push(ch, true); } else push(' ', false);
      continue;
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; push(' ', false); i += 1; push(' ', false); continue; }
      push(ch === '\n' ? '\n' : ' ', false);
      continue;
    }
    if (mode === 'regex') {
      // Mask the whole pattern, preserving newlines. A `[...]` character class may
      // contain `/` without closing the literal, and `\` escapes the next char.
      if (ch === '\\') {
        push(ch === '\n' ? '\n' : ' ', false);
        if (i + 1 < text.length) { push(text[i + 1] === '\n' ? '\n' : ' ', false); i += 1; }
        continue;
      }
      if (ch === '[') { inClass = true; push(' ', false); continue; }
      if (ch === ']' && inClass) { inClass = false; push(' ', false); continue; }
      if (ch === '/' && !inClass) {
        // Closing delimiter. The literal is a value, so a following `/` is division;
        // flags stay ordinary code characters handled in code mode.
        mode = 'code'; lastToken = { type: 'value' }; push(' ', false); continue;
      }
      push(ch === '\n' ? '\n' : ' ', false);
      continue;
    }
    // Inside a string/template literal: copy verbatim, honouring escapes. A `${`
    // in a template opens an executable expression, so the delimiters stay masked
    // while the substitution itself is scanned as code.
    if (mode === '`' && ch === '$' && next === '{') {
      push('$', false);
      push('{', false);
      templateFrames.push(1);
      mode = 'code';
      lastToken = { type: 'punct', value: '{' };
      i += 1;
      continue;
    }
    push(ch, false);
    if (ch === '\\') { if (i + 1 < text.length) { push(text[i + 1], false); i += 1; } continue; }
    if (ch === mode) { mode = 'code'; lastToken = { type: 'value' }; }
  }
  return { text: out, mask };
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function analyzeIsolation(sources) {
  const found = [];
  for (const source of sources) {
    if (!PRODUCTION_SCOPE_RE.test(source.rel)) continue;
    const scanned = scanCode(source.text);
    for (const regex of [STATIC_IMPORT_RE, DYNAMIC_IMPORT_RE, EXPORT_FROM_RE]) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(scanned.text)) !== null) {
        // The keyword must itself be code: a quoted path or a commented-out import
        // keeps the regex text but is not an executable dependency. When the match
        // carries a `from` clause, that token must be code too: otherwise a template
        // substitution such as `${import.meta.url} from '...'` would bridge from code
        // into template text and report a dependency that does not exist.
        if (scanned.mask[match.index] !== '1') continue;
        // Search only before the specifier's opening quote. Searching from the
        // closing quote would find a `from` inside the specifier path itself and,
        // because specifier text is masked as literal, skip a real import.
        const openingQuote = match[0].indexOf(match[1]);
        const from = match[0].lastIndexOf('from', openingQuote);
        if (from !== -1 && scanned.mask[match.index + from] !== '1') continue;
        const specifier = match[2];
        if (!isFrozenReaderSpecifier(specifier)) continue;
        found.push({
          rule: 'B-10',
          file: source.rel,
          line: lineOf(source.text, match.index),
          message: `production module must not import the frozen reader (gate-side only): ${specifier}`,
        });
      }
    }
  }
  return found;
}

function selfTest() {
  const lines = [];
  let bad = 0;
  const check = (label, sources, expected) => {
    const printed = analyzeIsolation(sources).map((violation) => `${violation.rule}@${violation.line}`).sort().join(',');
    const ok = printed === expected;
    if (!ok) bad += 1;
    lines.push(`${ok ? 'self-test ok  ' : 'SELFTEST FAIL'} ${label} -> [${printed}] expected [${expected}]`);
  };
  check('production ntp module importing the frozen reader is red',
    [{ rel: 'ntp/popups.js', text: "import { rollbackAudit } from '../scripts/legacy-reader-frozen.mjs';\n" }], 'B-10@1');
  check('production ntp module dynamic-importing the frozen reader is red',
    [{ rel: 'ntp/render.js', text: "const m = await import('../scripts/legacy-reader-frozen.mjs');\n" }], 'B-10@1');
  check('service worker importing the frozen reader is red',
    [{ rel: 'background.js', text: "import { rollbackAudit } from './scripts/legacy-reader-frozen.mjs';\n" }], 'B-10@1');
  check('service worker dynamic-importing the frozen reader is red',
    [{ rel: 'background.js', text: "const m = await import('./scripts/legacy-reader-frozen.mjs');\n" }], 'B-10@1');
  check('gate-side scripts import is NOT flagged',
    [{ rel: 'scripts/migration-golden-guard.mjs', text: "import { rollbackAudit } from './legacy-reader-frozen.mjs';\n" }], '');
  check('production re-export of the frozen reader is red',
    [{ rel: 'ntp/popups.js', text: "export { rollbackAudit } from '../scripts/legacy-reader-frozen.mjs';\n" }], 'B-10@1');
  check('comment-only mention of the frozen reader is NOT flagged',
    [{ rel: 'ntp/render.js', text: "// import { rollbackAudit } from '../scripts/legacy-reader-frozen.mjs'\n/* export { x } from './legacy-reader-frozen.mjs' */\n" }], '');
  check('string-literal mention of the frozen reader is NOT flagged',
    [{ rel: 'ntp/render.js', text: "const note = \"import '../scripts/legacy-reader-frozen.mjs'\";\n" }], '');
  check('backtick dynamic import of the frozen reader is red',
    [{ rel: 'ntp/render.js', text: "const m = await import(`../scripts/legacy-reader-frozen.mjs`);\n" }], 'B-10@1');
  check('no-space static import of the frozen reader is red',
    [{ rel: 'ntp/render.js', text: "import'../scripts/legacy-reader-frozen.mjs';\n" }], 'B-10@1');
  check('no-space re-export of the frozen reader is red',
    [{ rel: 'ntp/render.js', text: "export*from'../scripts/legacy-reader-frozen.mjs';\n" }], 'B-10@1');
  check('import.meta mention is NOT flagged',
    [{ rel: 'ntp/render.js', text: 'const url = import.meta.url;\n' }], '');
  check('quoted regex literal does not mask a following dynamic import',
    [{ rel: 'ntp/render.js', text: "const r = /[&<>\"']/g;\nconst m = await import('../scripts/legacy-reader-frozen.mjs');\n" }], 'B-10@2');
  check('import inside a template substitution is red at its line',
    [{ rel: 'ntp/render.js', text: "const prefix = 'ok';\nconst x = `${await import('../scripts/legacy-reader-frozen.mjs')}`;\n" }], 'B-10@2');
  check('template literal text mentioning the frozen reader is NOT flagged',
    [{ rel: 'ntp/render.js', text: "const note = `import('../scripts/legacy-reader-frozen.mjs')`;\n" }], '');
  check('code import.meta followed by template text is NOT bridged into a match',
    [{ rel: 'ntp/render.js', text: "const label = `${import.meta.url} from '../scripts/legacy-reader-frozen.mjs'`;\n" }], '');
  check('a "from" substring inside the specifier path does not hide the import',
    [
      { rel: 'ntp/render.js', text: "import '../from/legacy-reader-frozen.mjs';\n" },
      { rel: 'ntp/popups.js', text: "const m = await import('../from/legacy-reader-frozen.mjs');\n" },
      { rel: 'background.js', text: "export * from './from/legacy-reader-frozen.mjs';\n" },
    ], 'B-10@1,B-10@1,B-10@1');
  return { bad, lines };
}

const argv = process.argv.slice(2);
if (argv.includes('--self-test')) {
  const self = selfTest();
  for (const line of self.lines) console.log(line);
  console.log(`self-test: ${self.bad === 0 ? 'PASS' : 'FAIL'} (${self.lines.length - self.bad}/${self.lines.length})`);
  process.exit(self.bad === 0 ? 0 : 1);
}

function parseImport(line) {
  const match = line.match(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]\s*;?\s*$/);
  return match?.[1] || null;
}

for (const file of files) {
  const lines = fs.readFileSync(path.join(ntpDir, file), 'utf8').split(/\r?\n/);
  linesByFile.set(file, lines);
  lines.forEach((line, index) => {
    const specifier = parseImport(line);
    if (!specifier) return;
    if (/background(?:\.js)?$/.test(specifier)) add('B-4', `ntp/${file}`, index + 1, `background import is forbidden: ${specifier}`);
    if (!specifier.startsWith('.')) return;
    const target = path.normalize(path.join(path.dirname(file), specifier)).replaceAll('\\', '/').replace(/\.js$/, '');
    if (nodes.has(`${target}.js`)) edges.get(file).push(`${target}.js`);
  });
}

const isolationSources = files.map((file) => ({ rel: `ntp/${file}`, text: linesByFile.get(file).join('\n') }));
isolationSources.push({ rel: 'background.js', text: fs.readFileSync(path.join(root, 'background.js'), 'utf8') });
for (const violation of analyzeIsolation(isolationSources)) add(violation.rule, violation.file, violation.line, violation.message);

const leaves = new Set(['state.js', 'utils.js', 'credentials.js', 'favicon.js', 'i18n.js', 'storage.js', 'site-constants.js', 'url-title.js']);
for (const file of leaves) for (const target of edges.get(file) || []) {
  if (file === 'storage.js' && target === 'utils.js') continue;
  add('B-1', `ntp/${file}`, 0, `leaf module imports sibling module ${target}`);
}
for (const file of files) {
  const lines = linesByFile.get(file);
  if (/^(index|barrel)\.js$/i.test(file)) add('B-3', `ntp/${file}`, 1, 'barrel-style module is forbidden');
  let blockComment = false;
  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (/^export\s+\*\s+from\b/.test(trimmed) || /^export\s*\{[^}]*\bas\b[^}]*\}\s*from\b/.test(trimmed)) add('B-3', `ntp/${file}`, index + 1, 'barrel-style re-export is forbidden');
    if (blockComment) { if (raw.includes('*/')) blockComment = false; return; }
    if (raw.includes('/*')) { blockComment = !raw.includes('*/'); return; }
    if (!['storage.js', 'ntp.js'].includes(file) && /\b(?:layoutStorage|chrome\.storage\.(?:local|sync))\b/.test(raw) && !/^\s*(?:\/\/|\*|\/\*)/.test(raw)) add('B-5', `ntp/${file}`, index + 1, 'storage must be accessed through storage.js facade');
    if (/\b(?:chrome|browser)\./.test(raw)) {
      // credentials.js (ticket 81 , rework 81R): the per-install credential key (PIK) is
      // persisted under an independent chrome.storage.local key (boxingCredKey.v1) OUTSIDE the
      // layout, so it never enters buildSyncPayload/buildExportEnvelope/snapshots (offline-copy
      // attack surface closed). Conditional whitelist: ONLY the cross-browser storage probe idiom
      // (typeof chrome/browser !== 'undefined' && chrome/browser.storage) plus storage.local
      // get/set pass — the minimal PIK access chain. Any other browser API in credentials.js
      // (runtime, tabs, storage.sync direct use, ...) still violates B-6 (rule not weakened).
      const allowed = file === 'ntp.js' || file === 'sync-engine.js'
        || (file === 'popups.js' && /openBookmarksInNewTabs/.test(raw))
        || (file === 'credentials.js' && /typeof\s(?:chrome|browser)\s!==\s'undefined'\s&&\s(?:chrome|browser)\.storage|storage\.local\.(?:get|set)\b/.test(raw));
      if (!allowed && !/^\s*(?:\/\/|\*|\/\*)/.test(raw)) add('B-6', `ntp/${file}`, index + 1, 'direct browser API access is outside the whitelist');
    }
  });
}

const visiting = new Set();
const visited = new Set();
const stack = [];
function visit(file) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    add('B-2', `ntp/${file}`, 0, `import cycle: ${stack.slice(start).concat(file).join(' -> ')}`);
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file); stack.push(file);
  for (const target of edges.get(file) || []) visit(target);
  stack.pop(); visiting.delete(file); visited.add(file);
}
files.forEach(visit);
for (const [file, targets] of edges) for (const target of targets) {
  if (target === 'ntp.js') add('B-1', `ntp/${file}`, 0, 'feature module must not import entry module');
}

const facades = ['conn-layer.js', 'popups.js', 'credentials.js', 'sync-engine.js', 'settings-ui.js', 'onboarding.js', 'render.js', 'persist.js', 'storage.js'];
const facadeFunctions = { 'conn-layer.js': 'initConnFacade', 'popups.js': 'initPopupsFacade', 'credentials.js': 'initCredentialsFacade', 'sync-engine.js': 'initSyncEngineFacade', 'settings-ui.js': 'initSettingsUiFacade', 'onboarding.js': 'initOnboardingFacade', 'render.js': 'initRenderFacade', 'persist.js': 'initPersistFacade', 'storage.js': 'initStorageFacade' };
const entry = fs.readFileSync(path.join(ntpDir, 'ntp.js'), 'utf8');
for (const file of facades) {
  const fn = facadeFunctions[file];
  if (!linesByFile.get(file).some((line) => line.includes(`export function ${fn}(`))) add('B-7', `ntp/${file}`, 1, `missing ${fn}`);
  if (!entry.includes(`${fn}(`)) add('B-7', 'ntp/ntp.js', 1, `entry does not invoke ${fn}`);
}

const featureLeaves = new Set(['state.js', 'utils.js', 'credentials.js', 'favicon.js', 'i18n.js', 'storage.js', 'site-constants.js', 'url-title.js']);
const entryModule = 'ntp.js';
const acceptedFeatureSiblingEdges = new Set([
  'onboarding.js->render.js',
  'onboarding.js->settings-ui.js',
  'render.js->conn-layer.js',
  'render.js->persist.js',
  'render.js->popups.js',
  'settings-ui.js->conn-layer.js',
  'settings-ui.js->persist.js',
  'settings-ui.js->render.js',
  'sync-engine.js->render.js',
]);
for (const [file, targets] of edges) {
  for (const target of targets) {
    if (featureLeaves.has(file) || file === entryModule) continue;
    if (featureLeaves.has(target) || target === entryModule) continue;
    const key = `${file}->${target}`;
    if (!acceptedFeatureSiblingEdges.has(key)) add('B-9', `ntp/${file}`, 0, `unaccepted feature-to-feature sibling import: ${target} (feature-sibling import whitelist)`);
  }
}
for (const [file, names] of Object.entries({ 'sync-engine.js': ['__boxingIsSafeExtUrl', '__boxingTestWebDAV', '__boxingBackupWebDAV', '__boxingSyncWebDAV', '__bxSync', '__boxingFlushCredentials'], 'credentials.js': ['__boxingEncryptCredential', '__boxingDecryptCredential'] })) {
  for (const name of names) if (!linesByFile.get(file).some((line) => line.includes(name))) add('B-8', `ntp/${file}`, 1, `missing window contract ${name}`);
}

try {
  const mapping = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const specs = new Set(fs.readdirSync(testDir).filter((name) => name.endsWith('.spec.ts')));
  const covered = new Set();
  for (const [module, list] of Object.entries(mapping.clusters || {})) {
    if (!nodes.has(path.basename(module))) add('CM-2', 'test/cluster-map.json', 1, `unknown module cluster ${module}`);
    if (!Array.isArray(list) || list.length === 0) add('CM-2', 'test/cluster-map.json', 1, `empty cluster ${module}`);
    for (const spec of list || []) { covered.add(spec); if (!specs.has(spec)) add('CM-3', 'test/cluster-map.json', 1, `mapped spec does not exist: ${spec}`); }
  }
  for (const spec of specs) if (!covered.has(spec)) add('CM-1', 'test/cluster-map.json', 1, `spec is not covered by any cluster: ${spec}`);
} catch (error) { add('CM-1', 'test/cluster-map.json', 1, `cannot read mapping: ${error.message}`); }

const result = { ok: violations.length === 0, modules: files.length, edges: [...edges.values()].reduce((count, list) => count + list.length, 0), violations };
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
