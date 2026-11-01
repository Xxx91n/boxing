#!/usr/bin/env node
// Security contract guard for the NTP surface.
//
// Checks that the mechanically verifiable SEC rules stay in force:
//   - CSP meta tag in ntp/index.html
//   - dangerous protocol rejection in ensureHttpsUrl
//   - 2MB import payload cap
//   - plain-text paste handling on every editable title
//
// Exit 0 when the contract holds, exit 1 with named violations otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('ntp/index.html');
const utils = read('ntp/utils.js');
const settingsUi = read('ntp/settings-ui.js');
const render = read('ntp/render.js');
const favicon = read('ntp/favicon.js');

const violations = [];

for (const token of ["default-src 'self'", "script-src 'self'", "img-src 'self' https: data:", "connect-src 'self' https:"]) {
  if (!html.includes(token)) violations.push(`ntp/index.html CSP missing: ${token}`);
}

if (!/javascript\|data\|vbscript/i.test(utils)) {
  violations.push('ntp/utils.js no longer rejects javascript:/data:/vbscript: protocols');
}

if (!/JSON\.stringify\(data\)\.length\s*>\s*2_000_000/.test(settingsUi)) {
  violations.push('ntp/settings-ui.js import payload is not capped at 2_000_000 bytes');
}

const pasteHandlers = (render.match(/execCommand\('insertText', false, text\)/g) || []).length;
if (pasteHandlers < 3) {
  violations.push(`ntp/render.js plain-text paste handlers: expected >=3, found ${pasteHandlers}`);
}

// D11: every outbound endpoint declared in the runtime source must be
// disclosed in docs/privacy-policy.md. Adding a new CDN / service without
// updating the policy fails here (the drift is mechanical, so the check is).
const OUTBOUND_SCAN_FILES = ['ntp/favicon.js', 'ntp/settings-ui.js', 'ntp/sync-engine.js', 'ntp/site-constants.js'];
// github.com appears in the UI only as repo/issue/release page links, not as API traffic.
const IGNORED_OUTBOUND_HOSTS = new Set(['github.com']);
const privacyPolicy = read('docs/privacy-policy.md').toLowerCase();

function extractOutboundHosts(src) {
  const hosts = new Set();
  const re = /https:\/\/([a-z0-9.-]+)(?::[0-9]+)?/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    let h = m[1].toLowerCase();
    if (h.startsWith('www.')) h = h.slice(4);
    if (!IGNORED_OUTBOUND_HOSTS.has(h)) hosts.add(h);
  }
  return hosts;
}

const declaredHosts = new Set();
for (const rel of OUTBOUND_SCAN_FILES) {
  for (const h of extractOutboundHosts(read(rel))) declaredHosts.add(h);
}
for (const h of [...declaredHosts].sort()) {
  if (!privacyPolicy.includes(h)) {
    violations.push(`outbound endpoint ${h} is declared in runtime source but missing from docs/privacy-policy.md`);
  }
}
if (favicon.includes('favicon.ico') && !privacyPolicy.includes('favicon.ico')) {
  violations.push('direct /favicon.ico probing declared in ntp/favicon.js but missing from docs/privacy-policy.md');
}

const report = {
  ok: violations.length === 0,
  checked: ['CSP meta', 'dangerous protocol rejection', '2MB import cap', 'plain-text paste handlers', 'outbound endpoints disclosed in privacy policy'],
  violations
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
