# Handoff — Wave 2026.10.11 Round-2 Audit Clearance (P-13..P-18 Fully Verified)

> From: 审计 Agent (Auditor) · Date: 2026-10-06 · To: 用户 (User) / 发版 Agent
> Repo: <repo root> · Branch: wave-2026-10-11-round2-fixes (commit 897d0c4f / Change-ID: qnu)
> Baseline Commit: 06e51fdb (common base) -> HEAD (897d0c4f, 15 commits, GitButler managed)
> Post-merge: fixes/docs landed on `origin/main` at `2051b146`; the two Round-2 wave branches were then safely removed by GitButler.
> Audit Reports:
>   - Rework Implementation: commit 897d0c4f
>   - First-round Audit Findings: .scratch/wave10-1011-grill/handoffs/audit-2026-10-06-handoff.md
>   - Implementation Report: .scratch/wave10-1011-grill/reports/2026-10-06-report.md

> **Current source of truth:** This PASS handoff supersedes `audit-2026-10-06-handoff.md`, which is retained only as the pre-rework rejection record.

## 1. Audit Verdict: PASS (审计通过，具备发版条件)
Per ADR-0017 ("Multi-browser release gate"), all hard criteria have been met:
- **Build & Packaging**: `node --check` (PASS), `npm run pretest` (10 guards 0 violations, PASS), `npm run build` (Chrome & Firefox zip/crx/xpi generated, PASS).
- **Rework Verification**:
  - `ntp/persist.js`: `persistBootThemeMirror(mirrorWriter, dark)` now accepts and writes explicit target `dark` boolean.
  - `ntp/storage.js`: Duplicate `applyDarkMode()` in onChanged removed; visual replay triggered upon `saveLayout()` durability success.
  - `ntp/settings-ui.js`: Toggles strictly mutate `layout.settings.darkMode` and invoke `saveLayout()`; no manual DOM manipulation.
  - `ntp/conn-layer.js`: `recycleLineEl()` clears `conn-line--provisional`; `liveSmallBoxById()` scans current `layout.boxes[].children` for live parentage, supporting runtime reparenting (D007-5a regression test passing).
  - `test/tests/boxing-i18n-module.spec.ts`: Scoped to `.brand__name[data-i18n="brandName"]`, resolving pre-existing strict-mode locator collision with About tab.
  - Firefox lane stability: Settings tab switching uses DOM click; sync UI timeout extended to 120s; native mouse drag skipped under documented Playwright #16095 constraint (Chromium retains native coverage).
- **Gate Status**:
  - Chromium: 356 passed, 0 failed.
  - Firefox: 351 passed, 5 documented skipped, 0 failed.
  - Waiver ledger check: `node scripts/waiver-ledger-check.mjs` PASS (0 unrecorded skips).
  - Clean repository hygiene: LF line endings (0 CR bytes), BOM false, `git diff --check` clean.

## 2. Release Actions Pending User Execution (用户动作待办)
- **P-19 (User Authorization / Action)**:
  - Command: `gh release edit v2026.9.20` to rewrite historical release notes.
  - Note: External product mutation; reserved for human execution.
- **P-20 (User Tag Issuance & Release)**:
  - Tag: `v2026.10.11`
  - Target: Tip of `wave-2026-10-11-round2-fixes` (commit `897d0c4f`).
  - Action: User creates git tag `v2026.10.11` and triggers Release dispatch.

## 3. Next Grill Directions (下一轮 Grill 方向指示)
1. **Multi-surface i18n Locator Governance**:
   - Establish linting or test helper standard so shared i18n keys (e.g. `brandName`, `footerHint`) across multiple DOM surfaces (NTP header, Settings modal, About tab) are never queried via naked `[data-i18n="..."]` in Playwright strict mode.
2. **Settings Mutator & Persistence Layer Decoupling**:
   - Revisit `settings-ui.js` and `persist.js` to fully eliminate any residual presentation layer manipulation (e.g. glyph setting) from persistence modules, moving towards unidirectional state-driven rendering.
3. **Firefox Headed Mode Test Isolation**:
   - Evaluate dedicated headless/headed flags for Firefox in CI vs local lanes to further reduce execution duration while preserving browser-specific extension validation.
4. **New test findings from the final gate (not product regressions)**:
   - Decide whether the Firefox native mouse-drag limitation should remain a documented skip, gain a Firefox-compatible behavioral substitute, or be isolated into a dedicated lane; preserve Chromium native coverage.
   - Reproduce and bound the prior Chromium parallel-load `conflict-copy-readout` flake with resource/worker isolation before changing product code.
   - Record any new failures from the next full dual-browser run as separate Round-3 findings with browser, project, test title, repeat count, and product-vs-harness classification.

## 3.1 Unified Round-3 Grill Gate (统一口径)
- Round-2 product fixes are **closed and technically passed**; do not reopen them without a new reproducer.
- Firefox's five skips are documented environment waivers, not silent passes; `node scripts/waiver-ledger-check.mjs` must remain green.
- P-19/P-20 remain external user actions and are not prerequisites for Round-3 test investigation.
- The next grill may inspect tests, CI/browser configuration, and release evidence; source changes require a new decision-ledger entry.

## 4. Suggested Skills for Next Agent / Session
- `but`: Version control operations for merging/landing `wave-2026-10-11-round2-fixes` via GitButler.
- `code-review`: Final pre-merge check before merging into main.
