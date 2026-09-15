import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

/**
 * BX-PAGES-GC (ticket 109 / A-064): G-C is no longer "three URLs answer 200".
 * A stale site answers 200 on all three, so the gate now also asserts that the
 * deployed demo/version.json reports the version we just released.
 *
 * Layer 1 of the industrial recipe (build-time contract assertions): these
 * checks are offline and must stay offline - the gate itself is the only piece
 * allowed to touch the network.
 */
test.describe('BX-PAGES-GC: Pages version freshness gate', () => {
  const verifyScript = path.join(ROOT, 'scripts', 'pages-gc-verify.mjs');
  const buildScript = path.join(ROOT, '.github', 'scripts', 'build-demo.mjs');
  const workflow = path.join(ROOT, '.github', 'workflows', 'demo-deploy.yml');

  test('gate logic is covered by an offline self-test', () => {
    expect(fs.existsSync(verifyScript)).toBe(true);
    const out = execFileSync(process.execPath, [verifyScript, '--mode=self-test'], {
      encoding: 'utf8',
    });
    expect(out).toContain('self-test:');
    // the blind spot this ticket exists for: stale + 200 must be red, not green
    expect(out).toContain('gate fails with MISMATCH when Pages serves a stale version that still answers 200');
    expect(out).toContain('gate fails with UNREACHABLE when a G-C URL is down');
    expect(out).toContain('deploy-tail gives up inside the 180s budget and reports MISMATCH');
  });

  test('build-demo stamps version.json with version + deployedAt and reads it back', () => {
    const src = fs.readFileSync(buildScript, 'utf8');
    expect(src).toMatch(/JSON\.stringify\(\{ version, deployedAt,/);
    // layer-1 contract: a broken probe must fail the build, not silently pass
    expect(src).toContain('versionCheck.version !== version || !versionCheck.deployedAt');
    expect(src).toContain('FATAL: resolved version is empty');
  });

  test('the demo renders the deployed version (B75, machine readable)', () => {
    const src = fs.readFileSync(buildScript, 'utf8');
    expect(src).toContain('data-boxing-version');
    expect(src).toContain('name="boxing-version"');
  });

  test('the deploy job verifies freshness inside a 180s budget', () => {
    const yml = fs.readFileSync(workflow, 'utf8');
    const deployBlock = yml.slice(yml.indexOf('  deploy:'));
    expect(deployBlock).toContain('--mode=deploy-tail');
    expect(deployBlock).toContain('--timeout=180');
    expect(deployBlock).toContain('EXPECTED_VERSION');
    // verify must run after the deploy step, not before it
    expect(deployBlock.indexOf('Verify Pages freshness')).toBeGreaterThan(
      deployBlock.indexOf('Deploy to GitHub Pages'),
    );
    expect(yml).toContain('version: ${{ steps.version.outputs.value }}');
  });
});
