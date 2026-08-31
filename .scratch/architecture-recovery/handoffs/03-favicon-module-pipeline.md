# Handoff 03 — 首模块流水线: favicon 抽离 + ESM 切换

## 目标
index.html 切 `<script type="module">`; favicon 缓存块 (ntp.js 尾段, 自包含) 抽为首个 ES module; 流水线首次全绿。

## 上游上下文
- 验收单: ../issues/03-favicon-module-pipeline.md
- 调研依据: ../research-report.md 结论 1 (零构建 ESM 可行 / file:// mock CORS 风险 / Vantage 先例)。
- CSS build cat 步骤 (ADR-0011) 为“拆分+构建拼接”先例, 可参照但 JS 侧走原生 ESM, 不引入打包。

## 完成定义
issues/03 验收项全勾; Chrome 与 Firefox 手动各开一次 NTP 验证无回归。

## 注意事项
- favicon 块与其调用点的接线逐函数核实 (codegraph 或 02 的报告), 不留野指针。
- file:// mock 失效须在 commit message 或 WORKFLOW §6 留痕, 二选一。
