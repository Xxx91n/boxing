#!/usr/bin/env node
// i18n ratchet guard (ticket 118).
//
// Prevents untranslated English placeholder strings from silently accumulating in
// shipped locales. Compares each non-English locale's message values against en;
// fails if any locale's untranslated count exceeds its recorded ceiling in
// test/i18n-baseline.json.
//
// As translations land, lower the maxAllowed threshold in test/i18n-baseline.json
// so the ratchet continuously tightens toward zero.
//
// Exit 0 when the contract holds, exit 1 with named violations otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = path.join(ROOT, '_locales');
const BASELINE_PATH = path.join(ROOT, 'test', 'i18n-baseline.json');

/**
 * Verifies that all locales satisfy the i18n ratchet thresholds.
 * @returns {{ violations: string[], results: Record<string, { untranslatedCount: number, maxAllowed: number, untranslatedKeys: string[] }> }}
 */
export function checkI18nRatchet() {
  const violations = [];
  const enPath = path.join(LOCALES_DIR, 'en', 'messages.json');
  if (!fs.existsSync(enPath)) {
    return { violations: ['_locales/en/messages.json does not exist'], results: {} };
  }
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  if (!fs.existsSync(BASELINE_PATH)) {
    return { violations: ['test/i18n-baseline.json does not exist'], results: {} };
  }
  const baselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const baselines = baselineData.baselines || {};

  const locales = fs.readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'en')
    .map(d => d.name)
    .sort();

  const results = {};

  for (const loc of Object.keys(baselines)) {
    if (!locales.includes(loc)) {
      violations.push(`Locale ${loc} is missing`);
    }
  }

  for (const loc of locales) {
    const locPath = path.join(LOCALES_DIR, loc, 'messages.json');
    if (!fs.existsSync(locPath)) {
      violations.push(`Locale ${loc} missing messages.json`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    const untranslated = [];

    for (const [key, val] of Object.entries(en)) {
      if (!data[key] || data[key].message === val.message) {
        untranslated.push(key);
      }
    }

    const baseline = baselines[loc];
    if (!baseline) {
      violations.push(`Locale ${loc} has no baseline defined in test/i18n-baseline.json`);
      continue;
    }

    const maxAllowed = typeof baseline === 'number' ? baseline : baseline.maxAllowed;
    results[loc] = {
      untranslatedCount: untranslated.length,
      maxAllowed,
      untranslatedKeys: untranslated
    };

    if (untranslated.length > maxAllowed) {
      violations.push(
        `Locale ${loc} untranslated count ${untranslated.length} exceeds baseline maxAllowed ${maxAllowed} (untranslated keys: ${untranslated.join(', ')})`
      );
    }
  }

  return { violations, results };
}

const { violations, results } = checkI18nRatchet();
const ok = violations.length === 0;

if (ok) {
  console.log('✓ i18n ratchet guard: all locales within baseline thresholds');
  for (const [loc, res] of Object.entries(results)) {
    console.log(`  - ${loc}: ${res.untranslatedCount} / max ${res.maxAllowed}`);
  }
} else {
  console.error('✗ i18n ratchet guard violations:');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
}

process.exit(ok ? 0 : 1);
