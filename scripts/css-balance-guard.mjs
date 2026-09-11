#!/usr/bin/env node
// Ticket 53 (architecture-recovery): CSS balance gate — pretest half +
// negative self-check (issues/53 AC-3). Two jobs:
//   1. Scan every shipped source CSS (SOURCE_CSS). Any violation exits 1,
//      which makes `npm test` (and CI, via the pretest lifecycle) red —
//      same blocking discipline as migration-golden-guard (ticket 45).
//      build.mjs fail-closes independently; this guard enforces the same
//      contract without packaging (CI-only build policy: the authoritative
//      execution evidence is the CI run, which executes both halves).
//   2. Negative self-check: feed the scanner deliberately broken CSS and
//      assert each failure mode is detected — plus the incident-shaped
//      positive control (top-level [hidden] fallback pairs must NOT fire,
//      BX-DEV-020 convention). A guard blind to its own contract is a
//      build failure (exit 1).
// Zero disk writes, zero build artifacts.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanCssBalance, checkCssFiles, SOURCE_CSS } from "../.github/scripts/css-balance.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
function expect(label, ok) { if (!ok) failures.push(label); }

// --- AC-1: final depth != 0 (missing closing brace) ----------------------
let r = scanCssBalance(".a { color: red;\n.b { top: 0; }\n");
expect("self-check: missing '}' must yield finalDepth 1", r.finalDepth === 1);

// --- stray close (depth goes negative) ------------------------------------
r = scanCssBalance(".a { color: red; } }\n");
expect("self-check: stray '}' must be recorded, depth clamped", r.strayCloses.length === 1 && r.finalDepth === 0);

// --- AC-2: [hidden] nested at depth >= 1 ----------------------------------
r = scanCssBalance(".modal-overlay {\n  display: flex;\n  [hidden] { display: none; }\n}\n");
expect("self-check: nested [hidden] block must be flagged", r.nestedHidden.length === 1);
r = scanCssBalance("@media (max-width: 600px) {\n  .modal-overlay[hidden] { display: none; }\n}\n");
expect("self-check: [hidden] selector nested in @media must be flagged", r.nestedHidden.length === 1);

// --- positive control: top-level [hidden] pair must NOT fire --------------
r = scanCssBalance(".modal-overlay[hidden] {\n  display: none;\n  pointer-events: none;\n}\n");
expect("self-check: top-level [hidden] must be accepted", r.nestedHidden.length === 0 && r.finalDepth === 0);

// --- comment/string immunity ----------------------------------------------
r = scanCssBalance("/* } } { */\n.x { content: 'a{b}c'; }\n");
expect("self-check: braces in comments/strings must be ignored", r.finalDepth === 0 && r.strayCloses.length === 0);

if (failures.length) {
  console.error("css-balance guard: SELF-CHECK FAILED — scanner is blind to its own contract:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}

const gate = checkCssFiles(ROOT, SOURCE_CSS);
if (!gate.ok) {
  console.error("css-balance guard: source CSS violations (fail-closed, ticket 53 / spec D6):");
  for (const v of gate.violations) console.error("  - " + v);
  process.exit(1);
}
console.log("css-balance guard: OK — self-check passed, " + SOURCE_CSS.length + " source CSS files balanced, no nested [hidden]");
