# 报告 — 80 WebDAV merge 质量方案（方案先行，不改生产语义）

- 日期: 2026-09-12
- 分支: t80-merge-quality-spec（版本控制遵循 WORKFLOW §4.2）
- 阻塞: None（开工时核实，handoff 头部 `blocked: None (can start immediately)`）
- 票面: issues/80-merge-quality-spec.md · 覆盖 A-030（D-007 R2：WebDAV merge 质量，方案先行，勿静默改 newer-wins）
- 本票性质: **纯方案票**（research · to-spec）——零源码改动、零生产语义变更；交付物 = 本报告 §3–§6 的子盒/id 级合并方案（含备选与推荐、实施边界），供下票引用实施。
- 调研: atomcode 2026-09-12（串行一次，ctx source=`atomcode-merge-quality`，14 信源 12 次全文抓取：Joplin/Syncthing/Dropbox/Obsidian Sync/obsidian-livesync/SQL Server/1Password 系统设计分析/oneuptime LWW/thom.ee CRDT-OT/3-way merge/Joplin #13531/CRDT 综述等）；复用 wave6-dr-grill 已索引结论（Raindrop/Dropbox/Syncthing 冲突副本语义，票 44 报告 §3）并注明来源。
- 必读清单已读全（12 份）: handoffs/80 · issues/80 · spec.md（Wave8 节）· WORKFLOW.md（§4.2/§4.4）· decision-ledger.md（A-030）· destination-reconciliation-wave8.md · docs/CONTEXT.md · atomcode-ga-residual-research.md · next-round.md · ADR-0016 · ADR-0009（含票 51 修订）· AGENTS.md。

## 1. 开工声明

- 阻塞满足: ✅ 无前置阻塞票。
- 必读清单: ✅ 全部读全（复述见报告头部清单节）。
- 本票不改生产语义: ✅ 零源码 diff；`npm run build`/test 无 dist 契约面（纯 .scratch 文档票，先例同票 15/55/56）。

## 2. 现状定谳（代码级，行号锚点）

### 2.1 两条合并管线（已落地的「不静默」基线）

| 管线 | 入口 | 粒度 | 冲突兜底 | 锚点 |
|---|---|---|---|---|
| WebDAV 双向同步 | `ntp/sync-engine.js` `syncWithWebDAV` | **大盒 id 级字段合并**（`mergeLayoutFields`：盒子按 id 合并非重叠字段；>3 字段分歧视为整体编辑保留本地；连接 from:to 并集去重；settings 本地权威） | 同 id 盒字段分歧 → 云侧盒 verbatim 归档 `boxingLayout.conflict.<ts>`（reason=`webdav-field-conflict`）；merge 抛错 → 先按 LWW 胜者归档败者（reason=`webdav-merge-failed`）再落主键；cloud-newer pull 覆盖前 `saveSnapshot()`（票 51 COW） | sync-engine.js L365–421（mergeLayoutFields）、L423–601（syncWithWebDAV） |
| 导入合并 | `ntp/utils.js` `mergeImportedLayout` | **子树级**（同 id 盒 deep-equal 跳过 / 分歧 → 整个 incoming 子树出冲突副本；新 id 追加；连接并集） | settings-ui.js 两段式确认：合并预览（冲突归档 reason=`import-merge`）→ 取消 → 覆盖恢复二次确认（快照先行） | utils.js L231–269、settings-ui.js L514–548 |

### 2.2 冲突副本存储（票 44/51 已落地）

- 键 `boxingLayout.conflict.<ts>` + 轻量索引 `boxingLayout.conflict.index`，LRU 上限 `MAX_CONFLICT_ARCHIVES = 20`，单调 ts 防同毫秒撞键（storage.js L447–493）。
- 读取口: 设置数据区 `data-conflict-row`（归档数 + 最近时间，settings-ui.js L90–102）；单条导出属票 79（ready-for-agent，本票不实施）。
- 导出信封 `meta.conflicts[]` 索引（默认不含正文，票 51/ADR-0009 修订）。

### 2.3 测试契约（never-quarantine 面，实施票必须保绿）

