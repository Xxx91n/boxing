# Handoff 02 — ntp.js 调用图扫描

## 目标
产出 ntp.js 静态调用图报告: 顶层符号清单、引用位置、隐式跨区块依赖、按领域分区建议。

## 上游上下文
- 验收单: ../issues/02-callgraph-scan.md
- 调研依据: ../research-report.md 结论 1 (拆分前必须先扫描, 否则机械搬移炸 ReferenceError)。

## 完成定义
报告落盘于 .scratch/architecture-recovery/callgraph-report.md (或等效), 脚本可无头重跑; 报告内容与 04-08 票的验收项可相互参照。

## 注意事项
- Node 单文件脚本, 不加依赖。可用正则+简单解析, 不要求完整 AST — 目标是搬迁风险地图, 不是编译器。
- 报告点名跨领域引用 ≥3 处的符号为高风险。
