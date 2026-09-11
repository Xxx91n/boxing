# Decision Ledger — Wave 5（2026-09-11/12）

> 随 .scratch 归档。状态: implemented | deferred | stale

| ID | 决策 | 状态 | 落点 |
|---|---|---|---|
| A-41-1 | 快照分键 snap.v1 + Time Machine 轮转 + RAW_KEEP_FLOOR | **implemented** | ntp/storage.js, ADR-0009 superseded in practice |
| A-42-1 | onInstalled(update) 先 COW 再迁移 + NTP ensure 兜底 | **implemented** | background.js, ntp/storage.js ensurePreUpdateSnapshot |
| A-43-1 | crash rescue fork：归档 corrupt 再重建；saveLayout 同语义 | **implemented** | storage.js loadLayout+saveLayout |
| A-44-1 | 恢复=合并+冲突副本；显式覆盖才 newer-wins | **implemented** | utils.mergeImportedLayout, storage archiveConflictLayouts |
| A-45-1 | golden fixture + migration guard 进 pretest | **implemented** | scripts/migration-golden-guard.mjs, test/fixtures/schema |
| A-45-2 | data-golden gate2 写路径扫描（非子串禁令） | **implemented** | boxing-data-golden.spec.ts scanBackgroundWrites |
| A-46-1 | 发行门禁 G-A∧G-B∧G-C 合取；残红禁 tag | **implemented** | ADR-0017, WORKFLOW §4.4 |
| A-40-1 | CSS [hidden] 括号闭合；构建期括号校验 | **deferred** | 40 修了花括号；build.mjs 括号扫描门禁未落地（spec D6） |
| A-44-2 | 冲突副本解决 UI（对比/合并/删除） | **deferred** | 44 out of scope；仅可查入口 |
| A-45-3 | legacyReader 独立冻结读端（升格 rollback AC） | **deferred** | 45R caveats；记入 46/backlog |
| A-46-2 | CWS/AMO 实际上架操作 | **deferred** | 人工渠道，非代码票 |
| A-W1-1 | Pages Actions 工件含 ntp.css+privacy-policy | **implemented** | demo-deploy.yml + live 200 |

## 实现摘要（沉淀 docs/）

1. **快照分键 + 分层轮转**（A-41-1）: `snap.v1.<ts>` + `snap.v1.index`；24h 小时 / 30d 日 / 更早周；最新 RAW_KEEP_FLOOR=10 直通；8MB 总闸。废除单键 `boxingSnapshots[]` 主写路径。
2. **更新即 COW**（A-42-1）: SW `onInstalled(update)` 先 `takePreUpdateSnapshot` 再写 signal；NTP `ensurePreUpdateSnapshot` 在 loadLayout 前兜底。
3. **损坏/冲突 = fork**（A-43-1/A-44-1）: 读路径 loadLayout 与写路径 saveLayout 均先 `archiveCorruptMain`；导入/WebDAV 分歧写 `boxingLayout.conflict.<ts>`；显式覆盖才整替（先快照）。
4. **CI 数据门控**（A-45-1/2）: golden fixtures + migration-golden-guard 进 pretest；data-golden gate2 扫写不扫读。
5. **发行门禁**（A-46-1）: G-A CI 定谳 ∧ G-B 人工黄金路径 ∧ G-C Pages 200，合取才可 tag。

## Deferred

- A-40-1 构建期 CSS 括号 balance 校验（spec D6）未实现
- A-44-2 冲突解决 UI
- A-45-3 冻结 legacyReader
- A-46-2 商店上架人工流
