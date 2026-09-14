#!/usr/bin/env node
// Ticket 102 (architecture-recovery) - A-056 / B66: 亮色 bm-add-btn 对比度门禁。
//
// 为什么是"构建期 token 配对断言"而不是只靠浏览器测试:
//   axe-core 的 color-contrast 规则只覆盖 SC 1.4.3 文本, 且对渐变/伪元素/opacity 标记
//   incomplete; 目前没有任何主流自动化工具原生检查 SC 1.4.11 的非文本(边框)对比度。
//   工业界(Carbon #2729 / design-system-generator / Primer)把这道门放在 TOKEN 层:
//   对前景/背景配对离线跑 WCAG 相对亮度, 不达标即构建失败。本脚本是本仓第一道门,
//   与 test/tests/boxing-empty-state-buttons.spec.ts 的运行时 DOM 断言(第三道门)互补。
//
// 被检契约(从 CSS 源文件读出, 不硬编码颜色 —— 改回 hairline 会立刻红):
//   1. ntp/base.css      .bm-add-row .bm-add-btn             亮色 rest
//   2. ntp/base.css      .bm-add-row .bm-add-btn:hover       亮色 hover
//   3. ntp/settings.css  .ntp--dark .bm-add-row .bm-add-btn        暗色 rest
//   4. ntp/settings.css  .ntp--dark .bm-add-row .bm-add-btn:hover  暗色 hover
//
// 判定面: 三种 surface(canvas / canvas-2 / elevated)全部达标才算过, 报告取最坏值。
//   文本 >= 4.5:1 (SC 1.4.3; 本按钮 13px/500 属常规文本)
//   边界 >= 3.0:1 (SC 1.4.11; W3C 细线抗锯齿 Note 要求留余量, 故额外打印 margin)
//
// 接入: package.json 的 pretest(与 import-graph-guard / migration-golden-guard /
//   css-balance-guard / calver-guard 同一阻断纪律)。
//
// Usage: node scripts/contrast-guard.mjs [--json]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NL = String.fromCharCode(10);

const DS_REL = "ntp/design-system.css";
const BASE_REL = "ntp/base.css";
const SETTINGS_REL = "ntp/settings.css";

const TEXT_MIN = 4.5;      // SC 1.4.3 Contrast (Minimum)
const BOUNDARY_MIN = 3.0;  // SC 1.4.11 Non-text Contrast

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error("missing source: " + rel);
  return fs.readFileSync(p, "utf8");
}

// 注释里写了十六进制样例与比值, 解析前必须剥掉, 否则注释会被误当成声明。
function stripComments(css) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css.charAt(i) === "/" && css.charAt(i + 1) === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 2;
    } else { out += css.charAt(i); i++; }
  }
  return out;
}

function blockBody(css, selector) {
  const idx = css.indexOf(selector);
  if (idx < 0) return null;
  let open = -1;
  for (let i = idx + selector.length; i < css.length; i++) {
    if (css.charAt(i) === "{") { open = i; break; }
    if (css.charAt(i) === ";") return null;
  }
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css.charAt(i) === "{") depth++;
    else if (css.charAt(i) === "}") { depth--; if (depth === 0) return css.slice(open + 1, i); }
  }
  return null;
}

function parseTokens(css, selector) {
  const body = blockBody(css, selector);
  if (body == null) throw new Error("token block not found: " + selector);
  const out = {};
  for (const raw of body.split(NL)) {
    const line = raw.trim();
    if (line.indexOf("--") !== 0) continue;
    const c = line.indexOf(":");
    const semi = line.lastIndexOf(";");
    if (c < 0 || semi < 0) continue;
    out[line.slice(0, c).trim()] = line.slice(c + 1, semi).trim();
  }
  return out;
}

function decl(body, prop) {
  for (const raw of body.split(NL)) {
    const line = raw.trim();
    if (line.indexOf(prop + ":") !== 0) continue;
    let v = line.slice(prop.length + 1).trim();
    if (v.charAt(v.length - 1) === ";") v = v.slice(0, -1).trim();
    return v;
  }
  return null;
}

// border 用的是 shorthand "1px dashed var(--x)" -> 抽出其中的 var()
function borderColor(body) {
  const b = decl(body, "border");
  if (b) {
    const i = b.indexOf("var(");
    if (i >= 0) {
      const rest = b.slice(i + 4);
      const close = rest.indexOf(")");
      if (close > 0) return "var(" + rest.slice(0, close).trim() + ")";
    }
    const parts = b.trim().split(String.fromCharCode(32));
    return parts[parts.length - 1];
  }
  return decl(body, "border-color") || decl(body, "border-top-color");
}

