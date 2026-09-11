import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Ticket 45 (architecture-recovery): CI data-compatibility golden gates — migration
// + rollback half. The assertion logic lives in scripts/migration-golden-guard.mjs so
// the pretest lifecycle gate (npm run pretest, red on failure) and this Playwright
// report can never diverge. This spec additionally proves NODE/PAGE PARITY: the
// in-NTP migrateLayout (what real upgrades execute) must produce the same result the
// guard validated, for every golden fixture in test/fixtures/schema/.
//
// Fixtures: v1.json (current schemaVersion golden), legacy-groups.json (pre
// ADR-0007 Q1: persisted groups + no schemaVersion + conns without props),
// legacy-v2.json (BX-DEV-085 v2 shape). Golden contract per issues/45: old data ->
// new code loses no bookmarks; new data stays readable by the previous reader
// (expand/contract rollback safety).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUARD_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'scripts', 'migration-golden-guard.mjs')).href;
const UTILS_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'utils.js')).href;
const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function bootNtp(page: import('@playwright/test').Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
}

test.describe('Migration golden fixtures (ticket 45)', () => {
  test.setTimeout(120000);

  test('golden guard checks all pass (same source of truth as pretest)', async () => {
    const guard = await import(GUARD_URL);
    const result = await guard.runMigrationGoldenChecks();
    const failures = result.checks.filter((c: any) => !c.pass).map((c: any) => c.name + (c.detail ? ' :: ' + c.detail : ''));
    expect(failures, 'migration golden failures: ' + JSON.stringify(failures, null, 2)).toEqual([]);
  });

  test('fixture manifest covers every historical schemaVersion + pre-versioning shapes', async () => {
    const guard = await import(GUARD_URL);
    const names: string[] = guard.fixtureNames();
    expect(names).toContain('v1.json');
    expect(names).toContain('legacy-groups.json');
    expect(names).toContain('legacy-v2.json');
  });

  test('node migrateLayout is pure-importable (guards CI-only policy: no DOM needed)', async () => {
    const { migrateLayout } = await import(UTILS_URL);
    const out = migrateLayout({ version: 3.5, schemaVersion: 1, boxes: [], connections: [] });
    expect(out.version).toBe(3.5);
    expect(Array.isArray(out.boxes)).toBe(true);
  });

  test('in-page migrateLayout matches the Node result for every golden fixture', async ({ page }) => {
    const guard = await import(GUARD_URL);
    const { migrateLayout } = await import(UTILS_URL);
    await bootNtp(page);
    for (const name of guard.fixtureNames()) {
      const raw = guard.loadFixture(name);
      const nodeResult = migrateLayout(JSON.parse(JSON.stringify(raw)));
      const pageResult = await page.evaluate((json) => {
        return (window as any).__boxingDebug.migrateLayout(JSON.parse(json));
      }, JSON.stringify(raw));
      expect(pageResult, 'parity mismatch for fixture ' + name).toEqual(nodeResult);
    }
  });
});
