// Boxing — extension package builder.
// Produces two browser-specific build directories under dist/, each with a
// browser-tailored manifest.json. Used by .github/workflows/build.yml to emit
// 4 release artifacts: boxing-chrome.zip + boxing-chrome.crx, boxing-firefox.zip + boxing-firefox.xpi.
// Note: runs only on manual dispatch — does not auto-trigger.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DIST = path.resolve(ROOT, "dist");

const SKIP = new Set([
  ".git", ".github", ".codex-tmp", ".codex", ".omx", ".codegraph",
  "node_modules", "dist", "package", "playwright", "docs",
  "opencode.json", "README.md", "LICENSE",
  ".gitignore", ".gitattributes", "AGENTS.md"
]);

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
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
  writeManifest(chromeDir, tailorManifest(base, "chrome"));
  writeManifest(firefoxDir, tailorManifest(base, "firefox"));
  // BX-DEV-129 (B15): write a BUILD_INFO.json into each dist so users loading
  // a packaged extension can confirm the dist matches the source they expect
  // (the recurring "dist shows old onboarding UI" was a stale-disk issue; this
  // makes staleness observable without diffing files).
  let commit = "unknown";
  try { commit = execSync("git -C " + ROOT + " rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch (_) {}
  const branch = (() => { try { return execSync("git -C " + ROOT + " rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim(); } catch (_) { return "unknown"; } })();
  const info = { builtAt: new Date().toISOString(), commit, branch, source: "D:\\Aworker\\crx\\boxing" };
  for (const dir of [chromeDir, firefoxDir]) {
    fs.writeFileSync(path.join(dir, "BUILD_INFO.json"), JSON.stringify(info, null, 2) + "\n", "utf8");
  }
  console.log("Build dirs created:");
  console.log(" -", chromeDir);
  console.log(" -", firefoxDir);
  console.log("DONE_BUILD");
}

build();
