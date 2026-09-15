# 107 Report — P0 书签删除走 commit + 墓碑

> Ticket 107 · Covers **A-062** · Boxing Wave9.20 实施子窗口 · 2026-09-15
> 基线 tip `a1acaaac` 线性追加（D-005②）· 版本控制遵循 WORKFLOW §4.2 · 目标版本 2026.9.20
> 报告结构: §1 通用调研摘要（先于实现）→ §2 实现与裁定 → §3 AC 对照 → §4 验证锚点 → §5 风险与具名 N 项

## §1 通用调研摘要（handoff「每票必做一次」三项）

### 1.1 atomcode 串行深度调研

| 项 | 值 |
|---|---|
| 载体 | `atomcode -p` 单问（未附角度/键名/域名提示，遵 skill 禁令）；`ctx_batch_execute` 包裹，`concurrency: 1`，`timeout: 600000` |
| 串行前提 | 开跑前探测无在途 atomcode 进程（tasklist 零命中）；本会话仅此一次 atomcode 调用 |
| 版本 | atomcode 5.0.9 (52ca5e6) |
| 问题（verbatim） | 「本地优先（local-first）的浏览器扩展应用中，用户删除的嵌套数据项（例如某个盒子里的一条书签）在跨设备或跨标签页同步合并时，会被其他端的旧副本重新带回来。工业界成熟产品与同步引擎是如何解决这类「删除被合并复活」问题的？推荐哪种做法，理由是什么？」 |
| 证据规模 | 16 条来源（官方文档 RxDB / Couchbase Sync Gateway / Cassandra / DataStax HCD / Replicache / PowerSync / Aerospike / Automerge / Liveblocks；工业实践 Linear 逆向 + HN；一线工程博客 Storyie；对比类 Jsonic）；Confidence 高，三方独立交叉验证 |

**结论（原文分点，逐条落摘）**

1. **硬删除是复活问题的根因；带时间戳的软删除（墓碑）是全行业底线做法**。硬 DELETE 丢掉了「这条数据被有意删除」这一事实，pull 无法区分「已删除」与「从未见过」，于是把旧副本重新插回来。四家独立信源一致（Storyie / RxDB `_deleted` / Couchbase Sync Gateway `{_deleted:true}` 修订版 / Cassandra·Aerospike）。
2. **墓碑必须带时间戳（或逻辑时钟），不是布尔标志**：`deleted_at` 是 LWW 仲裁的载荷信息。Boxing 的 `layout._meta.deleted` 存的正是时间戳（`trimmedDeleted` 按 `Number(b[1])` 排序裁剪），与工业口径一致。
3. **复活有两个窗口，各需一道守卫**：窗口 A（删除尚在队列未推送，pull 先到）→ pending-push 守卫；窗口 B（推送重试耗尽）→ LWW write-back 守卫。Boxing 的对应物是内存 `clearedTombstones` Set（本 tab 已确认删除压过 remote 墓碑键）。
4. **墓碑 GC 的安全时机 = 「所有对等端都见过这次删除」；过早 GC 即复活**。参照：Cassandra/HCD `gc_grace_seconds`（默认 10 天，期间须完成 repair，否则出 zombie）、Couchbase purge interval 须按客户端同步频率调大、Cloudant 固定 90 天、RxDB 仅在 replication 空闲且领导者实例上清理。Boxing 的 `TOMBSTONE_TTL_MS` + `gcTombstones` 属「时间 TTL」流派，安全性依赖 **TTL > 最长离线时长**。
5. **合并时的墓碑过滤器必须在所有层级递归应用**——「过滤漏掉任何一层，那一层就是复活通道」（双源）。Boxing `mergeConcurrentLayout` 在 boxes / children / **bookmarks** 三层均传同一 `tombstones` Set，层级覆盖已完整；缺的不是过滤器，而是**单条删除路径从未写入墓碑**。
6. **进阶路线（服务端授权的增量 pull）对 Boxing 不适用**：Replicache CVR diff 生成 `op:del`、Linear SyncAction 游标重放 `D` 事件，官方明示「不需要软删除」，代价是必须有权威服务端 + 版本/游标基础设施。Boxing 的 WebDAV/Gist 是「哑」存储，退不回该路线 → **墓碑方案是正确选择**。

