
const fs = require('fs');
const path = require('path');
const root = 'D:/Aworker/crx/boxing';
const ar = path.join(root, '.scratch/architecture-recovery');
const grill = path.join(root, '.scratch/wave7-flash-grill');
const findings = [];
function add(sev, code, msg) { findings.push(sev + '|' + code + '|' + msg); }

const w7ledger = fs.readFileSync(path.join(grill, 'decision-ledger.md'), 'utf8');
const arLedger = fs.readFileSync(path.join(ar, 'decision-ledger.md'), 'utf8');
const spec = fs.readFileSync(path.join(ar, 'spec.md'), 'utf8');
const plan = fs.readFileSync(path.join(grill, 'plan.md'), 'utf8');
const readme = fs.readFileSync(path.join(ar, 'README.md'), 'utf8');

function parseCurrentD(text) {
  const rows = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    if (line.indexOf('| ID |') === 0) { inTable = true; continue; }
    if (inTable && line.indexOf('|---') === 0) continue;
    if (inTable && /^\| D-\d{3} \|/.test(line)) {
      const cells = line.split('|').map(function(s){ return s.trim(); });
      // leading empty, then fields, trailing empty
      const f = cells.slice(1, cells.length - 1);
      if (f.length >= 6) rows.push({ id: f[0], problem: f[1], answer: f[2], need: f[3], constraints: f[4], status: f[5] });
    } else if (inTable && line.charAt(0) !== '|') inTable = false;
  }
  return rows.filter(function(r){ return r.status.indexOf('current') >= 0; });
}
function parseCurrentA(text) {
  const part = text.split('## Wave7')[1] || '';
  const rows = [];
  for (const line of part.split('\n')) {
    if (/^\| A-\d{3} \|/.test(line)) {
      const cells = line.split('|').map(function(s){ return s.trim(); });
      const f = cells.slice(1, cells.length - 1);
      if (f.length >= 5) rows.push({ id: f[0], problem: f[1], need: f[2], constraints: f[3], status: f[4] });
    }
  }
  return rows;
}

const dCur = parseCurrentD(w7ledger);
const aAll = parseCurrentA(arLedger);
const aCur = aAll.filter(function(r){ return r.status.indexOf('current') >= 0; }).map(function(r){ return r.id; });
const aDef = aAll.filter(function(r){ return r.status.indexOf('deferred') >= 0; }).map(function(r){ return r.id; });

if (dCur.length !== 4) add('FAIL', 'D-COUNT', String(dCur.length));
if (aCur.length !== 9) add('FAIL', 'A-CUR-COUNT', aCur.join(','));

// D problem fragments must appear in A problem (quote fidelity smoke)
const pair = [
  ['D-001', 'A-012', '\u8303\u56F4'],
  ['D-002', 'A-013', '\u95EA\u73B0'],
  ['D-003', 'A-014', '\u62C6\u7968'],
  ['D-004', 'A-015', 'README']
];
const dById = {};
dCur.forEach(function(r){ dById[r.id] = r; });
const aById = {};
aAll.forEach(function(r){ aById[r.id] = r; });

// Field compare: key phrases from grill need/constraints must appear in A need/constraints or issue
function mustContain(hay, needles, label) {
  needles.forEach(function(n) {
    if (hay.indexOf(n) < 0) add('FAIL', 'PHRASE', label + ' missing "' + n + '"');
  });
}
if (dById['D-002']) {
  mustContain(aById['A-013'].need + aById['A-013'].constraints, ['\u4E3B\u9898', '\u5185\u5BB9'], 'A-013 vs D-002');
}
if (dById['D-003']) {
  mustContain(aById['A-014'].need + aById['A-014'].constraints, ['\u4E00\u5F20', 'ADR-0017'], 'A-014 vs D-003');
}
if (dById['D-004']) {
  mustContain(aById['A-015'].need, ['2026.9.11'], 'A-015 vs D-004');
  mustContain(aById['A-017'].constraints, ['passphrase'], 'A-017 vs D-004');
  mustContain(aById['A-020'].constraints, ['i18n'], 'A-020 vs D-004');
}

