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

const leaves = new Set(['state.js', 'utils.js', 'credentials.js', 'favicon.js', 'i18n.js', 'storage.js']);
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
      // credentials.js (ticket 81 / A-031, rework 81R): the per-install credential key (PIK) is
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

const featureLeaves = new Set(['state.js', 'utils.js', 'credentials.js', 'favicon.js', 'i18n.js', 'storage.js']);
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
    if (!acceptedFeatureSiblingEdges.has(key)) add('B-9', `ntp/${file}`, 0, `unaccepted feature-to-feature sibling import: ${target} (whitelist ADR-0016 §errata-26)`);
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
