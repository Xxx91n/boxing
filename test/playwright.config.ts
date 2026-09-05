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
  // Worker policy (ticket 20, architecture-recovery; research-report-round4 §5):
  // - Local cap 4: default (all cores) launches 8 headed browsers on this
  //   8-thread host and starves them — random 30s setup/timeout failures with
  //   different victims each run (ticket 01 gate evidence).
  // - CI cap 2: GitHub standard runners have 4 cores; 2-4 workers is the
  //   measured sweet spot there (currents.dev), and 2 keeps headroom for the
  //   headed browsers themselves. Explicit policy, not an ad hoc flag.
  workers: process.env.CI ? 2 : 4,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    headless: false,
  },
  projects: [
    {
      name: 'firefox-extension',
      // @quarantine: retired in ticket 27 (architecture-recovery convergence pass,
      // 2026-09-05). All 14 tagged tests were repaired (synthetic-input conversion
      // per the ticket-18 pattern) and rejoined the firefox lane, so grepInvert is
      // REMOVED — the firefox lane now runs the full suite. History: the tag
      // excluded firefox from specs whose native-input dispatch stalled on the
      // firefox persistent context (playwright#16095 class, ticket 01).
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
