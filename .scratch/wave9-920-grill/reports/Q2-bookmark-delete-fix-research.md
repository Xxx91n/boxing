# Q2 深度调研 — 书签删除复活修法形态（原子/架构/门禁）

> Generated 2026-09-15 · depth: standard（本地 primary + 文档定点抓取；WebSearch 本会话不可用）
> workspace: `.scratch/wave9-920-grill/`
> 约束: 调研不改源码；不与 current 账本静默改向

## Executive summary

1. **根因不是「忘了 markDeleted」，而是 ADR-0007 Q2 明确否决过的失败模式再现**：Bookmarks 单条删除在 `popups.js` 直接 `splice + saveLayout`，绕过 `commit(op)`；盒删除路径已正确为每个 `bm.id` 写墓碑，单条删除路径是唯一漏网旁路 [本地 render.js / popups.js / ADR-0007]。
2. **工业界成熟模型与 ADR-0007 同向**：tldraw 文档变更只经 Editor/Store 事务入口（`createShapes`/`deleteShapes`/`run` 批处理），副作用按类型注册，不散落 UI [1]；Automerge 强调一切变更走 `change()` 协议、GC 必须保留 tombstone，禁止在协议外改嵌套数组 [2]。
3. **手术式 A（一行 markDeleted）能止血但会留下 3 个旁路**（add L282/L301、reorder L407、edit save L171 无 id 赋值兜底），与 Top-5 #5 静态门禁互相打脸——门禁一上就会立刻逼 B。
4. **推荐 B（architectural）**：新增 `deleteBookmark`（及配套 `addBookmark`/`reorderBookmarks` 或至少 delete 门）走 `mutationHandlers` + `commit()`；同票或紧随姊妹票加静态门禁（layout 数据 `splice/filter/push` 不在 handlers 即 exit 1）。
5. **与 current 决策零冲突**：不 revised 任何 D/A；是对 ADR-0007 Q2 与 D-001「Top-5 全收」的执行展开。

## Background & scope

**问题**：Q2 在 9.20 全收范围内，P0 书签删除复活修法选 A 手术式 / B 架构式 / C A+门禁 / D 另定。

**边界**：不选「热修商店 9.15」；目标 tip 在 `a1acaaac` 线性追加；数据完整性 never-quarantine 不豁免；grill 期不实施。

**假设**：修复须使「add → delete → 陈旧存储合并/reload」不复活，且墓碑可被 `mergeById` 过滤。

## 本地实物（不可否认证据）

| 路径 | 事实 |
|---|---|
| `ntp/popups.js:189-190` | `sb.bookmarks.splice(index,1); saveLayout();` — **无 markDeleted、无 commit** |
| `ntp/popups.js:282,301` | add：`push({id: makeId('bm'),...}); saveLayout();` — 旁路 |
| `ntp/popups.js:407-408` | reorder：双 `splice` + `saveLayout` — 旁路 |
| `ntp/popups.js:171` | edit save：改 title/url + `saveLayout` — 非删除，无 id 问题 |
| `ntp/render.js` deleteLargeBox/deleteSmallBox | 已为**每个** `bm.id` 写入 tomb — 正确范式 |
| `ntp/render.js` removeConn | `tombstoneIds: [connId]` |
| `ntp/render.js` commit() | `markDeleted(...result.tombstoneIds)` 统一门 |
| `ntp/storage.js` mergeConcurrentLayout L603 | `localChild.bookmarks = mergeById(..., tombstones)` 并集 |
| `ntp/utils.js` mergeById | 无墓碑则 remote 旧书签被并回 → 复活 |
| 用户日志 `v2026.9.12` + 多次 merge revision 递增 | 与机制链一致 |

## 工业界心智模型

### tldraw（Boxing ADR-0007 已对标）

- 文档状态只经 Editor API；删除是 `Editor.deleteShapes`，创建是 `createShapes`，多变更包在 `editor.run()` 事务 [1]。
- Store 是 reactive record DB；side effects（onBeforeDelete 等）按 record 类型注册，**不散落在 UI 回调** [1]。
- 推论：UI 事件处理器只调用命名 op；「UI 里 splice 数组再 save」在 tldraw 模型中不存在。

### Automerge / CRDT 协议

- 一切变更必须经 `Automerge.change()`；独立初始化/迁移必须硬编码同一 change 字节，避免无共同祖先分叉 [2]。
- 历史 GC 实验明确 **必须保留 tombstone**，否则删除会被同步复活（Kleppmann 演讲）[2]。
- 推论：即便 Boxing 不是 CRDT，「删除必须留可合并标记」与「变更不得绕过协议」是同一课。

### 与 Boxing 现架构映射

