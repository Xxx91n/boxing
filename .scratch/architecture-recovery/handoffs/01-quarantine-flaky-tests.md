# Handoff 01 — 隔离并修复 flaky test

## 目标
9 个已知 flaky test 全部定位、隔离出主套件、并修复或带理由删除。完成后主套件每次运行结果确定。

## 上游上下文
- 产出物路径: ../issues/01-quarantine-flaky-tests.md (权威验收单)
- 本票是整个架构恢复的第一块基石: 后续所有拆分票的绿灯可信度依赖本票。

## 完成定义
issues/01 的全部验收项勾选, 且 `npm test` 连跑 3 次全绿无 retry 依赖。

## 注意事项
- quarantine 手段优先用 Playwright 原生 (test.describe.fixme / 单独 project / tag 过滤), 不发明自定义标记系统。
- 删除是合法终点, 但每个删除都要一句理由进 commit message。