const tickets = [
  { n: 60, slug: 'ntp-new-tab-zero-flash', title: 'ntp \u65B0\u5F00\u6807\u7B7E\u96F6\u95EA\u73B0\uFF08FART+\u5185\u5BB9\u906E\u7F69\uFF09', prio: 'P1', covers: ['A-013','A-014'], blocked: 'None', plan: 'W7-T1' },
  { n: 61, slug: 'readme-release-claims-narrow', title: 'README \u53D1\u884C\u58F0\u660E\u6536\u7A84', prio: 'P1', covers: ['A-015'], blocked: 'None', plan: 'W7-T2' },
  { n: 62, slug: 'git-history-declaration', title: 'Git \u5386\u53F2\u58F0\u660E\uFF08\u6761\u4EF6\uFF09', prio: 'P2', covers: ['A-016'], blocked: 'None', plan: 'W7-T3' },
  { n: 63, slug: 'credentials-honest-label', title: 'CRED \u8BDA\u5B9E\u6807\u6CE8\u6216 per-install key', prio: 'P1', covers: ['A-017'], blocked: 'None', plan: 'W7-T4' },
  { n: 64, slug: 'webdav-private-host-docs', title: 'WebDAV \u79C1\u7F51\u9650\u5236\u6587\u6863\u5316', prio: 'P2', covers: ['A-018'], blocked: '61', plan: 'W7-T5' },
  { n: 65, slug: 'user-visible-version-strings', title: '\u7EDF\u4E00\u7528\u6237\u53EF\u89C1\u7248\u672C\u4E32', prio: 'P2', covers: ['A-019'], blocked: 'None', plan: 'W7-T6' },
  { n: 66, slug: 'visible-debt-markers-merge', title: '\u7528\u6237\u53EF\u89C1\u503A\u52A1\u6807\u8BB0\u5408\u5E76\u6E05\u7406', prio: 'P2', covers: ['A-020'], blocked: 'None', plan: 'W7-T7' }
];

const banned = ['worktree', 'git checkout', 'git branch', 'git reset --hard', 'git push --force', 'git rebase -i'];
const coverUnion = new Set();
const specCovers = new Set();

// parse spec covers line
const specCoverLine = (spec.split('\n').filter(function(l){ return l.indexOf('**\u8986\u76D6 A-xxx:**') >= 0 && l.indexOf('Wave7') < 0; }) || []).pop() ||
  (spec.split('## Wave7')[1] || '').split('\n').filter(function(l){ return l.indexOf('**\u8986\u76D6 A-xxx:**') >= 0; })[0] || '';
const specAs = (specCoverLine.match(/A-\d{3}/g) || []);
specAs.forEach(function(a){ specCovers.add(a); });
if (specCovers.size < 9) add('FAIL', 'SPEC-COVER', 'spec covers ' + Array.from(specCovers).join(','));

// three-way: current A (non-deferred that should be in tickets) = A-012 is scope, tickets cover A-013..020
const aShouldBeInSpec = aCur; // all current must be in spec
aShouldBeInSpec.forEach(function(a) {
  if (!specCovers.has(a)) add('FAIL', 'COVER-SPEC', a + ' current in ledger but not in spec covers');
});

