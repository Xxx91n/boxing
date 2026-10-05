import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

/**
 * BX-MANIFEST-004b: dev scripts MUST chain build -> web-ext.
 * Prevents the "stale dist" bug where source was fixed
 * but dist was never recompiled before dev loading.
 */
test.describe('BX-MANIFEST-004b: build-before-dev pipeline', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  test('dev:chrome chains npm run build before web-ext run', () => {
    const script = pkg.scripts['dev:chrome'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build &&')).toBe(true);
    expect(script).toContain('web-ext run');
    expect(script).toContain('--source-dir=dist/boxing-chrome');
  });

  test('dev:firefox chains npm run build before web-ext run', () => {
    const script = pkg.scripts['dev:firefox'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build &&')).toBe(true);
    expect(script).toContain('web-ext run');
    expect(script).toContain('--source-dir=dist/boxing-firefox');
  });

  test('dev:chrome:no-build skips build and uses --no-reload', () => {
    const script = pkg.scripts['dev:chrome:no-build'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build')).toBe(false);
    expect(script).toContain('--no-reload');
    expect(script).toContain('--source-dir=dist/boxing-chrome');
  });

  test('dev:firefox:no-build skips build and uses --no-reload', () => {
    const script = pkg.scripts['dev:firefox:no-build'];
    expect(script).toBeTruthy();
    expect(script.startsWith('npm run build')).toBe(false);
    expect(script).toContain('--no-reload');
    expect(script).toContain('--source-dir=dist/boxing-firefox');
  });

  test('build.mjs has stale dist warning (warnStaleDist)', () => {
    const buildPath = path.join(ROOT, '.github', 'scripts', 'build.mjs');
    const buildSrc = fs.readFileSync(buildPath, 'utf8');
    expect(buildSrc).toContain('warnStaleDist');
    expect(buildSrc).toContain('[STALE_DIST]');
    expect(buildSrc).toContain('BUILD_INFO.json');
  });

  test('AGENTS.md documents BX-MANIFEST-004b', () => {
    const agentsPath = path.join(ROOT, 'AGENTS.md');
    const agentsSrc = fs.readFileSync(agentsPath, 'utf8');
    expect(agentsSrc).toContain('BX-MANIFEST-004b');
    expect(agentsSrc).toContain('stale');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BX-D-009 (Wave 2026.10.11 P-18 / S-11): Pages demo build contract.
//
// Regression class: the demo artifact is what visitors actually touch, and its
// first-run tour silently blocked every pointer gesture there. The fix is a
// BUILD-TIME flag, so the artifact itself is the thing under test: a source-only
// assertion would pass while the deployed demo kept the overlay.
//
// These are static artifact/source contracts (fast, no browser needed). The
// RUNTIME half — overlay really is suppressed, right-click really works — lives
// in the BX-D-009 onboarding block below, because that needs a live page.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('BX-D-009: Pages demo artifact suppresses the first-run tour', () => {
  const buildDemoSrc = () => fs.readFileSync(path.join(ROOT, '.github', 'scripts', 'build-demo.mjs'), 'utf8');
  const onboardingSrc = () => fs.readFileSync(path.join(ROOT, 'ntp', 'onboarding.js'), 'utf8');
  const ntpIndexHtml = () => fs.readFileSync(path.join(ROOT, 'ntp', 'index.html'), 'utf8');
  // A literal backslash-n as it appears in build-demo.mjs SOURCE TEXT (inside a
  // single-quoted JS string it is an escape, not a newline). Built from a char
  // code so no editor/template layer can silently turn it into a real newline.
  const BS_N = String.fromCharCode(92) + 'n';

  test('D009-b1: build-demo.mjs injects the __BOXING_DEMO__ flag', () => {
    const src = buildDemoSrc();
    expect(src, 'the demo build must set the flag').toContain('__BOXING_DEMO__');
    expect(src, 'the flag must be written as its own file').toContain('demo-flag.js');
  });

  test('D009-b2: the flag ships as a SEPARATE classic script (CSP + ordering), never inline', () => {
    const src = buildDemoSrc();
    // CSP is script-src 'self' (SEC-15): an inline flag would be blocked outright.
    expect(ntpIndexHtml()).toContain("script-src 'self'");
    // Injected next to chrome-stub.js and BEFORE the deferred ntp.js module, so
    // the flag is guaranteed set before ntp.js runs (no DOMContentLoaded wait).
    // Assert on SOURCE TEXT, all-literal. Two traps this avoids:
    //   1. in build-demo.mjs that separator is a LITERAL backslash-n (it lives
    //      inside a single-quoted JS string as an escape), not a newline;
    //   2. the source ends with "' + moduleTag" — the concatenation is NOT
    //      expanded in the file, so the needle must keep that suffix verbatim.
    expect(src).toContain(
      "'<script src=\"chrome-stub.js\"></script>" + BS_N +
      "<script src=\"demo-flag.js\"></script>" + BS_N + "' + moduleTag"
    );
    // The flag must never reach the page as an INLINE script: CSP is
    // `script-src 'self'` (SEC-15), so an inline handler would simply be blocked
    // and the demo would regress to showing the tour. Asserted on the emitted
    // HTML expression only — the surrounding comment block intentionally QUOTES
    // the inline form to explain why it was rejected, so a whole-file scan would
    // match the explanation instead of real code.
    const replaceCall = src.slice(src.indexOf('html = html.replace(moduleTag'));
    expect(replaceCall.slice(0, 400), 'flag must be a separate file, not inline')
      .not.toContain('<script>window.__BOXING_DEMO__');
  });

  test('D009-b3: the generated flag file content sets the global', () => {
    const src = buildDemoSrc();
    // Plain indexOf slicing rather than a regex: backslash classes inside a regex
    // literal are a needless escaping hazard in a generated spec. The window is
    // bounded by the writeFileSync call's own closing paren so it can never
    // overrun into the unrelated moduleTag declaration below it.
    const anchor = src.indexOf('path.join(DEMO, "demo-flag.js")');
    expect(anchor, 'demo-flag.js write not found in build-demo.mjs').toBeGreaterThan(-1);
    const end = src.indexOf(');', anchor);
    expect(end, 'writeFileSync call not terminated').toBeGreaterThan(anchor);
    const call = src.slice(anchor, end + 2);
    expect(call, 'the generated file must set the global').toContain('window.__BOXING_DEMO__ = true;');
    // The emitted tag must stay a CLASSIC script: that is what guarantees it runs
    // before the deferred ntp.js module, with no DOMContentLoaded wait.
    expect(call).not.toContain('type="module"');
    expect(call).not.toContain('defer');
  });

  test('D009-b4: initOnboarding returns early on the flag AND on runtime.id (defense in depth)', () => {
    const src = onboardingSrc();
    expect(src).toContain('__BOXING_DEMO__');
    expect(src, 'runtime.id is the defensive second condition').toContain('boxing-pages-demo');
    // The flag check must precede the fresh-install judgment, otherwise the tour
    // is already committed to showing before the suppression runs.
    // Anchor on the UNIQUE signature: plain 'export function initOnboarding'
    // matches initOnboardingFacade first, which sits ABOVE the guard block and
    // would make this ordering assertion vacuous.
    const bodyStart = src.indexOf('export function initOnboarding(trigger');
    expect(bodyStart, 'initOnboarding signature not found').toBeGreaterThan(-1);
    const body = src.slice(bodyStart);
    const flagAt = body.indexOf('__BOXING_DEMO__');
    const freshAt = body.indexOf('const freshInstall');
    expect(flagAt, 'the demo guard must exist inside initOnboarding').toBeGreaterThan(-1);
    expect(freshAt, 'the fresh-install decision must exist').toBeGreaterThan(-1);
    expect(flagAt, 'demo suppression must run BEFORE the fresh-install decision').toBeLessThan(freshAt);
    // The guard must actually RETURN, not merely be evaluated.
    const guardEnd = body.indexOf("const overlay = document.getElementById('onboarding-overlay')");
    expect(guardEnd, 'overlay lookup must follow the guard').toBeGreaterThan(flagAt);
    expect(body.slice(flagAt, guardEnd), 'the guard must return early').toContain('return;');
  });

  test('D009-b5: the file:// debug lane is NOT suppressed (empty-canvas tour still reachable)', () => {
    const src = onboardingSrc();
    // Suppression keys ONLY off the demo flag / demo runtime id — a plain file://
    // load has neither, so the legacy empty-canvas judgment must still be there.
    expect(src, 'legacy empty-canvas judgment must survive for the debug lane').toContain('layout.boxes.length === 0');
    // And the suppression must not be keyed off the URL scheme. NOTE: a naive
    // "source must not mention file://" assertion would be WRONG — the module
    // header legitimately documents the file:// mock lane in prose. What matters
    // is that no executable scheme branch decides suppression, which is what the
    // absence of any location read in the file proves.
    expect(src, 'suppression must not branch on the URL scheme').not.toContain('location.protocol');
    expect(src).not.toContain('location.href');
    // The suppression inputs are exactly the build-time flag and the demo
    // runtime id — asserted against the whole module, since the guard lives
    // above the function signature in an explanatory comment block.
    expect(src, 'suppression is keyed off the build flag').toContain('window.__BOXING_DEMO__');
    expect(src, 'and the demo runtime id as a defensive second condition').toContain('boxing-pages-demo');
  });

  test('D009-b6: overlay is dismissible with Escape (WCAG 2.1.2 No Keyboard Trap, Level A)', () => {
    const src = onboardingSrc();
    expect(src, 'Escape handler must exist').toContain("e.key !== 'Escape'");
    // Capture phase: must outrank the document-level canvas Escape semantics.
    expect(src).toContain("document.addEventListener('keydown', onOverlayKeydown, true)");
    // Mounted only while the overlay is open, and torn down on close.
    expect(src).toContain('attachOverlayKeydown()');
    expect(src).toContain('detachOverlayKeydown()');
    expect(src).toContain("document.removeEventListener('keydown', onOverlayKeydown, true)");
  });
});