| spec | 覆盖面 |
|---|---|
| `test/tests/boxing-import-merge.spec.ts` | AC1+AC2 合并导入保两侧、AC3 覆盖两段式、AC-sync WebDAV 字段冲突归档 |
| `test/tests/boxing-dr-export-envelope.spec.ts` | AC4 cloud-newer pull 覆盖前快照、AC6b 信封导入走合并管线 |
| `test/tests/boxing-state-sync.spec.ts` | 双标签并发收敛（state-sync 残红属票 71 修绿范围，非本票） |
| `scripts/migration-golden-guard.mjs` + `@data-golden` | 迁移往返金样（pretest 阻断门禁） |

以上全部命中 waiver-ledger never-quarantine 正则（`data-golden|migration-golden|state-sync|data-recovery|import-merge|webdav` 族）——**实施票改动合并语义时红灯只能修绿，不得豁免/skip**（WORKFLOW §G-A）。

### 2.4 现状缺口（本方案要解决的问题）

1. **粒度不均**: WebDAV `mergeLayoutFields` 是大盒 id 级（large box 一层），小盒（`large.children[]`）与书签（`children[].bookmarks[]`）作为盒子整体字段参与比较——两侧同一大盒下各自新增一个小盒时，`children` 数组整体分歧 → 按字段数启发式（>3 字段视为整体编辑）或 `...{...existing, ...lb}` 整组覆盖，**一侧新增的小盒可能被吞**（这是「子盒级合并方案」票面指向的核心缺口）。
2. **字段级启发式粗糙**: `divergedFields.length > 3` 的阈值无工业对标依据（Obsidian Sync 按**内容类型**分流，SQL Server 按**列/行/逻辑记录三级**跟踪——都不是按"字段个数"）。
3. **无 base 版本**: 现行合并是 two-way（云 vs 本地），无法区分「本侧改了」vs「两侧都改了」——three-way merge（diff3）的 base 缺失导致同字段分歧时只能靠 LWW 启发式裁决。
4. **merge 失败回落仍含 LWW**: 票 44 已把失败回落从「静默 newer-wins」改为「先归档败者再 LWW」（两侧都留痕），但主键落地的仍是 LWW 胜者——用户仍需到冲突副本里手工找回（读取口属票 79）。

## 3. 工业对标（atomcode 2026-09-12，14 信源）

### 3.1 五策略对比矩阵（ctx source=atomcode-merge-quality §2）

| 策略 | 优点 | 缺点/风险 | 采用的成熟产品 |
|---|---|---|---|
| LWW | 实现最简、O(1) | 静默丢并发编辑（lost update）、时钟偏移错判、粗粒度一次丢一片 | Dropbox/Syncthing（文件级+冲突副本兜底）、Obsidian Sync（二进制）、1Password（逐条目+版本向量）、obsidian-livesync（二进制 mtime） |
| Three-way merge（带 base） | 区分「谁改了哪段」、自动合并成功率最高 | 必须保存 base 版本；同区改动仍需人工 | Git/diff3、Joplin 冲突 UI、obsidian-livesync（diff-match-patch）、Obsidian Sync（markdown） |
| Field-level auto-merge | 粒度细、误报少、无感 | 依赖 schema 知识；同字段分叉仍要兜底 | Obsidian Sync 设置 JSON key-merge、obsidian-livesync JSON 优先级合并、SQL Server 列级跟踪 |
| CRDT | 数学保证收敛、天然离线 | 元数据膨胀、删除/重命名无自然语义、需定制类型 | 成熟同步引擎均未采用（仅 Yjs 生态 Obsidian 插件与在线协作） |
| OT | 实时协作体验好 | 中心服务器依赖、O(n²)、复杂 | 仅 Google Docs/Figma 类实时协作，个人同步引擎零采用 |

### 3.2 关键工业结论（每条 ≥2 独立信源交叉）

