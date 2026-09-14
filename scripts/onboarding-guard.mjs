#!/usr/bin/env node
// Ticket 101 (A-055 / B65): first-run onboarding dismissal guard.
//
// Ticket 89 hardened ONE spec against the fire-and-forget dismissal race and left
// ~25 siblings carrying it; ticket 93 then hit the same race again on a sibling
// (boxing-empty-state-buttons Bug5-dark). A helper alone does not stop the pattern
// from coming back, so this guard makes the rule mechanical: a spec may only
// dismiss the tour through test/helpers/onboarding.ts.
//
// Forbidden form (no post-condition, no ordering — the overlay can re-show after
// init() settles its decision and then intercept the next real pointer action):
//
//   await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
//
// Allowed: `await dismissOnboarding(page)` from the helper. An idempotent call
// INSIDE a poll callback (the helper's own form, or a spec re-asserting the
// precondition before a forced hover) is not the forbidden shape and is not flagged.
//
// Usage: node scripts/onboarding-guard.mjs
// Exit:  0 = no fire-and-forget dismissal in any spec, 1 = at least one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = path.join(ROOT, 'test', 'tests');

// A standalone `await <page>.evaluate(...skipOnboarding...)` — the fire-and-forget
// shape. The helper's poll callback calls skipOnboarding WITHOUT an await/evaluate
// on the same line, so it is not matched.
const FORBIDDEN = /^\s*await\s+\w+\.evaluate\([^\n]*skipOnboarding/;

function selfTest() {
  const positives = [
    "    await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });",
    "  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());",
    "    await p1.evaluate(() => (window as any).__boxingDebug.skipOnboarding());",
  ];
  const negatives = [
    '  await dismissOnboarding(page);',
    '        try { dbg?.skipOnboarding?.(); } catch (_) { /* helper: idempotent re-dismiss */ }',
    '      if (typeof dbg?.skipOnboarding === \'function\') dbg.skipOnboarding();',
    '  await assertPointerReaches(page, \'.bm-add-btn\');',
  ];
  const bad = [
    ...positives.filter((l) => !FORBIDDEN.test(l)).map((l) => 'positive not detected: ' + l),
    ...negatives.filter((l) => FORBIDDEN.test(l)).map((l) => 'negative falsely flagged: ' + l),
  ];
  if (bad.length) {
    console.error('onboarding-guard: SELF-TEST FAILED');
    bad.forEach((b) => console.error(' - ' + b));
    process.exit(1);
  }
  return positives.length + negatives.length;
}

const checked = selfTest();

const specs = fs.readdirSync(SPEC_DIR).filter((name) => name.endsWith('.spec.ts')).sort();
const violations = [];
for (const spec of specs) {
  const lines = fs.readFileSync(path.join(SPEC_DIR, spec), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (FORBIDDEN.test(line)) violations.push(`test/tests/${spec}:${index + 1}`);
  });
}

if (violations.length) {
  console.error('onboarding-guard: ' + violations.length + ' fire-and-forget dismissal(s) found.');
  console.error('Use `await dismissOnboarding(page)` from test/helpers/onboarding.ts instead:');
NaN
  process.exit(1);
}
console.log('onboarding-guard: OK — self-test ' + checked + '/' + checked + ', ' + specs.length + ' specs, no fire-and-forget tour dismissal.');
