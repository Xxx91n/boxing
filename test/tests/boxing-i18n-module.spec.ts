import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXT_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXT_PATH, 'ntp', 'index.html')).href;

// Ticket 04 (architecture-recovery): i18n dictionary / en-fallback / store now live in
// ntp/i18n.js as an ES module. These specs pin the EXTERNAL behavior (spec.md testing
// decision — never the file layout alone):
//   1. source contract — ntp.js no longer embeds the dictionary; i18n.js owns it.
//   2. forced fetch failure → en fallback path (catch branch, I18N_FALLBACK rendering,
//      currentLang reset to 'en').
//   3. subset locale → per-key fallback to I18N_FALLBACK + ESM live binding of
//      currentLang observed through __boxingDebug.state().lang.
//   4. three-language switch renders real translations (ticket 04 checkpoint).
//
// LANE NOTE (probed 2026-09-01, ticket 04): chromium file:// blocks fetch() of
// _locales/** even with --allow-file-access-from-files (that flag unblocked module
// SCRIPT loading only — ticket 03). Firefox blocks it natively. So tests 3/4 serve the
// REAL locale file bytes through a fetch stub (page.addInitScript) instead of relying
// on the environment; the loadI18nStore pipeline (fetch → parse → store → applyI18n →
// currentLang) runs unchanged, and expected strings still come from the on-disk
// _locales files, not literals. In the real extension (chrome-extension://) the native
// fetch works — covered by manual/extension verification, not this file:// lane.

async function resetFreshKeepOnboarding(page: any) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

