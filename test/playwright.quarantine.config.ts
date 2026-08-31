import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.resolve(__dirname, '..');

// Quarantine lane (ticket 01, architecture-recovery): runs ONLY tests tagged
// @quarantine in their titles. The main config (playwright.config.ts) excludes
// them via per-project grepInvert; this config omits grepInvert so the CLI
// --grep=@quarantine can select them for repair work (npm run test:quarantine).
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    trace: 'on-first-retry',
    headless: false,
  },
  projects: [
    {
      name: 'firefox-extension',
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
      // ticket 03 (architecture-recovery): keep in sync with playwright.config.ts —
      // the @quarantine file:// specs need --allow-file-access-from-files now that
      // ntp.js is <script type="module"> (chromium CORS-blocks modules over file://).
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