| 工业概念 | Boxing 对应 |
|---|---|
| Store.put/remove 唯一入口 | `commit(op)` + `mutationHandlers`（ADR-0007 Q2） |
| Soft-delete / tombstone | `layout._meta.deleted` + `markDeleted` + 24h GC |
| 并集合并尊重删除 | `mergeById(local, remote, tombstones)` |
| Side effects 注册 | commit() 统一：墓碑 → 索引 → DSU → save → render |
| **缺失的 record 类型** | **Bookmark 级 op 从未入 handlers** — 盒删除会顺带 tomb bookmarks，单条删除路径却旁路 |

## 选项对比

| 维度 | A 手术式 | B 架构式 | C A+静态门禁 |
|---|---|---|---|
| 修根因 | 部分（仅 delete） | 是（delete+可收编 add/reorder） | 部分 + 逼 B |
| 符合 ADR-0007 | 否（旁路仍在） | 是 | 否直至 B |
| 与 Top-5 #5 门禁 | 冲突（门禁会红） | 一致 | 自相矛盾（A 被门禁否决） |
| 回归面 | 小 | 中（需 never-quarantine spec） | 中 |
| 工业对标 | 反模式修补 | tldraw/CRDT 同向 | 门禁对、修补半吊子 |
| 9.20 成本 | ~0.5d | ~1–1.5d + spec | ~0.5d 后仍要 B |

## 与 current 决策冲突审计

| 记录 | 内容摘要 | 与推荐 B 关系 |
|---|---|---|
| W9.20 D-001 | 全收 + Top-5 含「P0 修墓碑/收编 commit」 | **无冲突**；B 即「收编 commit」臂 |
| W9.15 D-001..D-009 | 9.15 发行收口（已 implemented/定稿） | 无冲突（历史） |
| ADR-0007 Q2 | 唯一 commit 入口；否决 Plan B「靠各函数记得 cleanup」 | **强化 B**；A 正是否决模式 |
| ADR-0007 Q4a | Tombstone GC 24h | B 沿用，无改 |
| ADR-0009/0016 | 墓碑/合并/门面 | B 沿用 storage 门面 |
| never-quarantine | N/数据完整性禁豁免 | B 的回归 spec 必绿，无豁免 |
| 锐评 Top-5 #1/#5 | P0 修 + 静态门禁 | B + 姊妹门禁票 = 同向 |

**结论：零 current 决策需要 revised。不生成新 D 改向。**

## 推荐

**Q2 = B（架构式）+ 姊妹票静态门禁（可同波）**

实施形态（定稿后立票，grill 不改码）：

1. `mutationHandlers.deleteBookmark(state, {largeId, smallId, bmId})` → 返回 `tombstoneIds: [bmId]`；splices 仅在 handler 内。
2. `commit('deleteBookmark', ...)` 由 popups 删除按钮调用；废弃 L189 裸 splice。
3. 收编：至少同票评估 `addBookmark`（保证 id 与墓碑可逆）与 `reorderBookmarks`；若切票，静态门禁先只盯 **删除类** `splice`/filter-on-bookmarks，避免一次门禁炸出未迁 add 而阻塞 9.20。
4. 回归 spec（never-quarantine）：add → delete → 强制陈旧 remote 合并 / reload → 断言不复活 + `_meta.deleted` 含 bmId。
5. 静态门禁：扫描 `ntp/**`（非 mutationHandlers 文件）对 layout 集合的删除/改写调用；白名单注释豁免；进 pretest 或 test.yml 按 B73 裁定。

## Open questions

- WebSearch 本会话不可用；工业证据以 tldraw/Automerge 官方文档为主，未并行扫 Excalidraw/Figma 源码（本地 ADR-0007 已含 tldraw 对标，足够）。
- 存量无 `id` 的老书签（若有）无法进墓碑 — 实施票须决定是否 migrate 赋 id（属 B 的范围细节，不改 Q2 选型）。
- reorder 是否与 delete 同票收编：待 Q 后续裁定优先级。

## Sources

[1] tldraw Editor docs — https://tldraw.dev/docs/editor （accessed 2026-09-15）— createShapes/deleteShapes/run 事务、Store/Side effects
[2] Automerge Modeling Data — https://automerge.org/docs/cookbook/modeling-data/ （accessed 2026-09-15）— change 协议、迁移硬编码 change、GC 保留 tombstone
[3] 本地 ADR-0007 Q2/Q4a、ADR-0009、ADR-0016、CONTEXT Mutation API — 仓库实物
[4] 本地 `ntp/popups.js` / `render.js` / `storage.js` / `utils.js` — 仓库实物
[5] 用户日志 `boxing-log-2026-09-15T02-29-32.log` + `.codex-tmp/锐.txt`