1. **成熟产品不做「选一种算法打天下」，而是按数据类型给合并能力分级**（Obsidian Sync 官方：markdown→dmp 三向 / 二进制→LWW / 设置 JSON→键级合并；obsidian-livesync 同款三叉）。
2. **Dropbox/Syncthing 实质都是 LWW 决定「谁被标记」，但被标记方是被保留为副本而非删除**——这是它们规避纯 LWW 丢数据的关键设计（Dropbox conflicted copy / Syncthing `.sync-conflict-*`，maxConflicts 默认 10）。
3. **LWW 已知风险**: lost update、时钟偏移/回拨错判、「时间新但语义次要」的赢家覆盖「时间旧但内容重要」的输家；1Password 系统设计分析明确警告「整库 LWW 静默丢编辑」→ 降到逐条目 LWW+版本向量。LWW 仅在「一方版本确实被另一方取代 + 时间戳可验证」时恰当。
4. **粒度推荐（对含嵌套容器的层级结构化数据）**: 检测粒度越细（字段级/叶节点级）误报冲突越少；非重叠字段自动合并（字段级）；树结构操作（移动/改名/删除）用**子树级语义**处理；**绝不用整库/整条目 LWW 吞掉对端**（SQL Server merge replication 列/行/逻辑记录三级跟踪 + 结构化合并研究综合推断，置信中）。
5. **反例教训**: Joplin issue #13531（2025-10）冲突机制漏检 → 静默删笔记、无冲突计数用户无从知晓——**冲突计数与可见性**和合并正确性同等重要。

## 4. 方案（本票核心交付）

### 4.0 设计原则（红线约束）

- **不静默改 newer-wins**: 任何路径不得回到「无归档、无提示的 newer-wins」——A-030 负向约束；现行「归档败者再 LWW」是底线形态。
- **不改生产语义（本票）**: 本节全部为下票实施方案；本票零代码。
- 分层不变: 持久化只经 storage 门面（ADR-0016）；合并纯函数留在 utils.js / sync-engine.js 现有边界。
- 冲突副本语义不变: `boxingLayout.conflict.<ts>` 键族 + 归档先行（票 44 裁决）。
- never-quarantine 测试面: 改动合并语义的实施票必须保 `boxing-import-merge` / `boxing-dr-export-envelope` / `@data-golden` 全绿。

### 4.1 备选方案（含取舍）

**备选 A — 子盒级 two-way 合并（小改，最小实施面）**

- 做法: 在 `mergeLayoutFields` 现有大盒 id 合并之后，对同 id 大盒的 `children` 数组追加一层子盒 id 合并（小盒按 `id` 去重并集 + 同 id 小盒 deep-equal 跳过 / 分歧出子盒级冲突副本）；书签数组同法（按 url+title 归一化去重并集，分歧保留并集）。
- 优点: 改动局限单函数；不新增存储键；与现行「字段并集」心智一致；测试面小（import-merge spec 加 2 用例）。
- 缺点: 仍是 two-way——「本侧删除了小盒」vs「对侧编辑了同一小盒」无法区分（删除语义会复活对侧版本）；`nextSmallIndex` 需要同步取 max（现 utils.js mergeImportedLayout 已有先例）。
- 工业对标: Raindrop 式追加合并（票 44 已采用）下沉一层；Syncthing「保留双方」精神。

**备选 B — three-way merge（base 版本，中改，推荐）**

- 做法: 同步 payload 增加 `layout._meta.baseRevision`（上次成功同步时对端的 revision）；`mergeLayoutFields` 升级为 diff3 语义——对每个同 id 大盒/子盒/书签，分别与 base 比较得到 local-delta 与 cloud-delta：仅一侧 delta 非空 → 采纳该侧；两侧 delta 非空且相等 → 跳过；两侧 delta 非空且不等 → 冲突副本（保持现行归档语义）。base 不可得（首次同步/旧远端）时退化为备选 A 的 two-way 行为。
- 优点: 正确区分「谁改了」——解决备选 A 的删除/编辑歧义（base 存在且 local 删除、cloud 未动 → 保持删除）；与 Git/diff3、Obsidian Sync markdown、obsidian-livesync 同款心智；字段数启发式（>3 阈值）可整体退役。
- 缺点: 需要写入并随 payload 携带 base 快照或 base revision 锚点（存储 +payload 体积小幅上升）；旧版远端 payload 无 base 字段需兼容（migrateLayout 白名单已类似处理）；实施面跨 sync-engine + storage + 测试。
- 工业对标: Git/diff3、Raindrop 书签同步扩展「基线三向合并」、obsidian-livesync diff-match-patch 三向（对象级而非文本级，复杂度更低）。

