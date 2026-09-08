# Ticket 35 Report — Authoritative publication-surface verification

- Date: 2026-09-08
- Implementing window: sub-window, Ticket 35 only (no code from other tickets touched)
- Launcher: .scratch/architecture-recovery/prompts/35-authoritative-publication-surface-verification.md
- Ticket: .scratch/architecture-recovery/issues/35-authoritative-publication-surface-verification.md
- Handoff: .scratch/architecture-recovery/handoffs/35-authoritative-publication-surface-verification.md
- Research discipline: WORKFLOW.md §4.3 — one serialized atomcode run via ctx_batch_execute (concurrency 1, timeout 600000 ms); no second atomcode dispatch, no raw shell/curl self-search for the deep research.

## 0. Method and evidence classes

Evidence classes used, in descending authority:

1. **Owner-provided identifiers** — the Firefox gecko id read from this repo's own manifest.json: `{2F5A8F1E-9B3C-4D7E-A2B1-6F4C8E9D3A7F}` (manifest.json lines 41-43). This is an owner-declared ID, not a guessed store affinity string.
2. **Store/registry API lookups** — AMO API v5 (search by author, detail lookup by GUID, calibration lookups), GitHub REST API (releases, repo, user-site repo, pages).
3. **Store/public page status checks** — GitHub Pages root, project root, privacy page; GitHub releases page (via atomcode rendered fetch).
4. **Deep research** — one serialized atomcode run (Exa+Tavily+AnySearch + Patchright rendering) with the exact question mandated by the launcher.
5. **Repo-local documents** — docs/publishing-guide.md, docs/store-publishing-plan.md (used as corroboration, never as sole proof).

Zero guessed store IDs are presented anywhere in this report as proof of presence or absence. The only store ID used for lookup is the owner-declared gecko GUID from manifest.json, plus a synthetic calibration GUID explicitly labeled as a calibration probe (used to characterize API behavior, never to conclude about Boxing).

## 1. Acceptance criteria — item-by-item verification

### AC-1 — Each store claim is backed by an owner-provided URL/ID or an authoritative store lookup result

| Claim | Backing evidence | Class |
|---|---|---|
| Firefox Add-ons: no public listing | AMO API v5 author search `https://addons.mozilla.org/api/v5/addons/search/?author=Xxx91n` → `{"page_size":25,"page_count":1,"count":0,"results":[]}` (fetched 2026-09-08, cached in ctx index source `amo-author-search`). Corroborated by atomcode: AMO store search "boxing" (2,495 results) contains no extension by Xxx91n. | Store lookup |
| Firefox Add-ons: unlisted signed versions exist | GUID detail lookup `https://addons.mozilla.org/api/v5/addons/addon/%7B2F5A8F1E-9B3C-4D7E-A2B1-6F4C8E9D3A7F%7D/` → **HTTP 401** (twice, with and without `?lang=en-US`). Calibration: public add-on `uBlock0@raymondhill.net` → 200; synthetic GUID `{AAAAAAAA-BBBB-CCCC-DDDD-EEEEFFFF0000}` → 404. 401 (not 404) for the owner GUID is consistent with "exists but not anonymously visible", matching docs/publishing-guide.md's documented unlisted uploads of 3.7.0/3.7.1. | Owner-provided ID + store lookup + repo doc corroboration |
| Edge Add-ons: not published | Edge store search "boxing" rendered by atomcode (microsoftedge.microsoft.com/addons/search/boxing) → 6 results, all unrelated games/wallpapers (Ragdoll Duel Boxing Game, Kung Fu Street Fight Game, Drunken Boxing ×2, Stickman Boxing KO, Boxing Streams Wallpaper). No Boxing bookmark-manager listing. Partner Center submission state is account-gated and externally unverifiable — recorded as an evidence gap, not assumed. | Store lookup (rendered) + atomcode |
| GitHub Releases: empty | `https://api.github.com/repos/Xxx91n/boxing/releases` → `[]` (fetched directly 2026-09-08, source `releases-api`); `.../releases/latest` → HTTP 404. atomcode rendered the releases page: "There aren't any releases here". Repo has zero git tags (atomcode, local git). build.yml creates releases only on manual dispatch with make_release=true (atomcode source read). | Registry API + page + repo doc |
| GitHub Pages: project-site root 404, privacy page 200 | `https://xxx91n.github.io/boxing/` → HTTP 404 (direct fetch, source `pages-root`); `https://xxx91n.github.io/boxing/privacy-policy.html` → HTTP 200 with real rendered policy content (direct fetch, source `privacy-page`, title "Boxing Privacy Policy", "Last updated: 2026-08-08"). | Page status checks |

### AC-2 — The root GitHub Pages URL and privacy-visible URL are both verified

