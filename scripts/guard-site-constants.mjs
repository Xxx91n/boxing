#!/usr/bin/env node
// D-002 / S-02 req4: Build-time consistency guard for public site URLs.
// Asserts that build-side (.github/scripts/site-constants.mjs) and
// runtime-side (ntp/site-constants.js) URL constants match exactly,
// and that settings-ui.js consumes PRIVACY_URL without string literal hardcoding.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const isSelfTest = process.argv.includes('--self-test');

export function checkConstants(buildConstants, runtimeConstants, settingsUiContent) {
  const errors = [];

  const requiredKeys = ['SITE_URL', 'PRIVACY_URL', 'DEMO_URL'];
  for (const k of requiredKeys) {
    if (!buildConstants[k]) errors.push(`buildConstants missing key: ${k}`);
    if (!runtimeConstants[k]) errors.push(`runtimeConstants missing key: ${k}`);
    if (buildConstants[k] && runtimeConstants[k] && buildConstants[k] !== runtimeConstants[k]) {
      errors.push(`URL mismatch for ${k}: build='${buildConstants[k]}' vs runtime='${runtimeConstants[k]}'`);
    }
  }

  // Ensure settings-ui.js imports and consumes PRIVACY_URL
  if (!settingsUiContent.includes("from './site-constants.js'")) {
    errors.push("ntp/settings-ui.js does not import from './site-constants.js'");
  }
  if (!settingsUiContent.includes("'about-link-privacy': PRIVACY_URL")) {
    errors.push("ntp/settings-ui.js does not map 'about-link-privacy' to PRIVACY_URL");
  }
  if (settingsUiContent.includes("'about-link-privacy': 'http")) {
    errors.push("ntp/settings-ui.js hardcodes 'about-link-privacy' to a string literal");
  }

  return errors;
}

if (isSelfTest) {
  // Test negative cases
  const fakeBuild = { SITE_URL: 'https://example.com', PRIVACY_URL: 'https://example.com/p', DEMO_URL: 'https://example.com/d' };
  const fakeRuntime = { SITE_URL: 'https://mismatch.com', PRIVACY_URL: 'https://example.com/p', DEMO_URL: 'https://example.com/d' };
  const fakeSettings = "import { PRIVACY_URL } from './site-constants.js'; const links = { 'about-link-privacy': PRIVACY_URL };";

  const errs = checkConstants(fakeBuild, fakeRuntime, fakeSettings);
  if (errs.length === 0 || !errs[0].includes('URL mismatch for SITE_URL')) {
    console.error('FAIL: self-test did not catch URL mismatch');
    process.exit(1);
  }

  const badSettings = "const links = { 'about-link-privacy': 'https://hardcoded.com' };";
  const errs2 = checkConstants(fakeBuild, fakeBuild, badSettings);
  if (errs2.length === 0 || !errs2.some(e => e.includes('does not import'))) {
    console.error('FAIL: self-test did not catch missing import in settings');
    process.exit(1);
  }

  console.log('guard-site-constants: self-test passed.');
  process.exit(0);
}

// Live execution
async function main() {
  const buildMod = await import(pathToFileURL(path.join(ROOT, '.github', 'scripts', 'site-constants.mjs')).href);
  const runtimeMod = await import(pathToFileURL(path.join(ROOT, 'ntp', 'site-constants.js')).href);
  const settingsUiContent = fs.readFileSync(path.join(ROOT, 'ntp', 'settings-ui.js'), 'utf8');

  const errors = checkConstants(buildMod, runtimeMod, settingsUiContent);
  if (errors.length > 0) {
    console.error('FAIL guard-site-constants:');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log('guard-site-constants: OK — build and runtime site constants aligned, single-source enforced.');
}

main().catch(err => {
  console.error('FATAL guard-site-constants:', err);
  process.exit(1);
});
