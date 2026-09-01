# Handoff 08 — 持久化与渲染分离

## 目标
布局持久化 (load/save/debounce/migration) 抽为独立模块, 立于 07 的门面之上; 渲染主内聚 (canvas/DOM) 抽为渲染模块; ntp.js 瘦身为入口编排。

## 上游上下文
- 验收单: ../issues/08-persistence-render-split.md
- 性能不变量: ADR-0004 (viewport culling/LOD), ADR-0013 (grid hash / SVG line pool / 反模式), AGENTS.md BX-EXPLORE-007/008 (O(1) 查找 / pan-zoom 后的 conn refresh)。全部原样保留在渲染模块内, 由测试验证仍在生效。

## 完成定义
issues/08 验收项全勾。
