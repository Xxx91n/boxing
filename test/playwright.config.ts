import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Issue #70: the chromium-extension lane loads the built extension from
// dist/boxing-chrome/ (AGENTS.md loading rule: Chrome loads from dist/, never
// the repo root). The path is consumed only by this project's launch args.
// CI builds before running tests; a local run needs `npm run build` first.
const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist', 'boxing-chrome');

export default defineConfig({
  testDir: './tests',
  // Slow-host headroom: browser setup/teardown on a contended desktop can exceed the
  // 30s default without any assertion failing (issue #36). Specs that need more still
  // set their own timeout.
  timeout: 60000,
  // Ticket 45 (architecture-recovery): burn-in exclusion for the @data-golden gates.
  // .github/workflows/test.yml sets BOXING_EXCLUDE_GREP=@data-golden on the main lane and
  // runs the spec in its own continue-on-error data-golden job; after the burn-in week,
  // drop that env and the gates fold back into the blocking lane (undefined = no-op).
  grepInvert: process.env.BOXING_EXCLUDE_GREP ? new RegExp(process.env.BOXING_EXCLUDE_GREP, 'i') : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Worker policy (issue #36):
  // - Cap 2 everywhere. CI standard runners have 4 cores and 2 is the measured
  //   sweet spot (currents.dev). Locally, 4 workers still produced rotating
  //   chromium timeouts (page.goto / browserContext.close) on this 8-thread host
  //   once unrelated desktop apps contended for CPU; 2 keeps the full suite a
  //   usable merge gate. Coverage and assertions are unchanged.
  // - The deeper Firefox starvation source was Playwright's default
  //   dom.ipc.processCount=60000: the file:// suite spawned a content process per
  //   page (156 processes / ~6GB observed) that never got recycled. The Firefox
  //   project caps that pref below.
  workers: 2,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    headless: false,
  },
  projects: [
    {
      name: 'firefox-extension',
      // Firefox headless (wave-2026.10.11 Round-3, 2026-10-13): the lane runs HEADLESS.
      // The headed persistent-context native-input pipe wedges (playwright#16095
      // class — page.mouse.* progressively stalls, probe-verified 3/3 rounds); headless is
      // clean (0/3). One headless lane restores the 4 native-input tests in place
      // and is faster — no parallel third project needed. Chromium stays headed
      // (carries --load-extension real-extension liveness + native baseline).
      // History: ticket 27 retired @quarantine; the last 4 native-input skips
      // lived here until this flip.
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
        headless: true,
        launchOptions: {
          args: ['-no-remote'],
          // Issue #36: Playwright sets dom.ipc.processCount=60000 for Firefox.
          // Every file:// test page could then take its own content process and the
          // full suite accumulated 156 processes / ~6GB, starving page.goto and
          // browserContext.close. Cap it; tests never need more than a handful of
          // concurrent tabs per browser.
          firefoxUserPrefs: {
            'dom.ipc.processCount': 1,
            'dom.ipc.processCount.file': 1,
            'dom.ipc.processPrelaunch.enabled': false,
            'fission.autostart': false,
            // Headless Firefox on this host intermittently logs
            // "RenderCompositorSWGL failed mapping default framebuffer" and then
            // wedges page.goto/context.close. The suite only needs DOM/CSS, so use
            // the basic compositor path instead of software WebRender.
            'gfx.webrender.enabled': false,
            'gfx.webrender.all': false,
            'gfx.webrender.software': false,
            'gfx.webrender.compositor': false,
            'layers.acceleration.disabled': true,
            'gfx.canvas.accelerated': false,
          },
        },
      },
    },
    {
      name: 'chromium-extension',
      // ticket 01: the 30 quarantined tests were repaired and verified 30/30 on
      // chromium (see branch arch-recovery-01-quarantine); they run in the main
      // suite again. Firefox-only flakes stay excluded via the firefox project.
      //
      // ticket 03 (architecture-recovery): ntp/index.html now loads ntp.js as
      // <script type="module">. Modules over file:// are CORS-blocked on
      // chromium by default (origin 'null'); --allow-file-access-from-files
      // keeps the file:// mock lane (spec.md first-ticket decision: keep the
      // mock runnable, do not discard it). Firefox loads same-dir file://
      // modules natively — no pref needed (probed 2026-08-31).
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--load-extension=${EXTENSION_PATH}`,
            `--disable-extensions-except=${EXTENSION_PATH}`,
            '--allow-file-access-from-files',
            '--no-first-run',
            '--no-default-browser-check',
          ],
        },
      },
    },
  ],
});
