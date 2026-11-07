import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT, '_locales');
const BASELINE_PATH = path.join(ROOT, 'test', 'i18n-baseline.json');

// Ticket 118: i18n ratchet spec.
// Guards against silent accumulation of English placeholders in non-English locales.
// 1. Every non-English locale has an untranslated count at or below the baseline ceiling.
// 2. The critical danger-zone credentials block is translated in every locale.
// 3. Common action labels (e.g. editBookmarkLabel, importTooLarge) are translated in every locale.

test.describe('i18n ratchet guard (ticket 118)', () => {
  const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en', 'messages.json'), 'utf8'));
  const baselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const baselines = baselineData.baselines;

  const nonEnLocales = fs.readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'en')
    .map(d => d.name)
    .sort();

  test('all 13 non-English locales satisfy ratchet thresholds from baseline', () => {
    expect(nonEnLocales).toEqual(Object.keys(baselines).sort());

    for (const loc of nonEnLocales) {
      const locPath = path.join(LOCALES_DIR, loc, 'messages.json');
      expect(fs.existsSync(locPath), `Missing messages.json for ${loc}`).toBe(true);

      const data = JSON.parse(fs.readFileSync(locPath, 'utf8'));
      const untranslated: string[] = [];

      for (const [key, val] of Object.entries(en as Record<string, { message: string }>)) {
        if (!data[key] || data[key].message === val.message) {
          untranslated.push(key);
        }
      }

      const baseline = baselines[loc];
      expect(baseline, `Missing baseline for locale ${loc}`).toBeDefined();
      const maxAllowed = typeof baseline === 'number' ? baseline : baseline.maxAllowed;

      expect(
        untranslated.length,
        `Locale ${loc} has ${untranslated.length} untranslated keys, exceeding maxAllowed ${maxAllowed}: ${untranslated.join(', ')}`
      ).toBeLessThanOrEqual(maxAllowed);
    }
  });

  test('danger zone deleteSyncCredential keys are translated in all non-English locales', () => {
    const dangerZoneKeys = [
      'deleteSyncCredentialTitle',
      'deleteSyncCredentialHint',
      'deleteSyncCredentialOpen',
      'deleteSyncCredentialWillDelete',
      'deleteSyncCredentialLocalCreds',
      'deleteSyncCredentialDeleteRemote',
      'deleteSyncCredentialRemoteKeepHint',
      'deleteSyncCredentialWillKeep',
      'deleteSyncCredentialBookmarks',
      'deleteSyncCredentialCancel',
      'deleteSyncCredentialConfirm',
      'deleteSyncCredentialStatusDone',
      'deleteSyncCredentialRemoteFailed'
    ];

    for (const loc of nonEnLocales) {
      const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, loc, 'messages.json'), 'utf8'));
      for (const key of dangerZoneKeys) {
        expect(data[key], `Missing key ${key} in ${loc}`).toBeDefined();
        expect(
          data[key].message,
          `Key ${key} in ${loc} must not be English placeholder`
        ).not.toBe(en[key].message);
      }
    }
  });

  test('action labels editBookmarkLabel and importTooLarge are translated everywhere', () => {
    for (const loc of nonEnLocales) {
      const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, loc, 'messages.json'), 'utf8'));
      expect(data.editBookmarkLabel.message, `editBookmarkLabel in ${loc} is still English`).not.toBe(en.editBookmarkLabel.message);
      expect(data.importTooLarge.message, `importTooLarge in ${loc} is still English`).not.toBe(en.importTooLarge.message);
    }
  });
});
