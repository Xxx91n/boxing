# 报告 — 56 legacyReader 冻结读端升格 rollback AC（P2）

- 日期: 2026-09-12
- 分支: ticket-56-legacy-reader-freeze-rollback-ac（版本控制遵循 WORKFLOW §4.2）
- 阻塞: None（开工时核实）
- 范围裁决: 本票为 P2「立票可见、不占带宽」票（A-010），按 issue AC「可不在本波落地代码」执行 **纯设计+升格**：零源码改动。冻结模块的接线落地留后续票（§8）。
- 调研: 无新增调研问题——复用 Wave5/6 已索引 atomcode 结论并注明来源：expand/contract + 回滚前向兼容工业对标 = spec.md Solution L3 行（Android Room MigrationTestHelper / CWS rollback 义务）；发布门禁 18 信源 = 票46/ADR-0017（ctx source=atomcode）；豁免台账 12 信源 = 票48（ctx source=atomcode-48）。未新起 atomcode。

## 1. 验收对照（issues/56 全项）

| 验收项 | 证据 |
|---|---|
| 识别 migration-golden-guard 中 legacy 读路径边界 | §2 定界表（含行号锚点与「非边界」排除项） |
| 设计独立冻结读端模块接口（可不在本波落地代码） | §3 `scripts/legacy-reader-frozen.mjs` 接口草案 + 冻结规则 F1–F4 + 接线方案（本波不落码） |
| rollback AC 列出至少 1 条具名检查项 | §4 RA-1..RA-6 具名清单（6 条，全部已在 guard 中有实现体） |
| 不改主迁移语义 | §5：`migrateLayout`/`defaultLayout`/guard/fixture 零 diff；guard 现势复跑 28/28 绿 |

## 2. legacy 读路径边界定谳（`scripts/migration-golden-guard.mjs`）

**属于冻结读端（in-scope，共 3 个函数 + 1 个检查块）：**

| 锚点 | 位置 | 契约内容 |
|---|---|---|
| `legacyReader(raw)` | L52–60 | 上一发行版读取器镜像。准入门：`raw.version >= 3` 否则 null（BX-DEV-085「>=3 taken as-is」）；投影白名单 `boxes/connections/groups/settings`（非数组归 `[]`、settings 缺省 `{}`）；丢弃 `schemaVersion`/`_meta`/`nextLargeIndex` 等运行时装饰。契约锚点 = pre-ADR-0009（无 schemaVersion 感知）+ pre-ADR-0007-Q1（groups 可选、isParent 兜底），见 L47–51 注释 |
| 回滚检查块 | L123–134 | 输入 = 当前持久形态 `migrateLayout(v1.json)` 过存储序列化边界（`JSON.parse(JSON.stringify())`，L126）；5 条具名断言（RA-1..RA-5，§4） |
| `bookmarkIds(layout)` | L33–37 | 「用户可见书签」枚举器（boxes→children→bookmarks 三层遍历 = legacy 读端实际遍历结构），迁移半与回滚半共用 |
| `canon(value)` | L40–45 | 键排序规范化比较器（等值判定工具，非契约本体，抽取时留在 guard） |

**不属于边界（out-of-scope，「主迁移语义」本体，一行不动）：**

- `migrateLayout` / `defaultLayout`（`ntp/utils.js`，经 L63 动态 import 消费）——生产迁移语义归 ntp 层与票45 契约；
- v1 / legacy-groups / legacy-v2 三个**迁移**检查块（L76–121）——正向迁移验收面；
- fixtures manifest 检查（L67–74）——fixture 覆盖率面。

**消费者 seam（升格不破坏的对象）：** `legacyReader` 为模块私有（未 export，全仓仅 L127 一处调用）；外部消费者只经由 `runMigrationGoldenChecks`（pretest 生命周期 + `test/tests/boxing-migration-golden.spec.ts` L34–39 同一真源）。`scripts/import-graph-guard.mjs` 只扫 `ntp/**`，`scripts/` 下新模块不在其执法面——生产隔离不变量需按 §3-F4 另行钉死。

## 3. 独立冻结读端模块接口设计（本波不落码）

模块：`scripts/legacy-reader-frozen.mjs`（测试/门禁侧专用；**生产 `ntp/**` 永不 import**）。

```js
// scripts/legacy-reader-frozen.mjs — 冻结读端契约注册表（设计稿，接口定稿）

/** 契约定义：一个契约 = 一个历史发行版本对持久布局的读取规则 */
// { contractId: string,           // 具名 = 回滚目标版本，如 'pre-adr0009'（对应 v3.7.x 发行代）
//   frozenSince: string,          // 定稿 commit / 发行版，只增不改
//   accepts(raw): boolean,        // 准入门（BX-DEV-085 version>=3 语义）
//   project(raw): {boxes, connections, groups, settings},  // 白名单投影
//   visibleBookmarkIds(layout): string[] }                  // 用户可见对象枚举

export const FROZEN_READERS = { /* contractId -> 契约（Object.freeze 深冻结） */ };
export function registerFrozenReader(def) { /* 仅允许新增 contractId；重复名/改已冻结体 → throw */ }
export function rollbackAudit(reader, current) {
  // 返回 RA-1..RA-5 结构化结果：{accepted, bookmarkDiff, boxesDelta, connsDelta, isParentSurvives}
  // 纯函数；比较器等值语义 = canon（留 guard，经参数注入或本模块自带纯拷贝，落码票定夺）
}
```

