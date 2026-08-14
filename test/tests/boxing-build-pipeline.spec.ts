import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

/**
 * BX-MANIFEST-004b: dev scripts MUST chain build -> web-ext.
 * Prevents the "stale dist" bug where source was fixed
 * but dist was never recompiled before dev loading.
 */
test.describe('BX-MANIFEST-004b: build-before-dev pipeline', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  test('dev:chrome chains npm run build before web-ext run', () => {
    const script = pkg.scripts['dev:chrome'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build &&')).toBe(true);
    expect(script).toContain('web-ext run');
    expect(script).toContain('--source-dir=dist/boxing-chrome');
  });

  test('dev:firefox chains npm run build before web-ext run', () => {
    const script = pkg.scripts['dev:firefox'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build &&')).toBe(true);
    expect(script).toContain('web-ext run');
    expect(script).toContain('--source-dir=dist/boxing-firefox');
  });

  test('dev:chrome:no-build skips build and uses --no-reload', () => {
    const script = pkg.scripts['dev:chrome:no-build'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build')).toBe(false);
    expect(script).toContain('--no-reload');
    expect(script).toContain('--source-dir=dist/boxing-chrome');
  });

  test('dev:firefox:no-build skips build and uses --no-reload', () => {
    const script = pkg.scripts['dev:firefox:no-build'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build')).toBe(false);
    expect(script).toContain('--no-reload');
    expect(script).toContain('--source-dir=dist/boxing-firefox');
  });

  test('build.mjs has stale dist warning (warnStaleDist)', () => {
    const buildPath = path.join(ROOT, '.github', 'scripts', 'build.mjs');
    const buildSrc = fs.readFileSync(buildPath, 'utf8');
    expect(buildSrc).toContain('warnStaleDist');
    expect(buildSrc).toContain('[STALE_DIST]');
    expect(buildSrc).toContain('BUILD_INFO.json');
  });

  test('AGENTS.md documents BX-MANIFEST-004b', () => {
    const agentsPath = path.join(ROOT, 'AGENTS.md');
    const agentsSrc = fs.readFileSync(agentsPath, 'utf8');
    expect(agentsSrc).toContain('BX-MANIFEST-004b');
    expect(agentsSrc).toContain('stale');
  });
});