**对比矩阵（atomcode 原文）**

| 方案 | 防复活机制 | 墓碑/GC 成本 | 需服务端权威 | 代表产品 | 对 Boxing 适用性 |
|---|---|---|---|---|---|
| 时间戳软删除 + LWW（墓碑常驻或 TTL GC） | 墓碑 + LWW 守卫 | 有（存储膨胀；TTL 需 > 最长离线期） | 否 | Storyie、RxDB 默认、Couchbase | ✅ 已实现，与哑存储匹配 |
| 版本游标增量 pull（change-feed） | 删除 = 显式 del 事件 | 无墓碑 | 是 | Replicache CVR、Linear | ❌ WebDAV/Gist 无裁决层 |
| CRDT 内建墓石（永不 GC） | CRDT 收敛保证 | 高（只增不减） | 否 | Yjs、Automerge | 不适用（非文档协同场景） |
| 宽限期 + repair | grace 期内不可清除 | 中（需运维调参） | 否 | Cassandra、Aerospike | 理念可借鉴：TTL 调参逻辑 |

**本票采用（推荐与理由）**：维持现有「时间戳软删除 + LWW」路线（第一、二层已具备），本票只补**缺失的墓碑写入**——把单条书签删除收编进 ADR-0007 Q2 的唯一 mutation 入口 `commit(op)`，由 `commit` 统一 `markDeleted(...result.tombstoneIds)`。理由：① 与工业底线同向且是 Boxing 唯一可行流派；② 与 ADR-0007 Q2「新增操作 = 加 handler，而非改既有函数」的扩展方式一致，零架构改向；③ 复活窗口 A/B 的守卫（`clearedTombstones` + LWW）与递归过滤器均已存在，缺口单一，最小 diff 即可闭环。

**信息缺口（如实记账）**：Linear 内部无官方一手文档（逆向 + 演讲）；`MAX_TOMBSTONES` 按时间裁剪在「某设备离线超过裁剪窗口后回来」时的行为，未检索到客户端同步场景的量化研究（Storyie 亦承认 compaction 是「故意不还的债」）→ 见 §5 具名 N 项。

### 1.2 现有心智模型回顾（ADR / CONTEXT.md）与冲突审计

| 记录 | 内容 | 与本票关系 |
|---|---|---|
| ADR-0007 Q2 | 全部变更走单一 `commit(op)` 入口；handler 只改数据，`commit` 负责 `markDeleted → pruneConnIndices → DSU → saveLayout → render`；**显式否决 Plan B「靠各函数记得 cleanup」** | **强化本票**：`popups.js` 裸 splice 正是否决模式（scattered mutation path）的再现，与 ADR-0007 Context 第 2 条「6 scattered mutation paths」同型 |
| ADR-0007 Q4a | 墓碑 24h TTL GC | 沿用，不改 |
| ADR-0007 Q4d | 删除时清 `viewState` | 书签无 viewState，不适用 |
| docs/CONTEXT.md `Mutation API` | 现列 ops: `addConn` / `removeConn` / `toggleStar` / `deleteLargeBox` / `deleteSmallBox` / `applyExternal` | **需同步**：新增 `deleteBookmark` 后该清单须补齐，否则构成文档静默漂移（已在本票处理，见 §2.4） |
| docs/CONTEXT.md `Boxes` 术语 | 「small box … `bookmarks: [{title,url}]`」 | **既有文档漂移（非本票引入）**：代码自 `makeId("bm")` 起书签即带 `id`；本票一并校正并注明 |
| ADR-0017 | 三门合取可发行；N 桶/数据完整性永不豁免 | 本票回归 spec 属数据完整性家族，禁豁免（§3 AC4） |
| ADR-0009 / ADR-0016 | 墓碑/合并/存储门面分层 | 沿用 storage 门面，不改分层 |

