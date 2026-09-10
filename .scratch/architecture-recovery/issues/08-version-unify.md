# 08 — chore(release): unify version strings to 2026.9.12 + fix version_name injection

**What to build:** unify version strings to 2026.9.12 + fix version_name injection

**Blocked by:** 01 icons, 02 readme-sync, 03 store-i18n

**Status:** code-done (CI-open: build + Playwright evidence via CI dispatch, per 2026-09-04 CI-only mandate)

**GitHub:** https://github.com/Xxx91n/boxing/issues/8

## Acceptance criteria

- [x] manifest/package/README badge/CHANGELOG/AGENTS.md/settings footer = 2026.9.12
- [x] build.mjs overrides version_name as well as version from BOXING_BUILD_VERSION
- [ ] npm run build green; no leftover v3.6.6 footer — *footer half verified statically (zero v3.6.6 residue outside history layers); build-green deferred to CI (CI-only policy)*
