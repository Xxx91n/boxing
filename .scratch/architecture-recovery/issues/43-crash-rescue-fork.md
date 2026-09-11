# 43 — crash rescue 改为 fork：归档损坏主键再重建

**What to build:** loadLayout 捕获损坏时：写 boxingLayout.corrupt.<ts> 归档 → 用最近健康快照重建主键 → 用户可见提示。禁止无归档覆盖。设置页展示最近备份时间/快照数/损坏归档入口。

**Blocked by:** 41

**Status:** done（43R 返工轮绿跑后关闭，2026-09-11；证据见 reports/43-crash-rescue-fork-report.md §返工轮次 43R）

- [x] 损坏 JSON 被归档且仍可从 storage 读出
- [x] 主键从健康快照重建后应用可启动
- [x] 设置-数据区显示快照数量与最近备份时间
- [x] Playwright：注入损坏主键 → 启动 → 不抛未捕获异常且归档键存在（43R 绿跑：data-recovery.spec.ts 5 passed；首跑 FAIL archiveKeys=0 的产品 P0 —— saveLayout 写路径无归档覆盖 —— 已在 43R 修复）
