#!/usr/bin/env node
// Ticket 108 (A-063) - layout-bypass static gate.
//
// Contract: every membership change of a LAYOUT COLLECTION must go through the
// single mutation entry commit(op) -> mutationHandlers (ADR-0007 Q2, tldraw
// Store pattern). A bypass is exactly how the ticket-107 P0 happened: popups.js
// spliced the bookmarks array directly and fire-and-forgot saveLayout, so no
// tombstone was written and a stale remote copy resurrected the bookmark on the
// next cross-tab merge.
//
// Rules
//   LB-0  contract markers. ntp/render.js must still expose the
//         mutationHandlers object literal and the commit() function. If a marker
//         is missing the gate cannot locate the allow-region, so it fails
//         closed (never silently allows everything).
//   LB-1  deletion-class, in place: splice / pop / shift / unshift on a layout
//         collection.
//   LB-2  rewrite-class: reassignment of a layout collection (X.boxes = ...,
//         box.bookmarks = ...), index assignment (X[i] = ...), Object.assign(X, ...),
//         in-place reorder / overwrite (sort / reverse / fill / copyWithin),
//         X.length = 0 and delete X[k].
//   LB-3  unused exemption: an exemption comment that exempts nothing. Keeps the
//         exemption surface a ratchet instead of permanent debt.
//
// Layout collections
//   layout.boxes | layout.connections | layout.groups | layout._meta.deleted
//   state.boxes  | state.connections        (mutationHandlers take state = layout)
//   <ident>.children | <ident>.bookmarks    (box child collections)
//   plus any identifier bound to one of the above (alias, 4-round fixpoint).
//   DOM .children receivers (canvasSurface, ...) are excluded by receiver name.
//
// Allow-region (no comment needed)
//   The mutationHandlers object literal and the commit() body in ntp/render.js.
//
// Exemption (named, expiring, ticketed — C07 / D-005)
//   // layout-bypass-allow: <name> - <reason> (expires:YYYY-MM-DD; ticket:<ref>)
//   on the same line or the line directly above. <name> must match
//   [a-z0-9][a-z0-9._-]*, <reason> must be at least 12 characters, and the reason
//   must carry both expires:YYYY-MM-DD and ticket:<ref> — no permanent allow.
//   Missing name/reason/expires/ticket => NOT a valid exemption (fail closed).
//   There is deliberately NO module-level blanket exemption: the exemption
//   surface cannot be widened by naming a module.
//
// Structural exclusions (documented, not comments)
//   Normalization guards cannot delete or reorder anything, so they are excluded
//   by pattern:  X = X || []   and   if (!Array.isArray(X)) X = []
//
// Usage
//   node scripts/layout-bypass-guard.mjs               gate over ntp/*.js
//   node scripts/layout-bypass-guard.mjs --self-test   synthetic negative tests
//   node scripts/layout-bypass-guard.mjs --json        machine-readable only
// exit 0 = pass, exit 1 = violation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NTP_DIR = path.join(ROOT, "ntp");
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const TAB = String.fromCharCode(9);
const EM = String.fromCharCode(8212);

const HANDLERS_START = "  export const mutationHandlers = {";
const HANDLERS_END = "  };";
const COMMIT_START = "  export function commit(";
const COMMIT_END = "  }";

const ID = "[A-Za-z_$][A-Za-z0-9_$]*";
const CHAIN = ID + "(?:[.]" + ID + ")*";
const W = "[ " + TAB + "]";