Both verified on 2026-09-08 by direct fetch (ctx_fetch_and_index, HTTP status observed by the tool):

- `https://xxx91n.github.io/boxing/` → **404**.
- `https://xxx91n.github.io/boxing/privacy-policy.html` → **200**, real Jekyll-rendered privacy policy (theme footer "View the Project on GitHub"; policy content matches docs/privacy-policy.md).

Additional root-cause verification for the 404 (from atomcode + direct lookups):

- Domain root `https://xxx91n.github.io/` → 404 (atomcode + source report round7 agrees).
- `https://api.github.com/repos/Xxx91n/Xxx91n.github.io` → **404**: the user-site repo does not exist, so the domain root cannot serve anything — this is GitHub's by-design behavior for project sites (official docs: docs.github.com "What is GitHub Pages").
- Project root `/boxing/` 404 cause: `docs/` has `_config.yml` and privacy-policy.md but **no index.md / index.html** (local listing, command `ls docs/` 2026-09-08). Pages is enabled and building successfully — proven by the privacy page 200. GitHub's official 404 troubleshooting doc lists a missing index file as the canonical cause.
- Pages API `https://api.github.com/repos/Xxx91n/boxing/pages` → 404 anonymously (atomcode also timed out on it). Treated as non-conclusive (anonymous access to the pages API on a public repo returned 404 — same class of ambiguity as the AMO 401); the privacy page 200 is the load-bearing proof that Pages is enabled.

**Correct publishing entry (for Ticket 37 wording and maintainer action):** the current working public entry is the privacy-policy URL. Fixing the project-site root = add `docs/index.md` (or index.html). The domain root `xxx91n.github.io/` can only be fixed by creating the user-site repo `Xxx91n/Xxx91n.github.io` or attaching a custom domain — not by any change inside this repo.

### AC-3 — Firefox and Edge store conclusions are marked public, hidden, unlisted, not published, or unverified only from evidence

| Surface | Status (evidence-based) | Reasoning |
|---|---|---|
| Firefox Add-ons (AMO) | **not published (publicly listed)**; unlisted signed builds exist (unverified externally, documented locally) | Author search count:0 + GUID 401 vs calibration (public 200 / synthetic 404) + publishing-guide's unlisted 3.7.0/3.7.1 record. The unlisted-presence conclusion is "consistent with local doc + 401 signature", not owner-confirmed in the AMO dashboard this window — therefore qualified, not asserted. |
| Edge Add-ons | **not published** (externally verifiable sense) | Rendered store search has no Boxing listing. Whether a submission is sitting in Partner Center review is account-gated → recorded as evidence gap; external claim is only "no public listing". |
| Chrome Web Store | **out of scope by policy** | docs/publishing-guide.md: Chrome deferred until Edge is live (2026-08-22 decision). No lookup performed, no claim made. |
| GitHub Releases | **not published (zero releases)** | API `[]` + releases page empty + zero tags + CI workflow never dispatched for release. |
| GitHub Pages | **published (privacy page live); project root 404; domain root not applicable without user-site repo** | Direct status checks above. |

No status word in this table comes from guesswork; each cell cites its evidence class.

### AC-4 — Zero guessed store IDs are presented as proof of absence or presence

- The only store GUID used for the AMO presence check is the owner-declared `browser_specific_settings.gecko.id` from this repo's manifest.json (lines 41-43).
- The synthetic GUID `{AAAAAAAA-BBBB-CCCC-DDDD-EEEEFFFF0000}` was used solely as an API-behavior calibration probe (to distinguish 401 vs 404 semantics); it is never presented as a Boxing identifier.
- No Edge/Chrome store IDs appear anywhere in this report; Edge absence is established by rendered store search, not by probing guessed product-ID URLs.
- AMO search-result IDs seen in the "boxing" search (1067911 "boxing" by dmanley 2010, 1151198 "boxing 2" by angria 2010, cr-box 895244, etc.) are unrelated third-party extensions and are explicitly recorded as NOT Boxing.

## 2. Commands and probes actually run (chronological)

1. ctx_execute_file — read all 7 must-read files (launcher, issue, handoff, WORKFLOW.md, spec.md, round7-architecture-report.md, docs/publishing-guide.md, docs/store-publishing-plan.md).
2. ctx_fetch_and_index (6 URLs, 2026-09-08):
   - `https://xxx91n.github.io/boxing/` → HTTP 404
   - `https://xxx91n.github.io/boxing/privacy-policy.html` → HTTP 200 (real policy content)
   - `https://api.github.com/repos/Xxx91n/boxing/releases` → `[]`
   - `https://api.github.com/repos/Xxx91n/boxing/releases/latest` → HTTP 404
   - `https://api.github.com/repos/Xxx91n/boxing` → 200 (public repo metadata)
   - `https://addons.mozilla.org/api/v5/addons/search/?q=boxing` → count 2497, no Xxx91n extension in results
