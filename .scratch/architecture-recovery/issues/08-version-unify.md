# 08 — chore(release): unify version strings to 2026.9.12 + fix version_name injection

**What to build:** unify version strings to 2026.9.12 + fix version_name injection

**Blocked by:** 01 icons, 02 readme-sync, 03 store-i18n

**Status:** ready-for-agent

**GitHub:** https://github.com/Xxx91n/boxing/issues/8

## Acceptance criteria

- [ ] manifest/package/README badge/CHANGELOG/AGENTS.md/settings footer = 2026.9.12
- [ ] build.mjs overrides version_name as well as version from BOXING_BUILD_VERSION
- [ ] npm run build green; no leftover v3.6.6 footer