**备选 C — 子盒/书签级 CRDT（大改，不推荐）**

- 做法: boxes/children/bookmarks 全面 CRDT 化（树 CRDT + LWW-element-set 混合）。
- 优点: 数学保证收敛，天然离线。
- 缺点: 元数据膨胀（每元素唯一 id + 因果上下文）；删除/移动语义需自定义（crdt 综述：LWW-register 即最简 CRDT，树语义无自然解）；WebDAV 静态文件传输下无实时会话收益；Boxing 低频并发编辑场景收益有限。
- 工业对标: 成熟个人同步引擎（Dropbox/Syncthing/Joplin/1Password/Obsidian Sync）**均未采用** CRDT；Wave6 D-003 已显式 deferred CRDT（「不扩 CRDT」负向约束仍在）。

**备选 D — 仅 UI 兜底（不加自动合并，保守）**

- 做法: 保持现行合并不动，把「merge 失败/字段分歧」的冲突副本从「存储键可查」升格为「设置内对比视图 + 逐条采纳」（票 55 deferred 范围的 UI）。
- 优点: 零合并逻辑风险。
- 缺点: 不解决 §2.4-1 的子盒被吞缺口——自动合并粒度不变，冲突副本产出率反而升高，用户负担加重；与「质量方案」票面目标（合并质量提升）不符。

### 4.2 推荐: 备选 B（three-way merge）分阶段落地，备选 A 作为其 first-release 子集

**推荐理由**:

1. 工业主流即「条目级检测 + 内容类型感知混合策略 + base 三向」；Boxing 的 layout 是纯 JSON 结构化数据（对象级 diff3，无需文本 dmp），实施成本低于 obsidian-livesync 的文本三向。
2. 解决 §2.4 全部四个缺口: 子盒粒度（base 下 children 数组可做元素级 delta）、启发式退役（diff3 判定取代 >3 字段阈值）、two-way 歧义（删除 vs 编辑可区分）、LWW 回落面收窄（两侧 delta 相等时不再误报冲突）。
3. 分阶段降低风险:
   - **阶段 1（= 备选 A）**: 子盒/书签级 two-way 合并 + 子盒级冲突副本。先行落地即可消除「一侧新增小盒被吞」的最痛缺口；base 字段留空位（`_meta.baseRevision` 未设时行为 = 阶段 1）。
   - **阶段 2**: base revision 写入与随 payload 传播 + diff3 判定 + 启发式退役。退化路径: base 不可得 → 阶段 1 行为（永不更差）。
   - **阶段 3（可选，带宽允许时）**: 冲突副本对比/采纳 UI（票 55/79 既有票面承接，不在本票重复立票）。
4. 备选 C 被 Wave6 D-003 负向约束（不扩 CRDT）排除；备选 D 不解决缺口且加重负担，仅作为阶段 3 UI 的补充描述保留。

### 4.3 推荐方案的实施边界（下票可直接引用）

