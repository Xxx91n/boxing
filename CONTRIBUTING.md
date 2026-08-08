# Contributing to Boxing

Thanks for your interest in contributing! Boxing is a vanilla JS browser extension — no frameworks, no bundlers, no external runtime dependencies.

## Quick Start

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

## Workflow

1. **Fork** the repo and create a branch: `git checkout -b feat/your-feature`
2. **Build** to verify: `npm run build`
3. **Test**: `npm test` (Playwright, both Chrome + Firefox)
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add X` — new feature
   - `fix: resolve Y` — bug fix
   - `docs: update Z` — docs only
   - `refactor: clean up W` — no behavior change
5. **Push** and open a Pull Request against `main`

## Code Style

- Vanilla JavaScript (ES2020+), no transpiler, no TypeScript
- 2-space indentation, semicolons required
- No `var` — use `const` / `let`
- CSS follows the [dual-write convention](docs/css-dual-write-convention.md) for shared rules

## Testing

Tests are in `test/tests/` using Playwright. Run:

```bash
npm test                  # All browsers
npm run test:chromium     # Chrome only
npm run test:firefox      # Firefox only
```

When adding a feature, add a test spec that covers the core behavior.

## Architecture Notes

- `ntp/` — New tab page (canvas, boxes, bookmarks, settings)
- `popup/` — Toolbar popup
- `background.js` — Service worker
- `_locales/` — 14 language directories
- Build output: `dist/boxing-chrome` + `dist/boxing-firefox`
- See [CONTEXT.md](docs/CONTEXT.md) for the full architecture glossary

## Reporting Issues

Use [GitHub Issues](https://github.com/Xxx91n/boxing/issues) with the provided templates.

## Code of Conduct

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
