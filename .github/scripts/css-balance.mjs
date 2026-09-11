// Boxing — build-time CSS balance gate (ticket 53, spec D6, ledger A-010).
// Deterministic, zero-dep scanner for the two failure modes behind the
// 2026-09-12 freeze incident (docs/adr/0017 Context): a missing closing
// brace made CSS Nesting swallow every following top-level rule, and a
// [hidden] fallback pair nested inside a block never matches. Both are
// detectable from brace depth alone, so the gate is pure text analysis:
//   1. final brace depth != 0 for a source CSS file                  -> violation
//   2. depth going negative (stray closing brace)                    -> violation
//   3. a selector containing [hidden] that opens at depth >= 1       -> violation
// Entry points:
//   - .github/scripts/ntp-css.mjs   fail-closed before emitting ntp.css, which
//     covers every artifact path (build.mjs, --css-only, build-demo.mjs Pages).
//   - .github/scripts/build.mjs     A10 gate over the full SOURCE_CSS list.
//   - scripts/css-balance-guard.mjs pretest gate + negative self-check.
// Comments and quoted strings are skipped so braces/content inside them
// never affect depth or produce phantom [hidden] matches.
import fs from "node:fs";
import path from "node:path";

// Every shipped source CSS, repo-relative. ntp/ntp.css is excluded on
// purpose: it is a gitignored build artifact (ADR-0011) whose balance is
// derived from these inputs. New shipped .css sources join here, not in
// per-call-site lists.
export const SOURCE_CSS = [
  "ntp/base.css",
  "ntp/settings.css",
  "ntp/onboarding.css",
  "ntp/conn.css",
  "ntp/design-system.css",
  "popup/popup.css",
];

const HIDDEN_RE = /\[\s*hidden\s*\]/i;

// Scan one CSS text. Returns { finalDepth, strayCloses, nestedHidden }.
export function scanCssBalance(text) {
  const strayCloses = [];
  const nestedHidden = [];
  let depth = 0;
  let line = 1;
  let i = 0;
  let segStart = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      for (let k = i; k < stop; k++) if (text[k] === "\n") line++;
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < n && text[i] !== q) {
        if (text[i] === "\\") i++;
        if (text[i] === "\n") line++;
        i++;
      }
      i++;
      continue;
    }
    if (c === "{") {
      const prelude = text.slice(segStart, i).replace(/\/\*[\s\S]*?\*\//g, " ");
      if (depth >= 1 && HIDDEN_RE.test(prelude)) {
        nestedHidden.push({ line, depth, selector: prelude.replace(/\s+/g, " ").trim().slice(0, 120) });
      }
      depth++;
      segStart = i + 1;
      i++;
      continue;
    }
    if (c === "}") {
      depth--;
      if (depth < 0) { strayCloses.push({ line }); depth = 0; }
      segStart = i + 1;
      i++;
      continue;
    }
    if (c === ";") { segStart = i + 1; i++; continue; }
    i++;
  }
  return { finalDepth: depth, strayCloses, nestedHidden };
}

// Scan the given repo-relative CSS files under root. Returns
// { ok, violations: [string] }. An unreadable shipped source is itself a
// violation — the gate never fails open on I/O errors.
export function checkCssFiles(root, relFiles) {
  const violations = [];
  for (const rel of relFiles) {
    const fp = path.join(root, rel);
    let text;
    try {
      text = fs.readFileSync(fp, "utf8");
    } catch (e) {
      violations.push(rel + ": cannot read source CSS (" + e.code + ")");
      continue;
    }
    const r = scanCssBalance(text);
    for (const s of r.strayCloses) violations.push(rel + ":L" + s.line + " stray closing '}' (depth went negative)");
    for (const h of r.nestedHidden) violations.push(rel + ":L" + h.line + " [hidden] selector nested at depth " + h.depth + " (must be top-level): " + h.selector);
    if (r.finalDepth !== 0) violations.push(rel + ": final brace depth " + r.finalDepth + " != 0 (unbalanced braces — CSS Nesting swallows following rules, 2026-09-12 freeze root cause)");
  }
  return { ok: violations.length === 0, violations };
}
