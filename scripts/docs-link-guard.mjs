#!/usr/bin/env node
/**
 * docs-link-guard.mjs - agent/history layer reference resolvability guard.
 *
 * Ticket 96 (covers A-050). Replaces the inline bash step that reported 8 false
 * dead links on main (AI Docs Governance run 34808079960): the previous token
 * class excluded only space, both quote characters, close-paren and greater-than,
 * so markdown delimiters were absorbed into the path and every real reference
 * was reported as a dead link.
 *
 * Design (atomcode research 2026-09-14, session 0d02f171):
 *   1. path tokens come from a path-safe ALLOWLIST whose last character must be
 *      alnum / underscore / hyphen, so no markdown punctuation can be swallowed;
 *   2. markdown link targets are additionally resolved relative to the source
 *      document, covering the [label](agents/ui-audit.md) reference style;
 *   3. a self-test runs first on positive / negative / adversarial fixtures so a
 *      future tokenizer change that re-introduces delimiter swallowing fails
 *      loudly instead of silently going green;
 *   4. scope is unchanged from the original step: AGENTS.md + docs/CONTEXT.md,
 *      docs/agents/** and docs/history/** only. AGENTS/CONTEXT keep their
 *      agent/history reference capability (A-050 AC-3).
 *
 * Not wired into pretest on purpose: pretest is the test.yml / G-A surface and
 * ticket 96 must not mix with G-A (issue note). CI-only, run by
 * .github/workflows/ai-docs-governance.yml.
 *
 * Usage: node scripts/docs-link-guard.mjs
 * Exit:  0 = self-test passed and every reference resolves; 1 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BT = String.fromCharCode(96);
const DQ = String.fromCharCode(34);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['AGENTS.md', 'docs/CONTEXT.md'];
const LAYER_DIRS = ['docs/agents/', 'docs/history/'];
const TOKEN_SOURCE = 'docs/(?:agents|history)/[A-Za-z0-9._/-]*[A-Za-z0-9_-]';
const FORBIDDEN = [' ', ']', '[', '(', ')', BT, DQ, "'", '>', '*', '|', '<'];

function extractTokens(content) {
  const re = new RegExp(TOKEN_SOURCE, 'g');
  const out = [];
  let m = re.exec(content);
  while (m !== null) { out.push(m[0]); m = re.exec(content); }
  return out;
}

// Hand-written markdown link scanner. Same approach as scripts/docs-pointer-check.mjs
// but deliberately duplicated: A-035 / ticket 85 freezes that script as a NON-gate,
// so a required CI job must not depend on it.
function extractLinkTargets(content) {
  const out = [];
  let i = 0;
  while (i < content.length) {
    const open = content.indexOf('[', i);
    if (open === -1) break;
    const mid = content.indexOf('](', open);
    if (mid === -1) break;
    const close = content.indexOf(')', mid);
    if (close === -1) break;
    const text = content.slice(open + 1, mid);
    const target = content.slice(mid + 2, close).trim();
    if (text.indexOf(']') === -1 && target.indexOf('(') === -1) out.push(target);
    i = close + 1;
  }
  return out;
}

function isExternal(target) {
  return target.indexOf('http://') === 0 || target.indexOf('https://') === 0 ||
    target.indexOf('mailto:') === 0 || target.indexOf('tel:') === 0;
}

function isLayerPath(rel) {
  for (const d of LAYER_DIRS) { if (rel.indexOf(d) === 0) return true; }
  return false;
}

function toPosix(p) { return p.split(path.sep).join('/'); }

function isFile(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

function collectRefs(rel) {
  const abs = path.join(ROOT, rel);
  const content = fs.readFileSync(abs, 'utf8');
  const dir = path.dirname(abs);
  const refs = new Set();
  for (const t of extractTokens(content)) refs.add(t);
  for (const raw of extractLinkTargets(content)) {
    if (raw === '' || isExternal(raw) || raw.charAt(0) === '#') continue;
    const hashAt = raw.indexOf('#');
    const p = hashAt === -1 ? raw : raw.slice(0, hashAt);
    if (p === '') continue;
    const resolved = toPosix(path.relative(ROOT, path.resolve(dir, p)));
    if (isLayerPath(resolved)) refs.add(resolved);
  }
  return Array.from(refs).sort();
}

function selfTest() {
  const failures = [];
  const eq = (name, actual, expected) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) failures.push(name + ': expected ' + e + ' but got ' + a);
  };

  eq('markdown link whose text equals its target (text + target are two occurrences; collectRefs dedupes)',
    extractTokens('[docs/agents/critical-lessons.md](docs/agents/critical-lessons.md)'),
    ['docs/agents/critical-lessons.md', 'docs/agents/critical-lessons.md']);
  eq('inline-code path followed by a sentence period',
    extractTokens('See ' + BT + 'docs/agents/domain.md' + BT + '.'),
    ['docs/agents/domain.md']);
  eq('inline-code path inside prose',
    extractTokens('moved to ' + BT + 'docs/history/boxing-changelog.md' + BT + ' to keep'),
    ['docs/history/boxing-changelog.md']);
  eq('directory-only reference is not a file token',
    extractTokens('docs/agents/ holds one-shot deliverables'),
    []);
  eq('relative link target is kept for the link scanner',
    extractLinkTargets('[docs/agents/ui-audit.md](agents/ui-audit.md)'),
    ['agents/ui-audit.md']);
  eq('bold and table delimiters are not swallowed',
    extractTokens('**docs/agents/manifest-contract.md** and |docs/agents/domain.md|'),
    ['docs/agents/manifest-contract.md', 'docs/agents/domain.md']);
  eq('missing path still yields a token (negative control)',
    extractTokens('See docs/agents/does-not-exist.md.'),
    ['docs/agents/does-not-exist.md']);

  const adversarial = [
    'docs/agents/critical-lessons.md](docs/agents/critical-lessons.md',
    'docs/agents/domain.md' + BT + '.',
    DQ + 'docs/agents/manifest-contract.md' + DQ,
  ];
  for (const src of adversarial) {
    for (const tk of extractTokens(src)) {
      for (const ch of FORBIDDEN) {
        if (tk.indexOf(ch) !== -1) {
          failures.push('delimiter leaked into token: ' + JSON.stringify(tk) + ' (char ' + JSON.stringify(ch) + ')');
        }
      }
    }
  }

  if (!isFile('docs/agents/domain.md')) failures.push('fixture docs/agents/domain.md should exist');
  if (isFile('docs/agents/does-not-exist.md')) failures.push('negative control docs/agents/does-not-exist.md unexpectedly exists');
  return failures;
}

const selfFailures = selfTest();
if (selfFailures.length > 0) {
  console.log('docs-link-guard: SELF-TEST FAILED');
  for (const f of selfFailures) console.log('  - ' + f);
  process.exit(1);
}
console.log('docs-link-guard: self-test OK (7 fixtures + delimiter-leak invariant)');

let total = 0;
let dead = 0;
for (const rel of SOURCES) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    console.log('  MISSING source document: ' + rel);
    dead++;
    continue;
  }
  const refs = collectRefs(rel);
  if (refs.length === 0) {
    console.log('  ' + rel + ': 0 agent/history reference found - reference capability lost?');
    dead++;
    continue;
  }
  for (const r of refs) {
    total++;
    if (isFile(r)) {
      console.log('  OK   ' + rel + ' -> ' + r);
    } else {
      console.log('  DEAD ' + rel + ' -> ' + r);
      dead++;
    }
  }
}

console.log('docs-link-guard: ' + total + ' reference(s) checked, ' + dead + ' dead');
process.exit(dead > 0 ? 1 : 0);
