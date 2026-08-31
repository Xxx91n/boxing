import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local cap: default (all cores) launches 8 headed browsers on this 8-thread
  // host and starves them — random 30s setup/timeout failures with different
  // victims each run (ticket 01 gate evidence). 4 keeps every run deterministic.
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    headless: false,
  },
  projects: [
    {
      name: 'firefox-extension',
      // @quarantine: ticket 01 (architecture-recovery) — Firefox keeps excluding
      // @quarantine-tagged tests: native-input dispatch on the Firefox persistent
      // context hangs (playwright#16095), so those specs are environmental there.
      // Chromium fixed all 30 during ticket 01 and rejoined the main suite.
      grepInvert: /@quarantine/,
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
        launchOptions: {
          args: ['-no-remote'],
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
