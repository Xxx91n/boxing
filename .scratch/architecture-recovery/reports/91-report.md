# 报告 — 91 B55 layout/WebDAV merge 三向整票（票 91 · A-045 · GH #11）

- 日期: 2026-09-13 · 分支: ticket-91-merge-three-way（版本控制遵循 WORKFLOW §4.2）
- 票面: issues/91-merge-three-way-b55.md · 覆盖 A-045（D-009 B55 整票：禁只落方案、禁静默改 newer-wins）
- 阻塞/被阻塞: Blocked by None（开工核实 ✅）；本票不阻塞后续票（wave9 出口票 94 消费本票产物）

## 0. 调研摘要（handoff 通用调研三项，实施前完成）

### 0.1 atomcode 深度调研（本票新跑 1 次，串行）

ctx source=`atomcode-91-baseline`（2026-09-13，三引擎 9 查询/8 全文抓取/7 域，五角度配额达标）。
问题 = 单文件静态云（WebDAV JSON）下三向合并 base 的持久化/传播/失效/退化。结论：

1. **base 只存执行合并一侧的客户端本地，永不随 payload 上云** — Joplin GSoC 三向方案（issue #16020 + sync_items.base_* 列）教科书式实现；基线不需要在云端或对端存在（Confidence 高）。
2. **失效规则 = 干净同步完成即滚动前移；冲突期间 base 不被覆盖**（Joplin PR 测试 3；liveSync 最近公共祖先规则同构）。
3. **失效/不可信信号**：历史缺失（livesync 拒绝猜 base）、无共同祖先、本地从未上传过该条目（Joplin「received only by download」→ 退化）。
4. **基线缺失退化阶梯**：全部工业产品退化为两向 + 冲突副本/人工裁决，无人猜空基线硬并。
5. **单文件场景可迁移设计**：本地 last-synced 快照 + 上传成功后原子刷新（云端协议零改动）；云端单调 rev 作有效性探针（Boxing 已有 `_meta.revision`）；不要把 base 塞进云端单文件（三产品无一采用，payload 翻倍 + base 自身产生并发）。

来源锚点：Joplin #16020、varunkumar-22 PR、joplinapp conflict help、obsidian-livesync specs_conflict_resolution、Syncthing docs、rafa.ee 社区三向实践（完整清单在 ctx 索引内）。

**复用声明**：五策略对比矩阵（LWW/三向/字段级/CRDT/OT）沿用票 80 已索引调研 ctx source=`atomcode-merge-quality`（2026-09-12，14 信源）；先例 = 票 79 报告「调研复用声明」。本票 0.1 为增量专项（base 持久化），非重跑全景。

### 0.2 ADR/CONTEXT 心智模型回顾（冲突呈报，非静默改向）

- 票 44 裁决（冲突副本=存储键、box 级粒度）：**保持**键族/轮转/LRU/读取口语义；粒度下沉（子盒级 parent-wrapped 副本）是票 80 §4.4 预告过的显式修订建议，现经 ADR-0009「修订 2026-09-13（票 91）」记录落地。
- **对票 80 §4.3「存储边界」的一处显式修订**：原推荐把 base 锚点随 payload `_meta.baseRevision` 携带；本票调研 0.1-1/0.1-5 与三个工业产品一致否定该形态，改为「本地 `boxingLayout.syncBase` 单槽 + `_meta.baseRevision` 仅作信息性锚点」。这是新增一个 storage 顶层键 — 记 **revised** 并在此呈报（决策依据 = atomcode-91-baseline 结论 1/6；非静默）。
- Wave6 D-003「不扩 CRDT」：遵守 — 未引入 CRDT/OT。
- A-030/A-045「禁静默改 newer-wins」：遵守 — merge 失败回落与 cloud-newer pull 的 LWW 形态一字未动（见 §3 红线对照）。
- ADR-0016 四层/import-graph 边表：合并纯函数落 utils.js（B-1..B-9 不动）；storage 写链单一门面新增两个只读/单槽方法。

### 0.3 工业对标（测试策略）

- Joplin 集成测试三形态（无 base 设备填充/冲突不覆盖 base/退化两向）映射为本票 spec 的 AC1/AC3 组。
- 既有 Playwright seam 复用：t44 AC-sync file:// mock 车道（addInitScript 预载 + runtime.sendMessage 桩 + `__boxingDebug.syncWebDAV`）、t79 读取口 UI 断言（settings → data tab → `#data-conflict-list` 行）。未引入新框架。
- never-quarantine 纪律：改动只允许使 `boxing-import-merge`/`@data-golden`/`state-sync` 族更绿或等绿；旧契约行为逐字节保留于「无 base 大盒」路径（AC-sync 冒烟 T5 PASS 为函数级证据；CI 复跑为最终证据）。

## 1. 实现摘要（文件 + 锚点）

