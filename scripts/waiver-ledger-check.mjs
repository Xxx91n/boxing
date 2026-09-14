#!/usr/bin/env node
// Ticket 48 (architecture-recovery): G-A residual-red written-waiver ledger gate.
// Ticket 105 (covers A-059 / B69): adds the revocation-criteria gate — a `closed`
// row must prove the two-run revocation criterion, and the criteria rule text
// itself must still be present in the ledger.
// Parses the 「G-A 残红书面豁免台账 (Waiver Ledger」 table in
// .scratch/architecture-recovery/WORKFLOW.md and enforces the ticket-48 / spec
// W6-D3 / ADR-0017 rules mechanically:
//   1. every active entry carries all 5 fields (用例名 | 基线 run | 失败签名 | 归属票 | 到期);
//   2. no active entry may be past its expiry (到期未修 → 禁用或删除并记录, not renew);
//   3. never-quarantine families (data integrity / migration roundtrip / rollback
//      drill) may never hold a waiver row at all — red there is fix-or-retire only;
//   4. the 撤账判据 (revocation criteria) rule text must still be present (ticket 105);
//   5. every `closed` row must carry a 「撤账证据:」 marker citing at least two
//      distinct runs, one of them annotated `corroboration` — the ≥2-consecutive-
//      green-run revocation criterion (ticket 105).
// Exit non-zero blocks the release checklist G-A step. Signature freshness against
// the newest baseline run stays a manual check (the ledger row carries the run URL).
//
// Usage: node scripts/waiver-ledger-check.mjs [--as-of YYYY-MM-DD]

import fs from 'node:fs';

const LEDGER_FILE = new URL('../.scratch/architecture-recovery/WORKFLOW.md', import.meta.url);
const NEVER_QUARANTINE = /data-golden|migration-golden|update-cow|snapshot-rotation|state-sync|data-recovery|import-merge|webdav|sync-ui|boxing-sync/i;
const REVOCATION_RULE = '撤账判据';
const REVOCATION_MIN_RUNS = 2;
const RUN_REF_SRC = '(?:actions/runs/|run\\s+)(\\d{6,})';

function parseArgs() {
  const a = process.argv.slice(2);
  const i = a.indexOf('--as-of');
  return { asOf: i >= 0 && a[i + 1] ? a[i + 1] : null };
}

const rows = [];
let section = '';
{
  const text = fs.readFileSync(LEDGER_FILE, 'utf8');
  const start = text.indexOf('### G-A 残红书面豁免台账');
  if (start < 0) {
    console.error('waiver-ledger: WORKFLOW.md has no 「G-A 残红书面豁免台账」 section — ledger missing is itself a gate failure (ticket 48).');
    process.exit(1);
  }
  section = text.slice(start, text.indexOf('\n## ', start) > -1 ? text.indexOf('\n## ', start) : text.length);
  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*(active|expired-handled|closed|disabled|deleted)\s*\|(.*)$/);
    if (!m) continue;
    const cells = m[2].split('|').map(c => c.trim()).filter((c, idx, arr) => idx < 5 || true);
    // cells: 用例名, 基线 run, 失败签名, 归属票, 到期, 处置记录 (状态 already consumed)
    rows.push({ status: m[1], name: cells[0], run: cells[1], sig: cells[2], ticket: cells[3], expiry: cells[4], disposal: cells[5], raw: line });
  }
}

const { asOf } = parseArgs();
const today = asOf || new Date().toISOString().slice(0, 10);
const problems = [];

// (4) The revocation criteria rule text must survive in the ledger section: a
// closed row is unverifiable without the rule it is supposed to satisfy.
if (!section.includes(REVOCATION_RULE)) {
  problems.push('ledger is missing the 「' + REVOCATION_RULE + '」 (revocation criteria) rule — ticket 105.');
}

for (const r of rows) {
  const label = r.name ? r.name.slice(0, 60) : '(row without name)';
  if (NEVER_QUARANTINE.test(r.name)) {
    problems.push('never-quarantine family holds a waiver row (数据完整性/迁移/回滚类永不豁免, closed 行同受约束): ' + label);
  }
  // (5) ticket 105: closing a row is a two-run decision, never a one-run observation.
  if (r.status === 'closed') {
    const marker = r.raw.match(/撤账证据\s*[:：]([\s\S]*)$/);
    if (!marker) {
      problems.push('closed waiver has no 「撤账证据:」 marker — revocation needs ≥' + REVOCATION_MIN_RUNS + ' consecutive green runs (ticket 105): ' + label);
    } else {
      const seen = new Set();
      const re = new RegExp(RUN_REF_SRC, 'g');
      let g = re.exec(marker[1]);
      while (g !== null) { seen.add(g[1]); g = re.exec(marker[1]); }
      if (seen.size < REVOCATION_MIN_RUNS) {
        problems.push('closed waiver 「撤账证据」 cites ' + seen.size + ' distinct run(s), needs ≥' + REVOCATION_MIN_RUNS + ' (≥2 consecutive green main runs, ticket 105): ' + label);
      }
      if (!/corroboration/i.test(marker[1])) {
        problems.push('closed waiver 「撤账证据」 lacks the corroboration annotation — ≥1 of the two runs must be a same-commit re-run (ticket 105): ' + label);
      }
    }
  }
  if (r.status !== 'active') continue;
  for (const [k, v] of Object.entries({ 用例名: r.name, '基线 run': r.run, 失败签名: r.sig, 归属票: r.ticket, 到期: r.expiry })) {
    if (!v || /^_{3,}$/.test(v)) problems.push('active waiver missing field ' + k + ': ' + label);
  }
  if (!/^https:\/\/|run \d|CI run/i.test(r.run || '')) problems.push('active waiver 「基线 run」 is not a run URL: ' + label);
  const exp = (r.expiry || '').match(/(\d{4}-\d{2}-\d{2})/);
  if (!exp) problems.push('active waiver 「到期」 has no ISO date (hard expiry required): ' + label);
  else if (exp[1] < today) problems.push('active waiver EXPIRED (' + exp[1] + ' < ' + today + ') — 到期未修必须禁用或删除并回填处置记录, 禁止续期: ' + label);
}

if (problems.length) {
  console.error('waiver-ledger-check: ' + problems.length + ' problem(s):');
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
const closedCount = rows.filter(r => r.status === 'closed').length;
console.log('waiver-ledger-check: OK — ' + rows.length + ' ledger row(s) (' + closedCount + ' closed with ≥' + REVOCATION_MIN_RUNS + '-run + corroboration revocation evidence), all fields complete, none expired, never-quarantine clear (incl. closed rows), revocation criteria present (as of ' + today + ').');