3. ctx_batch_execute — local evidence: `ls docs/` (no index file, `_config.yml` present), README store/release link inventory (lines 27, 28, 32, 80, 88), but status (workspace state).
4. ctx_execute — tasklist probe: no atomcode process in flight (§4.3 serialization precondition).
5. ctx_batch_execute — **the one mandated atomcode run** (verbatim question from the launcher, concurrency 1, timeout 600000): completed with 8 indexed sections, evidence chain closed. Conclusion matrix: AMO not publicly listed (author API count:0; unlisted 3.7.0/3.7.1 documented), Edge not published (6 unrelated search hits), Releases empty (page+API+tags), Pages root 404 two-layer cause (user-site repo missing + docs/ lacks index), correct entries recorded.
6. ctx_batch_execute — local manifest read: gecko GUID extraction.
7. ctx_fetch_and_index (4 URLs): AMO GUID lookup → 401; AMO author search → count:0 (direct confirmation); `api.github.com/repos/Xxx91n/Xxx91n.github.io` → 404 (user-site repo absent); `api.github.com/repos/Xxx91n/boxing/pages` → 404 anonymous (non-conclusive, recorded as gap).
8. ctx_fetch_and_index (3 URLs) — 401 calibration: public add-on 200; synthetic GUID 404; our GUID 401 again. This distinguishes "exists but hidden from anonymous API" (401) from "never existed" (404).

## 3. Final publication-status table (the deliverable for Tickets 36/37)

| Surface | Authoritative URL probed | Observed | Final status |
|---|---|---|---|
| Firefox Add-ons (AMO), public listing | api v5 author search + 2497-result store search | count:0, no match | **not published** (no public listing) |
| Firefox Add-ons (AMO), unlisted builds | GUID detail API with owner GUID from manifest | HTTP 401 (calibrated: public=200, synthetic=404) | **unlisted builds consistent with repo doc (3.7.0/3.7.1 consumed)**; external visibility: none |
| Microsoft Edge Add-ons | rendered store search "boxing" | 6 unrelated results | **not published**; Partner Center state unverifiable externally (gap) |
| Chrome Web Store | — (deferred by policy) | — | **out of scope / not submitted by decision** |
| GitHub Releases | api releases + releases/latest + page + git tags | `[]`, 404, "no releases", 0 tags | **not published (zero releases)** |
| GitHub Pages, project root | /boxing/ | HTTP 404 | **404 — cause: docs/ lacks index page** |
| GitHub Pages, privacy page | /boxing/privacy-policy.html | HTTP 200 | **published, live** |
| GitHub Pages, domain root | xxx91n.github.io/ (+ user-site repo API) | 404; user-site repo 404 | **by-design 404; needs user-site repo or custom domain** |

## 4. Evidence gaps (explicitly non-conclusive items)

1. **Edge Partner Center submission state** — account-gated; external evidence can only say "no public listing". If the maintainer has a submission in review, only they can confirm.
2. **AMO unlisted build presence** — the 401-vs-404 signature + repo doc are consistent but not an owner-dashboard confirmation; unlisted add-ons are invisible to anonymous API by design.
3. **GitHub Pages source branch** — inferred main/docs from repo layout + publishing guide; the pages REST API is anonymously non-conclusive (404). The live privacy page proves enablement regardless.
4. **AMO version-line relationship** — publishing-guide says 3.7.0/3.7.1 consumed and "next from 3.7.2", while manifest is calver 2026.8.21; the exact AMO-side version bookkeeping needs the developer dashboard.

## 5. Handoff notes for dependent tickets

- **Ticket 36 (screenshots)**: no store listing exists to capture listings from; capture must use the local extension UI (as its handoff already scopes it) — do not attempt to screenshot store pages that do not exist.
- **Ticket 37 (README reconciliation)**: the README currently shows an "Install from GitHub Releases" button + version badge + release ZIP/XPI links (README.md lines 27, 32, 80, 88) against a **zero-release** reality, and an "Edge Add-ons — Coming Soon" badge (line 28) consistent with the actual not-published state. Reconciliation must either publish a release (maintainer action, CI build.yml manual dispatch) or reword install instructions; the privacy-policy URL is the only verified live public URL available for store listings.
- **Maintainer actionable fixes (outside this ticket's code scope)**: add `docs/index.md` for the project root; decide user-site repo vs custom domain for the domain root; AMO public listing requires a listed-channel submission (mind the one-time version-number consumption documented in publishing-guide).

## 6. Version control

Per WORKFLOW.md §4.2 this report is committed through GitButler on a dedicated ticket-35 branch; no push, no PR. The commit contains only this report file (other uncommitted workspace files belong to the brain window / other tickets and were not claimed).
