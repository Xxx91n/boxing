// Boxing — assemble the GitHub Pages demo artifact (ticket 07 pages-demo).
// Run by .github/workflows/demo-deploy.yml. Builds happen in CI only; the
// local tree is never built. Output layout: <out>/index.html (placeholder
// landing) + <out>/privacy-policy.html (ticket 47, store-required) +
// <out>/demo/** (NTP static mirror).
import fs from "node:fs";
import path from "node:path";
import { buildNtpCss } from "./ntp-css.mjs";

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

// ── Ticket 47: fail-closed artifact generation ──
// ntp.css is a gitignored build artifact (ADR-0011): a clean CI checkout has
// no ntp/ntp.css, so regenerate it via the shared build entry before the ntp
// mirror runs. The privacy policy is rendered from docs/privacy-policy.md
// because Actions-mode Pages serves only this artifact (no Jekyll docs/).
buildNtpCss(ROOT);
const ntpCssSrc = path.join(ROOT, "ntp", "ntp.css");
if (!fs.existsSync(ntpCssSrc) || fs.statSync(ntpCssSrc).size === 0) {
  console.error("FATAL: ntp/ntp.css missing or empty — demo would ship without styles");
  process.exit(1);
}
const ppSrc = path.join(ROOT, "docs", "privacy-policy.md");
if (!fs.existsSync(ppSrc) || fs.statSync(ppSrc).size === 0) {
  console.error("FATAL: docs/privacy-policy.md missing — store privacy URL would 404");
  process.exit(1);
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

// privacy-policy.html — store submissions hard-link
// https://xxx91n.github.io/boxing/privacy-policy.html (ticket 47). Rendered
// from docs/privacy-policy.md with a minimal Markdown subset (headings,
// bullets, bold, inline code, links); no new npm dependencies (CRX-R-009).
const ppHtml = renderPrivacyPolicy(fs.readFileSync(ppSrc, "utf8"));
if (!ppHtml.includes("Boxing Privacy Policy") || !ppHtml.includes("Last updated")) {
  console.error("FATAL: rendered privacy-policy.html missing required content");
  process.exit(1);
}
const ppOut = path.join(OUT, "privacy-policy.html");
fs.writeFileSync(ppOut, ppHtml, "utf8");

function renderPrivacyPolicy(md) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  const body = [];
  let inList = false;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const li = line.match(/^- (.*)$/);
    if (li) {
      if (!inList) { body.push("<ul>"); inList = true; }
      body.push("  <li>" + inline(li[1]) + "</li>");
      continue;
    }
    if (inList) { body.push("</ul>"); inList = false; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const n = h[1].length;
      body.push("<h" + n + ">" + inline(h[2]) + "</h" + n + ">");
      continue;
    }
    if (!line.trim()) continue;
    body.push("<p>" + inline(line) + "</p>");
  }
  if (inList) body.push("</ul>");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>Boxing Privacy Policy</title>",
    "  <style>",
    "    body { max-width: 46rem; margin: 2rem auto; padding: 0 1rem;",
    "           font: 16px/1.6 system-ui, sans-serif; color: #3a3226; background: #f4f0e8; }",
    "    code { background: rgba(0,0,0,.06); padding: 0 .25rem; border-radius: 3px; }",
    "  </style>",
    "</head>",
    "<body>",
    ...body,
    "</body>",
    "</html>",
  ].join("\n") + "\n";
}

console.log(JSON.stringify({
  out: path.relative(ROOT, OUT),
  version,
  versionSource,
  builtAt,
  ntpCssBytes: fs.statSync(ntpCssSrc).size,
  privacyPolicyBytes: fs.statSync(ppOut).size,
}));
