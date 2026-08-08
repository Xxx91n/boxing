# Publishing Guide

This guide walks you through setting up CRX3 signing and AMO signing for production releases of Boxing.

## Prerequisites

- Clone the repo: `git clone git@github.com:Xxx91n/boxing.git`
- Run `npm install` (downloads build dependencies)
- Node.js >= 18 (see `.nvmrc`)

## Part 1: CRX3 Signing (Chrome Web Store)

### Step 1: Generate a private key

```bash
openssl genrsa -out boxing.pem 2048
```

This `.pem` file is your permanent CRX signing key. **Keep it safe** — if you lose it, you'll need to republish the extension with a new ID.

### Step 2: Base64 encode the key for GitHub Secrets

```bash
# On Windows (Git Bash):
base64 -w 0 boxing.pem | tr -d '\n' > boxing.pem.b64
# On macOS/Linux:
base64 -i boxing.pem | tr -d '\n' > boxing.pem.b64
```

### Step 3: Add to GitHub Secrets

1. Go to your repo on GitHub: `https://github.com/Xxx91n/boxing`
2. Settings > Secrets and variables > Actions > New repository secret
3. Name: `CRX_PRIVATE_KEY_PEM`
4. Value: paste the base64-encoded content from `boxing.pem.b64`
5. Add secret

### Result

When you trigger the Build workflow, the CRX3 step will use this key to produce a signed `.crx` file instead of a placeholder.

## Part 2: AMO Signing (Firefox Add-ons)

### Step 1: Get AMO API credentials

1. Go to [https://addons.mozilla.org/developers/](https://addons.mozilla.org/developers/)
2. Log in with your Firefox/Mozilla account
3. Click **API Keys** in the sidebar
4. Generate a new API key/secret pair
5. Copy the **JWT issuer** (API key) and **JWT secret** (API secret)

### Step 2: Add to GitHub Secrets

1. Go to your repo: `https://github.com/Xxx91n/boxing/settings/secrets/actions`
2. New repository secret:
   - Name: `AMO_API_KEY`
   - Value: your JWT issuer key
3. New repository secret:
   - Name: `AMO_API_SECRET`
   - Value: your JWT secret

### Result

When you trigger the Build workflow, the AMO step will run `web-ext sign --channel unlisted` to produce a signed XPI. The signed XPI replaces the unsigned dev XPI in the release artifacts.

- `unlisted` channel means the XPI is signed but not listed on AMO — users install it from your release page.
- If you want it listed on AMO, change `--channel unlisted` to `--channel listed` in the workflow (requires AMO review).

## Part 3: Triggering a Build

### Manual trigger (recommended)

1. Go to `Actions` tab in your GitHub repo
2. Select **Build & Package** workflow
3. Click **Run workflow**
4. Optionally enter a version number override
5. Click **Run workflow**

### What you get

After the build completes, download the **boxing-release** artifact:

| File | Description |
|------|-------------|
| `boxing-chrome-<ver>.zip` | Chrome build — for Chrome Web Store upload or "Load unpacked" |
| `boxing-chrome-<ver>.crx` | CRX3 signed pack (if CRX_PRIVATE_KEY_PEM set) |
| `boxing-firefox-<ver>.zip` | Firefox build — for AMO upload |
| `boxing-firefox-<ver>.xpi` | AMO signed XPI (if AMO_API_KEY/SECRET set) or unsigned dev XPI |

## Part 4: Store Submission

### Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Pay the $5 one-time developer fee (if first time)
3. **Add new item** > upload `boxing-chrome-<ver>.zip`
4. Fill in store listing (use `docs/store-assets/store-listing.md`)
5. Upload screenshots from `docs/store-assets/screenshots/` (replace placeholders first!)
6. Set privacy policy URL: `https://<your-username>.github.io/boxing/privacy-policy.html`
7. Submit for review (1-3 business days)

### Firefox Add-ons (AMO)

1. Go to [AMO Developer Hub](https://addons.mozilla.org/developers/)
2. **Submit a New Add-on**
3. Choose **On this site** (for listed)
4. Upload `boxing-firefox-<ver>.zip`
5. Fill in store listing
6. Set privacy policy URL: `https://<your-username>.github.io/boxing/privacy-policy.html`
7. Submit for review

## Part 5: GitHub Pages (Privacy Policy)

1. Go to repo **Settings** > **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/docs`
4. Save
5. Your privacy policy will be available at `https://<your-username>.github.io/boxing/privacy-policy.html`

Note: GitHub Pages may need a _config.yml or index file. If Pages doesn't work with just markdown, create a simple `docs/_config.yml` or convert `privacy-policy.md` to `privacy-policy.html`.

## Part 6: Local Testing Safety

> **CRITICAL**: `web-ext sign` with real API credentials uploads to AMO and
> permanently occupies the version number — even with `--channel unlisted`.
> Deleted versions cannot be reused. This is not a bug; it is AMO policy.

### Rule 1: Local validation uses `web-ext lint`, not `web-ext sign`

```bash
npx web-ext lint --source-dir dist/boxing-firefox/release/firefox/boxing
```

This checks manifest, permissions, and code style without uploading anything.

### Rule 2: If you absolutely must verify signing end-to-end

Use a throwaway version number that you will never use for a real release:

```bash
# Temporarily set version to 99.9.1 in the Firefox dist manifest
npx web-ext sign --channel unlisted --api-key "$AMO_KEY" --api-secret "$AMO_SECRET" \
  --source-dir dist/boxing-firefox/release/firefox/boxing --artifacts-dir dist
# Delete version 99.9.1 from AMO Developer Hub afterwards
```

Throwaway version numbers like `99.9.x` are safe because you will never use
them for a real release. After signing, delete the version from the AMO
Developer Hub versions page.

### What happened (lesson learned)

During K5 local CI simulation, `web-ext sign --channel unlisted` was run
with real API keys and the production version numbers 3.7.0 and 3.7.1. Both
versions were uploaded to AMO and approved as unlisted. The version numbers
are now permanently consumed and cannot be reused even after deletion.
Future releases start from 3.7.2.

## Security Checklist

- [ ] CRX private key stored securely (not in the repo)
- [ ] AMO API secrets stored in GitHub Secrets (not in the repo)
- [ ] `boxing.pem` file is backed up safely (losing it means republishing with a new extension ID)
- [ ] Privacy policy page is accessible
- [ ] Screenshots are replaced with real ones (not transparent placeholders)
- [ ] Store listing descriptions are reviewed for accuracy
