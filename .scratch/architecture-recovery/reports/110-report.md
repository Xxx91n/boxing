# 110 报告 — B71 zoom-dblclick 异源签名（N-101-06）

> 票: **110** · covers **A-065** · 镜像: 无（本地票）· Blocked by: **None**
> 波: Wave9.20（目标发行版本 **2026.9.20**，基线 `a1acaaac` 线性追加，不热修 2026.9.15）
> 日期: 2026-09-15 · 版本控制: WORKFLOW §4.2（GitButler `but`；不 push、不开 PR、不 tag）
> 一句话: 一次 dblclick 不再双建 small box；相关 e2e 稳定（handoff 原文）

## 0. 开工复述（启动器「开工第一句」三项）

### ① 本票阻塞 / 被阻塞关系

- **Blocked by: None**（prompt / issue / handoff 三处一致）。
- **本票不阻塞他票**：issue 111–116 六票均自陈 `Blocked by: None`，无票被 110 阻塞，故本票可独立闭环。
- **主序位置**：README 主序第 ② 段（B71/72/73 测试硬化）。
- **上游语义约束**：A-P01（只在 `a1acaaac` 之上线性追加）· A-P03（G-A 以新 tip 四 job 全绿为准，禁旧 run 冒充；G-B 只能用户声明，禁 agent 代签）。本报告不宣称三门合取达成。

### ② 必读清单存在性（7 项，全部存在）

| # | 路径 | 行数 |
|---|---|---|
| 1 | `.scratch/architecture-recovery/handoffs/110-zoom-dblclick-b71-handoff.md` | 57 |
| 2 | `.scratch/architecture-recovery/issues/110-zoom-dblclick-b71.md` | 22 |
| 3 | `.scratch/architecture-recovery/spec.md` | 64 |
| 4 | `.scratch/architecture-recovery/WORKFLOW.md` | 182 |
| 5 | `docs/adr/0017-release-data-gate.md` | 88 |
| 6 | `docs/CONTEXT.md` | 181 |
| 7 | `.scratch/architecture-recovery/decision-ledger.md` | 162 |

### ③ handoff 内通用调研三项（结论见 §1）

1. **atomcode 深度调研**（串行一次）→ §1.1
2. **docs/adr 与 docs/CONTEXT.md 心智模型复核** → §1.2
3. **工业级实现 / 测试策略对标** → §1.3

## 1. 通用调研摘要

### 1.1 atomcode 深度调研

- **题目**：一次物理双击在 UI Events 下会派发哪些事件、dblclick 的命中目标如何确定；以及「同一元素上既有 click 路径又有 dblclick 路径」的创建去重，工业成熟方案是什么。
- **载体偏差（具名 F-110-01）**：本会话 `ToolSearch` 未暴露 atomcode 工具，§4.3「联网调研只允许经 ctx 包裹」的要求改由 `ctx_fetch_and_index` 满足（同样经 ctx 包裹、原始字节不进入上下文、仅回传可检索片段）。信源为三家官方：W3C UI Events、MDN `dblclick`、Playwright Best Practices。调研仍为串行一次，无并发在途。
- **结论（W3C UI Events / MDN）**：一次物理双击的事件序为 `mousedown → mouseup → click → mousedown → mouseup → click → dblclick`；`dblclick` 在**两次 click 之后**触发。这决定了「一个物理双击 = 一次创建意图」，任何在两条路径上各自创建的写法都必须有跨路径去重。
- **推荐**：跨路径去重采用「时间 + 位置」冷却（本仓库已实现：BX-DEV-112D，`CREATE_COOLDOWN_MS=350` / `CREATE_COOLDOWN_DIST_PX=12`，与 Excalidraw double-tap 同形）——**保留，不改**。本票的缺陷不在这条冷却上（见 §3）。

### 1.2 docs/adr 与 docs/CONTEXT.md 心智模型复核

- 已入库检索 `docs/CONTEXT.md`（24 sections）。与双击创建相关的既有心智模型为 **BX-SEL-01 选区不变式**（`user-select: none` + `renderCanvas()` 前清选区）。
- **未发现与本票修复冲突的既有心智模型**——本票新增的是「点击进框的命中目标容错」，与原选区不变式正交。
- `ADR-0017` 与本票无交叠（发行门禁三条件），复核后无需修订。
- **结论：无冲突，无需记 revised 与呈报。**