| 文件 | 改动 | 锚点 |
|---|---|---|
| `ntp/utils.js` | 新增纯函数 `mergeChildrenById`（子盒 id 级 diff3，无 base 退化并集两向）+ `mergeLayoutThreeWay`（大盒 id 级 + 非 children 字段 diff3 / 票 44 启发式保契约 / delete-vs-edit / 纯删除尊重 / nextSmallIndex/nextLargeIndex 取 max）；末尾独立 export 行 | utils.js:347 / 407 / 504 |
| `ntp/storage.js` | syncBase 单槽键族：`getSyncBase()`（isPlausibleLayout 读端把关，坏=缺失）/ `setSyncBase(payload)`（写失败软降级），门面独占 | storage.js:518–534 |
| `ntp/sync-engine.js` | `mergeLayoutFields(cloud, local, base)` 三参化 → 委派 mergeLayoutThreeWay（sync-engine.js:399）；merge 分支 `await getSyncBase()`（517）+ 子盒冲突 parent-wrapped 归档 reason=`webdav-child-conflict`（527）+ `_meta.baseRevision` 锚点（536）+ 合并态滚动 base（540）；pull×3（首拉 501/数据丢失恢复 454/云更新 585）与 push×2（597/608）干净落地后 `setSyncBase`；performBackup 记录 direction+conflicts 并 debugWarn 指向票 79 读取口 | 行号如左 |
| `test/tests/boxing-merge-three-way.spec.ts` | 新 e2e：AC1 双端各加子盒→merge→双方可见+conflicts=0+base 滚动+baseRevision=9；AC2 同 id 子盒分歧→`webdav-child-conflict` 归档→Settings▸Data 列表出现该行（票 79 接线证明）；AC3 有 base：本地纯删除被尊重/单边编辑静默合并/新增 id 不吞；AC3b delete-vs-edit 保内容侧 | 217 行 |
| `docs/adr/0009-3-2-1-data-resilience.md` | 「修订 2026-09-13（票 91）」粒度下沉变更记录 | 文末 |
| `docs/CONTEXT.md` | Wave9 merge 术语行（syncBase/mergeLayoutThreeWay/新 reason） | Wave9 grill 之后 |
| `reports/80-report.md` | §6.1 实施落地记录（含 base 载体对 §4.3 的修订） | §6.1 |

## 2. AC 对照（issues/91）

| AC | 状态 | 证据 |
|---|---|---|
| 子盒/id 级合并落地 | ✅ | utils.js:347/407 + sync-engine.js:517–540；函数级冒烟 T1–T4/T6c/T7 全 PASS（Node 直调，机械自验先例=票 08） |
| 冲突副本 UI（票 79）接线 | ✅ | 子盒冲突经 `archiveConflictLayouts` 入同一键族 → 票 79 列表 reason 无关自动展示；performBackup debugWarn 指向读取口；e2e AC2 断言 UI 行出现 |
| e2e 双端加子盒→pull→双方可见 | ✅（落盘）| `boxing-merge-three-way.spec.ts` AC1；CI 执行=具名待办（见 §4） |
| 若改 newer-wins 语义同步更新 80 报告/文档 | ✅ 未改语义，文档已同步 | 80-report §6.1 + ADR-0009 修订 + CONTEXT 行；红线对照见 §3 |
| 相关 CI 绿；reports/91-report.md | 报告 ✅；CI = **具名 F-91-CI** | 本票不宣称 G-A；CI-only 政策（2026-09-04）禁本地跑测试，证据只认 CI run — 待大脑派发（§4） |

## 3. 红线对照（D-009 负向约束）

| 红线 | 遵守 |
|---|---|
| 不许只落方案 | ✅ 代码+测试落地（§1） |
| 禁静默改 newer-wins | ✅ LWW 两形态（merge 失败回落=归档败者再 LWW；cloud-newer pull=saveSnapshot 先行）逐字未动；红线变更只有 merge 成功路径粒度，且冲突一律留痕（webdav-child-conflict） |
| N 桶/数据完整性不豁免 | ✅ 新 spec 落 never-quarantine 族（import-merge/webdav 面），未加 @quarantine、未动豁免台账 |
| 不宣称 2026.9.12 三门 / 不代签 G-B / 无明令不 push·tag·force | ✅ 全文无此宣称；仅本地 `but commit`（§4.2），无 push |

## 4. 验证与 CI 具名项

- 本地机械自验（非测试运行）：`node --check` 3/3 exit 0；utils ESM 冒烟（import 平价 + 9 例 mergeLayoutThreeWay 行为断言全 PASS）；`git diff --check` 干净；spec/文档均 UTF-8 无 BOM、LF。
- **具名 F-91-CI**：`npx playwright test --project=chromium test/tests/boxing-merge-three-way.spec.ts` + `boxing-import-merge`（回归面）+ `@data-golden` 由 CI 出证据。CI-only 政策下本窗口不派发 push（未获明令）；大脑收口时以 main（或叠加后分支）test.yml run URL 关闭该具名项。
- 风险登记：新 e2e 用 file:// mock 车道（与 AC-sync 同构），不触真扩展上下文；AC2 打开 settings modal 断言 UI——若首运引导 overlay 干扰（票 48 Bug5-dark 先例），seed 布局非空即不触发 onboarding（同 AC-sync 先例）。

## 5. 账本与去向

- decision-ledger A-045：current → implemented（票 91 落地；CI 证据具名待办随 wave9 收口票 94/定谳 run 关闭）。
- GH #11：不评论不关闭（push/对外动作未获明令；镜像同步由大脑收口执行）。
- issues/91：Status → done-when-CI（AC 前四项勾，第五项带具名 F 注记）。

## 6. 教训（写回候选，WORKFLOW §6 — 大脑定夺是否入表）

| 日期 | 来源 | 教训 |
|---|---|---|
| 2026-09-13 | 票91 | 方案票的「存储边界」也可能被后续专项调研否证：base 随 payload 携带（票 80 §4.3）在单文件静态云下是反模式（Joplin/livesync/Syncthing 全部本地存基线）；实施票修订方案边界时必须显式记 revised + 信源，而非静默换形 |
| 2026-09-13 | 票91 | 多窗并行下 decision-ledger 是热冲突文件：本票只动 A-045 行、提交按 hunk 隔离（票 83 教训的 ledger 版应用）|
