# 71 — G-A N 桶修绿

> 覆盖 A-xxx: A-025 · 阻塞: 70 ga-set-diff-root-cause（已满足）· 日期: 2026-09-12 · 状态: N 桶三面修绿，1 项跨窗口阻塞未绿
> 协议: D-005（调研 + ADR/CONTEXT 回顾 + 工业对标 + 冲突呈报）

---

## 0. 开工声明

1. **阻塞**：`issues/70` 四条 AC 全 `[x]`，终表已落 `reports/70-report.md` §4（N 5 / B 14 / B-F 1）—— **满足**。
2. **必读清单**：7 项全读（handoffs/71 · issues/71 · spec.md · WORKFLOW.md §4.2 · decision-ledger.md · destination-reconciliation-wave8.md · docs/CONTEXT.md），另补读 handoff 附加项 `docs/adr/0017-release-data-gate.md` 与 `reports/70-report.md`。
3. **本票 delta**：
   - 检查点**禁止写豁免** —— 本票**未新增/修改任何豁免台账条目**，`waiver-ledger-check` 仍为 2 行 active、never-quarantine clear。
   - 专属验收 **data-golden job 与主 lane 同绿** —— N1 面（gate4）双通道绿；data-golden job 内 **gate2 因跨票回归未绿**（§6.1，成因 tickets 81，非本票）。
   - 未 tag、未宣称可发行、未扩 ADR-0017、未新增 G-D。

---

## 1. 方法与证据口径

| 项 | 值 |
|---|---|
| 验证面 | 本地 Playwright 双通道 `chromium-extension` / `firefox-extension` |
| 探针 | 一次性 Node 脚本，写在 **OS temp**（`boxing-gate4-probe.cjs` / `probe2..probe6`），未落仓库；用完即留在系统临时目录 |
| 定责方法 | **因果对照**：对每一处失败，先临时还原旧判定式复跑同一用例，再恢复。同结果 ⇒ 非本票引入 |
| 插桩 | `ntp/storage.js` 曾加 `T71PROBE` 调试输出取证，**已完全移除**（复核：`T71PROBE` / `T71-TEMP-REVERT` 计数均为 0） |
| 静态门禁 | import-graph-guard / migration-golden-guard(28/28) / css-balance-guard / waiver-ledger-check 全 exit 0 |
| 完整性 | `git diff --check` CLEAN；改动文件 LF-only、无 BOM |
| 稳定性 | 三面 × chromium 3 轮 + firefox 2 轮重复跑，结果逐轮一致（§5.1） |
| 验证基准 | 稳定性取证时 HEAD = `4ae889c1`（GitButler 工作区提交） |

---

## 2. N1 — data-golden gate4 跨页 revision 收敛（3 → 4）

### 2.1 现象

`expect(settle2._meta.revision).toBe(settle1._meta.revision)` → Expected 3 / Received 4。静默窗口内多出一次写。

### 2.2 根因（插桩实测，推翻初始假设）

探针时间线（A 写 → B 收 → **B 回写** → A 收）：

```
A saveLayout done, revision=2
A saveLayout done, revision=3      <- 测试显式 saveLayout
B external layout applied {revision: 2}
B external layout applied {revision: 3}
B saveLayout done, revision=4      <- 多余的回写
A external layout applied {revision: 4}
```

插桩输出（接收方每次 apply 打印差异键）：

```
T71PROBE reconcile nrw=true  wins=true onlyLayout=[] onlyIncoming=[] diff=[_meta]   <- 该页首次收到外部布局
T71PROBE reconcile nrw=false wins=true onlyLayout=[] onlyIncoming=[] diff=[]        <- 之后收敛
```

**唯一差异键是 `_meta`，不是 `groups`。**（初始假设是 ADR-0007 Q1 的 `groups` 运行时字段；探针在 `needsReconcileWrite` 计算点取值后否证——`ensureGroups()` 在其**之后**才执行，`layout.groups` 当时并不存在。）

机制：`mergeConcurrentLayout` 恒定合成 `_meta` —— `_meta: {...remote._meta, ...local._meta, deleted: trimmedDeleted}`，即

1. 无论双方有无墓碑，merged 的 `_meta` **一定带 `deleted` 键**；
2. `revision / updatedAt / writerId` 被重盖。

而 incoming 来自持久化载荷（`stripGroupsForPersist` 之后），首次收到的载荷 `_meta` 无 `deleted`。于是 `JSON.stringify(layout) !== JSON.stringify(incoming)` **在每个标签页首次收到跨页更新时恒为真** → 回写一次 echo → revision +1。回写之后双方 `_meta.deleted` 都是 `{}`，才收敛——这解释了「只多一次」与 H3 观察到的「同代码不同结果」。

### 2.3 修复（`ntp/storage.js`）

