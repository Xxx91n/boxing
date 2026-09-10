# 07 — feat(pages-demo): release-triggered NTP static preview on GitHub Pages

**What to build:** release-triggered NTP static preview on GitHub Pages

**Blocked by:** 06 pages-index

**Status:** code-done · CI-open (deploy behavior awaits first release / manual dispatch CI evidence)

**GitHub:** https://github.com/Xxx91n/boxing/issues/7

## Acceptance criteria

- [x] demo/ NTP mirror + chrome API stub loads standalone (call-site audit in report §三; browser run deferred to CI/manual per CI-only policy)
- [x] demo-deploy.yml uses official artifact Pages deploy on release published
- [x] version.json equals release tag; human Pages source = GitHub Actions noted
