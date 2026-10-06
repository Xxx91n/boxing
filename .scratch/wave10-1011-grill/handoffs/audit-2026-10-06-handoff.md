# Audit Handoff — Wave 2026.10.11 Round-2 Audit & Gate Verdict (Superseded)

> From: 审计 Agent (Auditor) · Date: 2026-10-06 · To: 修复 Agent / 用户
> Repo: <repo root> · Branch: wave-2026-10-11-round2-fixes
> Audit Reference Report: .scratch/wave10-1011-grill/reports/2026-10-06-report.md
> Standing Task Book: .scratch/wave10-1011-grill/handoffs/next-round.md

> **Historical status:** This document records the pre-rework rejection and is retained for audit traceability. It is superseded by `audit-round2-pass-handoff.md`; do not use the rejection below as the current release verdict.

## Historical Audit Status: REJECTED FOR RELEASE / RETURN FOR REWORK (返工前历史结论)
At the time of this audit, the status was **NOT RELEASABLE** under ADR-0017. The listed findings were subsequently fixed and re-verified; the current status is recorded in `audit-round2-pass-handoff.md`.
All 27 newly introduced assertions (D-007, D-008, D-009) passed on both Chromium and Firefox. However, residual failures prevent release gate closure.

## Findings & Discrepancies Summary
1. **Gate Unmet**: Chromium (351 passed, 3 failed, 1 flake), Firefox (348 passed, 3 failed). The 2 i18n failures are pre-existing strict-mode violations introduced in D-006 (About tab added duplicate `[data-i18n="brandName"]`). Must be resolved or officially ticketed before release.
2. **Process Violations**:
   - Report self-claim of "LF (CR byte 0)" was false: report file itself contains `\r` bytes.
   - Machine path sweep remaining count was reported as 1, actual count is 2 (both in historical archive/logs).
   - Unilateral inversion of `scripts/locale-readme-guard.mjs` (BX-LOCALE-006) and README body rewriting was undeclared scope expansion.
3. **Smells & Spec Deviations**:
   - `ntp/persist.js:118`: `applyDarkMode(on)` mirror update reads `layout.settings.darkMode` instead of parameter `on`.
   - `ntp/storage.js:86-88`: redundant `applyDarkMode` invocation after `applyExternalLayout`.
   - `ntp/conn-layer.js:68-70`: `recycleLineEl` omits clearing `conn-line--provisional`.

## Rerun Checklist for Rework Window (返工重跑清单)
1. Fix i18n locator in `test/tests/boxing-i18n-module.spec.ts` (qualify with `.brand__name` to resolve strict-mode collision).
2. Clean CR bytes in `.scratch/wave10-1011-grill/reports/2026-10-06-report.md` to strictly enforce LF.
3. Align `persistBootThemeMirror` in `ntp/persist.js` to accept or reflect `on` parameter.
4. Remove redundant `applyDarkMode` in `ntp/storage.js:86-88`.
5. Add `el.classList.remove('conn-line--provisional')` to `ntp/conn-layer.js:recycleLineEl`.
6. Run full verification: `npm run pretest`, `npm run build`, and full Playwright suites on Chromium and Firefox.

## Historical Next Grill & Action Direction (返工前方向，已完成)
- The i18n locator strictness finding was fixed and covered by the current PASS handoff.
- **User Actions Pending**:
  - P-19: Authorization for `gh release edit v2026.9.20`.
  - P-20: Official tag issuance `v2026.10.11` AFTER full gate clearance.

## Suggested Skills
- `but`: All VCS operations on branch `wave-2026-10-11-round2-fixes`.
- `code-review`: Pre-merge verification after rework.