把「我是否还有本地东西要发布」的判定，从**整个内存对象**改为**复制态用户数据的规范化投影**：

- 新增 `stableJson()`：对象键排序、集合按元素规范化串排序（集合语义），消除键序/数组序造成的假差异；
- 新增 `canonicalReplicated(src)`：剔除 `groups`（ADR-0007 Q1 计算态）、剔除 `__` 前缀运行时设置（66/A-020）、`_meta` 只保留 `deleted`（墓碑是真实删除意图，不能丢），`revision/updatedAt/writerId` 视为簿记排除；
- `needsReconcileWrite = canonicalReplicated(layout) !== canonicalReplicated(incoming)`。

保留语义：当本方确有 incoming 没有的数据（例如 B 自建的 box），投影必然不同，仍会回写发布并集——`state-sync` 双标签并发收敛依赖此路径，实测仍绿。

### 2.4 验证

| 场景 | 结果 |
|---|---|
| gate4 · chromium（隔离，workers=1/2，多轮） | PASS |
| gate4 · firefox（三件套合并跑） | PASS |
| 全套 285 用例 · chromium 4 workers | gate4 报 **boot 5s poll 超时**，非 revision 断言失败（§6.4） |

---

## 3. N2 — state-sync 双标签并发创建收敛（2 → 1）

### 3.1 现象与定责

票 70 记为「存量未修（票 48 声称修绿未成功）」。本票入场时：chromium 已绿、**firefox 仍 2→1**。

**因果对照**：还原 §2.3 的旧判定式后，firefox 仍 2→1 —— **非本票引入**，是 firefox 通道的真实残留缺陷，落在本票 AC 内，需修。

### 3.2 根因（探针实测）

firefox 双页探针（先排除 id 冲突假设——两个 box 的 id 唯一：`large-<ts>-<rand>-1`）：

```
AFTER-ADD A = {ids:[2], nli:2, domCount:2}
AFTER-ADD B = {ids:[2], nli:2, domCount:1}   <- 内存 2 个 box，DOM 只有 1 个
AFTER-AtoB  B = {ids:[2], domCount:1}        <- 显式 applyExternalLayout 也没重渲染
```

两条真实缺陷叠加：

1. **`saveLayout()` 的 merge 不重渲染**。写链里 `setLayout(mergeConcurrentLayout(layout, remote))` 会把存储侧的 box 并进内存，但没有任何 repaint；唯一会渲染的 `applyExternalLayout` 走不到（见 2）。
2. **`applyExternalLayout` 的 writerId 自回声守卫误伤**。`if (incoming._meta?.writerId === writerId) return false;` 本意是「忽略自己的写回」。但 `mergeConcurrentLayout` 会整体覆盖 `_meta`，于是一个标签页可能持有**盖着本页自己 writerId 的对端载荷**；此时对端更新被当成自回声整条丢弃（不合并、不渲染）。file:// lane 下 storage 事件本就不可靠，该路径更是唯一通路。

净效果：**内存与 DOM 在 merge 后分叉** —— 用户看不到并发创建的 box，直到别处触发重绘。

### 3.3 修复（`ntp/storage.js`）

在 `saveLayout()` 的 merge 前后取 box-id 签名，仅当 **box 集合真的变了** 才 `renderCanvas()`：

```js
const boxSigBefore = ...layout.boxes.map(b => (b && b.id) || '').join('|');
setLayout(mergeConcurrentLayout(layout, remote));
const boxSigAfter  = ...
if (boxSigAfter !== boxSigBefore) { try { renderCanvas(); } catch (e) { debugErr(...); } }
```

守卫很窄：日常编辑（拖动/改名/设置）box 集合不变，不会额外重绘，避免每次 save 都重建画布。

**未改** writerId 守卫本身：那是判定语义（区分「我的写回」与「对端更新」）问题，改动会直接影响回声抑制，属数据语义级决策，超出本票且不属静默改向范围 —— 见 §7 给后续票的观察。

### 3.4 验证

| 场景 | 结果 |
|---|---|
| state-sync `concurrent creation in two tabs` · chromium | PASS |
| 同上 · firefox（修复前 FAIL 2→1，修复后） | **PASS**（三件套 19 passed） |
| state-sync 全 11 用例 · 双通道 | PASS |

---

## 4. N3/N4 — dr-export（AC1+AC3 / AC2 / AC4）

三者同源不同因：AC4 是产品缺陷，AC1/AC2 是新增 spec 的 fixture 缺陷。

### 4.1 AC4 — WebDAV cloud-newer pull（期望 pull，实得 merge）

探针实测（`?debug=1` 抓 `WebDAV sync: timestamps`）：