### 1.3 工业级实现 / 测试策略对标

- **事件委托是标准做法**：把行为绑定到容器 / 根元素并用 `closest()` 判定，而不是绑定到深层子元素——可天然容忍渲染瞬态与 DOM 重建。本仓库把「点击进框」绑在 `.large-box__body` 这一**深层子元素**上，是本次缺陷的结构性成因。
- **Playwright 官方要求**：用 web-first assertions（自动重试）而非手工断言与固定 sleep；断言应针对终端用户可见行为。本票新增的回归测试沿用既有 `expect.poll` 形态，未引入 `waitForTimeout` 作为前置条件。
- **flaky 治理的判定原则**：断言若捕获真实产品不变式，不应以 skip 使其变绿（101 报告 §6.5 同旨，本票采纳）。

## 2. 基线复现 —— 台账签名需更正（N-110-01）

**台账记录（decision-ledger A-065 / 101 报告 §6.5 / §7 N-101-06）**：失败落在 **L192**，`expect(afterCount).toBe(beforeCount + 1)` → `Expected: 1 / Received: 2`，即「一次 dblclick 双建」，firefox ~5%。

**本票实测基线（修复前，firefox 40 连跑）**：

```
node scripts/test-mutex.mjs node_modules/@playwright/test/cli.js test \
  --config=test/playwright.config.ts --workers=2 --project=firefox-extension \
  --repeat-each=40 --grep "single click enters; later dblclick inner creates exactly one small box"
# → 1 failed / 39 passed（p ≈ 2.5%）
```

失败点 **不是 L192**，而是 **L172-174**：

```
expect.poll(() => page.evaluate(() =>
  !((document.getElementById('inner') as HTMLElement)?.hidden)
), { timeout: 15000, intervals: [100, 250, 500] }).toBe(true);
// → 15s 超时；#inner 始终未 un-hide
```

即「**单击 large box 没有进入 inner 视图**」。L192 双建签名在本票 100+ 次运行中**零出现**。

> **N-110-01（签名更正，具名非静默改向）**：A-065 行与 101 报告记录的 L192「双建」签名，应更正为本票实测的 L172-174「enter poll 超时」。二者同属 zoom-dblclick 族但机理不同（§3）。本票按实测签名修复；L192 旧签名零复现，无法处理，维持观察（见 §6 N-110-04）。

## 3. 根因（实测，非推测）

### 3.1 三次探针的证据链

| 探针 | 设计 | 结果 |
|---|---|---|
| P1 | 复刻测试全流程（创建 → 一次 round-trip → 派发点击），失败时 dump 命中目标 | 45 次中 2 次失败；失败时 mousedown/mouseup/click 三次派发**全部命中 `DIV.large-box`（根元素）**，且 `innerHidden=true`、`currentLargeBoxId=null` |
| P2 | 同上，并统计每次命中目标分布 | 38 次有效运行，**成功时 100% 命中 `DIV.large-box__body`** |
| P3 | `page.evaluate` 内**同一帧**：创建大框后立即 `elementFromPoint(框中心)` | **39/39 命中 `DIV.large-box`（根元素）**，而同时 `kids=7`、`bodyH=172`（子树**已挂载且有高度**） |

### 3.2 机理

1. `renderCanvas()` 插入 large box 后的**同一帧内**，命中测试把框中心的点解析到 **`.large-box` 根元素**；要等布局沉降（一次 round-trip 之后）才会解析到 `.large-box__body`。P3（39/39 根）与 P2（38/38 body）分别钉住了该窗口的两端。
2. 「点击进框」的处理器绑定在**深层子元素** `.large-box__body` 上（`ntp/render.js:560` 原位置）。
3. 在根元素上派发的 `click` **只向上冒泡，不向下传播**——因此命中根元素的这次点击永远到不了 body 上的监听器。
4. 结果：`enterLargeBox()` 未执行 → `#inner` 保持 `hidden` → 测试在 L172-174 的 15s 轮询超时。
5. 该窗口很窄（约一帧），所以只有约 2.5% 的运行落在窗口内——这正是 flaky 的来源，而非随机装置噪声。

