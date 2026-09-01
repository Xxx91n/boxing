# Handoff 06 — 共享状态收敛

## 目标
layout / revision / 抑制标志等共享可变状态收敛为单点持有: state 模块单例 或 入口注入, 二选一并记录理由。

## 上游上下文
- 验收单: ../issues/06-state-module.md
- 调研依据: ../research-report.md (ESM live binding; 两模块各持副本 = 各活各的)。

## 完成定义
issues/06 验收项全勾; 02 票清单上的共享可变状态无一份被两处持有。
