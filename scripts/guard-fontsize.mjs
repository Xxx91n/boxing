#!/usr/bin/env node
// D-004 / ADR-0019: Global font-size regression guard.
//
// Contract:
//   No hardcoded `font-size:\s*\d+px` styles are allowed in NTP JS files (ntp/*.js).
//   All font sizing must consume `--fs-*` tokens derived from `--font-size-base`
//   (e.g., `font-size:var(--fs-sm)` or `font-size:var(--fs-base)`).
//
// Usage:
//   node scripts/guard-fontsize.mjs
//   node scripts/guard-fontsize.mjs --self-test
//
// Exit 0 on clean / passed self-test, exit 1 on violation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NTP_DIR = path.join(ROOT, "ntp");

// Pattern matching hardcoded font-size px values, e.g. font-size:12px or font-size: 14px
export const FONT_SIZE_PX_RE = /font-size:\s*\d+px/i;

export function scanJsContent(content, filename = "unknown") {
  const violations = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(FONT_SIZE_PX_RE);
    if (match) {
      violations.push({
        file: filename,
        line: i + 1,
        match: match[0],
        snippet: line.trim()
      });
    }
  }
  return violations;
}

export function scanNtpJsFiles(ntpDir = NTP_DIR) {
  const files = fs.readdirSync(ntpDir).filter(f => f.endsWith(".js"));
  const allViolations = [];
  for (const f of files) {
    const fullPath = path.join(ntpDir, f);
    const content = fs.readFileSync(fullPath, "utf8");
    const v = scanJsContent(content, f);
    allViolations.push(...v);
  }
  return { files, violations: allViolations };
}

// Self-test
export function runSelfTest() {
  const failures = [];
  function expect(label, ok) { if (!ok) failures.push(label); }

  // Must detect hardcoded px
  const bad1 = scanJsContent("el.style.cssText = 'font-size:12px;';", "test.js");
  expect("detect font-size:12px", bad1.length === 1 && bad1[0].match === "font-size:12px");

  const bad2 = scanJsContent("el.style.cssText = 'font-size: 14px;';", "test.js");
  expect("detect font-size: 14px", bad2.length === 1 && bad2[0].match === "font-size: 14px");

  // Must accept --fs-* and --font-size-base
  const good1 = scanJsContent("el.style.cssText = 'font-size:var(--fs-sm);';", "test.js");
  expect("allow font-size:var(--fs-sm)", good1.length === 0);

  const good2 = scanJsContent("root.style.setProperty('--font-size-base', v.fontSize + 'px');", "test.js");
  expect("allow setProperty --font-size-base", good2.length === 0);

  return failures;
}

// CLI entry
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes("--self-test")) {
    const failures = runSelfTest();
    if (failures.length > 0) {
      console.error("guard-fontsize: self-test FAILED:");
      failures.forEach(f => console.error("  - " + f));
      process.exit(1);
    }
    console.log("guard-fontsize: self-test passed.");
    process.exit(0);
  }

  // Always run self-test first to ensure scanner contract integrity
  const selfFailures = runSelfTest();
  if (selfFailures.length > 0) {
    console.error("guard-fontsize: self-test FAILED before scan:");
    selfFailures.forEach(f => console.error("  - " + f));
    process.exit(1);
  }

  const result = scanNtpJsFiles();
  if (result.violations.length > 0) {
    console.error(`guard-fontsize: FAILED — found ${result.violations.length} hardcoded font-size px violation(s) in ntp/*.js:`);
    for (const v of result.violations) {
      console.error(`  - ${v.file}:${v.line} (${v.match}) => ${v.snippet}`);
    }
    process.exit(1);
  }

  console.log(`guard-fontsize: OK — scanned ${result.files.length} ntp/*.js files, 0 hardcoded font-size px values found.`);
}
