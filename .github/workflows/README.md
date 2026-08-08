# Boxing — CI/CD Build Workflow

Manual dispatch workflow that packages the Boxing extension into 4 release artifacts
for Chrome and Firefox. It is intentionally NOT triggered on push or pull request — run it from
the Actions tab: **Build & Package → Run workflow**.

## Artifacts (one per browser, × 2 formats = 4 files)

| File | Browser | Format | Notes |
| --- | --- | --- | --- |
| `boxing-chrome.zip` | Chrome | zip | Load via `chrome://extensions` → Developer mode → Load unpacked |
| `boxing-chrome.crx` | Chrome | CRX3 | Signed only when repo secret `CRX_PRIVATE_KEY_PEM` (base64-encoded PEM private key) is present; otherwise a placeholder zip renamed `.crx` so the slot is still populated |
| `boxing-firefox.zip` | Firefox | zip | Web-ext-style zipped folder |
| `boxing-firefox.xpi` | Firefox | XPI | Unsigned dev build; production requires separate AMO signing (out of scope here) |

## Inputs

- `version` (optional): override `manifest.json` `version` for this build run (e.g. `3.7.10`).
- `make_release` (optional, default `false`): when `true`, also create a draft GitHub pre-release
  with `tag_name=v<version>` (or `v<run_id>` if version is empty) and attach the 4 artifacts.

## Required repo secrets (optional)

| Secret | Purpose |
| --- | --- |
| `CRX_PRIVATE_KEY_PEM` | base64-encoded RSA private key (PEM) used to sign `boxing-chrome.crx`. Without it the `.crx` is a placeholder (clearly noted in the build log). |

## Local repro

```
node .github/scripts/build.mjs
# -> dist/boxing-chrome/, dist/boxing-firefox/
# then zip each: (cd dist/boxing-chrome && zip -r -X ../boxing-chrome.zip .)
```

## ⚠ AMO Signing Safety

`web-ext sign` uploads to AMO and **permanently burns the version number**,
even with `--channel unlisted`. Do NOT run it locally with real API keys
just to "test" the pipeline.

- **Local validation**: use `npx web-ext lint --source-dir dist/boxing-firefox/release/firefox/boxing`
- **End-to-end signing test**: use a throwaway version (e.g. `99.9.x`), then delete from AMO
- **Production signing**: only in CI with proper version management

See `docs/publishing-guide.md § Local Testing Safety` for full details.