**冲突审计结论：零 revised**。本票不改变任何既有决策方向；`commit` 新增一个 op 属 ADR-0007 Q2 明文许可的扩展形态（「Adding a new operation = add a handler + side effect, not modify existing code」），故 ADR-0007 无需修订段；docs/CONTEXT.md 的 op 清单同步属**事实同步**（不涉方向改向），漂移点已在报告中具名呈报。

### 1.3 工业对标（实现与测试策略）

| 维度 | 工业做法（atomcode 核验） | Boxing 对齐动作 |
|---|---|---|
| 唯一变更入口 | tldraw `Editor.deleteShapes` + `editor.run()` 事务；Automerge 一切变更走 `change()` | 删除收编 `commit("deleteBookmark")`；`splice` 仅允许存在于 handler 内 |
| 删除表示 | 软删除墓碑 + 时间戳（LWW 载荷） | `markDeleted(bmId)` → `_meta.deleted[bmId] = Date.now()` |
| 合并尊重删除 | 墓碑过滤器递归应用于每一层 | 复用既有 `mergeById(local, remote, tombstones)`（三层已覆盖） |
| 副作用注册 | 按 record 类型注册，不散落 UI | `commit` 统一 save/render；UI 只调命名 op |
| 测试策略 | 双守卫各设一例：pending-push 窗口 + 陈旧副本回灌 | 回归 spec 用「真 UI 删除 → 高 revision 陈旧远端回灌（`applyExternalLayout`）→ 断言不复活」+ reload 持久性断言 |
| 门禁 | never-quarantine：数据完整性类红灯只允许修绿 | spec 命名落入既有 NQ 正则家族，`waiver-ledger-check.mjs` 机械拒绝任何豁免行 |

---

## §2 实现与裁定

### 2.1 改动清单

| 文件 | 改动 | 理由 |
|---|---|---|
| `ntp/render.js` | `mutationHandlers` 新增 `deleteBookmark(state, {largeId, smallId, bmId, index})`（+27 行） | 删除入单一 mutation 入口；handler 只改数据，墓碑由 `commit` 统一 `markDeleted`（ADR-0007 Q2） |
| `ntp/popups.js` | 删除按钮 `sb.bookmarks.splice(index,1); saveLayout();` → `commit("deleteBookmark", {largeId, smallId, bmId, index}, {save:true})`；facade 增 `commit` 注入位 | 废弃裸 splice 旁路（D-002①）；`{save:true}` 与既有 `_execDeleteLargeBox` 同形 |
| `ntp/ntp.js` | `initPopupsFacade({ ... , commit })` | popups ← render 为反向依赖，必须走门面注入（票13 同款） |
| `docs/CONTEXT.md` | Mutation API op 清单补 `deleteBookmark`；`Boxes` 术语书签形状校正为 `{id, title, url}` | 避免文档静默漂移（§1.2） |
| `test/cluster-map.json` | 新 spec 纳入 `ntp/ntp.js`·`render.js`·`popups.js`·`storage.js`·`utils.js` 五个 cluster | 满足 import-graph-guard CM-1 并让 `test:changed` 能选到它 |
| `test/tests/boxing-sync-bookmark-delete-tombstone.spec.ts` | 新增（never-quarantine 回归，3 用例） | AC1/AC2/AC3/AC4 的可执行锚点 |

### 2.2 关键设计决策与替代方案