for (let i = 0; i < tickets.length; i++) {
  const t = tickets[i];
  const base = t.n + '-' + t.slug;
  const ip = path.join(ar, 'issues', base + '.md');
  const hp = path.join(ar, 'handoffs', base + '.md');
  const pp = path.join(ar, 'prompts', base + '.md');
  const files = { issue: ip, handoff: hp, prompt: pp };
  const texts = {};
  Object.keys(files).forEach(function(k) {
    if (!fs.existsSync(files[k])) { add('FAIL', 'MISSING', files[k]); return; }
    texts[k] = fs.readFileSync(files[k], 'utf8');
  });
  if (!texts.issue) continue;

  // titles
  if (texts.issue.indexOf(t.title) < 0) add('FAIL', 'TITLE-ISSUE', base + ' expected title fragment');
  if (texts.handoff.indexOf(t.title) < 0) add('FAIL', 'TITLE-HANDOFF', base);
  if (texts.prompt.indexOf(t.title) < 0) add('FAIL', 'TITLE-PROMPT', base);

  // covers
  const ic = texts.issue.match(/A-\d{3}/g) || [];
  const hc = texts.handoff.match(/A-\d{3}/g) || [];
  const pc = texts.prompt.match(/A-\d{3}/g) || [];
  t.covers.forEach(function(a) {
    if (ic.indexOf(a) < 0) add('FAIL', 'COVER-ISSUE', base + ' missing ' + a);
    if (hc.indexOf(a) < 0) add('FAIL', 'COVER-HANDOFF', base + ' missing ' + a);
    if (pc.indexOf(a) < 0) add('FAIL', 'COVER-PROMPT', base + ' missing ' + a);
    coverUnion.add(a);
  });

  // blocked by
  if (t.blocked === 'None') {
    if (texts.issue.indexOf('None (can start immediately)') < 0) add('FAIL', 'BLOCK-ISSUE', base + ' expected None');
    if (texts.prompt.indexOf('None') < 0) add('FAIL', 'BLOCK-PROMPT', base + ' expected None');
    if (texts.handoff.indexOf('None') < 0) add('FAIL', 'BLOCK-HANDOFF', base);
  } else {
    if (texts.issue.indexOf('**Blocked by:** ' + t.blocked) < 0) add('FAIL', 'BLOCK-ISSUE', base + ' expected blocked by ' + t.blocked);
    if (texts.prompt.indexOf(t.blocked) < 0) add('FAIL', 'BLOCK-PROMPT', base + ' missing ' + t.blocked);
  }

  // readme wave row
  if (readme.indexOf(String(t.n)) < 0) add('FAIL', 'README-N', 'missing ticket ' + t.n);

  // banned words
  Object.keys(texts).forEach(function(k) {
    const low = texts[k].toLowerCase();
    banned.forEach(function(b) {
      if (low.indexOf(b) >= 0) add('FAIL', 'BANNED', base + ' ' + k + ' has ' + b);
    });
  });

  // restating upstream: prompt must not contain long verbatim AC bullets from issue
  const acLines = texts.issue.split('\n').filter(function(l){ return l.indexOf('- [ ]') === 0; });
  let restated = 0;
  acLines.forEach(function(l) {
    const body = l.replace('- [ ]', '').trim();
    if (body.length > 12 && texts.prompt.indexOf(body) >= 0) restated++;
  });
  if (restated > 0) add('FAIL', 'RESTATE', base + ' prompt restates ' + restated + ' AC lines');

  // prompt should reference handoff not duplicate research section
  if (texts.prompt.indexOf('atomcode \u6DF1\u5EA6\u8C03\u7814') >= 0 && texts.prompt.indexOf('ctx_batch_execute') >= 0 && texts.prompt.indexOf('\u4E32\u884C') >= 0 && texts.handoff.indexOf('\u901A\u7528\u8C03\u7814\u8981\u6C42') < 0) {
    add('FAIL', 'RESTATE-RESEARCH', base + ' research in prompt but not handoff');
  }
  // prefer research only in handoff: if prompt has long research block, flag
  if ((texts.prompt.match(/atomcode/g) || []).length > 2) add('WARN', 'RESEARCH-PROMPT', base + ' atomcode mentioned >2 in prompt');

  // plan cross-ref
  if (plan.indexOf(t.plan) < 0) add('FAIL', 'PLAN', base + ' missing ' + t.plan);

  // line counts prompt
  const pl = texts.prompt.split('\n').length;
  if (pl > 60) add('FAIL', 'PROMPT-LEN', base + ' lines=' + pl);

  // AC non-empty
  if (acLines.length < 3) add('FAIL', 'AC-THIN', base + ' ac=' + acLines.length);

  // path refs in prompt exist
  const pathRe = /\.scratch\/architecture-recovery\/[A-Za-z0-9_\-\/\.]+/g;
  const paths = texts.prompt.match(pathRe) || [];
  paths.forEach(function(rel) {
    // strip trailing punctuation
    const clean = rel.replace(/[\uFF1B;\u3002\uFF0C,]+$/, '');
    if (clean.indexOf('reports/') >= 0) return; // future artifact
    const abs = path.join(root, clean);
    if (!fs.existsSync(abs)) add('FAIL', 'PATH', base + ' missing ' + clean);
  });
}