| 边界 | 约束 |
|---|---|
| 函数边界 | 合并逻辑只落 `ntp/utils.js`（纯函数 `mergeLayoutThreeWay` / `mergeChildArrays`）与 `ntp/sync-engine.js`（`mergeLayoutFields` 调用面）；不新开模块（ADR-0016 四层 + import-graph-guard B-1..B-9 边表不动） |
| 存储边界 | base 锚点随 payload `_meta` 携带（`baseRevision`）；不新增 storage 顶层键；冲突副本仍走 `archiveConflictLayouts`（键族/轮转/LRU 不变，storage.js L447–493 不动） |
| 语义边界 | newer-wins 仅存于两处既有形态并保持「归档先行」: (a) merge 抛错回落（先归档败者再 LWW）；(b) cloud-newer pull（先 `saveSnapshot()` 再整替）。两者均不得回退为无归档静默覆盖（A-030 负向） |
| 数据边界 | `groups` 仍为 runtime-only（`stripGroupsForPersist`，ADR-0007 Q1）；`_meta.baseRevision` 是新增 meta 字段，随 `migrateLayout` 白名单式兼容（缺省 undefined → two-way 退化）；镜像键 `boxingBootTheme.v1` 不进 merge/sync（Wave7 D-002 负向） |
| 测试边界 | 阶段 1: import-merge spec +2 用例（子盒并集、子盒分歧副本）；阶段 2: +3 用例（base 三向合并、删除 vs 编辑区分、base 缺失退化）。全部命中 never-quarantine 族——红只许修绿；现有 4 用例契约（AC1+AC2/AC3/AC2-regression/AC-sync）不得回归 |
| 门禁边界 | 不扩 ADR-0017、不设 G-D、不 tag；实施票遵循 WORKFLOW §4.2 独立分支；`npm run pretest`（import-graph-guard + migration-golden-guard）必须绿 |
| i18n 边界 | 若阶段 3 UI 落地需新键则 14 locale 全量 + I18N_FALLBACK（BX-I18N-001/003/005）；阶段 1/2 无 UI 无新键 |

### 4.4 与 current 决策关系（无静默改向声明）

| 决策 | 关系 |
|---|---|
| A-030（D-007 R2） | 本方案即其「方案先行」交付；「勿静默改 newer-wins」被 §4.0/§4.3 语义边界显式服从 |
| ADR-0016 outbox 协议 | §2 现状记录被本方案细化为实施基线；「留待后续裁决」的 newer-wins 妥协由本方案给出裁决路径（不静默改向: 落地仍需下票按本报告实施并经 G 面测试） |
| Wave6 D-003（CRDT deferred） | 备选 C 被排除，服从「不扩 CRDT」 |
| 票 44 裁决（conflict 副本 = 存储键、box 级粒度、不做 URL 归一化） | 本方案保持其裁决；备选 A/B 把粒度下沉到子盒/书签是对「box 级粒度」的显式修订建议（新粒度仍出副本、仍走存储键，不违反「副本非画布盒」裁决），落地前需实施票在 ADR-0009 修订节补粒度变更记录 |
| 票 79（读取口） | 阶段 3 依赖其「列表+单条导出」先行；无依赖倒置 |

## 5. 验证

- 本票为纯文档票: 零源码 diff（`git diff --stat` 仅 .scratch 两文件）；无 dist 契约面，`npm run build`/test 不适用（先例: 票 15/55/56 纯文档票豁免构建）。
- 事实锚点核对: §2 全部行号与函数名经 ctx 沙箱对 `ntp/sync-engine.js` / `ntp/utils.js` / `ntp/settings-ui.js` / `ntp/storage.js` / `test/tests/` 现读核对（非凭记忆）。
- 调研可追溯: atomcode 14 信源清单见 ctx source=`atomcode-merge-quality` §4；本报告 §3 引用均标注来源节。
- `git diff --check`: 干净（提交后复验）。

## 6. issue 状态与去向

- issues/80: AC 三条全勾（方案含备选与推荐=§4.1/§4.2；不静默改 newer-wins=§4.0/§4.3/§4.4；实施边界清晰=§4.3），Status → done（方案先行票的 done = 方案交付，非代码落地）。
- 下票引用: 实施票以 §4.2 阶段 1 为第一刀（备选 A 子集），§4.3 边界表为验收基线。
- 遗留: 阶段 2/3 无票面，由大脑在下轮 to-tickets 时决定是否立票；本票不越权立票。

## 7. 教训（写回候选，WORKFLOW §6）

| 日期 | 来源 | 教训 |
|---|---|---|
| 2026-09-12 | 票80 | 方案票的「完成」= 方案可被下票直接引用（边界表 + 阶段刀 + 退化路径），不是「分析写得长」；先例票 56 报告的 §3 接口草案 + §4 具名检查是同款可引用形态 |
| 2026-09-12 | 票80 | atomcode 调研 prompt 直接写「对比 X/Y/Z + 风险 + 粒度推荐」一次拿全五策略矩阵，比拆多次串行调研省 2 轮；14 信源 12 全文抓取是本票引用密度的底气 |
