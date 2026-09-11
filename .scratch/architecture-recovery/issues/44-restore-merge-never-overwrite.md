# 44 — 导入/WebDAV 恢复改为合并+冲突副本，废除静默覆盖

**What to build:** JSON 导入与 WebDAV/Gist 拉取默认追加合并；同 id 分歧写冲突副本键；仅用户显式选择「覆盖恢复」才允许 newer-wins。同步层 outbox 合并保留，冲突升级为副本而非丢一侧。

**Blocked by:** 43

**Status:** done（4 项验收全绿，2026-09-11 本地实跑；证据见 reports/44-restore-merge-never-overwrite-report.md §1/§4；基线残红定谳非本票面 §7）

- [x] 导入含本地已存在 id 的备份后两侧书签都在（或冲突副本可查）（spec AC1+AC2 用例：本地 L1 原样保留 + L2 追加 + 分歧子树归档 boxingLayout.conflict.<ts> 可查）
- [x] 无「静默丢弃本地 bookmarks」路径作为默认（导入默认 mergeImportedLayout 追加合并；sync 字段冲突/合并失败/数据恢复三类败者侧均先归档再落主键）
- [x] 显式覆盖恢复仍可用且有确认对话框（两段式页内确认框 + saveSnapshot COW 先行；spec AC3 用例覆盖）
- [x] Playwright：导入合并用例 PASS（boxing-import-merge.spec.ts chromium-extension 4 passed (11.0s)；回归 data-golden/sync/data-recovery 19 passed；test:changed 闭包 510 passed，残红=基线既有名单）
