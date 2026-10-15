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
    expect(settingsUiSrc).toContain('export async function checkVersionUpdate()');
    expect(settingsUiSrc).toContain('boxingVersionCache');
    expect(settingsUiSrc).toContain('https://boxing.xxx91n.com/version.json');
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
});
