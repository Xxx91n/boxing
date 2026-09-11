# 42R — COW 验收测试返工：中和 unload flush + 绿跑勾 AC

**What to build:** 票 42 产品代码（takePreUpdateSnapshot / ensurePreUpdateSnapshot / needsMigration）已存在且序正确。本返工窗只修验收：让 T42-1 在 seed→reload 路径上真实看到 pre-update 快照；全 spec 绿后才勾 AC；报告只贴实跑输出。

**Blocked by:** None — can start immediately

**Status:** done（2026-09-11 返工绿跑 3/3；证据 reports/42-update-cow-before-migrate-report.md §7）

## 首脑结论（必须先读）

reports/W2-wave5-brain-review.md 票 42 节。T42-1 snapCount=0：旧页 pagehide→saveLayout 覆盖 seed。

## 验收

- [x] 先重跑现有 spec，贴出 1 failed 基线（与首脑一致）
- [x] 修复测试 harness：seed 后中和 `__boxingFlushPendingViewStatePersist` / 等价 unload 写回，或改为非 NTP 文档注入信号+legacy
- [x] T42-1 snapCount≥1 且 snapKeepsLegacyShape=true
- [x] 全 spec 3/3 passed（贴 playwright 原始 passed 行）
- [x] 不改产品 COW 代码序（除非测试暴露真产品 bug——须在报告单独论证）
- [x] issues/42 checkbox 仅在绿跑后保持/恢复 done；报告追加「返工轮次」节，不覆盖原报告
- [x] node --check + import-graph-guard 仍绿

## 禁止

- 禁止再在无运行时证据时勾 AC
- 禁止用「CI-only」代替本窗要求的本地绿跑（首脑已实跑可复现）

## Out of scope

- background SW 真机 onInstalled 路径（无 SW 的 file:// 车道）
- 43/45
