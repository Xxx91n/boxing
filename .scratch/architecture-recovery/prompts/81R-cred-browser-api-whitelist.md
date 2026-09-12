# 窗口启动器 81R-cred-browser-api-whitelist（返工）

你是 Boxing Wave8 票 81R 返工：81 返工：credentials.js B-6 白名单合规。覆盖 A-xxx：A-031。

## 必读清单（先读再动手）

- .scratch/architecture-recovery/reports/W8-W1-brain-review.md
- .scratch/architecture-recovery/reports/81-report.md
- .scratch/architecture-recovery/handoffs/81R-cred-browser-api-whitelist.md
- .scratch/architecture-recovery/issues/81R-cred-browser-api-whitelist.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/spec.md

## 本票 delta

最小修复二选一（优先 1）：1) 调整 import-graph-guard.mjs 对 credentials.js 的 B-6 白名单，仅放行 PIK 所需 storage.local 访问并注释 ADR/票号；或 2) 将 PIK 存取改为经既有 storage facade（若不破坏 leaf 约定）。禁止削弱全局 B-6。重跑 import-graph-guard + node --check + 相关 cred 测试。

## 开工第一句

先输出：1) 首脑报告中与本票相关的违规点列表；2) 必读是否读毕；3) 你认同或修正哪条。未复核禁止改代码。

## 收尾

报告追加写入 .scratch/architecture-recovery/reports/81-report.md（标注「返工轮次」）。重跑 node --check 与 node scripts/import-graph-guard.mjs。版本控制遵循 WORKFLOW §4.2。
