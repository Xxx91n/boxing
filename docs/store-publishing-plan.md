# Store Publishing Readiness Plan

> Generated from grill-with-docs session Q1-Q5.
> Domain terms: see CONTEXT.md Architecture Glossary section.

## Grill Decisions

| Q | Decision | Rationale |
|---|----------|-----------|
| Q1 | A+B sync, prepare everything at once | Screenshots as placeholders, human replaces later |
| Q2 | (A) Chrome optional_host_permissions + Firefox keeps host_permissions | Chrome review: narrower permissions = higher pass rate; Firefox more tolerant of WebDAV |
| Q3 | (A) GitHub Pages hosts privacy policy | https://xxx91n.github.io/boxing/privacy-policy.html |
| Q4 | (A) 5 transparent 1280x800 PNG placeholders + README | Human overwrites same filenames later |
| Q5 | CRX pem + AMO API key deferred to daytime interactive setup | Involves user account identity, needs hands-on guidance |

## Execution Plan

### Phase 1: Code Changes (autonomous, nighttime)

| Step | File | Change | Status |
|------|------|--------|--------|
| A1 | .github/scripts/build.mjs | tailorManifest Chrome: move host_permissions to optional_host_permissions | Done |
| A2 | background.js | ensureWebDAVPermission(url): check chrome.permissions.contains before fetch | Done |
| A2b | ntp/ntp.js | WebDAV: if needPermission, call chrome.permissions.request from user gesture | Done |
| A3 | docs/privacy-policy.md | Privacy policy for GitHub Pages | Done |
| A4 | docs/store-assets/screenshots/ | 5 transparent 1280x800 PNG + README | Done |
| A5 | docs/store-assets/store-listing.md | Short + detailed description | Done |
| A6 | .github/workflows/build.yml | AMO signing step with web-ext sign | Done |
| A6b | docs/publishing-guide.md | CRX pem + AMO API key setup guide | Done |

### Phase 2: Verification (autonomous, nighttime)

| Step | Check |
|------|-------|
| V1 | npm run build: Chrome dist has optional_host_permissions, no host_permissions |
| V2 | Firefox dist keeps host_permissions |
| V3 | git diff --check clean |
| V4 | CONTEXT.md glossary updated |
| V5 | Commit + push |

### Phase 3: Interactive Key Setup (daytime, with user)

| Step | Action | Who |
|------|--------|-----|
| K1 | openssl genrsa -out boxing.pem 2048 | User (guided) |
| K2 | base64 encode + GitHub Secret CRX_PRIVATE_KEY_PEM | User (guided) |
| K3 | AMO Developer Hub: generate API key/secret | User (guided) |
| K4 | GitHub Secrets AMO_API_KEY + AMO_API_SECRET | User (guided) |
| K5 | workflow_dispatch to verify signing | Agent |

### Phase 4: Store Submission (daytime, with user)

| Step | Action |
|------|-------|
| S1 | Chrome Web Store: upload zip, fill listing, submit |
| S2 | AMO: upload zip, fill listing, submit |
| S3 | Replace screenshot placeholders with real screenshots |
| S4 | Enable GitHub Pages (repo Settings, Pages, main /docs) |

## Risk Matrix

| Risk | Impact | Mitigation |
|------|--------|------------|
| Chrome rejects optional_host_permissions | Medium | pwm research: this is the recommended MV3 pattern |
| Firefox permissions.request inconsistent | Low | Firefox keeps required host_permissions, no runtime request |
| GitHub Pages not enabled | Low | Documented in publishing-guide |
| CRX key lost | High | Must republish with new extension ID |
| AMO source code review | Low | Vanilla JS, no minification, source = extension |
