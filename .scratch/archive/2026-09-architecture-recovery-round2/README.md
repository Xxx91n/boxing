# 架构恢复二期 — 状态表 (2026-09-02 起)

工件: spec.md / WORKFLOW.md (一期复用) / issues/ / handoffs/ / prompts/
依据: .scratch/brain-round2-ticket-proposals.md; 一期档案: .scratch/archive/2026-09-architecture-recovery/

## 波次表 (由 Blocked by 推导)

| 波次 | 票 | 并行性 | Blocked by |
|---|---|---|---|
| 第1波 | 11 几何下沉 / 14 quarantine 治理 / 15 ADR 补强 | 已完成 3/3 ✓ | 已收口 |
| 第2波 | 12 conn 图层拆分 | 已完成 ✓ | 11 (已解除) |
| 第3波 | 13 popups 拆分 | 已完成 ✓ (Firefox i18n checkpoint 提预算后独立复现绿) | 12 |

11→12→13 均触碰 render.js, 同文件并行 lane 必冲突, 强制串行; 14/15 与 render.js 零交叠, 任意时刻可并行。

## 状态表

| 票 | 状态 | 工件 |
|---|---|---|
| 一期 01-10 | 已归档 done | .scratch/archive/2026-09-architecture-recovery/ |
| 11 | done (首脑复核通过 2026-09-02) | issues/11 + 11-render-geometry-downsink-report.md |
| 12 | done (首脑复核通过 2026-09-02) | issues/12 + 12-conn-layer-module-report.md |
| 13 | done (首脑复核通过 2026-09-03) | issues/13-popups-module.md + 13-popups-module-report.md |
| 14 | done (首脑复核通过 2026-09-02) | issues/14 + 14-quarantine-governance-report.md |
| 15 | done (首脑复核通过 2026-09-02) | issues/15 + 15-adr-consequences-section-report.md |
