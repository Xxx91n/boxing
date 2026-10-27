#!/usr/bin/env node
// Ticket 45 (architecture-recovery): data-compatibility golden gates, pretest half.
// Runs migrateLayout (ntp/utils.js) over the golden fixtures in test/fixtures/schema/
// and asserts the issue-45 acceptance contract: no bookmark loss on old -> new migration,
// rollback (new data readable under the previous reader constraints, expand/contract).
// Same module is imported by test/tests/boxing-migration-golden.spec.ts so pretest and
// the Playwright report never diverge. Failures exit 1, which makes npm test (and CI,
// which runs it via the pretest lifecycle) red — per issues/45, red is the gate.
//
// Covers: release gating, schemaVersion / crash rescue, the groups -> isParent
// one-time migration, and connection props backfill.

import fs from 'node:fs';
import path from 'node:path';
import { rollbackAudit } from './legacy-reader-frozen.mjs';

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

  // -- legacy-groups.json: groups migration (runtime-only) + props backfill --------
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

  // -- legacy-v2.json: v2 -> 3.5 expansion ------------------------------
  {
    const raw = loadFixture('legacy-v2.json');
    const once = migrateLayout(JSON.parse(JSON.stringify(raw)));
    add('v2-bookmarks-preserved', canon(bookmarkIds(once)) === canon(bookmarkIds(raw)));
    add('v2-version-bumped', once.version === 3.5);
    add('v2-size-defaults-filled', once.boxes[0].width != null && once.boxes[0].height != null
      && once.boxes[0].children[0].width != null && once.boxes[0].children[0].pinned === true);
    add('v2-theme-defaulted', once.settings.theme === 'beige');
    add('v2-next-small-index', once.boxes[0].nextSmallIndex === once.boxes[0].children.length + 1);
    // Issue #34: one pass must yield a complete layout. A crash-rescue write-back of
    // this first result must not depend on a later load to restore missing keys.
    add('v2-one-pass-complete',
      Array.isArray(once.connections) && Array.isArray(once.groups)
      && once.schemaVersion === 1 && once._meta && once._meta.__groupsMigrated === true);
    add('v2-groups-stripped', once.groups.length === 0);
    add('v2-idempotent',
      canon(migrateLayout(JSON.parse(JSON.stringify(once)))) === canon(once));

    // Same payload shape as legacy-groups.json, downgraded to v2: the single pass must
    // still preserve its connection and restore isParent from the legacy groups row.
    // Input reuses repo fixtures instead of a freshly invented shape.
    const v2Groups = { ...loadFixture('legacy-groups.json'), version: 2 };
    const v2GroupsOnce = migrateLayout(JSON.parse(JSON.stringify(v2Groups)));
    add('v2-preserves-connections', v2GroupsOnce.connections.length === v2Groups.connections.length
      && v2GroupsOnce.connections[0].props && typeof v2GroupsOnce.connections[0].props === 'object');
    add('v2-restores-isparent-from-groups', v2GroupsOnce.boxes.some((b) => b.id === 'lb1' && b.isParent === true)
      && v2GroupsOnce.boxes.find((b) => b.id === 'lb2').children.some((s) => s.id === 's3' && s.isParent === true));

    // Malformed legacy groups rows must not throw out of migration: a throw during
    // boot would enter recovery without archiving the otherwise readable payload.
    // Input reuses legacy-v2.json and only injects invalid group rows.
    const v2Malformed = { ...loadFixture('legacy-v2.json'), groups: [{ parentId: 42 }, null, {}] };
    let malformedOk = false;
    try {
      const onceMalformed = migrateLayout(JSON.parse(JSON.stringify(v2Malformed)));
      malformedOk = canon(bookmarkIds(onceMalformed)) === canon(bookmarkIds(v2Malformed))
        && Array.isArray(onceMalformed.groups) && onceMalformed.groups.length === 0;
    } catch (_) { malformedOk = false; }
    add('v2-malformed-groups-tolerated', malformedOk);
  }

  // -- rollback safety: current persisted data readable by the previous reader -----
  // The reader itself is the append-only pre-adr0009 contract; the gate keeps the
  // layout comparison helpers and derives the same five checks from one audit.
  {
    const current = migrateLayout(loadFixture('v1.json'));
    const audit = rollbackAudit('pre-adr0009', current);
    add('rollback-old-reader-accepts', audit.acceptance);
    add('rollback-bookmarks-visible', audit.acceptance
      && audit.bookmarkDiff.lost.length === 0 && audit.bookmarkDiff.gained.length === 0);
    add('rollback-boxes-visible', audit.acceptance && audit.boxDelta === 0);
    add('rollback-connections-visible', audit.acceptance && audit.connectionDelta === 0);
    add('rollback-isparent-self-contained', audit.acceptance
      && audit.starSurvival.lost.length === 0 && !audit.starSurvival.groupsLeaked
      && audit.starSurvival.total > 0); // grouping survives the contract without groups
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
