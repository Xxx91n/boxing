import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Ticket 108 (A-063): layout collections must be mutated through the single
 * mutation entry commit(op) -> mutationHandlers (ADR-0007 Q2).
 *
 * The gate itself is scripts/layout-bypass-guard.mjs. These checks are offline
 * (layer 1 of the industrial recipe: build-time contract assertions) - the guard
 * never touches the network, so the assertions can run in both browser lanes.
 *
 * The negative test lives in the guard's --self-test: a deliberate bypass must be
 * red. Without it a static gate can silently degrade into a tautology.
 */
test.describe('BX-LAYOUT-BYPASS: layout mutations go through commit(op)', () => {
  const guard = path.join(ROOT, 'scripts', 'layout-bypass-guard.mjs');
  const renderSrc = path.join(ROOT, 'ntp', 'render.js');
  const popupsSrc = path.join(ROOT, 'ntp', 'popups.js');

  test('self-test proves a deliberate bypass is red (the gate has teeth)', () => {
    const out = execFileSync(process.execPath, [guard, '--self-test'], { encoding: 'utf8' });
    expect(out).toContain('self-test: PASS');
    expect(out).toContain('deliberate bypass (bookmark delete outside handlers) is red');
    expect(out).toContain('alias bypass');
    expect(out).toContain('tombstone delete outside commit is red');
    expect(out).toContain('membership rewrite (layout.boxes = filter) is red');
    expect(out).toContain('exemption without a name or reason is NOT an exemption');
    expect(out).toContain('unused exemption is red (LB-3 ratchet)');
    expect(out).toContain('missing allow-region markers fail closed');
  });

  test('the gate is green on the current tree', () => {
    const out = execFileSync(process.execPath, [guard], { encoding: 'utf8' });
    expect(out).toContain('"ok": true');
  });

  test('the allow-region contract is still present in render.js', () => {
    const src = fs.readFileSync(renderSrc, 'utf8');
    expect(src).toContain('export const mutationHandlers = {');
    expect(src).toContain('export function commit(');
  });

  test('bookmark reorder goes through commit, not a direct array splice', () => {
    const src = fs.readFileSync(popupsSrc, 'utf8');
    expect(src).toContain('commit("reorderBookmarks"');
    expect(src.indexOf('bookmarks.splice(')).toBe(-1);
  });

  test('the guard is wired into the blocking pretest chain and the CI lane', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.pretest).toContain('node scripts/layout-bypass-guard.mjs');
    const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'test.yml'), 'utf8');
    expect(yml).toContain('node scripts/layout-bypass-guard.mjs');
  });
});
