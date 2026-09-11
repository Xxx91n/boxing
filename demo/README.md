# demo/ — Boxing web preview (ticket 07 pages-demo)

Source payload for the **GitHub Pages NTP demo**: a static mirror of the
extension new-tab page that runs standalone on
`https://xxx91n.github.io/boxing/demo/` with no browser-extension context.

## How it works

- The mirror is **not committed as a copy of `ntp/`** — a copy would drift.
  At deploy time `.github/scripts/build-demo.mjs` (run by
  `.github/workflows/demo-deploy.yml`) copies the live `ntp/*` and
  `_locales/*` from the checkout into the artifact `demo/` directory and
  regenerates `index.html` from `ntp/index.html` with two insertions:
  1. `<script src="chrome-stub.js"></script>` before the `ntp.js` module tag;
  2. a fixed "web demo" banner after `<body>`.
- `chrome-stub.js` installs a localStorage-backed `chrome.*` mock
  (storage.local/sync/managed + onChanged, runtime.getURL, tabs.create →
  window.open) so the NTP boots without extension APIs. The NTP also carries
  its own `file://` mock; the stub makes the http-hosted lane explicit and
  key-faithful (the file mock `get()` answers only `boxingLayout`).
- Ticket 47: the mirror needs `ntp.css`, a gitignored build artifact
  (ADR-0011). `build-demo.mjs` regenerates it through the shared
  `.github/scripts/ntp-css.mjs` concatenation (the single logic, shared with
  `build.mjs`, per BX-XPLAT-001) and **fails closed** (exit 1) if `ntp.css`
  comes out missing/empty or `docs/privacy-policy.md` is absent. It also
  renders the artifact-root `privacy-policy.html` from
  `docs/privacy-policy.md` — the store-required
  `https://xxx91n.github.io/boxing/privacy-policy.html` URL, which Actions-mode
  Pages only serves if it is inside the artifact. `demo-deploy.yml` runs
  `build.mjs --css-only` before assembling and re-asserts both files exist
  before upload.
- `version.json` is **generated**, not committed: the workflow writes the
  release tag into the artifact, so the deployed demo is stamped with the
  release it came from. Fallbacks for manual runs:
  `workflow_dispatch` input `version`, then `manifest.json` version.

## Verification (CI-only build policy)

All assembling and deployment runs in GitHub Actions; the local tree is
never built. Static gates used at authoring time:

- `node --check` on `chrome-stub.js` and `.github/scripts/build-demo.mjs`
- `js-yaml` parse of `demo-deploy.yml`
- call-site audit: every `chrome.*` / `browser.*` touch in `ntp/*.js` is
  either covered by the stub, guarded by `typeof`, or has a
  `window.open` / `location` fallback (see ticket report §stub)
- After merge: dispatch `Deploy NTP demo (Pages)` once the Pages source
  switch is done, then load `/demo/` manually in Chrome + Firefox.

`pages-artifact/` is a deploy artifact directory, never committed.

## Manual one-time GitHub Pages switch (not automated)

Settings → Pages → Build and deployment → **Source = GitHub Actions**.
Without it the deploy-pages job has no destination. Until ticket 06 is
re-rendered as static HTML, `build-demo.mjs` also emits a placeholder
root `index.html` that redirects to `/demo/` (see the ticket report).
