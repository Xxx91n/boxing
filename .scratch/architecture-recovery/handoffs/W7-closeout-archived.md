# Handoff — Wave7 收口归档（2026-09-12）

## 一句话

Wave7 grill D-001..D-004 → 票 60–66 源码/文档已实施并硬验收（build+guards+spot 全绿）；账本 A-012..020 implemented / A-021..024 deferred；G-B 仍人工并行；land/push 等用户明令。

## 票面

- Grill: .scratch/wave7-flash-grill/decision-ledger.md
- Spec/Issues: .scratch/architecture-recovery/spec.md · issues/60–66
- 复核: reports/W1-brain-review.md · W2-brain-review.md · W7-closeout-audit.md
- 账本: architecture-recovery/decision-ledger.md Wave7 结算
- Backlog: docs/history/2026-09-12-wave7-closeout-backlog.md

## 完成定义

遵循 handoff 内的完成定义：源码票以 reports/NN-report.md + 首脑复核为准；发行仍以 ADR-0017 G-A∧G-B∧G-C。

## 版本控制

遵循 WORKFLOW §4.2（GitButler but CLI）。

## 必读

1. .scratch/architecture-recovery/README.md（波次+状态表）
2. reports/W7-closeout-audit.md
3. docs/history/2026-09-12-wave7-closeout-backlog.md
4. docs/CONTEXT.md（Wave7 settle）
5. docs/adr/0017-release-data-gate.md
6. .scratch/architecture-recovery/evidence/49-g-b-manual-golden-path/

## 本波 delta（摘要）

- 零闪现 boot（boot-theme.js + boxingBootTheme.v1 + boot-pending）
- README/CHANGELOG 发行声明收窄；历史声明；CRED 诚实标注；WebDAV 文档化；版本串；债务净化

## 通用调研要求

需要工业成熟方案时必须 atomcode 深度调研，并回顾 docs/adr 与 docs/CONTEXT.md，对标工业级落地；串行 ctx_batch_execute timeout 600000。

## Suggested skills

- but — land/push（等明令）
- playwright — 60 慢放 / G-B
- atomcode-research — 仅残红/商店政策再调研
- domain-modeling — 若再改 CONTEXT/ADR

## 完成时

下一轮恢复：先读本 handoff → README 状态表 → backlog；禁在 G-B 完成前 tag/宣称可发行。
