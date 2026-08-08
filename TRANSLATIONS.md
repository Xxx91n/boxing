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
| Traditional Chinese | zh_TW | Planned | — |
| Japanese | ja | Planned | — |
| Korean | ko | Planned | — |
| French | fr | Planned | — |
| German | de | Planned | — |
| Spanish | es | Planned | — |
| Portuguese (Brazil) | pt_BR | Planned | — |
| Russian | ru | Planned | — |
| Arabic | ar | Planned | — |
| Hindi | hi | Planned | — |
| Thai | th | Planned | — |
| Vietnamese | vi | Planned | — |

The extension UI supports all 14 languages via `_locales/`. README translations are added on demand.

## How to Add a Translation

1. Copy `README.md` to `docs/i18n/README.<lang>.md` (use [BCP 47](https://tools.ietf.org/html/rfc5645) language tags)
2. Translate all prose into the target language
3. Keep code blocks, URLs, file paths, and variable names in English
4. Fix relative paths: links to root-level files need `../../` prefix (e.g., `../../LICENSE`, `../../CONTRIBUTING.md`)
5. Update the language selector in:
   - `README.md` (root) — add your language link pointing to `docs/i18n/README.<lang>.md`
   - Your new file — bold your language, link English to `../../README.md`, other translations as sibling filenames
6. Open a PR

## Guidelines

- Translate prose only — do not modify code, commands, URLs, or badge syntax
- Match the structure and section order of the English original
- Image paths use `../../docs/store-assets/screenshots/` prefix from `docs/i18n/`
- If a section is hard to translate, keep the English version rather than paraphrasing incorrectly
