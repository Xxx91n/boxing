// Boxing — Cross-platform extension packaging builder.
// Produces two browser-specific trees under dist/, each with a nested
// release/<browser>/ subdir holding 3 artifacts:
//   dist/boxing-chrome/release/chrome/  <- { boxing/, boxing-<ver>.zip, boxing-<ver>.crx }
//   dist/boxing-firefox/release/firefox/  <- { boxing/, boxing-<ver>.zip, boxing-<ver>.xpi }
// Cross-platform: no hardcoded absolute paths. Auto-discovers ROOT via __dirname.
// Zero third-party deps. Node fs + minimal STORE-mode zip writer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DIST = path.resolve(ROOT, "dist");

const SKIP = new Set([
  ".git", ".github", ".codex-tmp", ".codex", ".omx", ".codegraph",
  "node_modules", "dist", "package", "package.json", "package-lock.json",
  "playwright", "docs", "scripts", "release",
  "dev-chrome", "dev-firefox",
  "opencode.json",
  ".gitignore", ".gitattributes", "AGENTS.md", ".DS_Store", "Thumbs.db"
]);

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    if (ent.isFile() && (ent.name.startsWith("README.") || ent.name.startsWith("CHANGELOG.") || ent.name.startsWith("BUILD_INFO."))) continue;
    if (ent.isFile() && ent.name.endsWith(".md") && ent.name !== "LICENSE") continue;
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

function tailorManifest(base, browser) {
  const m = JSON.parse(JSON.stringify(base));
  if (browser === "firefox") {
    m.background = { scripts: ["background.js"], type: "module" };
    if (!m.browser_specific_settings) m.browser_specific_settings = {};
    m.browser_specific_settings.gecko = Object.assign({
      id: "{2F5A8F1E-9B3C-4D7E-A2B1-6F4C8E9D3A7F}",
      strict_min_version: "109.0"
    }, m.browser_specific_settings.gecko || {});
    if (!m.permissions.includes("browserSettings")) m.permissions.push("browserSettings");
  } else if (browser === "chrome") {
    m.background = { service_worker: "background.js" };
    if (m.browser_specific_settings) delete m.browser_specific_settings;
    m.permissions = (m.permissions || []).filter(p => p !== "browserSettings");
  }
  if (process.env.BOXING_BUILD_VERSION) m.version = process.env.BOXING_BUILD_VERSION;
  return m;
}

function writeManifest(dir, manifest) {
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

// Minimal STORE-mode zip writer (zero third-party deps).
const crc32Table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crc32Table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; }
function zipWrite(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.rel.split(path.sep).join("/"), "utf8");
    const crc = crc32(f.data);
    const local = Buffer.concat([
      Buffer.from([0x50,0x4b,0x03,0x04]), u16(20), u16(0), u16(0), u16(0),
      u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length),
      u16(nameBuf.length), u16(0), nameBuf, f.data,
    ]);
    chunks.push(local);
    central.push(Buffer.concat([
      Buffer.from([0x50,0x4b,0x01,0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.data.length), u32(f.data.length),
      u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBuf,
    ]));
    offset += local.length;
  }
  const cenStart = offset;
  const cenBuf = Buffer.concat(central);
  const end = Buffer.concat([
    Buffer.from([0x50,0x4b,0x05,0x06]), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cenBuf.length), u32(cenStart), u16(0),
  ]);
  return Buffer.concat([...chunks, cenBuf, end]);
}

function collectFiles(dir) {
  const out = [];
  function walk(d, base) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(ent.name)) continue;
      if (ent.isFile() && (ent.name.startsWith("README.") || ent.name.startsWith("CHANGELOG.") || ent.name.startsWith("BUILD_INFO."))) continue;
      if (ent.isFile() && ent.name.endsWith(".md") && ent.name !== "LICENSE") continue;
      const p = path.join(d, ent.name);
      const rel = base ? base + "/" + ent.name : ent.name;
      if (ent.isDirectory()) walk(p, rel);
      else if (ent.isFile()) out.push({ abs: p, rel });
    }
  }
  walk(dir, "");
  return out;
}