test.describe('i18n module extraction (ticket 04)', () => {
  // Firefox headed launch on this host takes ~22s alone (DEBUG=pw:api: "browserType.launch succeeded +22s"),
  // which exhausts the 30s default before the fetch-stub navigation + reload + poll even starts
  // (page.goto times out at domcontentloaded with URL stuck at about:blank, zero console output —
  // a launch/commit stall, not a page-content fault). Raise the budget so the checkpoint is
  // deterministic on the Firefox lane. See WORKFLOW §6 票15/票13 notes for the false-failure signature.
  test.setTimeout(120_000);
  test('source contract: dictionary lives in ntp/i18n.js, ntp.js imports instead of embedding', async () => {
    const ntp = fs.readFileSync(path.join(EXT_PATH, 'ntp', 'ntp.js'), 'utf8');
    const mod = fs.readFileSync(path.join(EXT_PATH, 'ntp', 'i18n.js'), 'utf8');
    // i18n.js owns the whole surface
    expect(mod).toContain('const I18N_FALLBACK = {');
    expect(mod).toContain('function loadI18nStore(lang) {');
    expect(mod).toContain('function i18n(key, placeholders) {');
    expect(mod).toContain('function applyI18n() {');
    expect(mod).toContain('const SUPPORTED_LANGS = [');
    // ntp.js consumes, does not embed
    expect(ntp).toContain("from './i18n.js'");
    expect(ntp).toContain('initI18n({ api, debug, debugErr });');
    expect(ntp).not.toContain('const I18N_FALLBACK = {');
    expect(ntp).not.toContain('function loadI18nStore');
  });

  test('forced _locales fetch failure → en fallback rendering + currentLang reset (file://-safe)', async ({ page }) => {
    await page.addInitScript(() => {
      const of = window.fetch;
      window.fetch = function (input: any, init?: any) {
        const u = typeof input === 'string' ? input : (input && input.url) || '';
        if (String(u).includes('_locales')) return Promise.reject(new TypeError('forced-off: i18n fallback spec'));
        return of.call(this, input, init);
      };
    });
    await resetFreshKeepOnboarding(page);
    // catch branch resets currentLang to 'en' and swaps the store to the en fallback dict.
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().lang)).toBe('en');
    // applyI18n rendered the English fallback strings into the DOM.
    expect(await page.locator('[data-i18n="brandName"]').textContent()).toBe('Boxing');
    expect(await page.locator('[data-i18n="emptyCanvasTitle"]').textContent()).toBe('No large boxes yet');
    expect((await page.locator('[data-i18n="footerHint"]').textContent()) || '').toContain('Ctrl+scroll to zoom');
  });

  test('subset locale: per-key fallback + ESM live binding of currentLang', async ({ page }) => {
    await page.addInitScript(() => {
      const of = window.fetch;
      window.fetch = function (input: any, init?: any) {
        const u = String(typeof input === 'string' ? input : (input && input.url) || '');
        // api.runtime.getURL is a mock on file:// → url is RELATIVE ('_locales/ja/messages.json').
        if (u.includes('_locales/ja/messages.json')) {
          return Promise.resolve(new Response(JSON.stringify({ brandName: { message: 'ボクシングJa', placeholders: null } }), { headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.includes('_locales/de/messages.json')) {
          return Promise.resolve(new Response(JSON.stringify({ brandName: 'DeutscheWoerter' }), { headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.includes('_locales')) return Promise.reject(new TypeError('forced-off: subset spec'));
        return of.call(this, input, init);
      };
    });
    await resetFreshKeepOnboarding(page);
    // en boot (initial load) — brandName falls back to English.
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().lang)).toBe('en');
    expect(await page.locator('[data-i18n="brandName"]').textContent()).toBe('Boxing');
    // Switch to ja: store = subset → brandName from subset, missing keys per-key fallback.
    await page.evaluate(() => (window as any).__boxingDebug.setOnboardingLangInUI('ja'));
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().lang)).toBe('ja');
    expect(await page.locator('[data-i18n="brandName"]').textContent()).toBe('ボクシングJa');
    // 'emptyCanvasTitle' is NOT in the ja subset → I18N_FALLBACK English (per-key fallback).
    expect(await page.locator('[data-i18n="emptyCanvasTitle"]').textContent()).toBe('No large boxes yet');
    // state().lang observed 'ja' proves the export-let live binding (no second copy).
    // Switch to de (string-form subset entry) — text changes again, binding follows.
    await page.evaluate(() => (window as any).__boxingDebug.setOnboardingLangInUI('de'));
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().lang)).toBe('de');
    expect(await page.locator('[data-i18n="brandName"]').textContent()).toBe('DeutscheWoerter');
    expect(await page.locator('[data-i18n="emptyCanvasTitle"]').textContent()).toBe('No large boxes yet');
  });

  test('three-language switch renders real translations from _locales (ticket 04 checkpoint)', async ({ page }) => {
    // Serve the REAL locale bytes (read from _locales/ at spec time) — expected strings
    // come from the same files, so this stays self-checking.
    const serveLangs = ['en', 'ja', 'zh_CN', 'ar'];
    const bodies: Record<string, string> = {};
    for (const lang of serveLangs) {
      bodies[lang] = fs.readFileSync(path.join(EXT_PATH, '_locales', lang, 'messages.json'), 'utf8');
    }
    await page.addInitScript((map: Record<string, string>) => {
      const of = window.fetch;
      window.fetch = function (input: any, init?: any) {
        const u = String(typeof input === 'string' ? input : (input && input.url) || '');
        if (u.includes('_locales')) {
          const lang = u.split('_locales/')[1] && u.split('_locales/')[1].split('/')[0];
          if (lang && map[lang]) {
            return Promise.resolve(new Response(map[lang], { headers: { 'Content-Type': 'application/json' } }));
          }
          return Promise.reject(new TypeError('forced-off: checkpoint spec'));
        }
        return of.call(this, input, init);
      };
    }, bodies);
    await resetFreshKeepOnboarding(page);
    // Determinism: force en first (host locale must not leak into the assertion chain).
    await page.evaluate(() => (window as any).__boxingDebug.setOnboardingLangInUI('en'));
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().lang)).toBe('en');
    expect(await page.locator('[data-i18n="emptyCanvasTitle"]').textContent()).toBe('No large boxes yet');
    // Drive three real languages through the same picker.
    const want: Record<string, string> = {};
    for (const lang of ['ja', 'zh_CN', 'ar']) {
      const j = JSON.parse(bodies[lang]);
      want[lang] = j.emptyCanvasTitle.message;
    }
    const seen = new Set<string>();
    for (const lang of ['ja', 'zh_CN', 'ar']) {
      await page.evaluate((l: string) => (window as any).__boxingDebug.setOnboardingLangInUI(l), lang);
      await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().lang)).toBe(lang);
      const text = await page.locator('[data-i18n="emptyCanvasTitle"]').textContent();
      expect(text).toBe(want[lang]);
      seen.add(text || '');
    }
    // The three languages actually rendered three distinct strings (no stuck store).
    expect(seen.size).toBe(3);
  });
});
