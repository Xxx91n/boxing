#!/usr/bin/env node
// Ticket 45 (architecture-recovery): data-compatibility golden gates, pretest half.
// Runs migrateLayout (ntp/utils.js) over the golden fixtures in test/fixtures/schema/
// and asserts the issue-45 acceptance contract: no bookmark loss on old -> new migration,
// rollback (new data readable under the previous reader constraints, expand/contract).
// Same module is imported by test/tests/boxing-migration-golden.spec.ts so pretest and
// the Playwright report never diverge. Failures exit 1, which makes npm test (and CI,
// which runs it via the pretest lifecycle) red — per issues/45, red is the gate.
//
// Spec refs: .scratch/architecture-recovery/spec.md L3 (release gating),
// docs/adr/0009 (schemaVersion / crash rescue), docs/adr/0007 Q1 + Q4c (groups ->
// isParent one-time migration, connection props backfill).

import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_DIR = new URL('../test/fixtures/schema/', import.meta.url);
const UTILS_URL = new URL('../ntp/utils.js', import.meta.url);

async function loadUtils() {
  // UTILS_URL is already an absolute file: URL (relative to this module) — import directly.
  return import(UTILS_URL.href);
}

function fixtureNames() {
  return fs.readdirSync(FIXTURE_DIR).filter((n) => n.endsWith('.json')).sort();
}

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(new URL('./' + name, FIXTURE_DIR), 'utf8'));
}

function bookmarkIds(layout) {
  const ids = [];
  for (const box of layout.boxes || []) for (const child of box.children || []) for (const bm of child.bookmarks || []) ids.push(bm.id);
  return ids.sort();
}

// Canonical stringify (sorted keys) — deep equality independent of key insertion order.
function canon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canon(value[k])).join(',') + '}';
}

