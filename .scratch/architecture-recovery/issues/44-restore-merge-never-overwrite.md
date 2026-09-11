# 44 — 导入/WebDAV 恢复改为合并+冲突副本，废除静默覆盖

**What to build:** JSON 导入与 WebDAV/Gist 拉取默认追加合并；同 id 分歧写冲突副本键；仅用户显式选择「覆盖恢复」才允许 newer-wins。同步层 outbox 合并保留，冲突升级为副本而非丢一侧。

**Blocked by:** 43

**Status:** ready-for-agent

- [ ] 导入含本地已存在 id 的备份后两侧书签都在（或冲突副本可查）
- [ ] 无「静默丢弃本地 bookmarks」路径作为默认
- [ ] 显式覆盖恢复仍可用且有确认对话框
- [ ] Playwright：导入合并用例 PASS