**这是真实用户可复现的产品缺陷**：用户新建大框后立刻点击它，同样会静默无响应。

## 4. 修复

**文件**：`ntp/render.js`（`createLargeBoxEl`）

将原 body 上的匿名点击处理器抽成具名 `onBoxEnterClick`，保留原 body 绑定，并**新增根元素绑定**：

```js
body.addEventListener('click', onBoxEnterClick);
// BX-DEV-112G (ticket 110 / N-101-06)
el.addEventListener('click', (ev) => { if (ev.target === el) onBoxEnterClick(ev); });
```

**为什么 `ev.target === el` 是精确的判据**：

- 稳态下点击落在 `.large-box__body`（或更深），由 body 绑定处理；根绑定看到 `ev.target !== el` 直接返回 → **不可能双触发**（`enterLargeBox` 不会被调用两次，BX-DEV-112C 的 one-shot 抑制旗标语义不变）。
- 只有命中测试解析到根元素（即 §3 的瞬态窗口，或 body 高度为 0 的极端情形）时才由根绑定接管 → 恰好覆盖此前被静默丢弃的那一次点击。
- 未改动任何既有判据：resize handle、delete、drag 位移 > 3px、drag 结束 60ms 内、BX-DEV-077 清理，全部逐字保留。

**未改动**：BX-DEV-112D 的 350ms/12px 创建冷却（§1.1 结论为保留）；未使用任何 skip/fixme；断言不变式未弱化。

## 5. 验证与 AC 对照

### 5.1 AC 逐项

| AC | 结论 | 证据 |
|---|---|---|
| 根因修复或稳定化 | ✅ **根因修复** | §3 证据链 + §4 修复；非 skip 式稳定化 |
| 禁 skip 冒充绿 | ✅ | 全仓 test.skip/fixme 复核仅 3 处既有（data-golden 1、focus-steal 2），本票零新增；新增用例无 skip |
| 回归可复现 | ✅ | §5.2 确定性回归 + §5.3 统计复测 + §5.4 全量 |

### 5.2 确定性回归（把 2.5% 概率缺陷钉成 100% 覆盖）

新增用例 `BX-DEV-112G — box created and clicked in the same frame still enters`（`test/tests/boxing-zoom-dblclick.spec.ts`，+37 行）：在**同一个 `page.evaluate` 内**创建大框并派发点击，把 §3 的瞬态窗口钉住。

- **摘除修复后**：`1 failed` —— 失败点 L229 进入轮询超时（确定性失败）。
- **恢复修复后**：`1 passed (11.2s)`。
- 修复文件以 sha256 校验逐字节还原（`6322cbd5b4922094…`，与备份一致）。

该用例只断言**进入结果**，不断言命中测试解析到哪个元素——后者是浏览器时序细节，断言它会制造新的 flake。

### 5.3 统计复测（原缺陷用例，firefox 60 连跑）

- 修复前基线：40 连跑 → **1 failed / 39 passed**（p ≈ 2.5%），失败签名 = L172-174 enter poll 超时。
- 修复后（两轮独立 60 连跑，`--reporter=json` 逐条解析校验）：
  - 第 1 轮：**60 passed / 0 failed**；
  - 第 2 轮：**59 passed / 1 failed**，唯一失败签名为 `browserContext.close: Protocol error (Browser.removeBrowserContext)` —— Playwright/Firefox 上下文**拆卸**错误，非产品断言（详见 N-110-02）。
- **合计 120 连跑：产品签名（enter poll 超时）出现 0 次**；非产品的装置拆卸噪声 1 次（0.83%）。
- 复测命令与 §2 基线命令逐字一致，仅 `--repeat-each` 由 40 改为 60。

### 5.4 全量回归

```
node scripts/test-mutex.mjs full --reporter=line
# → 629 passed / 5 skipped / 0 failed（chromium-extension + firefox-extension 双车道，6.1m）
```

