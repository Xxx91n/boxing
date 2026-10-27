import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

// Ticket 45 (architecture-recovery): CI data-compatibility golden gates — migration
// + rollback half. The assertion logic lives in scripts/migration-golden-guard.mjs so
// the pretest lifecycle gate (npm run pretest, red on failure) and this Playwright
// report can never diverge. This spec additionally proves NODE/PAGE PARITY: the
// in-NTP migrateLayout (what real upgrades execute) must produce the same result the
// guard validated, for every golden fixture in test/fixtures/schema/.
//
// Fixtures: v1.json (current schemaVersion golden), legacy-groups.json (pre
// persisted groups + no schemaVersion + conns without props),
// legacy-v2.json (v2 shape). Golden contract per issues/45: old data ->
// new code loses no bookmarks; new data stays readable by the previous reader
// (expand/contract rollback safety).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUARD_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'scripts', 'migration-golden-guard.mjs')).href;
const FROZEN_READER_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'scripts', 'legacy-reader-frozen.mjs')).href;
const UTILS_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'utils.js')).href;
const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function bootNtp(page: import('@playwright/test').Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
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
      if (!raw.settings || raw.settings.lastBackupAt === undefined) {
        expect(typeof pageResult.settings.lastBackupAt).toBe('number');
        expect(typeof nodeResult.settings.lastBackupAt).toBe('number');
        expect(Math.abs(pageResult.settings.lastBackupAt - nodeResult.settings.lastBackupAt)).toBeLessThan(10000);
        pageResult.settings.lastBackupAt = nodeResult.settings.lastBackupAt;
      }
      expect(pageResult, 'parity mismatch for fixture ' + name).toEqual(nodeResult);
    }
  });
});

// Ticket 43 (spec #40): the frozen pre-migration reader is a named, append-only
// contract. These assertions live at the module's public boundary: registration
// rules, deep freeze, and the rollback audit shape. They do not inspect the
// reader's private helpers or the gate's layout comparison helpers.
test.describe('Frozen reader contract registry (ticket 43)', () => {
  test('pre-adr0009 is registered, immutable and deeply frozen', async () => {
    const frozen = await import(FROZEN_READER_URL);
    const contract = frozen.getContract('pre-adr0009');
    expect(contract.id).toBe('pre-adr0009');
    expect(contract.frozenSince).toBe('2026-09-12');
    expect(typeof contract.reader).toBe('function');
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(frozen.getRegistry())).toBe(true);
    expect(Object.isFrozen(frozen.getRegistry()['pre-adr0009'])).toBe(true);
  });

  test('re-registering an existing contract id throws', async () => {
    const frozen = await import(FROZEN_READER_URL);
    const existing = frozen.getContract('pre-adr0009');
    expect(() => frozen.registerContract({ ...existing })).toThrow(/already registered|append-only/i);
  });

  test('registering an edited body under an existing id throws', async () => {
    const frozen = await import(FROZEN_READER_URL);
    expect(() => frozen.registerContract({
      id: 'pre-adr0009',
      frozenSince: '2026-09-12',
      reader: () => null,
    })).toThrow(/already registered|append-only/i);
  });

  test('a new contract id registers without disturbing existing contracts', async () => {
    const frozen = await import(FROZEN_READER_URL);
    const existing = frozen.getContract('pre-adr0009');
    const registryBefore = frozen.getRegistry();
    const entry = frozen.registerContract({
      id: 'test-contract-43',
      frozenSince: '2026-10-27',
      reader: (raw: any) => raw,
      metadata: { tags: ['red'], nested: { ok: true } },
    });
    expect(entry.id).toBe('test-contract-43');
    // Deep freeze covers nested values supplied with the contract.
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.metadata)).toBe(true);
    expect(Object.isFrozen(entry.metadata.tags)).toBe(true);
    expect(Object.isFrozen(entry.metadata.nested)).toBe(true);
    // Existing contract identity and the previously published snapshot are untouched.
    expect(frozen.getContract('pre-adr0009')).toBe(existing);
    expect(registryBefore['test-contract-43']).toBeUndefined();
    expect(frozen.getRegistry()['pre-adr0009']).toBe(existing);
    expect(frozen.getRegistry()['test-contract-43']).toBe(entry);
  });

  test('rollback audit reports acceptance, bookmark diff, deltas and star survival', async () => {
    const frozen = await import(FROZEN_READER_URL);
    const guard = await import(GUARD_URL);
    const { migrateLayout } = await import(UTILS_URL);
    const current = migrateLayout(guard.loadFixture('v1.json'));
    const audit = frozen.rollbackAudit('pre-adr0009', current);
    expect(audit.acceptance).toBe(true);
    expect(audit.bookmarkDiff).toEqual({ lost: [], gained: [] });
    expect(audit.boxDelta).toBe(0);
    expect(audit.connectionDelta).toBe(0);
    // v1.json carries exactly one star (large box lb1, isParent === true).
    expect(audit.starSurvival).toEqual({ total: 1, survived: 1, lost: [], groupsLeaked: false });
  });
});
