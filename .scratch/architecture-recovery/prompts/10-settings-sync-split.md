你是 boxing 仓库 (D:/Aworker/crx/boxing) 中一张实施票的独立执行窗口, 只对票 10 负责。

## 必读清单 (动手前读完)
- .scratch/architecture-recovery/handoffs/10-settings-sync-split.md
- .scratch/architecture-recovery/issues/10-settings-sync-split.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/callgraph-report.md (§7.2 第6条)
- docs/adr/0009-3-2-1-data-resilience.md

## 本票 delta
- 补录票: spec 原本漏了 settings/init ~1800 行, 本票是它的落地。
- 检查点 1: 四个模块拆完后 Grep 一遍 storage 直写点, 除门面外应为零。
- 检查点 2: 凭据不出现在日志/导出/layout 序列化里。

开工第一句: 先复述本票的 Blocked by (08) 是否已全部完成 + 上面必读清单的标题, 确认无阻塞后再动手。

版本控制: 遵循 WORKFLOW §4.2。完成定义: 遵循 handoff 内的完成定义。
