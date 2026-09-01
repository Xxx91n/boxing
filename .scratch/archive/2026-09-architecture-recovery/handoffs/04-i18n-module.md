# Handoff 04 — i18n 抽离为模块

## 目标
i18n 字典 / fallback / i18nStore 抽为独立 ES module, ntp.js 经 import 消费, 14 语言行为不变。

## 上游上下文
- 验收单: ../issues/04-i18n-module.md
- 最近曾有重复 I18N_FALLBACK 修复 (git log 75359a5), 搬移时留意同名符号不要再次双份定义。

## 完成定义
issues/04 验收项全勾。