function resolve(raw, tokens, seen) {
  seen = seen || [];
  const v = String(raw).trim();
  if (v.indexOf("var(") === 0 && v.charAt(v.length - 1) === ")") {
    const inner = v.slice(4, -1);
    const comma = inner.indexOf(",");
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    if (name.indexOf("--") === 0) {
      if (seen.indexOf(name) >= 0) throw new Error("token cycle: " + name);
      const next = tokens[name];
      if (next == null) throw new Error("unresolved token: " + name);
      return resolve(next, tokens, seen.concat([name]));
    }
    if (comma >= 0) return resolve(inner.slice(comma + 1).trim(), tokens, seen);
  }
  if (v.charAt(0) === "#") {
    const h = v.slice(1);
    const full = h.length === 3 ? (h.charAt(0)+h.charAt(0)+h.charAt(1)+h.charAt(1)+h.charAt(2)+h.charAt(2)) : h;
    return { r: parseInt(full.slice(0,2),16), g: parseInt(full.slice(2,4),16), b: parseInt(full.slice(4,6),16), a: 1 };
  }
  if (v.indexOf("rgb") === 0 && v.indexOf("(") > 0) {
    const inner = v.slice(v.indexOf("(") + 1, v.lastIndexOf(")"));
    const parts = inner.split(",").map(function (x) { return x.trim(); });
    // 注意: rgba(var(--x-rgb), 0.10) 的 parts 长度是 2, 不是 4 —— rgb 三元组打包在第 0 段。
    if (parts[0].indexOf("var(") === 0) {
      const name = parts[0].slice(4, parts[0].lastIndexOf(")")).trim();
      const raw3 = tokens[name];
      if (raw3 == null) throw new Error("unresolved rgb token: " + name);
      const triple = raw3.split(",").map(function (x) { return parseFloat(x.trim()); });
      // rgba(var(--x-rgb), a) 只有两段: 第 0 段是打包的 rgb 三元组, 第 1 段才是 alpha。
      const a = parts.length > 1 ? parseFloat(parts[1]) : 1;
      return { r: triple[0], g: triple[1], b: triple[2], a: a };
    }
    const nums = parts.map(parseFloat);
    return { r: nums[0], g: nums[1], b: nums[2], a: parts.length > 3 ? nums[3] : 1 };
  }
  throw new Error("unsupported color value: " + v);
}

function lum(c) {
  const f = function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function over(fg, bg) {
  return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
}
function fmt(n) { return n.toFixed(2); }

function main() {
  const ds = stripComments(read(DS_REL));
  const base = stripComments(read(BASE_REL));
  const settings = stripComments(read(SETTINGS_REL));

  const light = parseTokens(ds, ":root");
  const darkTokens = parseTokens(ds, ".ntp--dark");
  const dark = {};
  for (const k of Object.keys(light)) dark[k] = light[k];
  for (const k of Object.keys(darkTokens)) dark[k] = darkTokens[k];

  const SEL = ".bm-add-row .bm-add-btn";
  const DSEL = ".ntp--dark .bm-add-row .bm-add-btn";

  const rules = [
    { name: "base.css " + SEL, body: blockBody(base, SEL) },
    { name: "base.css " + SEL + ":hover", body: blockBody(base, SEL + ":hover") },
    { name: "settings.css " + DSEL, body: blockBody(settings, DSEL) },
    { name: "settings.css " + DSEL + ":hover", body: blockBody(settings, DSEL + ":hover") },
  ];
  for (const r of rules) {
    if (r.body == null) { console.error("[contrast-guard] rule not found: " + r.name); process.exit(1); }
  }

  const SURFACES = ["--color-canvas", "--color-canvas-2", "--color-elevated"];
  const themes = [
    { name: "light", tokens: light, rest: rules[0].body, hover: rules[1].body },
    { name: "dark", tokens: dark, rest: rules[2].body, hover: rules[3].body },
  ];

  const rows = [];
  const failures = [];

  for (const theme of themes) {
    const t = theme.tokens;
    const glyph = resolve(decl(theme.rest, "color"), t);
    const border = resolve(borderColor(theme.rest), t);
    const hoverBg = resolve(decl(theme.hover, "background"), t);
    const hoverGlyph = resolve(decl(theme.hover, "color"), t);
    const hoverBorder = resolve(borderColor(theme.hover), t);
    for (const sName of SURFACES) {
      const surface = resolve("var(" + sName + ")", t);
      const fill = over(hoverBg, surface);
      const checks = [
        { row: theme.name + " rest glyph", surface: sName, value: ratio(over(glyph, surface), surface), min: TEXT_MIN },
        { row: theme.name + " rest border", surface: sName, value: ratio(over(border, surface), surface), min: BOUNDARY_MIN },
        { row: theme.name + " hover glyph", surface: sName, value: ratio(over(hoverGlyph, fill), fill), min: TEXT_MIN },
        { row: theme.name + " hover border", surface: sName, value: ratio(over(hoverBorder, fill), fill), min: BOUNDARY_MIN },
      ];
      for (const c of checks) {
        rows.push(c);
        if (c.value < c.min) failures.push(c);
      }
    }
  }

  if (process.argv.indexOf("--json") >= 0) {
    console.log(JSON.stringify({ ok: failures.length === 0, rows: rows, failures: failures }, null, 2));
    process.exit(failures.length ? 1 : 0);
  }

  const worst = {};
  const order = [];
  for (const r of rows) {
    if (worst[r.row] === undefined) { order.push(r.row); worst[r.row] = r; }
    else if (r.value < worst[r.row].value) worst[r.row] = r;
  }
  console.log("[contrast-guard] bm-add-btn token pairing (worst of canvas / canvas-2 / elevated)");
  for (const k of order) {
    const w = worst[k];
    const ok = w.value >= w.min ? "PASS" : "FAIL";
    let pad = k;
    while (pad.length < 20) pad += " ";
    console.log("  " + ok + "  " + pad + " " + fmt(w.value) + ":1  (min " + w.min + ":1, worst surface " + w.surface + ")");
  }
  if (failures.length) {
    console.error(NL + "[contrast-guard] FAILED " + failures.length + " pairing(s):");
    for (const f of failures) console.error("  - " + f.row + " on " + f.surface + ": " + fmt(f.value) + ":1 < " + f.min + ":1");
    console.error(NL + "Fix the token pairing in ntp/base.css / ntp/settings.css / ntp/design-system.css.");
  } else {
    console.log("[contrast-guard] OK - SC 1.4.3 (>=4.5:1) and SC 1.4.11 (>=3:1) satisfied in both themes.");
  }
  process.exit(failures.length ? 1 : 0);
}

try {
  main();
} catch (e) {
  console.error("[contrast-guard] error: " + (e && e.message ? e.message : e));
  process.exit(1);
}