1. **收编形态 = `commit(op)`，而非直接调 `markDeleted`**。替代方案「在 popups 里补一行 markDeleted」（Q2 选项 A 手术式）被否决：它不修复「旁路存在」这一根因，且会被姊妹票的静态门禁（D-002②）当场红。
2. **`bmId` 优先、`index` 兑底（而非只收 bmId）**。理由：① `commit` 的 handler 在实时 `layout` 上按 id 重解析，比 popup 闭包里可能已陈旧的 `index` 正确（外部 reload 会替换整个数组）；② 存量无 `id` 的 legacy 书签（v2 迁移不回填 id）仍能删除，否则删除按钮会静默变死键（UX 回归）。未削弱不变量：`mergeById` 以 `item?.id` 为门，无 id 项本就无法进入合并结果，因此不存在复活通道（另见 §5 N-107-02）。
3. **`commit` 走 facade 注入而非 import**。`render.js:26` 已 `import { renderBookmarks } from "./popups.js"`；popups 反向 import render 会形成循环依赖（票12/13 已定同类门面）。
4. **不做 add/reorder/edit 的顺手收编**。见 2.3。

### 2.3 open note 裁定：add / reorder **不同票收编**（delete-only）

| 候选 | 是否复活向量 | 裁定 | 依据 |
|---|---|---|---|
| `addBookmark`（popups L282/L301 push） | 否 | 本票不收编 | 新建项用 `makeId("bm")` 产生**全新 id**，与任何墓碑不碰撞；且新增项只会被合并保留，不会被旧副本带回 |
| `reorderBookmarks`（popups L407 双 splice） | 否 | 本票不收编 | 位置重排不改变集合成员；`mergeById` 保留本地顺序、仅追加远端新增 id，不产生复活 |
| `edit save`（popups L171） | 否 | 本票不收编 | 只改 title/url，不涉集合删除 |

去向：add / reorder 的收编留给姊妹票 **108（A-063 layout 旁路静态门禁）**，并按 Q2 §推荐3 的口径把门禁扫描面先限定为**删除类** `splice`/filter-on-bookmarks，避免一次门禁炸出未迁 add 而阻塞 9.20 关键路径。理由汇总：① 本票为 P0，blast radius 纪律要求只动根因；② 三者均非复活向量（上表）；③ 将 id 生成与 `MAX_BOOKMARKS` 守卫下沉 handler 会扩大模块契约变更，超出 P0 所需。

### 2.4 文档同步（无静默改向）

- `docs/CONTEXT.md` Mutation API op 清单：`addConn / removeConn / toggleStar / deleteLargeBox / deleteSmallBox / deleteBookmark / applyExternal`——这是**事实同步**，非方向改向；ADR-0007 Q2 明文「Adding a new operation = add a handler + side effect」许可此扩展，故 **ADR-0007 不写 revised**。
- `docs/CONTEXT.md` 书签形状 `{title,url}` → `{id, title, url}`：修正**既有**文档漂移（代码自 `makeId("bm")` 起即带 id），非本票引入，已具名呈报。

## §3 AC 对照

| # | AC（issue 原文） | 状态 | 证据 |
|---|---|---|---|
| AC1 | `mutationHandlers.deleteBookmark` 返回 `tombstoneIds:[bmId]` | ✅ 达成 | spec 用例 2（`commit("deleteBookmark", ...)` 返回 `tombstoneIds` 深度等于 `["bm-107"]`，且 `_meta.deleted` 含该 id）；`ntp/render.js` handler 返回体 |
| AC2 | popups 删除按钮走 commit，废弃裸 splice | ✅ 达成 | spec 用例 3（源码断言：popups 命中 `commit(...deleteBookmark...)`、不再命中 `bookmarks.splice(`；render 命中 `deleteBookmark(state,`）；spec 用例 1 全程走**真 UI** 删除按钮 |
| AC3 | 回归：add→delete→陈旧合并/reload→不复活 + `_meta.deleted` 含 bmId | ✅ 达成 | spec 用例 1（双 project 绿）：真 add popup → 真 delete popup → 断言墓碑 → `applyExternalLayout(高 revision 陈旧远端)` → 不复活 → reload → 不复活 + 墓碑仍在；**并含反证**：抹掉墓碑后同一载荷**必须复活**（证明墓碑是承重件） |
| AC4 | never-quarantine：禁豁免 | ✅ 达成 | spec 文件名 `boxing-sync-bookmark-delete-tombstone.spec.ts` 命中 `scripts/waiver-ledger-check.mjs` 的 `NEVER_QUARANTINE` 正则（`boxing-sync`）→ 任何台账行（含 closed）会被机械拒绝；本票未新增任何豁免行 |
| AC5 | open note：add/reorder 是否同票收编 | ✅ 已裁定 | §2.3：不同票收编（delete-only），去向票 108 |