// Rollback half of the expand/contract exercise: a reader frozen at the PREVIOUS
// contract (pre-ADR-0009: no schemaVersion awareness; pre-Q1: groups optional with
// fallback). The point of the contract is that this reader keeps every user-visible
// object from current data (boxes, children, bookmarks, connections); only the
// runtime-only grouping decoration may differ, and that survives via isParent.
function legacyReader(raw) {
  if (!raw || typeof raw !== 'object' || !(raw.version >= 3)) return null; // BX-DEV-085: >=3 taken as-is
  return {
    boxes: Array.isArray(raw.boxes) ? raw.boxes : [],
    connections: Array.isArray(raw.connections) ? raw.connections : [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    settings: raw.settings || {},
  };
}

async function runMigrationGoldenChecks() {
  const { migrateLayout, defaultLayout } = await loadUtils();
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name: name, pass: !!pass, detail: detail || null });

  // -- fixture manifest: every historical format has >= 1 golden file ------------
  const names = fixtureNames();
  add('fixtures-present',
    names.includes('v1.json') && names.includes('legacy-groups.json') && names.includes('legacy-v2.json'),
    'found ' + JSON.stringify(names));
  add('fixtures-schema-coverage',
    names.includes('v1.json') && names.includes('legacy-groups.json'),
    'v1.json = current schemaVersion, legacy-*.json = pre-versioning formats');

  // -- v1.json: current golden passes through unchanged (idempotent migration) ----
  {
    const raw = loadFixture('v1.json');
    const m = migrateLayout(JSON.parse(JSON.stringify(raw)));
    add('v1-bookmarks-preserved', canon(bookmarkIds(m)) === canon(bookmarkIds(raw)));
    add('v1-boxes-preserved', m.boxes.length === raw.boxes.length && m.connections.length === raw.connections.length);
    add('v1-schema-fields', m.schemaVersion === 1 && m.version === 3.5 && m._meta && m._meta.__groupsMigrated === true);
    add('v1-groups-stripped', Array.isArray(m.groups) && m.groups.length === 0);
    add('v1-props-present', (m.connections || []).every((c) => c.props && typeof c.props === 'object'));
    add('v1-idempotent', canon(migrateLayout(JSON.parse(JSON.stringify(m)))) === canon(m));
    // settings keep the union: every default key + the fixture values
    const d = defaultLayout();
    add('v1-settings-superset', Object.keys(d.settings).every((k) => k in m.settings) && m.settings.theme === 'beige');
  }

  // -- legacy-groups.json: ADR-0007 Q1 + Q4c one-time migration -------------------
  {
    const raw = loadFixture('legacy-groups.json');
    const m = migrateLayout(JSON.parse(JSON.stringify(raw)));
    add('groups-bookmarks-preserved', canon(bookmarkIds(m)) === canon(bookmarkIds(raw)));
    add('groups-isparent-restored-large', m.boxes.some((b) => b.id === 'lb1' && b.isParent === true));
    add('groups-isparent-restored-small', (m.boxes.find((b) => b.id === 'lb2') || { children: [] }).children.some((s) => s.id === 's3' && s.isParent === true));
    add('groups-stripped-after-migration', Array.isArray(m.groups) && m.groups.length === 0);
    add('groups-schema-version-defaulted', m.schemaVersion === 1 && m.version === 3.5);
    add('groups-props-backfilled', (m.connections || []).every((c) => c && typeof c.props === 'object'));
    add('groups-meta-flag-set', m._meta && m._meta.__groupsMigrated === true);
    add('groups-migration-idempotent', canon(migrateLayout(JSON.parse(JSON.stringify(m)))) === canon(m));
  }

  // -- legacy-v2.json: BX-DEV-085 v2 -> 3.5 expansion ------------------------------
  {
    const raw = loadFixture('legacy-v2.json');
    const once = migrateLayout(JSON.parse(JSON.stringify(raw)));
    add('v2-bookmarks-preserved', canon(bookmarkIds(once)) === canon(bookmarkIds(raw)));
    add('v2-version-bumped', once.version === 3.5);
    add('v2-size-defaults-filled', once.boxes[0].width != null && once.boxes[0].height != null
      && once.boxes[0].children[0].width != null && once.boxes[0].children[0].pinned === true);
    add('v2-theme-defaulted', once.settings.theme === 'beige');
    add('v2-next-small-index', once.boxes[0].nextSmallIndex === once.boxes[0].children.length + 1);
    // KNOWN GAP (upstream ticket per ticket-45 acceptance rule): the v2 branch returns
    // without connections/groups/schemaVersion keys; consumers normalize via the >= 3
    // branch on next load. Second pass must normalize without losing anything.
    const twice = migrateLayout(JSON.parse(JSON.stringify(once)));
    add('v2-second-pass-normalized', Array.isArray(twice.connections) && twice.schemaVersion === 1
      && canon(bookmarkIds(twice)) === canon(bookmarkIds(raw)));
  }

  // -- rollback safety: current persisted data readable by the previous reader -----
  {
    const current = migrateLayout(loadFixture('v1.json'));
    const serialized = JSON.parse(JSON.stringify(current)); // storage boundary
    const old = legacyReader(serialized);
    add('rollback-old-reader-accepts', old !== null);
    add('rollback-bookmarks-visible', old !== null && canon(bookmarkIds(old)) === canon(bookmarkIds(current)));
    add('rollback-boxes-visible', old !== null && old.boxes.length === current.boxes.length);
    add('rollback-connections-visible', old !== null && old.connections.length === current.connections.length);
    add('rollback-isparent-self-contained', old !== null && old.boxes.every((b) => b.groups === undefined)
      && current.boxes.some((b) => b.isParent === true)); // grouping survives the contract without groups
  }

  const failures = checks.filter((c) => !c.pass).map((c) => c.name);
  return { ok: failures.length === 0, failures: failures, checks: checks };
}

export { runMigrationGoldenChecks, loadFixture, fixtureNames };

// Self-run when invoked directly (npm run pretest).
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1].replace(/\\/g, '/')))) {
  const result = await runMigrationGoldenChecks();
  for (const c of result.checks) if (!c.pass) console.error('MIGRATION GOLDEN FAIL: ' + c.name + (c.detail ? ' (' + c.detail + ')' : ''));
  console.log(JSON.stringify({ ok: result.ok, passed: result.checks.filter((c) => c.pass).length, total: result.checks.length, failures: result.failures }));
  process.exitCode = result.ok ? 0 : 1;
}