```
A4 pre  localUpdatedAt 距 now 60411ms   （种子值，符合「本地自上次同步后未变」）
A4 after setWebDAVConfig  距 now 6ms    <- 被重盖为当前时刻
A4 syncWebDAV -> direction: merge
```

根因：`setWebDAVConfig()` 调 `saveLayout()` 落盘凭据，`saveLayout` 无条件把 `_meta.updatedAt` 重盖为 `Date.now()`。`_meta.updatedAt` 是**数据时间戳**，而 WebDAV 地址/账号/口令是**连接配置**。写配置推进数据时间戳 ⇒ `localUpdatedAt > lastSyncAt` ⇒ 同步判定为「双方都改过」⇒ 走进 ADR-0009 并发字段 merge 分支，本该是纯 pull。这是**伪造的本地变更**。

修复（`ntp/storage.js` + `ntp/ntp.js`）：

- `saveLayout(opts)` 新增 `opts.preserveUpdatedAt`：保留既有 `_meta.updatedAt`，**revision 照常递增**（写入照样传播、序不乱）；
- `setWebDAVConfig()` 改调 `saveLayout({ preserveUpdatedAt: true })`。

未触碰 newer-wins / merge 判定本身（A-030 票 80 明确「勿静默改 newer-wins」），只是不再让配置写入制造假变更。

### 4.2 AC1+AC3 / AC2 — 快照数为 0（期望 1）

**产品行为先被独立证真**：探针按正确方式播种后，导出得到 `metaSnapshots=[{ts:111,schemaVersion:3,size:999}]`、`hasBodies=false`（默认信封不带正文，D-006 负向约束成立）、全量包 `_bodies.snapshots[0].data.boxes[0].title === 'Seeded Snap'`。即 AC1/AC2 描述的产品语义**已经正确**。

根因在新增 spec 的 fixture：`addInitScript` 的播种函数体内引用了模块作用域常量 `SNAP_TS`。Playwright 以 `fn.toString()` 序列化并在页面里求值，模块常量在页面上下文是**自由变量**，读取即 `ReferenceError`，脚本从第二条 `setItem` 起被中断：

```
CLOSURE-SHAPE listSnapshots=[]          // 与失败签名一致
CLOSURE-SHAPE boxTitle=Envelope Root    // 第一条 setItem 已执行，故 layout 断言仍过
```

修复：把 `ts` 作为可序列化入参随 `seed` 传入（`const ts = seed.ts`），调用点补 `ts: SNAP_TS`。与 t43R「single goto, no reload」同源纪律——fixture 必须能跨序列化边界存活。

### 4.3 验证

| 用例 | chromium | firefox |
|---|---|---|
| AC1+AC3 | PASS | PASS |
| AC2 | PASS | PASS |
| AC4 | PASS | PASS |
| AC6 / AC6b | PASS | PASS |

---

## 5. 验收

| AC | 结论 | 证据 |
|---|---|---|
| data-golden gate4 绿或退役 | **绿** | 双通道隔离复跑 PASS（§2.4） |
| state-sync 并发绿 | **绿** | chromium + firefox 双通道 PASS（§3.4） |
| dr-export WebDAV 绿 | **绿** | 5/5 双通道 PASS（§4.3） |
| waiver 无 N 桶行 | **满足** | `waiver-ledger-check` exit 0：2 行 active、字段完整、未过期、never-quarantine clear（未改台账） |
| 专属验收：data-golden job 与主 lane 同绿 | **部分** | job 内 gate4 绿；**gate2 因跨票回归未绿**（§6.1） |

### 5.1 稳定性（重复跑取证）

H3 将 gate4 定性为「flaky 升级为稳定红」，故修复必须证明是**确定性绿**而非单次运气。三个 N 面连同其所在 spec 文件整体重复跑：

| 通道 | 轮次 | 结果 |
|---|---|---|
| chromium-extension | 3 | 19 passed / 1 failed / 1 skipped，**逐轮完全一致** |
| firefox-extension | 2 | 19 passed / 1 failed / 1 skipped，**逐轮完全一致** |

「1 failed」恒为 gate2（静态源码扫描，确定性红，见 §6.1），与 N 面无关；「1 skipped」为 gate3（spec 自带 `test.skip`，票 45 接受）。

结论：N1 / N2 / N3-N4 三面在双通道上均为**确定性绿**，无 flaky 残留。

---

## 6. 未绿项定责（均非本票引入）

### 6.1 data-golden gate2 — 跨票回归（ticket 81）