const CALL_RE = new RegExp("(" + CHAIN + ")[.](splice|pop|shift|unshift|sort|reverse|fill|copyWithin)" + W + "*[(]", "g");
const DELETE_RE = new RegExp("(?:^|[^A-Za-z0-9_$])delete" + W + "+(" + CHAIN + ")" + W + "*[[.]", "g");
const LEN_RE = new RegExp("(" + CHAIN + ")[.]length" + W + "*=" + W + "*0(?:[^0-9]|$)", "g");
const ASSIGN_RE = new RegExp("(?:^|[^A-Za-z0-9_$.])(" + CHAIN + ")" + W + "=(?!=)", "g");
const INDEX_RE = new RegExp("(?:^|[^A-Za-z0-9_$.])(" + CHAIN + ")[ ]*[[][^\\]]+\\]" + W + "=(?!=)", "g");
const OBJECT_ASSIGN_RE = new RegExp("Object[.]assign[(]" + W + "*(" + CHAIN + ")", "g");
const DECL_RE = new RegExp("(?:const|let|var|,)" + W + "*(" + ID + ")" + W + "*=" + W + "*([^,;]+)", "g");
const ARRAY_GUARD_RE = new RegExp("!Array[.]isArray[(]");
const EXEMPT_RE = new RegExp("//" + W + "*layout-bypass-allow:" + W + "+([a-z0-9][a-z0-9._-]*)" + W + "+(?:-{1,2}|" + EM + "|:)" + W + "+([^ " + TAB + "].*)$");
const CHILDREN_RE = new RegExp("^(.*)[.](children|bookmarks)$");
const DOM_SUFFIX_RE = new RegExp("(?:Node|Element|target|parentNode)$");

const CALL_OPS_DELETE = ["splice", "pop", "shift", "unshift"];
const MIN_REASON = 12;

const DOM_RECEIVERS = new Set([
  "document", "window", "canvasSurface", "innerSurfaceContent", "innerSurface",
  "innerCanvas", "canvasContainer", "appEl", "el", "row", "rows", "popup",
  "body", "bodyEl", "warn", "container", "this"
]);

function isCommentLine(raw) {
  const t = raw.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function isLayoutReceiver(expr, aliases) {
  if (!expr) return false;
  if (aliases.has(expr)) return true;
  if (expr === "layout.boxes" || expr === "layout.connections" || expr === "layout.groups") return true;
  if (expr === "layout._meta.deleted") return true;
  if (expr === "state.boxes" || expr === "state.connections") return true;
  const m = CHILDREN_RE.exec(expr);
  if (!m) return false;
  const owner = m[1];
  if (DOM_RECEIVERS.has(owner)) return false;
  if (DOM_SUFFIX_RE.test(owner)) return false;
  return true;
}

function buildAliases(lines) {
  const aliases = new Set();
  for (let round = 0; round < 4; round += 1) {
    let grew = false;
    for (const raw of lines) {
      if (isCommentLine(raw)) continue;
      if (raw.indexOf("const ") < 0 && raw.indexOf("let ") < 0 && raw.indexOf("var ") < 0) continue;
      DECL_RE.lastIndex = 0;
      let m;
      while ((m = DECL_RE.exec(raw)) !== null) {
        const name = m[1];
        if (aliases.has(name)) continue;
        let rhs = m[2].trim();
        // Only a TRAILING "|| []" is the empty-array fallback. Stripping an
        // inner one would turn `(lb.children || []).find(...)` into a bogus
        // "layout collection" and register a false alias.
        const tail = /[|][|][ ]*[[ ]*][ ]*$/.exec(rhs);
        if (tail) rhs = rhs.slice(0, tail.index).trim();
        if (!rhs) continue;
        if (isLayoutReceiver(rhs, aliases)) { aliases.add(name); grew = true; }
      }
    }
    if (!grew) break;
  }
  return aliases;
}

function isNormalizationGuard(line, recv) {
  let at = line.indexOf(recv + " =");
  if (at < 0) at = line.indexOf(recv + "=");
  if (at < 0) return false;
  let rest = line.slice(at + recv.length).trimStart();
  if (rest.startsWith("=")) rest = rest.slice(1).trimStart();
  const rhs = rest.trim();
  if (rhs === "[];" || rhs === "[]") return ARRAY_GUARD_RE.test(line);
  if (rhs === recv + " || [];" || rhs === recv + " || []") return true;
  return false;
}

function isDeclarationOf(line, name) {
  const re = new RegExp("(?:const|let|var|,)" + W + "*" + name + W + "*=");
  return re.test(line);
}

function detect(line, aliases) {
  const found = [];
  if (isCommentLine(line)) return found;
  let m;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(line)) !== null) {
    if (!isLayoutReceiver(m[1], aliases)) continue;
    const op = m[2];
    const rule = CALL_OPS_DELETE.indexOf(op) >= 0 ? "LB-1" : "LB-2";
    found.push({ rule: rule, op: "call:" + op, receiver: m[1] });
  }
  DELETE_RE.lastIndex = 0;
  while ((m = DELETE_RE.exec(line)) !== null) {
    if (!isLayoutReceiver(m[1], aliases)) continue;
    found.push({ rule: "LB-2", op: "delete", receiver: m[1] });
  }
  LEN_RE.lastIndex = 0;
  while ((m = LEN_RE.exec(line)) !== null) {
    if (!isLayoutReceiver(m[1], aliases)) continue;
    found.push({ rule: "LB-2", op: "length=0", receiver: m[1] });
  }
  INDEX_RE.lastIndex = 0;
  while ((m = INDEX_RE.exec(line)) !== null) {
    if (!isLayoutReceiver(m[1], aliases)) continue;
    found.push({ rule: "LB-2", op: "index-assign", receiver: m[1] });
  }
  OBJECT_ASSIGN_RE.lastIndex = 0;
  while ((m = OBJECT_ASSIGN_RE.exec(line)) !== null) {
    if (!isLayoutReceiver(m[1], aliases)) continue;
    found.push({ rule: "LB-2", op: "object-assign", receiver: m[1] });
  }
  ASSIGN_RE.lastIndex = 0;
  while ((m = ASSIGN_RE.exec(line)) !== null) {
    const recv = m[1];
    if (!isLayoutReceiver(recv, aliases)) continue;
    // A declaration initializer is not a reassignment: `const bms = sb.bookmarks`
    // both registers the alias and would otherwise look like a rewrite.
    if (isDeclarationOf(line, recv)) continue;
    if (isNormalizationGuard(line, recv)) continue;
    found.push({ rule: "LB-2", op: "assign", receiver: recv });
  }
  return found;
}

