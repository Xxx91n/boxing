# Spec — Wave9 2026.9.15 全部修复

> 数据源: `.scratch/wave9-postrelease-grill/decision-ledger.md` D-001..D-010 · plan.md · ga-definitive-b4f3df2.md  
> A 账本: `.scratch/architecture-recovery/decision-ledger.md` A-040..A-048  
> 目标版本: **2026.9.15**（持有 2026.9.12，不热修）

## A-xxx Coverage（对账用，强制全集）

| A-xxx | 状态 | 实施工件 |
|---|---|---|
| A-040 | implemented（纸面债） | 已落盘，无票 |
| A-041 | current | ticket 87 · GH #10 |
| A-042 | current | ticket 88 |
| A-043 | current | ticket 89 |
| A-044 | current | ticket 90 |
| A-045 | current | ticket 91 · GH #11 |
| A-046 | current | ticket 92 |
| A-047 | current | ticket 93 · GH #12 |
| A-048 | current | ticket 94 |

**并集约束**：本表 = decision-ledger Wave9 块全部记录；票 Covers 并集 = 本表除去 A-040（无票）。

## Problem Statement

2026.9.12 已在 G-A 未满足下发往 GitHub Release 与两店（D-004/006）。对 tip `b4f3df2` 的定谳（run 34749813393）显示 data-golden 绿但三 OS test 仍红：跨 tab 星标同步（R1）稳定失败，空态暗色按钮与 auto-expand 在 Linux 上异常/闪。同步合并仍是 newer-wins 启发式，双端同盒各加子盒会静默吞没一侧。用户需要一个可过闸、文档与行为一致的 **2026.9.15**。

## Solution

在 `b4f3df2` 之上线性实施：修绿 G-A 残红（R1–R3）、补齐 WebDAV 缺口、整票落地 merge 三向与 boot-pending e2e，完成 2026.9.15 版本面与门禁重跑。纸面债（A-040）已落盘，不在本 spec 重复实施。

## User Stories

1. As a user with Boxing open in two windows, I want a star set on a large box in one tab to appear in a fresh tab so that isParent state stays consistent.
2. As a user in dark mode, I want the empty-state add-bookmark control to keep an accessible contrast so that I can see and click it.
3. As a user who collapses and re-enters a box, I want auto-expand to still work so that hover-collapse does not trap content.
4. As a user with a NAS on .local or an opt-in private host, I want URL validation and export to honor the private-host setting so that sync does not silently fail.
5. As a user syncing WebDAV from phone and PC, I want both sides' new small boxes under the same large box to survive a pull so that merge never silently archives one side.
6. As a developer, I want boot-pending covered by e2e so that zero-flash cannot regress unnoticed.
7. As a release publisher, I want main test.yml green (or only named F that does not fail the job) so that G-A can be honestly claimed for 2026.9.15.
8. As a release publisher, I want version 2026.9.15 notes and store packages ready so that G-B (user-declared pass) and G-C can complete the gate.
9. As an auditor, I want residual reds bucketed N/B/F with no N waivers so that G-A cannot be faked.
10. As the next agent window, I want each ticket declaring covered A-xxx so that ledger reconciliation stays closed.

## Implementation Decisions

- **Modules**: star/isParent cross-tab path (ntp state + sync); empty-state dark tokens; auto-expand enter/exit; WebDAV URL/export opt-in; layout merge engine (baseRevision or equivalent) + conflict-copy wiring; boot-pending e2e harness; version/release notes surface.
- **Merge**: ticket 80 plan is authoritative direction; full implementation in this wave (D-009 B), not plan-only.
- **History model**: linear append-only on pushed main (D-008); no new root.
- **G-B**: user-declared pass with version+date; agents must not sign (D-007 / ADR-0017 revision).
- **Paper debt**: already landed (A-040); tickets must not reopen it unless a ticket's AC explicitly regresses a doc.
- **GitHub P0 mirrors**: #10 (A-041), #11 (A-045), #12 (A-047) — local tickets are the implementation source of truth under architecture-recovery.

## Testing Decisions

- Prefer existing Playwright extension seams (`test/tests/boxing-*.spec.ts`) over new frameworks.
- Test external behavior: cross-tab adoption, contrast visibility, expand after enter+exit, dual-end box visibility after pull, boot first-paint.
- Prior art: boxing-star-sync-audit, boxing-empty-state-buttons, boxing-auto-expand, boxing-viewstate-sync, data-recovery.
- G-A exit is CI evidence (test.yml run URL), not a local-only claim.
- N-bucket / data-golden never waived.

## Out of Scope

- Hotfix tag for 2026.9.12 (D-004).
- Reopening user-resolved G-B/慢放/store upload (D-005 12–14).
- Expanding ADR-0017 beyond the 2026-09-13 revision.
- Force-push / new root history export (D-008).
- Large redesign beyond merge three-way + listed residual fixes.

## Further Notes

- Ledger: A-040..A-048. Spec/tracks cover all; A-040 implemented, no ticket.
- Waves derive from ticket Blocked-by only.
- Version control: GitButler per WORKFLOW §4.2.
