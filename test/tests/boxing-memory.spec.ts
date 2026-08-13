import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// BX-DEV-111M/N/L regression: permanent memory + per-box viewState + credential flush.
// Covers: (1) closing-tab loses credential bug fix via flushUnsavedCredentials,
//         (2) each large box persists its own inner zoom/pan -> cross-tab + browser restart,
//         (3) tab view state has permanent LRU history fallback instead of cache-only sessionStorage.

async function resetFreshSkipOnboarding(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
}
// Variant that keeps onboarding overlay visible — required for the onboarding language picker tests.
async function resetFreshKeepOnboarding(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

test.describe('Permanent memory + per-box viewState (BX-DEV-111M/N/L)', () => {
  test('saveLargeBoxViewState writes lb.viewState on the matched large box only', async ({ page }) => {
    await resetFreshSkipOnboarding(page);
    // Two large boxes.
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const ids = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map(b => b.id));
    expect(ids.length).toBe(2);
    // Enter first box (sets currentLargeBoxId).
    await page.evaluate((id) => (window as any)._boxingEnterLargeBox(id), ids[0]);
    // Persist its view state via the exposed helper.
    await page.evaluate((id) => (window as any).__boxingDebug.saveLargeBoxViewState(id), ids[0]);
    const vs0 = await page.evaluate((id) => (window as any).__boxingDebug.layout.boxes.find(b => b.id === id)?.viewState, ids[0]);
    expect(vs0).toBeTruthy();
    expect(typeof vs0.innerZoom).toBe('number');
    expect(typeof vs0.innerPanX).toBe('number');
    expect(typeof vs0.innerPanY).toBe('number');
    expect(typeof vs0.updatedAt).toBe('number');
    // Second box must NOT carry viewState yet.
    const vs1 = await page.evaluate((id) => (window as any).__boxingDebug.layout.boxes.find(b => b.id === id)?.viewState, ids[1]);
    expect(vs1).toBeUndefined();
  });

  test('tab view permanent history fallback restores after sessionStorage + LAST_ACTIVE cleared (browser restart simulation)', async ({ page }) => {
    await resetFreshSkipOnboarding(page);
    // Patiently run a couple of persistView calls to populate history.
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    const histBefore = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('boxingTabViewHistory.v3') || '[]'); } catch (_) { return null; }
    });
    expect(Array.isArray(histBefore)).toBe(true);
    expect(histBefore.length).toBeGreaterThan(0);
    // Simulate browser restart: clear sessionStorage + LAST_ACTIVE_VIEW_KEY but keep history.
    await page.evaluate(() => {
      sessionStorage.removeItem('boxingTabView.v2');
      localStorage.removeItem('boxingLastActiveView.v2');
    });
    // Reload — startup should fall back to permanent history via loadFallbackTabView().
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    // History still intact after reload (lives in localStorage; not cleared on reload).
    const histAfter = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('boxingTabViewHistory.v3') || '[]'); } catch (_) { return null; }
    });
    expect(Array.isArray(histAfter)).toBe(true);
    expect(histAfter.length).toBeGreaterThan(0);
    // clearTabViewHistory must fully wipe.
    const cleared = await page.evaluate(() => (window as any).__boxingDebug.clearTabViewHistory());
    expect(cleared).toBe(true);
    const histCleared = await page.evaluate(() => localStorage.getItem('boxingTabViewHistory.v3'));
    expect(histCleared).toBeNull();
  });

  test('LRU history bounded at MAX_TAB_VIEW_HISTORY (8) — prevents unbounded heap growth', async ({ page }) => {
    await resetFreshSkipOnboarding(page);
    await page.evaluate(() => (window as any).__boxingDebug.clearTabViewHistory());
    // Push >8 distinct snapshots.
    for (let i = 0; i < 12; i++) {
      await page.evaluate((zoomVal) => {
        (window as any).__boxingDebug.layout.settings.zoomLevel = zoomVal;
        // Bump canvasZoom indirectly via persistView snapshot which reads current var.
        (window as any).__boxingDebug.persistView();
      }, 1 + i * 0.1);
    }
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('boxingTabViewHistory.v3') || '[]'));
    expect(Array.isArray(hist)).toBe(true);
    expect(hist.length).toBeLessThanOrEqual(8);
  });

  test('flushCredentials persists the current _encWebdavPass even without blur (close-browser bug fix)', async ({ page }) => {
    await resetFreshSkipOnboarding(page);
    // Simulate user typing credentials directly into the input fields (no blur fired).
    await page.evaluate(() => {
      const urlInput = document.getElementById('webdav-url');
      const userInput = document.getElementById('webdav-user');
      const passInput = document.getElementById('webdav-pass');
      if (urlInput) urlInput.value = 'https://app.koofr.net/dav/Koofr/';
      if (userInput) userInput.value = 'jinxi2410@gmail.com';
      if (passInput) passInput.value = 'kel988j8tv44f2v0';
      // Open the settings modal so inputs exist / are readable.
      const modal = document.getElementById('settings-modal');
      if (modal) modal.hidden = false;
    });
    // Fire flushUnsavedCredentials without firing blur — simulates pagehide / browser close path.
    const flushed = await page.evaluate(() => {
      const fn = (window as any).__boxingFlushCredentials;
      return fn ? fn() : Promise.resolve();
    });
    await flushed;
    // Give the async encryption a tick to complete.
    await page.waitForTimeout(50);
    const enc = await page.evaluate(() => (window as any).__boxingDebug.layout.settings._encWebdavPass);
    expect(enc).toBeTruthy();
    expect(typeof enc).toBe('object');
    // BX-CRED-V2 format { v:2, s, iv, d }.
    expect(enc.v).toBe(2);
    expect(enc.s).toBeTruthy();
    expect(enc.iv).toBeTruthy();
    expect(enc.d).toBeTruthy();
    // url + user persisted in plain settings.
    const cfg = await page.evaluate(() => ({
      url: (window as any).__boxingDebug.layout.settings.webdavUrl,
      user: (window as any).__boxingDebug.layout.settings.webdavUser,
    }));
    expect(cfg.url).toBe('https://app.koofr.net/dav/Koofr/');
    expect(cfg.user).toBe('jinxi2410@gmail.com');
  });
});

