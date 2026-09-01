# Handoff 05 — 纯工具函数抽离

## 目标
无副作用纯函数抽为 utils ES module; 原调用点全部 import。

## 上游上下文
- 验收单: ../issues/05-utils-module.md
- 候选清单来自 02 票的调用图报告 — 先拿报告再动手, 不凭印象圈函数。

## 完成定义
issues/05 验收项全勾; utils 模块内零 storage/DOM 副作用 (抽查即过)。
