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

const report = {
  ok: violations.length === 0,
  checked: ['CSP meta', 'dangerous protocol rejection', '2MB import cap', 'plain-text paste handlers'],
  violations
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
