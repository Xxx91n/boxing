# Ticket 37 Report — README release-install claim reconciliation

- Date: 2026-09-09
- Implementing window: sub-window, Ticket 37 only (no other ticket's code touched)
- Launcher: .scratch/architecture-recovery/prompts/37-readme-release-install-claim-reconciliation.md
- Ticket: .scratch/architecture-recovery/issues/37-readme-release-install-claim-reconciliation.md
- Handoff: .scratch/architecture-recovery/handoffs/37-readme-release-install-claim-reconciliation.md
- Version control: WORKFLOW.md §4.2 (GitButler; branch ticket-37-readme-release-claims; commit uvl; no push, no PR)

## 0. Blocker state and method

- Blockers 35 and 36 were both review-accepted before start (round7-wave1-review.md, tracked
  by the brain's uncommitted .scratch updates; status table shows "37 | ready-for-agent |
  blockers 35 and 36 are review-accepted").
- Read the full launcher via ctx_execute_file, then every must-read file via ctx_execute
  (issue 37, handoff 37, WORKFLOW.md, spec.md, round7-architecture-report.md, README.md,
  docs/publishing-guide.md) plus the ticket 35/36 reports — no work started from memory.
- Evidence re-verified this window, not copied: GitHub Releases API re-fetched 2026-09-09
  (ctx_fetch_and_index, source t37-releases-api) → `[]`, same as ticket 35's finding.
- Screenshot pixels verified byte-identical to ticket 36's archived sha256 prefixes
  (e62c8ef9db9fcccf / 87c4eb9e5a1f0610 / dadba759e96e99c8 / 37deea7c05ae6d77 / 816ab91840eb1d47),
  computed locally this window over docs/store-assets/screenshots/*.png.

## 1. AC-1 — GitHub Releases links produce at least one asset, or README no longer implies an available release

Chosen route: **README no longer implies an available release** (maintainer route — publish a
release — is explicitly out of scope per spec.md "Out of Scope": no release upload authorized).

Evidence:
- Releases API re-check 2026-09-09: `https://api.github.com/repos/Xxx91n/boxing/releases`
  → `[]` (zero releases; matches ticket 35 report §3 "not published (zero releases)").
- Ticket delta honored: **no new release-download links added** (launcher delta: 不新增发布下载
  链接,除非已有 GitHub Release 资产).
- Removed from README.md:
  - L27 badge "Install from GitHub Releases" → replaced with
    `Install — Build_from_source` badge linking to #install.
  - L32 `img.shields.io/github/v/release/Xxx91n/boxing` version badge → replaced with a
    static `extension_version-2026.8.21` badge (matches manifest.json calver) labeled
    "no GitHub release published yet".
  - L80 "Download the latest [release ZIP](...releases)" and L88
    "Download the latest [release XPI](...releases)" → removed entirely; install steps now
    say "Clone or download this repository".
- Post-edit assertion (16 checks, all pass in the edit script's POST-WRITE layer):
  `github.com/Xxx91n/boxing/releases` count in README.md = **0**.

## 2. AC-2 — CRX and XPI language distinguishes store/AMO signing from self-signed or un-signed local builds

New `> [!NOTE]` blockquote inside the Install section states, verbatim-claims:
- The `.zip` per browser is for store upload and **not signed by this repository**.
- The `.crx` is **self-signed only when CRX_PRIVATE_KEY_PEM is configured in CI**; otherwise
  an unsigned local placeholder.
- The `.xpi` is an **unsigned development build unless AMO API credentials are configured**,
  in which case AMO signs it on the **unlisted channel**.
- Production signing is provided by the stores (Edge Add-ons) or AMO/web-ext at publish time;
  **none of these artifacts are currently published for download**.

This matches the spec.md Implementation Decision ("local crx and xpi placeholders must not be
presented as production-signed installation artifacts without clear qualification") and
docs/publishing-guide.md Part 1-3 (CRX3 key → signed .crx; AMO creds → web-ext sign unlisted).

## 3. AC-3 — Store links reflect ticket 35 findings

- New `> [!IMPORTANT]` callout at the top of Install: "No installable packages are published
  yet. GitHub Releases currently has zero releases, and no store listing is live: Edge Add-ons
  rollout is in progress, Chrome Web Store is deferred until Edge is live, and AMO has no
  public listing. Until the first release or listing ships, install from source below."
  Each clause maps 1:1 to ticket 35 report §3's status table (Releases zero / Edge rollout
  per publishing-guide order / Chrome deferred by policy / AMO no public listing).
- Edge badge (L28, "Edge Add-ons — Coming Soon" → publishing-guide.md) kept: it already
  reflects ticket 35's "not published" + rollout-in-progress state.
- The only public URL ticket 35 verified live (privacy-policy page 200) is not claimed as a
  store link anywhere; no guessed store IDs were introduced.
- Evidence pointer added in the IMPORTANT callout linking the ticket 35 report
  (.scratch/architecture-recovery/35-authoritative-publication-surface-verification-report.md,
  git-tracked) and docs/publishing-guide.md.

## 4. AC-4 — Screenshot references use the pixels produced by ticket 36

- README screenshot references were **not changed** — they already point at
  docs/store-assets/screenshots/screenshot-{1-canvas,2-boxes,3-connections,4-settings,5-bookmarks}.png.
- Those five files on disk hash (sha256, first 16 hex) exactly to ticket 36's archived capture
  values (listed in §0) — i.e. the pixels README displays ARE ticket 36's output. No action
  needed; verified rather than assumed.

## 5. Install steps are now executable from source (claim-repair follow-through)

- Chrome/Edge: clone → npm install → npm run build → Load unpacked `dist/boxing-chrome/`.
- Firefox: clone → npm install → npm run build → about:debugging#/runtime/this-firefox →
  Load Temporary Add-on `dist/boxing-firefox/manifest.json`, with the unsigned/temporary
  caveat stated.
- Old steps were UNFOLLOWABLE (clicked "Download release ZIP" → empty releases page), so the
  new steps repair the user story 6 "no silent fake success" requirement.
- TIP blockquote updated: Node.js/npm are now needed once (build) until the first release
  ships; previously it claimed end users never need them while pointing at a download that
  did not exist.

## 6. Verification commands and results

| Check | Command | Result |
|---|---|---|
| Edit integrity | ctx_execute Node fs edit with PRE-WRITE (old fragments ×1) + 16 POST-WRITE assertions, then re-read compare | re-read identical: true; BOM absent; 0 CRLF; 203→222 lines |
| Locale parity gate | `node .scratch/architecture-recovery/34-locale-structure-check.mjs` | **14/14 PASS, 0 findings** (exit 0) |
| Whitespace gate | `git diff --check` | clean (DIFF-CHECK-CLEAN) |
| Test-face scan | grep README assertions in test/tests/*.ts | only boxing-v3.spec.ts:137 `/[Cc]anvas/` — unaffected by this change |
| Scope claim | `but diff` hunk IDs | only README.md hunks rl:3/rl:0 claimed into commit uvl; brain-window zz files (scratch round7 artifacts, dev-chrome/dev-firefox) NOT included |
| Releases re-check | ctx_fetch_and_index api.github.com/repos/Xxx91n/boxing/releases | `[]` on 2026-09-09 |

## 7. Residuals (out of ticket 37 scope, recorded for the brain)

1. **13 locale READMEs still carry the stale releases link** (docs/i18n/README.*.md all match
   github.com/Xxx91n/boxing/releases; zh_CN/zh_TW/hi additionally claim "Download release
   ZIP/XPI"). Ticket 37's acceptance criteria and handoff scope the English root README only;
   fixing locales is a follow-up ticket (would ride the ticket-34 validator + the locales'
   install sections).
2. docs/publishing-guide.md "What you get" still describes the release artifact table
   conditioned on secrets being set — accurate as a maintainer workflow doc; no user-facing
   availability claim. Left untouched.
3. Maintainer actions from ticket 35 (docs/index.md for Pages root, user-site repo decision,
   first release dispatch) remain external to this ticket.

## 8. Version control

Per WORKFLOW.md §4.2: `but diff` → hunk-level claim of README.md changes (rl:3, rl:0) →
`but commit -b ticket-37-readme-release-claims -m "docs(readme): ticket 37 - reconcile
release/install claims with zero-release reality (ticket 35 evidence): drop releases
install/version badges and ZIP/XPI download steps, add no-package-published IMPORTANT +
artifact signing NOTE, switch install to build-from-source dist paths" rl` → commit **uvl**
on branch ticket-37-readme-release-claims. This report file is committed separately after
writing. No push, no PR; other windows' uncommitted changes untouched.