**接线方案（后续落地票执行，具名检查名保持不变）：** guard 的 L52–60 与 L33–37 逐字节迁入新模块（contract `pre-adr0009`），`legacyReader`/`bookmarkIds` 改 import；`FROZEN_READERS['pre-adr0009']` 在 guard 内装配回 `accepts+project` 组合；28 个检查名与断言表达式零改动（检查名 = AC 身份，见 §4）。

**冻结规则：**

- **F1 append-only**：既有契约的 `accepts/project/visibleBookmarkIds` 函数体不可编辑；schema 演化只**新增**契约（如未来破坏性变更后加 `post-snapv1`），旧契约即回滚演练的目标读取器。对标：Android Room 迁移测试的「旧 migration 类永不改写」惯例（spec L3 已索引）。
- **F2 深冻结**：模块加载时 `Object.freeze` 全部契约对象；`registerFrozenReader` 运行时守卫（重复 id / 原型改写 → throw）。
- **F3 漂移钉**：落地票为每个契约函数体加源码哈希 pin（取 `Function.prototype.toString` 切片比对，允许文件追加不允许既有体漂移），红 = 冻结读端被篡改，禁豁免（never-quarantine 家族）。
- **F4 生产隔离断言**：source-contract 测试断言 `ntp/**` 与 `background.js` 中 grep 不到 `legacy-reader-frozen` import（import-graph-guard 现面不覆盖 scripts/，故单点钉）。

## 4. rollback AC 具名升格（≥1 条 → 实际 6 条）

以下 6 条检查名自本报告起为 **ADR-0017 数据兼容义务（Rollback 兼容）的可执行验收面**，名字即契约（G-A 台账匹配、never-quarantine 名单、G-B 人工演练对照共用同一身份）：

| AC | 检查名（guard 现实现体） | 语义 |
|---|---|---|
| RA-1 | `rollback-old-reader-accepts` | 当前持久数据必须被上一版读取契约接受（准入门非 null） |
| RA-2 | `rollback-bookmarks-visible` | 书签 id 多重集经 canon 等值——回滚读回零书签丢失 |
| RA-3 | `rollback-boxes-visible` | 盒子计数不减 |
| RA-4 | `rollback-connections-visible` | 连线计数不减 |
| RA-5 | `rollback-isparent-self-contained` | 分组真相经 `isParent` 自含存活，无 groups 残留依赖（ADR-0007 Q1 契约） |
| RA-6 | `v2-second-pass-normalized` | **v2 单程路径样例**（ADR-0017 具名项）：首过缺键输出经二过归一且书签零丢失——G-B「回滚演练」人工项的自动化镜像 |

治理挂点（升格的效力来源，本票已落文档）：

1. **G-A**：RA-* 属 `migration-golden` 数据完整性家族 → WORKFLOW §4.4 豁免台账 never-quarantine 名单既覆盖，红只允许修绿；
2. **G-B**：检查单「回滚演练」行（含 v2 单程样例 — ADR-0017 具名项）与 RA-1..RA-6 同名对照勾选；
3. **ADR-0017 数据兼容义务**：新增「回滚验收 AC 具名升格（票 56）」条款块，钉死 RA 名单与禁豁免口径。

## 5. 不改主迁移语义——证据

- 本票 diff 面 = 2 个文档增量（ADR-0017 条款块、CONTEXT.md 词条）+ 1 张 issue 勾选 + 本报告；`scripts/migration-golden-guard.mjs`、`ntp/utils.js`、`test/fixtures/schema/*`、`test/tests/*` 零字节改动。
- guard 现势复跑：`node scripts/migration-golden-guard.mjs` → `{"ok":true,"passed":28,"total":28}` exit 0（RA-1..RA-6 全绿；读时校验，无本机构建产物，CI-only 政策合规）。
- `git diff --check` 目标文件 0 告警。

## 6. issue 状态

issues/56-legacy-reader-freeze-rollback-ac.md：4 项全勾，Status → done（证据 = 本报告 §1–§5）。

## 7. 教训（写回候选，WORKFLOW §6）

| 日期 | 来源 | 教训 |
|---|---|---|
| 2026-09-12 | 票56 | 「升格为验收」类票的落点是**身份钉**而非代码：检查名 = AC 契约身份，一旦挂进 G-A 台账/G-B 检查单，重构/抽模块时函数可搬、名字不可动——接口设计必须先声明「名字冻结」再谈「实现冻结」（F1–F3 只冻函数体，F3 哈希 pin 若含签名会误伤搬家，落码票按函数体切片取哈希） |

## 8. 遗留 / 回报大脑

- **落地票建议（新窗口，非本票扩面）**：按 §3 接线方案建 `scripts/legacy-reader-frozen.mjs` + guard import 改造 + F3 哈希 pin + F4 隔离断言 spec；改动面全在 scripts/test，属 `migration-golden` never-quarantine 家族，验证需 CI dispatch 全量绿。
- **WORKFLOW §4.4 G-B 检查单行**未动（该行已含「ADR-0017 具名项」引用，RA 编号由 ADR 条款块承接，避免并行窗共享文件重复扩面）。
- ADR-0017 复核日（2026-10-12，票57）时建议复核项追加：RA-1..RA-6 是否在首个按门禁执行的发行中完成人工对照留痕。