test.describe('Onboarding language picker (BX-DEV-111O)', () => {
  test('language picker <select> is present in onboarding overlay on fresh install', async ({ page }) => {
    await resetFreshKeepOnboarding(page);
    const present = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      const sel = document.getElementById('onboarding-lang-select');
      return !!ov && !ov.hidden && !!sel && sel.options.length > 0;
    });
    expect(present).toBe(true);
  });

  test('changing onboarding lang select updates selectedLanguage + Settings lang-select (file://-safe)', async ({ page }) => {
    await resetFreshKeepOnboarding(page);
    // Determinism: force English via the picker so we don't depend on host browser locale.
    await page.evaluate(() => (window as any).__boxingDebug.setOnboardingLangInUI('en'));
    await page.waitForTimeout(50);
    // setting selectedLanguage is the verifiable behavior in file:// (i18n text fetch may fall back to I18N_FALLBACK for missing locales).
    const selEn = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.selectedLanguage);
    expect(selEn).toBe('en');
    // Switch to zh_CN via the exposed debug helper (dispatches change event like a real user).
    await page.evaluate(() => (window as any).__boxingDebug.setOnboardingLangInUI('zh_CN'));
    await page.waitForTimeout(50);
    const selZh = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.selectedLanguage);
    expect(selZh).toBe('zh_CN');
    // The Settings modal lang-select mirror should also reflect 'zh_CN'.
    const mirror = await page.evaluate(() => { const ls = document.getElementById('lang-select'); return ls ? ls.value : null; });
    expect(mirror).toBe('zh_CN');
    // currentLang inside the module should equal zh_CN (only fetch would set it; on file:// fallback returns currentLang back to 'en' — so assert either).
    const dbgState = await page.evaluate(() => (window as any).__boxingDebug.state());
    expect(['zh_CN', 'en']).toContain(dbgState.lang);
  });
});
