import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
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

  test('published check names are frozen: exactly 33 in order (ticket 43 AC1)', async () => {
    const guard = await import(GUARD_URL);
    const result = await guard.runMigrationGoldenChecks();
    expect(result.checks.map((c: any) => c.name)).toEqual([
      'fixtures-present', 'fixtures-schema-coverage',
      'v1-bookmarks-preserved', 'v1-boxes-preserved', 'v1-schema-fields', 'v1-groups-stripped',
      'v1-props-present', 'v1-idempotent', 'v1-settings-superset',
      'groups-bookmarks-preserved', 'groups-isparent-restored-large', 'groups-isparent-restored-small',
      'groups-stripped-after-migration', 'groups-schema-version-defaulted', 'groups-props-backfilled',
      'groups-meta-flag-set', 'groups-migration-idempotent',
      'v2-bookmarks-preserved', 'v2-version-bumped', 'v2-size-defaults-filled', 'v2-theme-defaulted',
      'v2-next-small-index', 'v2-one-pass-complete', 'v2-groups-stripped', 'v2-idempotent',
      'v2-preserves-connections', 'v2-restores-isparent-from-groups', 'v2-malformed-groups-tolerated',
      'rollback-old-reader-accepts', 'rollback-bookmarks-visible', 'rollback-boxes-visible',
      'rollback-connections-visible', 'rollback-isparent-self-contained',
    ]);
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
    // This exercises the append-only id collision (registering the same id twice),
    // which fires before any body comparison. Real body drift is proven by the
    // temp-module tests in the ticket 46 block below.
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
    // Unique per run so `--repeat-each` does not collide with an earlier append.
    const id = 'test-contract-43-' + process.pid + '-' + Date.now();
    const entry = frozen.registerContract({
      id,
      frozenSince: '2026-10-27',
      reader: (raw: any) => raw,
      metadata: { tags: ['red'], nested: { ok: true } },
    });
    expect(entry.id).toBe(id);
    // Deep freeze covers nested values supplied with the contract.
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.metadata)).toBe(true);
    expect(Object.isFrozen(entry.metadata.tags)).toBe(true);
    expect(Object.isFrozen(entry.metadata.nested)).toBe(true);
    // Existing contract identity and the previously published snapshot are untouched.
    expect(frozen.getContract('pre-adr0009')).toBe(existing);
    expect(registryBefore[id]).toBeUndefined();
    expect(frozen.getRegistry()['pre-adr0009']).toBe(existing);
    expect(frozen.getRegistry()[id]).toBe(entry);
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

  test('rollback audit reports the loss path when the old reader accepts nothing', async () => {
    const frozen = await import(FROZEN_READER_URL);
    const guard = await import(GUARD_URL);
    const { migrateLayout } = await import(UTILS_URL);
    const current = migrateLayout(guard.loadFixture('v1.json'));
    // Unique per run so `--repeat-each` does not collide with an earlier append.
    const id = 'test-contract-loss-43-' + process.pid + '-' + Date.now();
    frozen.registerContract({ id, frozenSince: '2026-10-27', reader: () => null });
    const audit = frozen.rollbackAudit(id, current);
    expect(audit.acceptance).toBe(false);
    expect(audit.bookmarkDiff.lost.length).toBeGreaterThan(0);
    expect(audit.bookmarkDiff.gained).toEqual([]);
    expect(audit.boxDelta).toBeNull();
    expect(audit.connectionDelta).toBeNull();
    expect(audit.starSurvival.survived).toBe(0);
  });

  test('the gate imports the frozen module and owns no reader declaration (tickets 43/46)', async () => {
    const gateSource = await fs.promises.readFile(
      path.resolve(__dirname, '..', '..', 'scripts', 'migration-golden-guard.mjs'), 'utf8');
    expect(gateSource).toMatch(/from\s+['"]\.\/legacy-reader-frozen\.mjs['"]/);
    expect(gateSource).toContain("getContract('pre-adr0009')");
    expect(gateSource).not.toMatch(/\bfunction\s+legacyReader\s*\(/);
  });
});

// Ticket 46 (spec #40): each frozen contract function body is pinned by a
// source-text hash. The pin is over the module's raw on-disk function source, so
// a semantic no-op reformat still fails. These tests stay at the module boundary:
// they exercise load-time drift rejection and the in-memory pin of a new id.
test.describe('Frozen function-body pins (ticket 46)', () => {
  const FROZEN_SOURCE = path.resolve(__dirname, '..', '..', 'scripts', 'legacy-reader-frozen.mjs');

  test('reformatting a frozen body fails load, naming the contract and function', async () => {
    const original = await fs.promises.readFile(FROZEN_SOURCE, 'utf8');
    const needle = "if (!raw || typeof raw !== 'object' || !(raw.version >= 3)) return null; // >=3 taken as-is";
    expect(original).toContain(needle);
    // Whitespace-only reformat inside the frozen body: same behaviour, different source.
    const reformatted = original.replace(needle, needle.replace(') return', ')  return'));
    expect(reformatted).not.toBe(original);

    const tmpPath = path.join(os.tmpdir(), 'legacy-reader-frozen-drift-' + process.pid + '-' + Date.now() + '.mjs');
    await fs.promises.writeFile(tmpPath, reformatted, 'utf8');
    try {
      // The module has no relative imports, so a standalone copy is a valid import.
      await expect(import(pathToFileURL(tmpPath).href)).rejects.toThrow(/pre-adr0009[\s\S]*legacyReader/);
    } finally {
      await fs.promises.unlink(tmpPath);
    }
  });

  test('editing a frozen body fails load, naming the contract and function', async () => {
    const original = await fs.promises.readFile(FROZEN_SOURCE, 'utf8');
    const needle = '!(raw.version >= 3)';
    expect(original).toContain(needle);
    // Semantic edit inside the frozen body: a v3 guard weakened to v2 changes
    // behaviour, so the source pin must reject the loaded copy.
    const edited = original.replace(needle, '!(raw.version >= 2)');
    expect(edited).not.toBe(original);

    const tmpPath = path.join(os.tmpdir(), 'legacy-reader-frozen-logic-' + process.pid + '-' + Date.now() + '.mjs');
    await fs.promises.writeFile(tmpPath, edited, 'utf8');
    try {
      await expect(import(pathToFileURL(tmpPath).href)).rejects.toThrow(/pre-adr0009[\s\S]*legacyReader/);
    } finally {
      await fs.promises.unlink(tmpPath);
    }
  });

  test('a shadow declaration of a pinned reader is rejected at load (append-only bypass)', async () => {
    const original = await fs.promises.readFile(FROZEN_SOURCE, 'utf8');
    const needle = 'reader: legacyReader,';
    expect(original).toContain(needle);
    // Realistic bypass: register an inline body under the pinned name while the
    // real declaration stays untouched. A first-match pin would still verify the
    // original and miss the substituted reader, so duplicate detection must fire.
    const spoofed = original.replace(needle, 'reader: function legacyReader(raw) { return null; },');
    expect(spoofed).not.toBe(original);

    const tmpPath = path.join(os.tmpdir(), 'legacy-reader-frozen-shadow-' + process.pid + '-' + Date.now() + '.mjs');
    await fs.promises.writeFile(tmpPath, spoofed, 'utf8');
    try {
      await expect(import(pathToFileURL(tmpPath).href)).rejects.toThrow(/pre-adr0009[\s\S]*legacyReader/);
    } finally {
      await fs.promises.unlink(tmpPath);
    }
  });

  test('a new contract id gets its own computed pin and leaves existing pins untouched', async () => {
    const frozen = await import(FROZEN_READER_URL);
    const existing = frozen.getContract('pre-adr0009');
    const existingPins = existing.sourcePins;
    expect(existingPins.legacyReader).toMatch(/^[0-9a-f]{64}$/);

    const reader = (raw: any) => raw;
    // Unique per run so `--repeat-each` does not collide with an earlier append.
    const id = 'test-contract-46-' + process.pid + '-' + Date.now();
    const entry = frozen.registerContract({
      id,
      frozenSince: '2026-10-27',
      reader,
    });

    // The new id is pinned in memory from its own body; no manifest entry needed.
    expect(entry.sourcePins).toEqual({
      reader: crypto.createHash('sha256').update(reader.toString()).digest('hex'),
    });
    // Existing contract identity, its pin record, and the previous snapshot survive.
    expect(frozen.getContract('pre-adr0009')).toBe(existing);
    expect(existing.sourcePins).toBe(existingPins);
    expect(frozen.getRegistry()['pre-adr0009'].sourcePins.legacyReader).toBe(existingPins.legacyReader);
  });
});
