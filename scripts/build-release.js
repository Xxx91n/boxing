#!/usr/bin/env node
// Local release builder for Boxing (MV3) — produces 4 artifacts under ~/box/release/{firefox,chrome}:
//   ~/box/release/chrome/boxing/                 ← unpacked extension directory
//   ~/box/release/chrome/boxing-<ver>.zip         ← Chromium load-extension zip
//   ~/box/release/firefox/boxing/                 ← unpacked extension directory (xpi source)
//   ~/box/release/firefox/boxing-<ver>.xpi         ← Firefox install file (zip with .xpi extension)
// No third-party deps. Uses Node fs + a minimal zip writer (STORE, no compression — sufficient for
// extension distribution; keeps the script self-contained and ~50 lines).
// Usage:  node scripts/build-release.js

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
// v3.7.0+: output to ~/box/release as user-requested, fallback to <project>/release if HOME unset.
const RELEASE_ROOT = path.resolve(os.homedir() || __dirname, 'box', 'release');
// Ensure ~/box/release exists; mkdir -p semantics.
(function ensureReleaseRoot() {
  try {
    const parts = RELEASE_ROOT.split(path.sep);
    let cur = parts[0] || path.sep;
    for (let i = 1; i < parts.length; i++) {
      cur = path.join(cur, parts[i]);
      if (!fs.existsSync(cur)) fs.mkdirSync(cur, { recursive: true });
    }
  } catch (e) { /* fail-soft — build will create subdirs later anyway */ }
})();
const IGNORE = new Set(['.git', '.github', 'node_modules', '.codex-tmp', '.codex-tmp-onb.log',
  '.codex-final.log', '.codex-misc.log', '.codex-tmp-repro.log', 'playwright-report', 'test-results',
  'dist', 'build', 'out', 'release', '~box', 'docs', 'opencode.json',
  '.omx', 'scripts', 'package-lock.json', 'package.json', 'AGENTS.md', '.codegraph', '.gitignore',
  '.gitattributes', 'tools']);
const EXTS = new Set(['.js', '.json', '.html', '.css', '.svg', '.png', '.ico', '.webp', '.txt', '.md']);

function walk(src, base, out) {
  for (const name of fs.readdirSync(src, { withFileTypes: true })) {
    const entryName = name.name;
    if (IGNORE.has(entryName)) continue;
    if (entryName.startsWith('README.') && entryName.endsWith('.md')) continue;    // multi-language READMEs are repo-doc only, not bundled
    if (entryName === 'CHANGELOG.md') continue;
    // BX-DEV-120: include top-level LICENSE (no extension) in extension bundle for compliance.
    if (entryName === 'LICENSE') { out.push([path.join(src, entryName), base ? base + '/' + entryName : entryName]); continue; }
    const p = path.join(src, entryName);
    const rel = base ? base + '/' + entryName : entryName;
    if (name.isDirectory()) { walk(p, rel, out); }
    else if (name.isFile()) {
      const ext = path.extname(entryName).toLowerCase();
      if (!EXTS.has(ext) && entryName !== 'manifest.json') continue;
      out.push([p, rel]);
    }
  }
}

function collect() {
  const out = [];
  walk(ROOT, '', out);
  return out;
}

// ── minimal STORE-mode zip writer (PKZIP 2.0) ─────────────────────────────
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u16(n){const b=Buffer.alloc(2);b.writeUInt16LE(n,0);return b;}
function u32(n){const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0,0);return b;}
function zipWrite(files) {
  // files: [{rel, data: Buffer}]
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.rel, 'utf8');
    const crc = crc32(f.data);
    const local = Buffer.concat([
      Buffer.from('PK\x03\x04'), u16(20), u16(0), u16(0), u16(0),
      u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length),
      u16(nameBuf.length), u16(0), nameBuf, f.data,
    ]);
    chunks.push(local);
    central.push(Buffer.concat([
      Buffer.from('PK\x01\x02'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.data.length), u32(f.data.length),
      u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBuf,
    ]));
    offset += local.length;
  }
  const cenStart = offset;
  const cenBuf = Buffer.concat(central);
  const end = Buffer.concat([
    Buffer.from('PK\x05\x06'), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cenBuf.length), u32(cenStart), u16(0),
  ]);
  return Buffer.concat([...chunks, cenBuf, end]);
}