## §4 验证锚点

| 项 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check ntp/render.js / popups.js / ntp.js` | 三份均 exit 0 |
| 行尾/编码 | `git diff --check -- ntp/ docs/`；CRLF/BOM 探测 | clean；四份目标文件均 LF、无 BOM（仓库 `.gitattributes` = `* text=auto eol=lf`，repo `core.autocrlf=false`） |
| 门禁 | `npm run pretest` | import-graph OK(15 modules/48 edges) · migration-golden 28/28 · css-balance OK · contrast-guard PASS x8 · calver OK(8 面) · onboarding OK · **locale-readme 红（既有，非本票，见 N-107-01）** |
| 本票定向 | `node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts test/tests/boxing-sync-bookmark-delete-tombstone.spec.ts --reporter=line` | **6 passed (35.3s)**（3 用例 × chromium-extension + firefox-extension） |
| 全量套件 | 同 config 全跑（绕 pretest） | 见下行回填 |
| 全量结果 | — | **609 passed / 10 failed / 5 skipped（10.7m）**；10 个失败项**同码重跑 10/10 全绿**（`--last-failed`，32.1s）→ 按票15 判据（同码不同结果）定性为**宿主争用下的环境性抖动**，非本票回归。注：该轮工作区同时载有他窗在途改动（package.json / release-status / build-demo / pages-gc-verify 等），非纯净基线 |

### 提交锚点（WORKFLOW §4.2 · GitButler）

| 项 | 值 |
|---|---|
| 分支 | `w920-107-bookmark-delete-commit`（stack 于 `ticket/111-innerclip-settimeout-b72` 之上；依赖冲突按 WORKFLOW §6 票10 教训处置） |
| 代码提交 | change ID `zzv` — fix(w920-107)：`ntp/render.js` + `ntp/popups.js` + `ntp/ntp.js` + `docs/CONTEXT.md` + `test/cluster-map.json` + 新 spec + 本报告（7 files, +420 / -6） |
| 账本提交 | change ID `xzo` — docs(w920-107)：A-062 行 → implemented（1 file, +1 / -1） |
| push / PR | **未执行**（§4.2：除非用户明确要求）；tag / 商店未动 |
| 引用口径 | 仅用 **change ID**（history edit 后仍稳定）；sha 随 `amend`/`squash` 变化，故本报告不引用 sha |

### 本票验证过程中发现的测试装置缺陷（已修正，非产品缺陷）

初版 spec 在 reload 后断言失败（`_meta.deleted` 为空）。根因：`page.addInitScript` 在**每一次导航**（含 `page.reload()`）都会重放，未加守卫的种子脚本把删除前的载荷重新写回 `localStorage`，覆盖了被侧状态。修正：种子改为「仅当 `boxingLayout` 键不存在时写入」。同源教训已写入 spec 注释，与 t44/t91 的「单次 goto 不 reload」纪律互补。

## §5 风险与具名 N 项

| ID | 项 | 处置 |
|---|---|---|
| **N-107-01** | **既有 pretest 红（非本票）**：`locale-readme-guard` BX-LOCALE-006——`README.md` badge `store_published-v2026.9.15` ≠ `docs/release-status.md` 「上一已发布版本 2026.9.12」。证据：两份文件在工作区均为 clean（`git status --porcelain` 空）；README badge 来自**共同基线 `a1acaaac`**（`git log -1 -- README.md`），release-status 行来自 `98d6dc2d`；本票 diff 不涉二者。后果：`npm test`（含 pretest）在本票之前即为红 → 本票**不宣称全量 `npm test` 绿，也不宣称 G-A 达成** | 按 WORKFLOW §2「不跨票动代码」**不在本票修**，具名上报大脑；归属 release-status / calver 面（票 113/116） |
| **N-107-02** | 存量无 `id` 的 legacy 书签无法进墓碑（Q2 open question） | 本票裁定不处理：① `mergeById` 以 `item?.id` 为门，无 id 项本就无法进入合并结果，**无复活通道**；② 赋 id 属持久化数据形状迁移，须配 golden fixture + migration guard（ADR-0017 数据兼容义务），应另立票；③ handler 已保留 index 兑底，不产生 UX 回归 |
| **N-107-03** | 墓碑 TTL（`TOMBSTONE_TTL_MS` = 24h）< 最长离线时长时仍可能复活（atomcode §5 信息缺口） | 本票不改 TTL（属 ADR-0007 Q4a 既有决策）；登记为观察项，留待发行前 G-A 复查时评估 |
| 风险 R-1 | add / reorder 仍为旁路；若票 108 的门禁不限定「删除类」会一次炸出 | 已在 §2.3 具名传递口径给票 108 |
| 风险 R-2 | 并行窗口在 `package.json`（pretest 插 contrast-guard）、`docs/testing-governance.md`、`.scratch/**` 有在途改动 | 本票提交只认领本票 hunk，不动他人改动（§4.2 / CRX-R-015） |
| **N-107-04** | **共享文件写冲突（实测 3 次）**：① `test/cluster-map.json` 本票条目被还原为 HEAD（重做后已提交）；② `decision-ledger.md` 的 A-062 行被还原为 `current`（重做后已提交）；③ 一次隔离提交因外来行检测正则跨文件误判，错提交了 A-061 的回退（已 `but uncommit` 撤销，工作区字节校验未受损） | 处置：本票成果已全部提交（change ID `zzv` + `xzo`）；已向大脑具名上报该写冲突面；建议后续对共享 scratch 文件采用「先提交再改」或按文件隔离 |
| **N-107-05** | **ledger hunk 跨票共占**：A-062 行与 A-070（票115）/ A-068（票113）/ A-061 等行同处一 hunk，GitButler 无法按 hunk 拆分 | 采用 skill 明文允许的隔离法（临时还原外来行 → 提交 → 原样回写），提交后校验工作区字节与提交前一致；外来行全部保留（A-070 preserved=true），已记账 |
| 建议（→ 大脑 §6） | 本票产出两条可复用教训，建议由大脑写入 `WORKFLOW.md` §6（子窗口不跨层改治理文件）：① **共享 scratch 文件的并行写冲突**：`test/cluster-map.json` / `decision-ledger.md` 的未提交改动会被其他窗口的 `but`/工作区操作还原（本票实测 2 次），共享文件应「先提交再改」或按文件隔离；② **`page.addInitScript` 在每次导航（含 `reload`）都会重放**：带 reload 的 spec 必须给种子加存在性守卫，否则删除前的载荷会被重新写回、断言在假前提下失败 |
| **N-107-06** | 本票完成时点的 pretest 红盘点（**均非本票面**）：① `locale-readme-guard` BX-LOCALE-006（既有，见 N-107-01；票 113 在途改 `docs/release-status.md`）；② `import-graph-guard` CM-1 = 新 spec `boxing-pages-gc-version.spec.ts`（**票 109 在途**，未注册 cluster-map）。本票自身面全绿：migration-golden 28/28 · css-balance · contrast-guard · calver · onboarding 均 exit 0；本票 spec 已在 cluster-map 注册（import-graph 于注册后曾 exit 0）；`waiver-ledger-check` exit 0 | 具名上报；**不得据此宣称 G-A**；两个红面归属票 109 / 113 |

