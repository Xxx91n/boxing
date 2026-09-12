# 窗口启动器 81R2-cred-gate2-write-path

你是 Boxing Wave8 票 81R2 返工：data-golden gate2 / credentials PIK 写路径。覆盖 A-xxx：A-031, A-025。

## 必读清单（先读再动手）

- .scratch/architecture-recovery/reports/W8-W2-brain-review.md
- .scratch/architecture-recovery/reports/71-report.md
- .scratch/architecture-recovery/reports/81-report.md
- .scratch/architecture-recovery/handoffs/81R2-cred-gate2-write-path.md
- .scratch/architecture-recovery/issues/81R2-cred-gate2-write-path.md
- test/tests/boxing-data-golden.spec.ts
- ntp/credentials.js
- ntp/storage.js

## 本票 delta

修 gate2 单写路径扫描违规（credentials.js storage.local.set）。优先 facade 或钉死 boxingCredKey.* 窄例外。禁止全局削弱 gate2 / 回滚 PIK。

## 开工第一句

先输出：1) 首脑报告 gate2 失败签名原文；2) 必读是否读毕；3) 你选 facade 还是窄例外及理由。未复核禁止改代码。

## 收尾

报告追加 .scratch/architecture-recovery/reports/81-report.md（标注「返工轮次 81R2」）。重跑 gate2 + import-graph-guard + node --check。版本控制遵循 WORKFLOW §4.2。
