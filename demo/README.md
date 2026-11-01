# demo/ — Boxing web preview (ticket 07 pages-demo)

Source payload for the **GitHub Pages NTP demo**: a static mirror of the
extension new-tab page that runs standalone at
`https://boxing.xxx91n.com/demo/` with no browser-extension context.

Scope and known limits: the mirror runs without real extension APIs — the
stub only mocks the surfaces listed above, so anything that needs the MV3
service worker (such as the WebDAV background proxy) is not supported here.
Pages deployment is CI-only (see Verification).

## How it works

- The mirror is **not a committed copy of `ntp/`** — a copy would drift. At
  deploy time `.github/scripts/build-demo.mjs` (run by
  `.github/workflows/demo-deploy.yml`) copies the live `ntp/*` and
  `_locales/*` files from the checkout into the artifact `demo/` directory
  and regenerates `index.html` from `ntp/index.html` with these changes:
  1. `<script src="chrome-stub.js"></script>` and `<script src="demo-flag.js"></script>`
     before the `ntp.js` module tag;
  2. a `<meta name="boxing-version" content="<version>">` tag inside `<head>`;
  3. a fixed "web demo" banner after `<body>`.
- `chrome-stub.js` installs a localStorage-backed `chrome.*` mock
  (storage.local/sync/managed + onChanged, runtime.getURL, tabs.create →
  window.open) so the NTP boots without extension APIs. The NTP also carries
  its own `file://` mock; the stub makes the http-hosted lane explicit and
  key-faithful (the file mock `get()` answers only `boxingLayout`).
- Ticket 47: the mirror needs `ntp.css`, a gitignored build artifact.
  `build-demo.mjs` regenerates it through the shared
  `.github/scripts/ntp-css.mjs` concatenation (the same logic `build.mjs`
  uses as the single build entry) and **fails closed** (exit 1) if `ntp.css`
  comes out missing/empty or `docs/privacy-policy.md` is absent. It also
  renders the artifact-root `privacy-policy.html` from
  `docs/privacy-policy.md` — the store-required
  `https://boxing.xxx91n.com/privacy-policy.html` URL, which Actions-mode
  Pages only serves when it is inside the artifact. `demo-deploy.yml` runs
  `build.mjs --css-only` before assembling and re-asserts both files exist
  before upload.
- `version.json` is **generated**, not committed: the workflow writes the
  release it came from into the artifact, normalized to the bare calver
  (`v2026.9.20` is stored as `2026.9.20`). Fallbacks for manual runs:
  `workflow_dispatch` input `version`, then `manifest.json` version.

## Verification (CI-only Pages deployment policy)

Pages deployment runs in GitHub Actions. Artifact assembly also works
locally: `.github/scripts/build.mjs` and `.github/scripts/build-demo.mjs`
can be invoked directly and write generated files (`ntp/ntp.css`,
`pages-artifact/`) into the checkout. Static gates used at authoring time:

- `node --check` on `chrome-stub.js` and `.github/scripts/build-demo.mjs`
- `js-yaml` parse of `demo-deploy.yml`
- call-site audit: every `chrome.*` / `browser.*` touch in `ntp/*.js` is
  either covered by the stub, guarded by `typeof`, or has a `window.open` /
  `location` fallback (see ticket report §stub)
- After merge: dispatch `Deploy NTP demo (Pages)` once the Pages source
  switch is done, then load `/demo/` manually in Chrome + Firefox.

`pages-artifact/` is a deploy artifact directory, never committed.

## Manual one-time GitHub Pages switch

Settings → Pages → Build and deployment → **Source = GitHub Actions**.
Without it the `deploy-pages` job has no destination. `build-demo.mjs` also
emits a placeholder root `index.html` that redirects to `/demo/` (see the
ticket report).
