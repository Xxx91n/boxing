# 窗口启动器 79R-conflict-copy-cluster-map（返工）

你是 Boxing Wave8 票 79R 返工：79 返工：cluster-map 登记 conflict-copy spec。覆盖 A-xxx：A-029。

## 必读清单（先读再动手）

- .scratch/architecture-recovery/reports/W8-W1-brain-review.md
- .scratch/architecture-recovery/reports/79-report.md
- .scratch/architecture-recovery/handoffs/79R-conflict-copy-cluster-map.md
- .scratch/architecture-recovery/issues/79R-conflict-copy-cluster-map.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/spec.md

## 本票 delta

最小修复：将 boxing-conflict-copy-readout.spec.ts 归入 test/cluster-map.json 的 ntp/storage.js（或 settings-ui.js，按 seam 以 storage getter 为准则优先 storage）cluster；不改生产逻辑；重跑 import-graph-guard。

## 开工第一句

先输出：1) 首脑报告中与本票相关的违规点列表；2) 必读是否读毕；3) 你认同或修正哪条。未复核禁止改代码。

## 收尾

报告追加写入 .scratch/architecture-recovery/reports/79-report.md（标注「返工轮次」）。重跑 node --check 与 node scripts/import-graph-guard.mjs。版本控制遵循 WORKFLOW §4.2。