function matchExemption(line) {
  const m = EXEMPT_RE.exec(line);
  if (!m) return null;
  const reason = (m[2] || "").trim();
  if (reason.length < MIN_REASON) return null;
  // C07 (D-005): rewrite exemptions are named + expiring + ticketed. No permanent allow.
  // expires:YYYY-MM-DD and ticket:<ref> must appear in the reason, otherwise the
  // comment is NOT a valid exemption and the site stays a violation (fail closed).
  const exp = /expires:(\d{4}-\d{2}-\d{2})/.exec(reason);
  const tkt = /ticket:([A-Za-z0-9._\/-]+)/.exec(reason);
  if (!exp || !tkt) return null;
  return { name: m[1], reason: reason, expires: exp[1], ticket: tkt[1] };
}

function findAllowRegions(lines) {
  const ranges = [];
  const missing = [];
  const findFrom = (pred, start) => {
    for (let i = start; i < lines.length; i += 1) if (pred(lines[i])) return i;
    return -1;
  };
  const hStart = findFrom((l) => l === HANDLERS_START, 0);
  const hEnd = hStart < 0 ? -1 : findFrom((l) => l === HANDLERS_END, hStart + 1);
  if (hStart < 0 || hEnd < 0) missing.push("mutationHandlers object literal");
  else ranges.push([hStart + 1, hEnd + 1]);
  const cStart = findFrom((l) => l.startsWith(COMMIT_START), 0);
  const cEnd = cStart < 0 ? -1 : findFrom((l) => l === COMMIT_END, cStart + 1);
  if (cStart < 0 || cEnd < 0) missing.push("commit() function");
  else ranges.push([cStart + 1, cEnd + 1]);
  return { ranges: ranges, missing: missing };
}