function buildBrowser(browser, baseManifest, sourceDir) {
  const manifest = tailorManifest(baseManifest, browser);
  const version = manifest.version;
  const buildDir = path.join(DIST, "boxing-" + browser);
  const releaseDir = path.join(buildDir, "release", browser);
  fs.rmSync(releaseDir, { recursive: true, force: true });
  fs.mkdirSync(releaseDir, { recursive: true });

  const extDir = path.join(releaseDir, "boxing");
  copyTree(sourceDir, extDir);
  writeManifest(extDir, manifest);

  const collected = collectFiles(extDir);
  const zipFiles = collected.map(f => {
    const rel = f.rel.split(path.sep).join("/");
    let data = fs.readFileSync(f.abs);
    if (path.basename(f.abs) === "manifest.json" && path.dirname(f.abs) === extDir) {
      data = Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");
    }
    return { rel, data };
  });
  const zipBuf = zipWrite(zipFiles);
  fs.writeFileSync(path.join(releaseDir, "boxing-" + version + ".zip"), zipBuf);

  if (browser === "chrome") {
    fs.writeFileSync(path.join(releaseDir, "boxing-" + version + ".crx"), zipBuf);
    console.log("CRX placeholder written. CI signs via CRX_PRIVATE_KEY_PEM, or use chrome --pack-extension locally.");
  } else {
    fs.writeFileSync(path.join(releaseDir, "boxing-" + version + ".xpi"), zipBuf);
    console.log("XPI is unsigned dev build. Use web-ext sign with AMO_API_KEY/AMO_API_SECRET for production.");
  }
  return {
    extDir,
    zip: path.join(releaseDir, "boxing-" + version + ".zip"),
    pack: path.join(releaseDir, "boxing-" + version + (browser === "chrome" ? ".crx" : ".xpi")),
  };
}

function build() {
  const baseManifestPath = path.join(ROOT, "manifest.json");
  if (!fs.existsSync(baseManifestPath)) throw new Error("manifest.json not found at " + baseManifestPath);
  const base = JSON.parse(fs.readFileSync(baseManifestPath, "utf8"));
  console.log("Base manifest version:", base.version);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const chromeDir = path.join(DIST, "boxing-chrome");
  const firefoxDir = path.join(DIST, "boxing-firefox");
  copyTree(ROOT, chromeDir);
  copyTree(ROOT, firefoxDir);
  const chrManifest = tailorManifest(base, "chrome");
  const ffManifest = tailorManifest(base, "firefox");
  writeManifest(chromeDir, chrManifest);
  writeManifest(firefoxDir, ffManifest);

  let commit = "unknown";
  try { commit = execSync("git -C " + ROOT + " rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch (_) {}
  let branch = "unknown";
  try { branch = execSync("git -C " + ROOT + " rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim(); } catch (_) {}
  const info = { builtAt: new Date().toISOString(), commit, branch, source: ROOT };
  for (const dir of [chromeDir, firefoxDir]) {
    fs.writeFileSync(path.join(dir, "BUILD_INFO.json"), JSON.stringify(info, null, 2) + "\n", "utf8");
  }

  const chr = buildBrowser("chrome", base, chromeDir);
  const ff = buildBrowser("firefox", base, firefoxDir);

  console.log("DONE_BUILD");

  // ── Create dev-load junctions/symlinks for browser GUI loading ──
  // dev-chrome -> dist/boxing-chrome, dev-firefox -> dist/boxing-firefox
  // Users can load ~\boxing\dev-chrome in Chrome, ~\boxing\dev-firefox in Firefox
  const devLinks = [
    { name: "dev-chrome", target: chromeDir },
    { name: "dev-firefox", target: firefoxDir },
  ];
  for (const link of devLinks) {
    const linkPath = path.join(ROOT, link.name);
    try {
      if (fs.existsSync(linkPath) || fs.lstatSync(linkPath, { throwIfNoEntry: false })) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
      if (process.platform === "win32") {
        execSync('mklink /J "' + linkPath + '" "' + link.target + '"', { stdio: "pipe" });
      } else {
        fs.symlinkSync(link.target, linkPath, "dir");
      }
      console.log("  dev link: " + linkPath + " -> " + link.target);
    } catch (e) {
      console.log("  dev link skipped: " + link.name + " (" + e.message + ")");
    }
  }

  console.log("Chrome release:");
  console.log("  " + chr.extDir);
  console.log("  " + chr.zip);
  console.log("  " + chr.pack);
  console.log("Firefox release:");
  console.log("  " + ff.extDir);
  console.log("  " + ff.zip);
  console.log("  " + ff.pack);
}

build();