// cover union = ticket covers should equal spec non-deferred implementation set (A-013..A-020)
const ticketCovers = Array.from(coverUnion).sort();
const expectedTicketCovers = aCur.filter(function(a){ return a !== 'A-012'; }).sort();
if (ticketCovers.join(',') !== expectedTicketCovers.join(',')) {
  add('FAIL', 'COVER-UNION', 'tickets=' + ticketCovers.join(',') + ' expected=' + expectedTicketCovers.join(','));
}
// A-012 must appear in spec
if (spec.indexOf('A-012') < 0) add('FAIL', 'SPEC-A012', 'spec missing A-012');

// deferred must NOT be in any issue covers
tickets.forEach(function(t) {
  const ip = path.join(ar, 'issues', t.n + '-' + t.slug + '.md');
  const c = fs.readFileSync(ip, 'utf8');
  aDef.forEach(function(a) {
    if (c.indexOf(a) >= 0) add('FAIL', 'DEFERRED-IN-ISSUE', t.n + ' contains ' + a);
  });
});

// OUTPUT
const fails = findings.filter(function(f){ return f.indexOf('FAIL|') === 0; });
const warns = findings.filter(function(f){ return f.indexOf('WARN|') === 0; });
const lines = [];
lines.push('# Wave7 \u7A0B\u5E8F\u5316\u6BD4\u5BF9\u62A5\u544A');
lines.push('');
lines.push('## \u6E90');
lines.push('- grill D current: ' + dCur.map(function(r){return r.id;}).join(', '));
lines.push('- ar A current: ' + aCur.join(', '));
lines.push('- ar A deferred: ' + aDef.join(', '));
lines.push('- spec covers: ' + specAs.join(', '));
lines.push('- ticket cover union: ' + ticketCovers.join(', '));
lines.push('');
lines.push('## \u4E0D\u4E00\u81F4\u6E05\u5355\uFF08FAIL\uFF09');
if (fails.length === 0) lines.push('\uFF08\u7A7A\uFF09');
else fails.forEach(function(f){ lines.push('- ' + f); });
lines.push('');
lines.push('## \u8B66\u544A\uFF08WARN\uFF09');
if (warns.length === 0) lines.push('\uFF08\u7A7A\uFF09');
else warns.forEach(function(f){ lines.push('- ' + f); });
lines.push('');
lines.push('## \u4E09\u7EF4\u7ED3\u8BBA');
lines.push('1. \u7981\u6B62\u6A21\u5F0F: ' + (findings.some(function(f){return f.indexOf('BANNED|')>=0;}) ? '\u6709\u8FDD\u7981' : '\u672A\u547D\u4E2D worktree/\u88F8 git \u5199\u547D\u4EE4'));
lines.push('2. \u590D\u8FF0\u4E0A\u6E38\u6761\u6B3E: ' + (findings.some(function(f){return f.indexOf('RESTATE|')>=0;}) ? '\u6709\u590D\u8FF0' : '\u672A\u53D1\u73B0 prompt \u590D\u8FF0 issue AC \u539F\u6587'));
lines.push('3. \u4E09\u6BB5\u8986\u76D6: spec\u2287currentA ? ' + (aCur.every(function(a){return specCovers.has(a);}) ? 'YES' : 'NO') + ' ; tickets\u222A=' + (ticketCovers.join(',')===expectedTicketCovers.join(',') ? 'YES' : 'NO'));
lines.push('');
lines.push('FAIL_COUNT=' + fails.length);
const out = lines.join('\n');
fs.writeFileSync(path.join(ar, 'reports', 'W7-programmatic-audit.md'), out, 'utf8');
console.log(out);
if (fails.length) process.exit(2);
