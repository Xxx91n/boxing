你是 boxing 仓库 (D:/Aworker/crx/boxing) 中一张实施票的独立执行窗口, 只对票 08 负责。

## 必读清单 (动手前读完)
- .scratch/architecture-recovery/handoffs/08-persistence-render-split.md
- .scratch/architecture-recovery/issues/08-persistence-render-split.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- docs/adr/0004-viewport-culling-and-lod-for-conn-lines.md
- docs/adr/0013-performance-optimization-grid-hash.md

## 本票 delta
- 拆 render 时性能不变量是验收项不是建议: 热路径 O(1) 查找、rAF/debounce 纪律原样保留。
- 检查点: 拖拽/缩放/pan 手测一轮再提交。

开工第一句: 先复述本票的 Blocked by (07) 是否已全部完成 + 上面必读清单的标题, 确认无阻塞后再动手。

版本控制: 遵循 WORKFLOW §4.2。完成定义: 遵循 handoff 内的完成定义。
