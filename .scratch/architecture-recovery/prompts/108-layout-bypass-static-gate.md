# 108 layout-bypass-static-gate — 窗口启动器

身份: Boxing Wave9.20 实施子窗口 · ticket 108 · covers A-063（附带 109R/113R 返工）

## 必读（先读完再动手）

- .scratch/architecture-recovery/handoffs/108-layout-bypass-static-gate-handoff.md
- .scratch/architecture-recovery/issues/108-layout-bypass-static-gate.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- docs/adr/0017-release-data-gate.md
- docs/CONTEXT.md
- .scratch/architecture-recovery/decision-ledger.md
- .scratch/architecture-recovery/reports/W920-W1-brain-review.md

## 本票 delta

- 检查点: 见 issue AC；完成定义与调研协议见 handoff（不在此复述）
- 专属验收: 静态门禁：layout 旁路不得绕过 mutationHandlers
- Blocked by: 107（已 done，可开工）
- **109R（W1 首脑复核返工）**: `test/cluster-map.json` 为 `boxing-pages-gc-version.spec.ts` 补 cluster，使 `node scripts/import-graph-guard.mjs` exit 0
- **113R（W1 首脑复核返工）**: 对齐 `docs/release-status.md` 商店 published 与 README/user 声明 **2026.9.15**，使 `node scripts/locale-readme-guard.mjs` exit 0（不得静默改 guard 基线）
- 完成门: pretest 七守卫（含 import-graph + locale-readme）全绿

## 开工第一句

先复述：①本票阻塞/被阻塞关系 ②必读清单路径是否都存在 ③handoff 内通用调研三项 ④109R/113R 两道返工。确认无误后再写代码。

## 收尾

报告写入 .scratch/architecture-recovery/reports/108-report.md（含调研摘要、本票 AC、109R/113R 锚点）。
版本控制遵循 WORKFLOW §4.2。完成定义遵循 handoff。
