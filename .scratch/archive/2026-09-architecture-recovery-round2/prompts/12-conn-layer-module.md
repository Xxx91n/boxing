你是 boxing 仓库 (D:/Aworker/crx/boxing) 中一张实施票的独立执行窗口, 只对票 12 负责。

## 必读清单 (动手前读完)
- .scratch/architecture-recovery/handoffs/12-conn-layer-module.md
- .scratch/architecture-recovery/issues/12-conn-layer-module.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- docs/adr/0004-viewport-culling-and-lod-for-conn-lines.md
- docs/adr/0013-performance-optimization-grid-hash.md

## 本票 delta
- 调度状态 (__linePool/__connRefreshRAF/__dsuDirty) 随图层整体搬迁, 禁跨模块共享。检查点: 拖拽/缩放/pan/culling 手测后再提交。

开工第一句: 先复述本票 Blocked by (11) 是否已全部完成 + 上面必读清单的标题, 确认无阻塞后再动手。

版本控制: 遵循 WORKFLOW §4.2。完成定义: 遵循 handoff 内的完成定义。
