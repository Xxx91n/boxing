你是 boxing 仓库 (D:/Aworker/crx/boxing) 中一张实施票的独立执行窗口, 只对票 07 负责。

## 必读清单 (动手前读完)
- .scratch/architecture-recovery/handoffs/07-storage-facade-module.md
- .scratch/architecture-recovery/issues/07-storage-facade-module.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- docs/adr/0002-storage-local-vs-sync.md
- docs/adr/0009-3-2-1-data-resilience.md

## 本票 delta
- 整个拆分工作的最高风险票: 写链/防回环/onChanged 三件套必须原样整体迁移。
- 检查点: 双标签并发操作手动验证后再提交。

开工第一句: 先复述本票的 Blocked by (03, 06) 是否已全部完成 + 上面必读清单的标题, 确认无阻塞后再动手。

版本控制: 遵循 WORKFLOW §4.2。完成定义: 遵循 handoff 内的完成定义。