function analyze(sources) {
  const violations = [];
  const exemptions = [];
  const stats = { scannedLines: 0, allowed: 0, exempted: 0, modules: sources.length };
  for (const src of sources) {
    const lines = src.text.split(NL).map((l) => (l.endsWith(CR) ? l.slice(0, -1) : l));
    stats.scannedLines += lines.length;
    const aliases = buildAliases(lines);
    let ranges = [];
    if (src.rel === "ntp/render.js") {
      const r = findAllowRegions(lines);
      for (const name of r.missing) {
        violations.push({
          rule: "LB-0", file: src.rel, line: 1, op: "contract", receiver: "-",
          message: "allow-region marker missing: " + name + " - gate fails closed (ADR-0007 Q2 allow-region)"
        });
      }
      ranges = r.ranges;
    }
    const exemptionLines = new Map();
    lines.forEach((raw, idx) => { if (matchExemption(raw)) exemptionLines.set(idx + 1, matchExemption(raw)); });
    const usedExemptions = new Set();
    lines.forEach((raw, idx) => {
      const n = idx + 1;
      const hits = detect(raw, aliases);
      if (!hits.length) return;
      const inRange = ranges.some((r) => n >= r[0] && n <= r[1]);
      const ownEx = exemptionLines.get(n) || exemptionLines.get(n - 1) || null;
      if (ownEx) usedExemptions.add(exemptionLines.get(n) ? n : n - 1);
      for (const h of hits) {
        if (inRange) { stats.allowed += 1; continue; }
        if (ownEx) {
          stats.exempted += 1;
          const at = exemptionLines.get(n) ? n : n - 1;
          if (!exemptions.some((e) => e.file === src.rel && e.line === at)) {
            exemptions.push({ file: src.rel, line: at, name: ownEx.name });
          }
          continue;
        }
        violations.push({
          rule: h.rule, file: src.rel, line: n, op: h.op, receiver: h.receiver,
          message: h.rule + ": layout collection '" + h.receiver + "' " + h.op +
            " outside mutationHandlers - route it through commit(op) (ADR-0007 Q2 / ticket 108)"
        });
      }
    });
    for (const [lineNo, ex] of exemptionLines) {
      if (usedExemptions.has(lineNo)) continue;
      violations.push({
        rule: "LB-3", file: src.rel, line: lineNo, op: "exemption", receiver: ex.name,
        message: "LB-3: unused layout-bypass-allow exemption '" + ex.name + "' - remove it (ratchet: the exemption surface only shrinks)"
      });
    }
  }
  return { violations: violations, stats: stats, exemptions: exemptions };
}

function loadSources() {
  return fs.readdirSync(NTP_DIR)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ rel: "ntp/" + name, text: fs.readFileSync(path.join(NTP_DIR, name), "utf8") }));
}