function rmTree(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}
function mkdir(p){ fs.mkdirSync(p, { recursive: true }); }

function copyFilesToDir(srcList, dstDir) {
  for (const [abs, rel] of srcList) {
    const dst = path.join(dstDir, rel.split('/').join(path.sep));
    mkdir(path.dirname(dst));
    fs.copyFileSync(abs, dst);
  }
}


// Produce a browser-tailored copy of the base manifest.
// Source manifest is Chrome-safe (service_worker only, no Firefox-only permissions).
// Firefox build injects: background.scripts + browser_specific_settings.gecko + browserSettings permission.
function tailorManifestFor(base, browser) {
  const m = JSON.parse(JSON.stringify(base));
  if (browser === 'firefox') {
    // Match .github/scripts/build.mjs: Firefox build完全替换 background (not Object.assign).
    // Object.assign 会保留 service_worker 字段，Firefox 虽然忽略但 manifest 不应包含。
    m.background = { scripts: ['background.js'], type: 'module' };
    if (!m.browser_specific_settings) m.browser_specific_settings = {};
    m.browser_specific_settings.gecko = Object.assign({
      id: '{2F5A8F1E-9B3C-4D7E-A2B1-6F4C8E9D3A7F}',
      strict_min_version: '109.0'
    }, m.browser_specific_settings.gecko || {});
    if (!m.permissions.includes('browserSettings')) m.permissions.push('browserSettings');
  } else if (browser === 'chrome') {
    m.background = { service_worker: m.background?.service_worker || 'background.js' };
    delete m.browser_specific_settings;
    m.permissions = (m.permissions || []).filter(p => p !== 'browserSettings');
  }
  return m;
}

function writeManifestTo(dir, manifest) {
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function bytesWithManifest(fileList, manifest) {
  const mjson = JSON.stringify(manifest, null, 2) + '\n';
  return fileList.map(f => f.rel === 'manifest.json' ? { rel: 'manifest.json', data: Buffer.from(mjson, 'utf8') } : f);
}

function main() {
  const baseManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const ver = baseManifest.version;
  console.log('Building Boxing release v' + ver);

  const files = collect();
  if (!files.length) throw new Error('no files collected — wrong root?');

  // Tailor manifests per browser (source manifest stays Chrome-safe).
  const chrManifest = tailorManifestFor(baseManifest, 'chrome');
  const ffManifest  = tailorManifestFor(baseManifest, 'firefox');

  // chrome
  const chrDir = path.join(RELEASE_ROOT, 'chrome');
  rmTree(chrDir); mkdir(chrDir);
  const chrExtDir = path.join(chrDir, 'boxing');
  copyFilesToDir(files, chrExtDir);
  writeManifestTo(chrExtDir, chrManifest);
  const chrFiles = files.map(([abs, rel]) => ({ rel, data: fs.readFileSync(abs) }));
  fs.writeFileSync(path.join(chrDir, 'boxing-' + ver + '.zip'), zipWrite(bytesWithManifest(chrFiles, chrManifest)));

  // firefox (tailored manifest + .xpi extension)
  const ffDir = path.join(RELEASE_ROOT, 'firefox');
  rmTree(ffDir); mkdir(ffDir);
  const ffExtDir = path.join(ffDir, 'boxing');
  copyFilesToDir(files, ffExtDir);
  writeManifestTo(ffExtDir, ffManifest);
  const ffFiles = files.map(([abs, rel]) => ({ rel, data: fs.readFileSync(abs) }));
  fs.writeFileSync(path.join(ffDir, 'boxing-' + ver + '.xpi'), zipWrite(bytesWithManifest(ffFiles, ffManifest)));

  console.log('Wrote:');
  console.log('  ' + path.join(chrDir, 'boxing') + '  +  boxing-' + ver + '.zip');
  console.log('  ' + path.join(ffDir,  'boxing') + '  +  boxing-' + ver + '.xpi');
}
main();
