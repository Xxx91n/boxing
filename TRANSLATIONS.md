# Translations

## Layout

- English README (source of truth): `README.md` at repo root
- Translated READMEs: `docs/i18n/README.<lang>.md`

GitHub renders only the root `README.md` on the repo homepage. Translations live under `docs/i18n/` to keep the root directory clean.

## Supported Languages

| Language | Code | Status | File |
|----------|------|--------|------|
| English | en | Source | `README.md` |
| Simplified Chinese | zh_CN | Available | `docs/i18n/README.zh_CN.md` |
| Traditional Chinese | zh_TW | Available | `docs/i18n/README.zh_TW.md` |
| Japanese | ja | Available | `docs/i18n/README.ja.md` |
| Korean | ko | Available | `docs/i18n/README.ko.md` |
| French | fr | Available | `docs/i18n/README.fr.md` |
| German | de | Available | `docs/i18n/README.de.md` |
| Spanish | es | Available | `docs/i18n/README.es.md` |
| Portuguese (Brazil) | pt_BR | Available | `docs/i18n/README.pt_BR.md` |
| Russian | ru | Available | `docs/i18n/README.ru.md` |
| Arabic | ar | Available | `docs/i18n/README.ar.md` |
| Hindi | hi | Available | `docs/i18n/README.hi.md` |
| Thai | th | Available | `docs/i18n/README.th.md` |
| Vietnamese | vi | Available | `docs/i18n/README.vi.md` |

The extension UI supports all 14 languages via `_locales/`. A hand-translated README exists for every locale; the English README is the source of truth and locale files are kept in sync manually whenever its Install section, Screenshots table, or Brand Assets section changes.

## Language Switcher

Every README (root + locales) carries a one-line language selector between `<!-- README-I18N:START -->` and `<!-- README-I18N:END -->` markers. `node scripts/gen-i18n-readme.js` regenerates only that marker block across all 14 files — it never rewrites translated prose. (The old version of the script rebuilt whole locale READMEs from the English body and wrote them to the repo root, clobbering hand translations; that behavior was retired in the 2026.9.12 docs sync.)

## How to Add a Translation

1. Copy `README.md` to `docs/i18n/README.<lang>.md` (use [BCP 47](https://tools.ietf.org/html/rfc5645) language tags)
2. Translate all prose into the target language
3. Keep code blocks, URLs, file paths, and variable names in English
4. Fix relative paths: links to root-level files need `../../` prefix (e.g., `../../LICENSE`, `../../CONTRIBUTING.md`); screenshots use `../../docs/store-assets/screenshots/`
5. Update the language selector in:
   - `README.md` (root) — add your language link pointing to `docs/i18n/README.<lang>.md`
   - Your new file — bold your language, link English to `../../README.md`, other translations as sibling filenames
   - Or add your locale to `LOCALES` in `scripts/gen-i18n-readme.js` and run it to sync every selector block
6. Mark your locale `Available` in the table above
7. Open a PR

## Guidelines

- Translate prose only — do not modify code, commands, URLs, or badge syntax
- Match the structure and section order of the English original, including the Screenshots table (5 images), the Brand Assets section, and the release-first Install section
- Image paths use `../../docs/store-assets/screenshots/` prefix from `docs/i18n/`
- If a section is hard to translate, keep the English version rather than paraphrasing incorrectly