function selfTest() {
  const lines = [];
  let bad = 0;
  const check = (label, sources, expect) => {
    const out = analyze(sources);
    const rules = out.violations.map((v) => v.rule + "@" + v.line).sort().join(",");
    const ok = rules === expect;
    if (!ok) bad += 1;
    lines.push((ok ? "self-test ok   " : "SELFTEST FAIL ") + label + "  -> [" + rules + "] expected [" + expect + "]");
  };
  const popups = (body) => [{ rel: "ntp/popups.js", text: "const x = 1;" + NL + body + NL }];
  const handlers = (inner) => [{
    rel: "ntp/render.js",
    text: ["const a = 1;", "  export const mutationHandlers = {", "    op(state, p) {", "      " + inner, "    }", "  };", "  export function commit(op, payload, opts) {", "    return 1;", "  }", ""].join(NL)
  }];

  check("deliberate bypass (bookmark delete outside handlers) is red", popups("  sb.bookmarks.splice(idx, 1);"), "LB-1@2");
  check("alias bypass (const a = sb.bookmarks; a.splice) is red", popups("  const bms = sb.bookmarks, item = bms[0];" + NL + "  bms.splice(0, 1);"), "LB-1@3");
  check("alias whose RHS is a || [] fallback is NOT a layout alias", popups("  const others = (lb.children || []).filter(Boolean);" + NL + "  others = others.slice(0, 2);"), "");
  check("tombstone delete outside commit is red", popups("  delete layout._meta.deleted[k];"), "LB-2@2");
  check("membership rewrite (layout.boxes = filter) is red", popups("  layout.boxes = layout.boxes.filter(b => b.id !== id);"), "LB-2@2");
  check("length reset outside handlers is red", popups("  lb.children.length = 0;"), "LB-2@2");
  check("index assignment outside handlers is red", popups("  lb.children[0] = replacement;"), "LB-2@2");
  check("Object.assign onto a layout collection is red", popups("  Object.assign(layout.connections, extra);"), "LB-2@2");
  check("index assignment inside mutationHandlers is allowed", handlers("lb.children[0] = replacement;"), "");
  check("same splice inside mutationHandlers is allowed", handlers("state.connections.push(x);"), "");
  check("same splice inside mutationHandlers is allowed (splice form)", handlers("sb.bookmarks.splice(idx, 1);"), "");
  check("normalization guard (X = X || []) is not a violation", popups("  sb.bookmarks = sb.bookmarks || [];"), "");
  check("normalization guard (if !Array.isArray) is not a violation", popups("  if (!Array.isArray(layout.connections)) layout.connections = [];"), "");
  check("DOM .children receiver is not a layout collection", popups("  canvasSurface.children.length = 0;"), "");
  check("named exemption comment exempts the line below", popups("  // layout-bypass-allow: storage-facade-merge - facade owns the merge write chain (expires:2027-03-31; ticket:108)" + NL + "  localBox.children = mergeById(a, b, t);"), "");
  check("exemption without a name or reason is NOT an exemption", popups("  // layout-bypass-allow: no-name-just-text" + NL + "  layout.boxes = layout.boxes.filter(Boolean);"), "LB-2@3");
  check("exemption without expires+ticket is NOT an exemption (C07)", popups("  // layout-bypass-allow: no-expiry-rot - facade owns the merge write chain here" + NL + "  localBox.children = mergeById(a, b, t);"), "LB-2@3");
  check("unused exemption is red (LB-3 ratchet)", popups("  // layout-bypass-allow: stale-rot - this comment no longer exempts anything (expires:2027-03-31; ticket:108)" + NL + "  const ok = 1;"), "LB-3@2");
  check("missing allow-region markers fail closed", [{ rel: "ntp/render.js", text: "const a = 1;" + NL + "  layout.boxes = layout.boxes.filter(Boolean);" + NL }], "LB-0@1,LB-0@1,LB-2@2");
  return { bad: bad, lines: lines };
}

const argv = process.argv.slice(2);
if (argv.indexOf("--self-test") >= 0) {
  const r = selfTest();
  for (const l of r.lines) console.log(l);
  console.log("self-test: " + (r.bad === 0 ? "PASS" : "FAIL") + " (" + (r.lines.length - r.bad) + "/" + r.lines.length + ")");
  console.log("self-test: deliberate bypasses (splice / alias / delete / assign / length=0) are red, handler-internal mutation is green, and a nameless exemption comment stays red");
  process.exit(r.bad === 0 ? 0 : 1);
}

const result = analyze(loadSources());
const ok = result.violations.length === 0;
const payload = {
  ok: ok,
  modules: result.stats.modules,
  scannedLines: result.stats.scannedLines,
  allowedInHandlers: result.stats.allowed,
  exempted: result.stats.exempted,
  liveExemptions: result.exemptions.map((e) => e.file + ":" + e.line + " " + e.name),
  violations: result.violations
};
if (argv.indexOf("--json") < 0) {
  console.log(JSON.stringify(payload, null, 2));
  // Live exemption list (atomcode 2026-09-15): print every exemption that is
  // currently doing work, so the surface is visible in CI logs and PR diffs.
  for (const ex of result.exemptions) console.log("exempt  " + ex.file + ":" + ex.line + "  " + ex.name);
  console.log("live exemptions: " + result.exemptions.length + " (each must keep exempting a real site - LB-3 rejects orphans)");
} else {
  console.log(JSON.stringify(payload));
}
if (!ok) {
  console.log("layout bypass gate: " + result.violations.length + " violation(s) - layout collections must be mutated through commit(op) (ADR-0007 Q2)");
}
process.exitCode = ok ? 0 : 1;
