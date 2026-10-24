#!/usr/bin/env node
// Manifest contract guard.
//
// The source manifest is intentionally Firefox-loadable and Chrome-rejectable:
// it keeps both background declarations plus the gecko block, and keeps
// browserSettings out of the source permissions (the Firefox Tailor injects it
// into dist/ at build time). Removing any of these breaks one browser.
//
// Exit 0 when the contract holds, exit 1 with named violations otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'manifest.json');

export function checkManifest(manifest) {
  const errors = [];
  const background = manifest.background || {};
  if (background.service_worker !== 'background.js') {
    errors.push('background.service_worker must be "background.js"');
  }
  const scripts = Array.isArray(background.scripts) ? background.scripts : [];
  if (!scripts.includes('background.js')) {
    errors.push('background.scripts must include "background.js"');
  }
  if (!manifest.browser_specific_settings || !manifest.browser_specific_settings.gecko) {
    errors.push('browser_specific_settings.gecko must be present');
  }
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  if (permissions.includes('browserSettings')) {
    errors.push('permissions must not declare browserSettings in the source manifest');
  }
  return errors;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const violations = checkManifest(manifest);
const report = {
  ok: violations.length === 0,
  checked: ['background.service_worker', 'background.scripts', 'browser_specific_settings.gecko', 'permissions.browserSettings'],
  violations
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
