# Boxing Test Suite

Playwright end-to-end tests for the Boxing browser extension.

## Setup (first time after clone)

```bash
npm install
npx playwright install firefox chromium
```

> **Required:** You must run `npx playwright install firefox chromium` once after cloning.
> The `postinstall` hook will remind you if you forget. Without the browser binaries,
> tests will fail with "Executable doesn't exist" errors.

## Running tests

```bash
# All tests (both browsers)
npm test

# Chrome only
npm run test:chromium

# Firefox only
npm run test:firefox

# Debug mode (Chrome, headed, slow)
npm run test:debug
```

## Configuration

- Config: `test/playwright.config.ts`
- Specs: `test/tests/boxing-*.spec.ts`
- Extension path: resolved from config via `__dirname/..` (repo root)
- Projects: `firefox-extension` and `chromium-extension` only

## CI

Tests run on GitHub Actions via `.github/workflows/test.yml`. Browser binaries are
cached via `actions/cache` keyed on `package-lock.json` hash.