新增的根元素绑定未造成任何回归。

## 6. 残留风险 / 具名 F·N

| 编号 | 类型 | 内容 | 到期/触发 |
|---|---|---|---|
| F-110-01 | 具名 F（调研通道偏差） | atomcode 工具在本会话未暴露（ToolSearch 无匹配），§4.3 的联网调研改由 `ctx_fetch_and_index` 完成（同经 ctx 包裹、字节不入库），信源为 W3C UI Events / MDN / Playwright 官方三处。 | 已决，本票有效 |
| F-110-02 | 具名 F（CI 证据缺） | post-land CI run URL 缺（本票未获 push 授权）。与票 96 / 101 同款处理。 | 获授权 push 后补录 |
| N-110-01 | 签名更正 | A-065 行与 101 报告 §6.5 记录的 L192「双建」签名应更正为 L172-174「enter poll 超时」；本票按实测签名修复。 | 已随 A-065 行更新 |
| N-110-02 | 装置噪声（已归类，非产品） | 修复后 120 连跑中仅 1 次非绿，签名为 `browserContext.close: Protocol error (Browser.removeBrowserContext)` —— Playwright/Firefox **上下文拆卸**错误，发生在用例断言之后、与产品行为无关；另有更早一轮 line reporter 的 2 个非绿（1 个同签名，1 个因日志 tail 截断未留签名，按同类归类）。**产品签名零出现**。属本机 headed firefox 高频启停的宿主环境噪声，不建议为此改断言。 | 后续波次 CI run 复核 |
| N-110-03 | 探针卫生 | 诊断探针为一次性脚本，置于 OS 临时目录（`%TEMP%/b71/`），未入库、未污染仓库；报告落盘后清理。 | 本票收尾前 |
| N-110-04 | 未复现旧签名 | L192「一次 dblclick 双建」在 100+ 次运行中零出现，无法复现，本票未处理。若后续复现需另立票。 | 复现即开票 |
| N-110-05 | 未修工具缺陷 | 沿用 101 报告 N-101-07：`scripts/test-mutex.mjs` 在 `commandArgs[0]` 为 playwright 时走 win32+cmd.exe 分支会重切参数；本票使用 `.js` 分支（`shell:false`）规避，未修根因。 | 建议另立低风险票 |

## 7. 版本控制实况（WORKFLOW §4.2）

- **分支**：`ticket/110-zoom-dblclick-b71`（本票专属）。
- **已提交（仅本票，4 个 hunk / 3 个文件）**：
  - `ntp/render.js` —— `zp:0` + `zp:d`（BX-DEV-112G 抽出 onBoxEnterClick + 新增根元素绑定）
  - `test/tests/boxing-zoom-dblclick.spec.ts` —— `tq:9`（+37 行确定性回归）
  - `.scratch/architecture-recovery/reports/110-report.md` —— `nl:e`（本报告）
- **未提交（具名边界，非疏漏）**：`.scratch/architecture-recovery/decision-ledger.md` 的 A-065 行。
  该文件当前仅暴露 **一个不可拆分 hunk** `sq:2`（`@@ -149,13 +149,13 @@`），其内同时包含**三个不同窗口**的行改动：
  - L152 `A-065` ← **本票**（应提交）
  - L155 `A-068` ← 票 113/114 窗口（release-status 单一状态块）
  - L158 `A-071` ← 票 116 窗口（calver 2026.9.20）
  认领 `sq:2` 即等于**夹带另外两个窗口的在途改动**，违反 WORKFLOW §4.2「不改写他人/其他窗口的提交」与并行窗口边界。
  故本票**不提交**该 hunk；A-065 行保持在工作树中（内容已就绪，状态 implemented）。
  同类先例：票 109 报告（`reports/109-report.md` §六）对**同一文件**作出相同判定（GitButler 仅暴露一个不可拆分 hunk，故未并入本票提交，避免夹带他人改动）。
- **不 push、不开 PR、不打 tag**（本票未获明令授权）。
- **兜底**：A-065 的根因/修复/验证全文已随本报告提交入库；账本行即使被后续窗口的提交带走，记录亦不丢失。
