# 55 — 冲突副本解决 UI（P2，实施 deferred）

**What to build:** 为 boxingLayout.conflict.* 提供对比/合并/删除 UI。本波只立票可见，实施 deferred（A-003）。

**Blocked by:** None (can start immediately)

**Status:** deferred — 实施不在本波（A-003 / A-010：P2 立票可见，不占带宽）

**覆盖 A-xxx:** A-003, A-010

- [x] 立票完成且 Status 明确 deferred（实施不在本波）
- [x] 票面写明数据区已有冲突副本入口可查（见下「数据区入口现状」）
- [x] 不阻塞 G-A/G-B；不实施对比/合并/删除 UI
- [x] 未开始实现，无需回退（若误开始实现则视为范围外并回退）

## 数据区入口现状（票面引用，本波不改动）

- 设置弹窗数据区已有冲突副本行 `data-conflict-row`：归档数与最近归档时间可见（`ntp/settings-ui.js` 票 44 段）。
- 冲突副本存储：`boxingLayout.conflict.<ts>` 正文 + `boxingLayout.conflict.index` 索引，轮转保留最多 20 份（`ntp/storage.js` 的 `archiveConflictLayouts` / `listConflictArchives`；Dropbox conflicted-copy / Syncthing 对标，atomcode 2026-09-11，源 `.scratch/wave6-dr-grill`）。
- 导出信封已含 `meta.conflicts[]` 索引（默认不含正文；可选完整容灾包含正文）——见 ADR-0009「修订 2026-09-12（票 51）」。
- Deferred 范围：对比（diff 视图）/ 合并（选择性采纳）/ 删除（清理归档）UI 均不在本波实施；数据侧（归档、索引、导出索引）已由票 44/51 落地。
