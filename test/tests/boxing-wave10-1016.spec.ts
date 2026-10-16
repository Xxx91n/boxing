import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { dismissOnboarding } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp/index.html')).href;
const URL_TITLE_PATH = pathToFileURL(path.join(EXTENSION_PATH, 'ntp/url-title.js')).href;

async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
  await page.waitForTimeout(200);
}

// D-008 behavioral lane: L1 -> S1 seed so the real add/edit popups can be driven
// (t44/t91 discipline — seed before first navigation, synthetic dblclick for the
// firefox headed lane, same pattern as boxing-sync-bookmark-delete-tombstone).
function seedPopupLayout() {
  return {
    version: 3.5, schemaVersion: 1, nextLargeIndex: 2,
    boxes: [{
      id: 'L1', type: 'large', title: 'WaveRoot', x: 40, y: 40, width: 320, height: 220,
      nextSmallIndex: 2,
      children: [{ id: 'S1', title: 'WaveSmall', x: 0, y: 0, width: 260, height: 190, pinned: true, bookmarks: [] }],
    }],
    connections: [], groups: [],
    settings: { selectedLanguage: 'en', autoTitleEnabled: true },
    _meta: { revision: 3, updatedAt: Date.now() - 5000, writerId: 'spec-seed-popup' },
  };
}

async function bootIntoAddPopup(page: Page) {
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('boxingLayout')) localStorage.setItem('boxingLayout', JSON.stringify(seed));
  }, seedPopupLayout());
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
  await page.evaluate(() => {
    document.querySelector('.large-box[data-id="L1"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.small-box[data-id="S1"]'))), { timeout: 5000 }).toBe(true);
  await page.evaluate(() => {
    (document.querySelector('.small-box[data-id="S1"] .bm-add-btn') as HTMLElement)?.click();
  });
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.bm-edit-popup'))), { timeout: 5000 }).toBe(true);
}

// inputs[0] = title, inputs[1] = url in both add and edit popups.
async function typeIntoPopupInput(page: Page, index: number, value: string) {
  await page.evaluate(({ i, v }) => {
    const ins = document.querySelectorAll('.bm-edit-popup input');
    (ins[i] as HTMLInputElement).value = v;
    ins[i].dispatchEvent(new Event('input', { bubbles: true }));
  }, { i: index, v: value });
}

async function clickPopupPrimary(page: Page, label: string) {
  await page.evaluate((lbl) => {
    const popup = document.querySelector('.bm-edit-popup');
    const btn = Array.from(popup!.querySelectorAll('button')).find((b) => b.textContent!.trim() === lbl);
    (btn as HTMLElement).click();
  }, label);
}