失败点：`ntp/credentials.js` 的 `return api.storage.local.set(obj);`，违反 gate2「storage.js 之外禁止直接写」。
归属：`git merge-base --is-ancestor f76d9e13 HEAD` = **YES**，该行来自票 81（A-031，per-install key `boxingCredKey.v1`，刻意写在 layout 之外）。已合入 main，故 run C 之后才转红，不在票 70 的快照内。
**本票不改**：gate2 属 never-quarantine 门禁家族，改它是门禁口径变更；且 81R 曾为同一写法在 `import-graph-guard` B-6 加条件白名单——同一决策应复用。
建议（交票 81/81R 或新票）：把 45R 的「按键定向」语义从 SW 侧平移到 ntp 侧扫描——仍拦截任何 `boxingLayout` 写入，放行其它键（如 `boxingCredKey.v1`）。

**可直接套用的补丁方案（本票未实施，待归属窗口裁定）** —— 沿用 gate2 已有的「钉死 + 计数」纪律（与 debug passthrough trio 同一手法），因此任何**新增**写点仍会转红：

```ts
// 与 debugPassthroughRe 并列，放在同一个 lines.forEach 内、writeRe 判定之前
// Ticket 81 (A-031): 每安装随机密钥 boxingCredKey.v1 刻意写在 layout 之外
// （永不进导出/备份/快照）；它不是 boxingLayout 写入，不违反 single-write-path 不变式。
const credKeyWriteRe = /^\s*return api\.storage\.local\.set\(obj\);\s*$/;
const credHits: string[] = [];
// 循环内（紧邻 debugPassthroughRe 分支之后）:
//   if (credKeyWriteRe.test(line)) { credHits.push(trimmed); return; }
// 循环后，与 trio 同样钉死数量:
expect(credHits.length, 'credentials.js PIK write site drifted').toBe(1);
```

如此 gate2 仍拦截 `ntp/**` 下任何新增直接写（含任何 `boxingLayout` 写），仅放行票 81 已具名、且数量被钉死的那一个非布局键写入点。

### 6.2 star-sync Scenario 1 — N? 遗留项

`starB = null`。**因果对照已证明与本票无关**（还原旧判定式后同样 null）。成因是 harness：`boot(b)` 先 `localStorage.clear()` 再 reload，把 A 的数据抹掉后 B 无从加载；叠加 writerId 守卫（§3.2 第 2 条）后 A 不会重新发布。票 70 §4 已标为「N? 先定 N/B 再修」，维持该定性。

### 6.3 B 桶 14 面
属票 72 范围，本票未触碰。

### 6.4 满载 boot / launch 超时
4 workers 满载跑全套时出现 `bootNtp` 5s poll 超时与 `browserType.launch: Timeout 180000ms`（`boxing-sync-level` ×3）。低并发复跑均通过，属票 20 已记录的宿主饥饿现象，非产品失败。

---

## 7. 与 current 决策的关系

- **无冲突、无 revised。** A-025（N/B 禁豁免、禁假绿）、A-008（修绿优先、数据完整性永不豁免）、A-037（D-005 协议、冲突须呈报）、ADR-0017（G-A∧G-B∧G-C）全部被服从，未改写。
- 未扩 ADR-0017、未新增 G-D、未回滚零闪现、未改豁免台账。
- **给后续票的观察（非改向，未实施）**：
  1. **票 80（A-030 合并质量）**：`_meta.writerId` 同时承担「最后写入者」与「回声抑制身份」两种职责，`mergeConcurrentLayout` 整体覆盖 `_meta` 会让二者互相污染（§3.2）。若 80 要动 newer-wins 判定，建议一并给出 writerId 与修订序的分离方案。
  2. **票 74（T-GA5 豁免复查）**：本次未发现需要新增的豁免；台账 2 行 active 仍只覆盖 auto-expand / zoom-dblclick。
  3. **票 73（T-GA4）**：本票未产生任何支持 H1 的新证据，维持暂挂。

---

## 8. 交付物

| 路径 | 内容 |
|---|---|
| `.scratch/architecture-recovery/reports/71-report.md` | 本报告 |
| `ntp/storage.js` | `stableJson` + `canonicalReplicated`（N1）；`saveLayout(opts)` 的 `preserveUpdatedAt`（N3）；merge 后 box 集合变化即重渲染（N2） |
| `ntp/ntp.js` | `setWebDAVConfig` 改走 `saveLayout({ preserveUpdatedAt: true })` |
| `test/tests/boxing-dr-export-envelope.spec.ts` | fixture 的 `ts` 改走可序列化入参（N4） |

## 9. 版本控制

遵循 WORKFLOW §4.2：`but diff` 确认改动 → `but commit -b <branch> -m "<消息>" <改动id...>`。不 push、不开 PR、不 tag。

**归属说明**：`ntp/ntp.js` 的单行改动在实施期间被 GitButler 工作区快照 `c66d2326` 一并带走（代码在 HEAD 中已存在，可用 `git show HEAD:ntp/ntp.js | grep preserveUpdatedAt` 核验），因此本票提交集中为 `ntp/storage.js` 与 `test/tests/boxing-dr-export-envelope.spec.ts`。
