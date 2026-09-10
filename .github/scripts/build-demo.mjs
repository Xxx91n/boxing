// Boxing — assemble the GitHub Pages demo artifact (ticket 07 pages-demo).
// Run by .github/workflows/demo-deploy.yml. Builds happen in CI only; the
// local tree is never built. Output layout: <out>/index.html (placeholder
// landing) + <out>/demo/** (NTP static mirror).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function arg(name, dflt) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const OUT = path.resolve(ROOT, arg("out", "pages-artifact"));
const releaseTag = (process.env.RELEASE_TAG || "").trim();
const inputVersion = (process.env.VERSION_INPUT || "").trim();
let version = "";
let versionSource = "";
if (inputVersion) {
  version = inputVersion;
  versionSource = "workflow_dispatch";
} else if (releaseTag) {
  version = releaseTag;
  versionSource = "release";
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  version = manifest.version;
  versionSource = "manifest";
}
const builtAt = new Date().toISOString();

function copyFile(src, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, path.basename(src)));
}
function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
const DEMO = path.join(OUT, "demo");
fs.mkdirSync(DEMO, { recursive: true });

// ntp mirror: every file except index.html (regenerated below)
for (const ent of fs.readdirSync(path.join(ROOT, "ntp"))) {
  const s = path.join(ROOT, "ntp", ent);
  if (!fs.statSync(s).isFile() || ent === "index.html") continue;
  copyFile(s, DEMO);
}
// locale dictionaries (i18n.js fetches _locales/<lang>/messages.json)
copyTree(path.join(ROOT, "_locales"), path.join(DEMO, "_locales"));
// chrome.* web stub
copyFile(path.join(ROOT, "demo", "chrome-stub.js"), DEMO);

let html = fs.readFileSync(path.join(ROOT, "ntp", "index.html"), "utf8");
const moduleTag = '<script type="module" src="ntp.js"></script>';
if (!html.includes(moduleTag)) {
  console.error("FATAL: ntp.js module tag not found in ntp/index.html");
  process.exit(1);
}
html = html.replace(moduleTag, '<script src="chrome-stub.js"></script>\n' + moduleTag);
const banner = '<body>\n' +
  '  <div id="boxing-demo-banner" style="position:fixed;top:0;left:0;right:0;z-index:9999;' +
  'text-align:center;padding:6px 12px;background:rgba(244,239,229,.92);color:#3a3226;' +
  'font:13px/1.4 system-ui,sans-serif;border-bottom:1px solid rgba(0,0,0,.08);">' +
  'Boxing web preview &mdash; a static demo; the layout is stored only in this browser. ' +
  '<a href="https://github.com/Xxx91n/boxing" style="color:#c2410c">Get the extension</a></div>';
if (!html.includes("<body>")) {
  console.error("FATAL: <body> tag not found in ntp/index.html");
  process.exit(1);
}
html = html.replace("<body>", banner);
fs.writeFileSync(path.join(DEMO, "index.html"), html, "utf8");

// version.json = release tag (or dispatch input, then manifest fallback)
fs.writeFileSync(
  path.join(DEMO, "version.json"),
  JSON.stringify({ version, source: versionSource, builtAt }, null, 2) + "\n",
  "utf8",
);

// placeholder landing — see demo/README.md; full landing parity is a
// follow-up ticket (the ticket 06 docs/index.md is Jekyll-rendered, and
// switching Pages to an Actions source stops Jekyll builds).
const landing = [
  "<!doctype html>",
  '<html lang="en">',
  "<head>",
  '  <meta charset="utf-8">',
  "  <title>Boxing</title>",
  '  <meta http-equiv="refresh" content="0; url=./demo/">',
  '  <link rel="canonical" href="https://xxx91n.github.io/boxing/demo/">',
  "</head>",
  "<body>",
  '  <p>Boxing &mdash; <a href="./demo/">open the live preview</a> &middot; ' +
  '<a href="https://github.com/Xxx91n/boxing">source</a></p>',
  "</body>",
  "</html>",
].join("\n");
fs.writeFileSync(path.join(OUT, "index.html"), landing + "\n", "utf8");

console.log(JSON.stringify({ out: path.relative(ROOT, OUT), version, versionSource, builtAt }));