test.describe('Wave 2026.10.16 — S-01 to S-05 E2E & Contract Tests', () => {
  test.setTimeout(30000);

  // ── S-01 / D-001: Favicon cold path & display restoration ──────────────────
  test('S-01 / D-001: popups.js does not trigger false error; applyDecodedFavicon restores display', () => {
    const popSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/popups.js'), 'utf8');
    const favSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/favicon.js'), 'utf8');

    // popups.js must not initialize fav.src = ''
    expect(popSrc).not.toContain("fav.src = '';");
    expect(popSrc).toContain("fav.onerror = () => { if (fav.src) fav.style.display = 'none'; };");

    // applyDecodedFavicon must explicitly reset display on success
    expect(favSrc).toContain("img.style.display = '';");
  });

  // ── S-02 / D-002: Auto-backup alarm hub + NTP catch-up ─────────────────────
  test('S-02 / D-002: SW records autoBackupDue; NTP catches up without duplicate onAlarm', () => {
    const bgSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'background.js'), 'utf8');
    const syncSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/sync-engine.js'), 'utf8');

    // background.js sets autoBackupDue on alarm
    expect(bgSrc).toContain('autoBackupDue: true');
    expect(bgSrc).toContain('ADR-0022: chrome.alarms hub for auto-backup');

    // ntp/sync-engine.js must NOT have chrome.alarms.onAlarm listener
    expect(syncSrc).not.toContain('chrome.alarms.onAlarm.addListener');
    expect(syncSrc).toContain('checkAutoBackupCatchUp');
    expect(syncSrc).toContain('autoBackupDue');
    // Deprecated lastAutoBackupTs
    expect(syncSrc).not.toContain('let lastAutoBackupTs');
    // ADR-0016 single write path: due-flag consumption goes through the storage.js
    // facade (clearAutoBackupDue), never direct chrome.storage writes.
    expect(syncSrc).not.toContain('chrome.storage.local.remove');
    expect(syncSrc).toContain('clearAutoBackupDue');
    // Catch-up requires the extension env (SW alarm hub exists only there);
    // file:// lanes / demo stub must never trigger a boot backup.
    expect(syncSrc).toContain('chrome.alarms');
    expect(syncSrc).toContain('checkAutoBackupCatchUp');
  });

  // ── S-03 / D-003: Title selection focus machine ────────────────────────────
  test('S-03 / D-003: title focus machine has unconditional mouseup preventDefault & caret fallback', () => {
    const renderSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/render.js'), 'utf8');

    // guardFirstMouseUp prevents default without checking isCollapsed
    expect(renderSrc).toContain('if (guardFirstMouseUp) {');
    expect(renderSrc).toContain('guardFirstMouseUp = false;');
    expect(renderSrc).toContain('e.preventDefault();');
    expect(renderSrc).toContain('selectAllTitleText(el);');

    // Firefox caret position fallback on second click
    expect(renderSrc).toContain('caretPositionFromPoint');
    expect(renderSrc).toContain('caretRangeFromPoint');
  });

  // ── S-04 / D-004: Version check module & About tab ─────────────────────────
  test('S-04 / D-004: About tab version check markup, 24h caching, and 14-locale hint', () => {
    const htmlSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/index.html'), 'utf8');
    const settingsUiSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/settings-ui.js'), 'utf8');

    expect(htmlSrc).toContain('id="about-update-hint"');
    expect(settingsUiSrc).toContain('export async function checkVersionUpdate(');
    expect(settingsUiSrc).toContain('boxingVersionCache');
    expect(settingsUiSrc).toContain('version.json');
    expect(settingsUiSrc).toContain('api.github.com/repos/Xxx91n/boxing/releases/latest');

    // 14 locales have aboutUpdateAvailable
    const localesDir = path.join(EXTENSION_PATH, '_locales');
    const langs = fs.readdirSync(localesDir).filter(f => fs.statSync(path.join(localesDir, f)).isDirectory());
    for (const lang of langs) {
      const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'messages.json'), 'utf8'));
      expect(msgs.aboutUpdateAvailable, `Missing aboutUpdateAvailable in ${lang}`).toBeDefined();
      expect(msgs.aboutUpdateAvailable.message.length).toBeGreaterThan(0);
    }
  });

  // ── S-05 / D-005 ~ D-007: URL title 8 preset types & match-pattern ────────
  test('S-05 / D-005 ~ D-007: url-title 8 preset types, pattern matching, eTLD+1 parsing', async () => {
    const {
      parseDomain,
      extractTitleByType,
      matchPattern,
      deriveTitleFromUrl,
      DEFAULT_AUTO_TITLE_RULES,
      EXTRACTION_TYPES
    } = await import(URL_TITLE_PATH);

    expect(EXTRACTION_TYPES.length).toBe(8);

    // Domain parsing with multi-part TLDs
    const bbc = parseDomain('news.bbc.co.uk');
    expect(bbc.domainMain).toBe('bbc');
    expect(bbc.subdomain).toBe('news');
    expect(bbc.fullHost).toBe('news.bbc.co.uk');

    const gh = parseDomain('github.com');
    expect(gh.domainMain).toBe('github');
    expect(gh.subdomain).toBe('');

    const cn = parseDomain('sub.example.com.cn');
    expect(cn.domainMain).toBe('example');
    expect(cn.subdomain).toBe('sub');

    // 8 extraction types on GitHub URL
    const ghUrl = new URL('https://github.com/Xxx91n/boxing/issues/1');
    expect(extractTitleByType(ghUrl, 'domain-main')).toBe('github');
    expect(extractTitleByType(ghUrl, 'full-host')).toBe('github.com');
    expect(extractTitleByType(ghUrl, 'subdomain')).toBe('github'); // fallback to domainMain
    expect(extractTitleByType(ghUrl, 'first-path')).toBe('Xxx91n');
    expect(extractTitleByType(ghUrl, 'last-path')).toBe('1');
    expect(extractTitleByType(ghUrl, 'first-two-paths')).toBe('Xxx91n/boxing');
    expect(extractTitleByType(ghUrl, 'domain-first-path')).toBe('github/Xxx91n');
    expect(extractTitleByType(ghUrl, 'full-url')).toBe('https://github.com/Xxx91n/boxing/issues/1');

    // Slug cleaning on blog URL
    const postUrl = new URL('https://blog.example.com/2026/my-awesome-post.html');
    expect(extractTitleByType(postUrl, 'last-path')).toBe('my-awesome-post');

    // Pattern matching
    expect(matchPattern('https://github.com/*/*', 'https://github.com/Xxx91n/boxing')).toBe(true);
    expect(matchPattern('https://github.com/*/*', 'https://github.com/')).toBe(false);
    expect(matchPattern('https://*/*', 'https://anything.com/path')).toBe(true);
    expect(matchPattern('*://*.google.com/*', 'https://mail.google.com/mail')).toBe(true);
    expect(matchPattern('*://*.google.com/*', 'https://google.com/')).toBe(true);
    expect(matchPattern('*://*.google.com/*', 'https://other.com/')).toBe(false);

    // Rule engine order
    const rules = [
      { pattern: 'https://github.com/*/*', type: 'first-two-paths' },
      { pattern: 'https://*/*', type: 'domain-main' }
    ];
    expect(deriveTitleFromUrl('https://github.com/foo/bar', rules, true)).toBe('foo/bar');
    expect(deriveTitleFromUrl('https://other.com/test', rules, true)).toBe('other');
    // Disabled rule fallback to hostname
    expect(deriveTitleFromUrl('https://github.com/foo/bar', rules, false)).toBe('github.com');
  });

  // ── S-05 / D-008: Settings General tab auto-title UI & Popups wiring ───────
  test('S-05 / D-008: General tab auto-title controls present and functional', async ({ page }) => {
    await boot(page);

    // Open Settings modal
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-modal')).toBeVisible();

    // General tab should have auto-title section
    const enabledCb = page.locator('#auto-title-enabled');
    await expect(enabledCb).toBeVisible();
    expect(await enabledCb.isChecked()).toBe(true);

    const rulesTable = page.locator('#auto-title-rules-table');
    await expect(rulesTable).toBeVisible();

    // Factory rules should show 2 rows
    const rows = page.locator('#auto-title-rules-tbody tr');
    await expect(rows).toHaveCount(2);

    // Add rule button adds a row
    await page.locator('#btn-add-rule').click();
    await expect(rows).toHaveCount(3);

    // Reset to defaults restores 2 rows
    await page.locator('#btn-reset-rules').click();
    await expect(rows).toHaveCount(2);
  });

  // ── B-1 / B-2 Regression Tests (Audit Round-1 Blockers) ───────────────────
  test('B-1 regression: reopening settings modal does not accumulate listeners; add rule adds exactly 1 row', async ({ page }) => {
    await boot(page);

    // Open settings modal first time
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-modal')).toBeVisible();

    // Close settings modal
    await page.locator('#settings-modal .modal__close').click();
    await expect(page.locator('#settings-modal')).toBeHidden();

    // Reopen settings modal second time
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-modal')).toBeVisible();

    // Also trigger applyExternalLayout to ensure sync does not accumulate listeners
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      if (dbg && dbg.layout) {
        dbg.applyExternalLayout(JSON.parse(JSON.stringify(dbg.layout)));
      }
    });

    const rows = page.locator('#auto-title-rules-tbody tr');
    const initialCount = await rows.count();

    // Click Add Rule button once
    await page.locator('#btn-add-rule').click();

    // Exactly 1 row must be added
    await expect(rows).toHaveCount(initialCount + 1);
  });

  test('B-2 regression: applyExternalLayout does not trigger version check fetch; only About tab triggers it', async ({ page }) => {
    await boot(page);

    let versionFetchCount = 0;
    const fulfillVersion = (route: import('@playwright/test').Route) => {
      versionFetchCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v2026.10.17',
          name: 'v2026.10.17',
          version: '2026.10.17',
          url: 'https://github.com/Xxx91n/boxing/releases/tag/v2026.10.17',
          html_url: 'https://github.com/Xxx91n/boxing/releases/tag/v2026.10.17'
        })
      });
    };
    await page.route('**/repos/Xxx91n/boxing/releases/latest*', fulfillVersion);
    await page.route('**/version.json*', fulfillVersion);

    // 1. Simulate external sync adopting lastSettingsTab: 'about' while modal is closed
    const applied = await page.evaluate(async () => {
      // Mock chrome.runtime.getManifest and chrome.storage.local for file:// test environment
      (window as any).chrome = (window as any).chrome || {};
      (window as any).chrome.runtime = (window as any).chrome.runtime || {};
      (window as any).chrome.runtime.getManifest = () => ({ version: '2026.10.15' });

      const mockStore: Record<string, any> = {};
      (window as any).chrome.storage = {
        local: {
          get: (keys: string[], cb: any) => {
            const res: Record<string, any> = {};
            keys.forEach(k => { res[k] = mockStore[k]; });
            if (typeof cb === 'function') cb(res);
            return Promise.resolve(res);
          },
          set: (items: Record<string, any>, cb: any) => {
            Object.assign(mockStore, items);
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          },
          remove: (keys: string[], cb: any) => {
            keys.forEach(k => { delete mockStore[k]; });
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        }
      };

      const verEl = document.getElementById('about-version-value');
      if (verEl) verEl.textContent = '2026.10.15';

      const dbg = (window as any).__boxingDebug;
      if (dbg && dbg.layout) {
        const snap = JSON.parse(JSON.stringify(dbg.layout));
        snap.settings = snap.settings || {};
        snap.settings.lastSettingsTab = 'about';
        snap._meta = {
          writerId: 'remote-test-peer',
          revision: (Number(dbg.layout._meta?.revision) || 0) + 1,
          updatedAt: Date.now() + 1000
        };
        return dbg.applyExternalLayout(snap);
      }
      return false;
    });

    expect(applied).toBe(true);

    // Wait 300ms — assert NO fetch happened while modal is closed
    await page.waitForTimeout(300);
    expect(versionFetchCount, 'applyExternalLayout must not trigger version.json fetch').toBe(0);

    // 2. Open Settings modal — it restores lastSettingsTab ('about') and SHOULD trigger checkVersionUpdate
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-modal')).toBeVisible();

    // About tab is now active, version.json fetch must trigger
    await expect.poll(() => versionFetchCount, { timeout: 5000 }).toBe(1);
    await expect(page.locator('#about-update-hint')).toBeVisible();

    // 3. Re-navigating to About within 24h uses cache
    await page.locator('.settings-nav__item[data-tab="general"]').click();
    await page.locator('.settings-nav__item[data-tab="about"]').click();
    await page.waitForTimeout(200);
    expect(versionFetchCount, 'Within 24h TTL, version check uses cache').toBe(1);
  });

  // ── S-05 / D-008 behavioral: real add/edit popups (fill, guard, fallback, persist) ──
  test('S-05 / D-008 behavioral: add popup auto-fills title; manual edit protected; rules persist', async ({ page }) => {
    await bootIntoAddPopup(page);
    // URL input -> 300ms debounced fill; github.com/*/* rule -> first-two-paths
    await typeIntoPopupInput(page, 1, 'https://github.com/foo/bar');
    await expect.poll(() => page.evaluate(() => (document.querySelector('.bm-edit-popup input') as HTMLInputElement)?.value), { timeout: 5000 }).toBe('foo/bar');
    // Manual title -> later URL change must NOT overwrite (anti-overwrite guard)
    await typeIntoPopupInput(page, 0, 'My Repo');
    await typeIntoPopupInput(page, 1, 'https://example.com/x/y');
    await page.waitForTimeout(500);
    await expect.poll(() => page.evaluate(() => (document.querySelector('.bm-edit-popup input') as HTMLInputElement)?.value)).toBe('My Repo');
    // Save -> bookmark keeps manual title; rules live in persisted settings
    await clickPopupPrimary(page, 'Add');
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].bookmarks?.length || 0), { timeout: 5000 }).toBe(1);
    const saved = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].bookmarks[0]);
    expect(saved.title).toBe('My Repo');
    expect(saved.url).toBe('https://example.com/x/y');
    const rules = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.autoTitleRules);
    expect(rules?.length).toBe(2);
    // Empty-title submit: save path itself must derive (deriveTitleOrHostname at submit)
    await page.evaluate(() => {
      (document.querySelector('.small-box[data-id="S1"] .bm-add-btn') as HTMLElement)?.click();
    });
    await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.bm-edit-popup'))), { timeout: 5000 }).toBe(true);
    await typeIntoPopupInput(page, 1, 'https://gitlab.com/grp/proj');
    await page.waitForTimeout(500);
    await typeIntoPopupInput(page, 0, ''); // clear auto-fill -> submit derives fresh
    await clickPopupPrimary(page, 'Add');
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].bookmarks?.length || 0), { timeout: 5000 }).toBe(2);
    const saved2 = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].bookmarks[1]);
    expect(saved2.title).toBe('gitlab');
  });

  test('S-05 / D-008 behavioral: rules disabled -> hostname fallback; edit popup shares helper guard', async ({ page }) => {
    await bootIntoAddPopup(page);
    await page.evaluate(() => { (window as any).__boxingDebug.layout.settings.autoTitleEnabled = false; });
    await typeIntoPopupInput(page, 1, 'https://github.com/foo/bar');
    await expect.poll(() => page.evaluate(() => (document.querySelector('.bm-edit-popup input') as HTMLInputElement)?.value), { timeout: 5000 }).toBe('github.com');
    await clickPopupPrimary(page, 'Add');
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].bookmarks?.length || 0), { timeout: 5000 }).toBe(1);
    // Edit popup: existing title is 'manual' to the helper -> URL change must not overwrite
    await page.evaluate(() => {
      (document.querySelector('.small-box[data-id="S1"] .bm-row__edit-btn') as HTMLElement)?.click();
    });
    await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.bm-edit-popup'))), { timeout: 5000 }).toBe(true);
    await typeIntoPopupInput(page, 1, 'https://other.io/a');
    await page.waitForTimeout(500);
    await expect.poll(() => page.evaluate(() => (document.querySelector('.bm-edit-popup input') as HTMLInputElement)?.value)).toBe('github.com');
    // Edit-submit with cleared title derives via shared helper (rules disabled -> hostname)
    await typeIntoPopupInput(page, 0, '');
    await clickPopupPrimary(page, 'Save');
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].bookmarks[0].title)).toBe('other.io');
  });

  // ── D-004: right-click return hardening (FF/LibreWolf) ───────────────────
  test('D-004: edge anchor ignores non-left buttons; button-2 release exits box even if contextmenu is swallowed', async ({ page }) => {
    const connSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/conn-layer.js'), 'utf8');
    const ntpSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/ntp.js'), 'utf8');

    // Anchor mousedown gates on the left button — a right-button preventDefault
    // there would swallow contextmenu in FF-family and wrongly enter connect mode.
    const anchorBlock = connSrc.slice(connSrc.indexOf("a.addEventListener('mousedown'"), connSrc.indexOf('el.appendChild(a)'));
    expect(anchorBlock).toContain('e.button !== 0');

    // Release-fallback + trailing-menu suppression contracts.
    expect(ntpSrc).toContain('function onRightButtonRelease');
    expect(ntpSrc).toContain("document.addEventListener('mouseup', onRightButtonRelease)");
    expect(ntpSrc).toContain("document.addEventListener('pointerup', onRightButtonRelease)");
    expect(ntpSrc).toContain('function onRightButtonDown');
    expect(ntpSrc).toContain("document.addEventListener('mousedown', onRightButtonDown)");
    expect(ntpSrc).toContain('lastRightExitAt');

    // Behavioral: seed L1, enter it.
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('boxingLayout')) localStorage.setItem('boxingLayout', JSON.stringify(seed));
    }, seedPopupLayout());
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await dismissOnboarding(page);
    await page.evaluate(() => {
      document.querySelector('.large-box[data-id="L1"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => !(document.getElementById('inner') as HTMLElement).hidden), { timeout: 5000 }).toBe(true);

    // Path A: contextmenu never dispatched — button-2 release alone exits.
    const exitedByRelease = await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 2 }));
      return (document.getElementById('inner') as HTMLElement).hidden;
    });
    expect(exitedByRelease).toBe(true);

    // Upstream suppression: right-mousedown inside the box is preventDefaulted
    // (kills the native menu in FF-family where contextmenu is the mousedown
    // default action and may never reach the page — the LibreWolf failure mode).
    await page.evaluate(() => {
      document.querySelector('.large-box[data-id="L1"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => !(document.getElementById('inner') as HTMLElement).hidden), { timeout: 5000 }).toBe(true);
    const downPrevented = await page.evaluate(() => {
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2 });
      return !document.dispatchEvent(ev);
    });
    expect(downPrevented).toBe(true);
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 2 }));
    });

    // The same gesture's trailing contextmenu (Chrome order) stays suppressed.
    const menuSuppressed = await page.evaluate(() => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
      return !document.dispatchEvent(ev);
    });
    expect(menuSuppressed).toBe(true);

    // Path B: re-enter, contextmenu alone still exits (original contract intact).
    await page.evaluate(() => {
      document.querySelector('.large-box[data-id="L1"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => !(document.getElementById('inner') as HTMLElement).hidden), { timeout: 5000 }).toBe(true);
    const exitedByMenu = await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
      return (document.getElementById('inner') as HTMLElement).hidden;
    });
    expect(exitedByMenu).toBe(true);
  });
});
