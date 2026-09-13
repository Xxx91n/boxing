# 89 报告 — R3 auto-expand collapseHover 去 flaky

- 票: **89** · covers **A-043** · Blocked by: **None**（可立即开工）
- 波: Wave9（目标版本 **2026.9.15**，持有 2026.9.12 不热修）
- 日期: 2026-09-13 · 版本控制: WORKFLOW §4.2（GitButler `but`）
- 分支: `wave9-89-auto-expand-deflake`（本票独立分支，未 push、未开 PR）

---

## 1. 通用调研摘要（handoff 必做三项）

### 1.1 atomcode 深度调研（串行一次，已完成）

- **载体**: `node.exe` + 全局 `@atomgit.com/atomcode/bin/atomcode.js`（ticket 28 配方：绝对路径直拉真实 JS 入口、零引号层、后台运行、stdout 日志为唯一成果通道）。headless `--prompt-file --ephemeral`；开跑前探针确认无在途 atomcode（webui 不占串行额度）。耗时 18m48s，exit 0。
- **检索面**: 10 次检索 / 5 角度（Official·Criticism·Currency·Community·Comparative 全覆盖）/ 15+ 全文核验 / **26 条来源**。
- **结论要点（对本票）**:
  1. 依赖真实 CSS `:hover` 的断言要"动作与断言分离 + **命中测试显式化**"。Playwright actionability 的 `Receives Events` 只保证**动作发出那一刻**指针落在正确元素上；`force: true` 会**跳过**该检查 → 遮罩回归被静默掩盖，正是本票失败的机制。
  2. 全屏遮罩的工业处理 = 官方 `page.addLocatorHandler` 文档原话："显式等待遮罩 → 确定性关闭 → 后置断言消失"，作为正常测试流；**fire-and-forget 是反例**。
  3. flaky 纪律（Google 2016/2017 +《SWE at Google》ch23 + Chromium 政策）：同一代码既 pass 又 fail = flaky；CI 上 84% 的 pass→fail 实为 flaky；"稳定测试突然 flaky 且可定位到某次变更"时 **1/6 概率是产品 bug**；rerun 只是"CPU 换时间"，不解决根因；**禁止**用放宽阈值 / `force` 让它"变绿"；具名 skip 必须绑 issue。
  4. `networkidle` 官方标记 **DISCOURAGED**；维护者 issue #37080："永远不需要 networkidle"；替代 = web-first 断言 / 具体 UI 信号。
  5. 跨 OS：官方 CI 文档建议 `workers: 1`；官方 repo issue **#27517** 实锤 headed + 并行 workers 下 hover 类测试**系统性 flaky**（复现命令即 `xvfb-run … --headed --repeat-each 20`，headless 或 `--workers 1` 均不复现），与本票签名同构。
- **方案对比矩阵（调研给出）**：`elementFromPoint` 命中断言 + 真实 hover + poll = ✅推荐；预置"onboarding 已完成"storage = ✅首选；`force:true` / `dispatchEvent` = **不用**（绕过 hit-testing，掩盖回归）。

### 1.2 回顾 ADR / CONTEXT 现有心智模型

| 来源 | 与本票的关系 |
|---|---|
| **ADR-0017**（Release Data Gate，修订 2026-09-13） | 三门合取；R3 属 **F 桶（flaky）**，N 桶/数据完整性永不豁免 → 本票只能"修绿或具名 skip"，**不得折绿**。 |
| **WORKFLOW §4.4** G-A 残红书面豁免台账 | 本用例在册（状态 active），字段已记"ubuntu-latest only、macos+windows 同码绿、票15/票31 已备案 60vs80 hover 抖动、到期 2026-09-19 硬到期" → 与本次定谳一致。 |
| **WORKFLOW §6** 票01/票13 教训 | firefox 有头原生输入会挂起（playwright#16095），本仓 firefox 车道依赖该结论 → **与调研"去掉 force"建议冲突，记 revised（§5 R1）**。 |
| **WORKFLOW §6** 票01 教训 | 本地 8 核跑默认 workers 会饿死 headed 浏览器，"失败名单逐轮轮换且 solo 全绿即此症状" → 本次本地复跑观察到的 "3 failed / 3 passed" 即此症状（§4）。 |
| **docs/CONTEXT.md** | `autoExpand`/`collapseHover` 术语、BX-EXP-REGR、BX-EXPLORE-010/011（`setBodyExpandHeight` 必须量自然高度）、`--expand-height` 机制。本票**不改产品代码**，无心智模型冲突。 |

**冲突记录**: 唯一冲突 = 调研建议去 `force` vs 本仓 firefox 实测约束 → **未静默改向**，记 revised 并呈报（§5）。

### 1.3 工业对标（Playwright 扩展 e2e / CI 门禁）

见 §1.1 的 §1–§5；来源 26 条（Playwright 官方 10 页 + 维护者 issue 3 + Google/Chromium 政策 4 + 社区 9）。与本仓既有实践对齐：票 48 已在 `boxing-empty-state-buttons` 用过同款"先等 `__boxingDebug` → 再 `skipOnboarding`"约定；本票把它升级为"**等 init 完成 + 可验证 + 命中测试 + 具名诊断**"。

---

## 2. 根因（已定谳，非推测）

**失败签名**（G-A 定谳 run [34749813393](https://github.com/Xxx91n/boxing/actions/runs/34749813393) · ubuntu · `chromium-extension` · spec 原 44 行）：

```
Expected: > 80
Received:   60
Timeout 10000ms exceeded while waiting on the predicate
```

**根因**: 首运引导遮罩 `#onboarding-overlay`（`ntp/index.html:380`，class `modal-overlay onboarding-overlay`，CSS `.modal-overlay { position: fixed; inset: 0; z-index: 100 }`，`aria-modal="true"`）在 fresh storage 显示；它**拦截命中测试**，`page.hover` 的指针落在遮罩上，被测盒子永不进入 CSS `:hover`，`max-height` 停在折叠 clamp **60px** —— 与签名逐字一致。

**本地 A/B/A 实验**（`.scratch/probe-89/probe.spec.ts`，验证后已删除）：

| 臂 | 遮罩 | hover 后高度 | `elementFromPoint`(盒中心) |
|---|---|---|---|
| control（隐藏） | hidden | **105**（正常展开） | `large-box__body` |
| treatment（强制显示） | visible | **60（卡死）** | **`onboarding-overlay`** |
| recovery（再隐藏） | hidden | **105** | `large-box__body` |

→ 遮罩是**充分且确定**的成因。

**次因（测试非确定性，非产品缺陷）**: 原关闭方式为 fire-and-forget
`await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });`
① 在 `waitForFunction(__boxingDebug)` **之前**发出；② 不等关闭完成；③ **无后置断言**。

**为什么只在 ubuntu 出现（关键机制，实现中被自证伪后补全）**: `init()` 在 `loadLayout()`（ntp.js:920）之后、`initOnboarding()`（ntp.js:1160）之前仍有 await —— file:// 车道的 i18n fetch 会失败（`Failed to fetch`）并**延迟 `init()`**。若在 `init()` 结束前关闭遮罩，`loadLayout()` 的 `setLayout()` 会**覆盖 `layout.settings`**、把 `onboardingCompleted` 还原，随后 `initOnboarding()` **重新显示**遮罩。该窗口时长 = 失败 fetch 的耗时，机器越快窗口越小 —— 这解释了 macos/windows 全绿而 ubuntu（headed + xvfb + 2 workers，最慢最争用）稳定中招。

**产品侧不修**: 遮罩对真实用户是**预期行为**（真人可见引导、`aria-modal` 拦截指针），故**不属产品 bug**，不给产品开洞。

---

## 3. 修复（仅测试；产品代码零改动）

文件: `test/tests/boxing-auto-expand.spec.ts`

**关键认识**：一次性的"关闭遮罩"**不充分**。实测（注入"boot 关闭后遮罩再出现"）：只加一次性关闭会把 flaky 变成**确定性失败**（`pointer intercepted by #onboarding-overlay`）。故最终为四层设计：

1. **`waitForInitComplete(page)`** —— 等 `init()` 自己打出 `init complete` 标记后再动手，使后续关闭**永久**生效。标记是 `debug()` 级日志，默认 `LOG_WARN` 会被丢弃，故页面以 **`?debug=1`** 载入（ntp.js `initDebugMode` 在**模块初始化即**把级别提到 `LOG_DEBUG`，**无竞态**；测试内再调 `setLogLevel(4)` 仅作晚附着的兜底 —— 单独依赖它会因"晚于 init 打日志"而挂 15s，实测已证伪）。
2. **`dismissOnboarding(page)`** —— poll 内重发 `skipOnboarding()` 直到 `#onboarding-overlay` **确实 hidden**（timeout 8s，带具名 message）。
3. **`hoverUntilExpanded(page, selector)`** —— 每次尝试前先做一次**廉价、非轮询、幂等**的重新隐藏（防 boot 之后才出现的遮罩）；再做 `document.elementFromPoint` **命中断言**（`.toPass()`，命中者不是盒子或其子节点时**直接抛出具名拦截者**）；再真实 `page.hover`（`force:true`，timeout 12s）；再 poll 高度 > 80；失败输出 `overlayHidden / height / expandVar / hitTest` 诊断；上限 **2 次尝试**。
4. `waitUntil: 'networkidle'` → **`'domcontentloaded'`**；`test.setTimeout(30000)` → **`90000`**；步骤 2/7 统一走 helper；过期注释（票48/票15）改为 89 口径。

**设计修正记录（自证伪，非静默）**：
- 初版把 `page.hover` 放进 `expect.poll` 回调 → firefox 车道 3/3 超时（每轮变成完整输入往返）→ 改为 hover 在 poll 之外、上限 2 次。
- 初版只做一次性关闭 → 被"晚显示"注入证伪 → 加入 `waitForInitComplete` + 幂等重隐藏。
- 初版 hover timeout 5s 在 headed firefox 争用下偶发超时 → 提到 12s。

---

## 4. 验证锚点

| 项 | 命令 / 证据 | 结果 |
|---|---|---|
| **正例（CI worker 数）** | `npx playwright test --config=test/playwright.config.ts --project=chromium-extension --project=firefox-extension boxing-auto-expand --repeat-each=3 --workers=2` | **6 passed (30.9s)** |
| 单项目 | chromium ×3 / firefox ×3 | 各 3 passed |
| **负例**（强制遮罩在 hover 时可见 + 移除幂等重隐藏） | `.scratch/probe-89b/spec-blocker.spec.ts` | **1 failed** → `pointer intercepted by DIV#onboarding-overlay.modal-overlay onboarding-overlay`（**即时具名**，取代原 10s 不透明超时） |
| **晚显示恢复**（boot 关闭后强制遮罩可见） | `.scratch/probe-89b/spec-late.spec.ts` | **1 passed**（幂等重隐藏生效，`AFTER EXIT hover height=105`） |
| **慢机复现 A/B**（把 file:// 的 i18n fetch 人为延迟 3s） | 旧版 spec（`b4f3df2d` 原文件）×3 | **3 failed** — `page.hover: Element is not visible`（`AFTER EXIT` 读到 `h=0`，盒子几何未定） |
| **慢机复现 A/B**（同一扰动） | 新版 spec ×3 | **3 passed**（`AFTER EXIT h=60` → hover `105`） |
| 健康值对照 | 通过时 `{"h":105,"expandVar":"220px"}` | 与 CI macos/windows 实测逐字一致 |

**本地宿主说明**: 两项目同跑、默认 workers 时出现 3 failed / 3 passed，**solo 全绿** —— 即 WORKFLOW §6 票01 记载的本地 8 核 headed 饥饿症状；降到 `--workers=2`（CI 口径）即 **6/6 绿**。故非代码问题。

**慢机复现（同一根因、另一症状）**: 用 `page.addInitScript` 把 file:// 车道的 i18n fetch（本就失败）人为延迟 3s，以模拟慢/争用 runner。旧版 spec **3/3 失败**（`AFTER EXIT` 读到 `h=0`，随后 `page.hover: Element is not visible`）；新版 spec 在同一扰动下 **3/3 通过**（`h=60` → hover `105`）。两者症状不同（CI 是 `60`，此处是 `0`），但**根因同类**：测试在 `init()` 尚未结束时就开始操作 —— CI 表现为遮罩拦截 hover，此处表现为盒子几何未定。新版因 `waitForInitComplete` 先等 `init()` 收口而对两者免疫。CPU 节流（4x）在本机不足以复现（`init()` 仍太快），故改用定向延迟。

**全量受限（并行窗口所致，非本票缺陷）**: 硬化后的 `npm run test:changed` **无法收集** —— 并行窗口的在制品 `test/tests/boxing-merge-three-way.spec.ts` 存在语法错误（第 21 行只 import 了 `pathToFileURL`，第 23 行却用 `fileURLToPath`），Playwright 在 collection 阶段即退出。该文件**非本票所有，未改动**。硬化前的全量锚点为 **595 passed / 5 skipped / 0 failed**；本票改动仅限单一 spec 文件（test-only，无跨 spec 影响），故以定向证据为准。

---

## 5. 偏离与 revised（不得静默改向）

| # | 项 | 结论 |
|---|---|---|
| **R1** | 调研建议**去掉 `force: true`** | **不采纳，记 revised**。实测去掉后 firefox 车道 `page.hover` **3/3 超时**（本仓票01/13 + playwright#16095 既有约束）。合成方案：**保留 force + 前置显式命中断言**，把 force 跳过的 Receives-Events 信号补回来。 |
| R2 | 调研建议"预置 onboarding 已完成 storage"为首选 | 不采纳为主修（会改变 fresh-storage 路径语义，且需伪造完整 layout 通过 `isPlausibleLayout`）；列入 §6 后续可选优化。 |
| R3 | 调研建议 CI `workers: 1` / `reducedMotion` | 属全局 config 变更，**超本票边界**；列入 §6 建议。 |
| R4 | 未采用 `addLocatorHandler` | 官方 warning：handler 会**改变鼠标位置与焦点**，对依赖鼠标状态的 hover 用例不适用 → 与调研结论一致，改用显式流程。 |
| **R5** | 以 `?debug=1` 载入页面以获取 `init complete` 标记 | **采纳**。`debug()` 级日志默认被 `LOG_WARN` 丢弃；由测试调 `setLogLevel` 存在"晚于 init 打日志"的竞态（实测会挂 15s 后失败）。`?debug=1` 是代码内已文档化的一等调试开关（ntp.js `initDebugMode`），模块初始化即生效，无竞态。 |

---

## 6. 残余风险与后续建议

1. **同款竞态仍存在于兄弟 spec**：`skipOnboarding` 的 fire-and-forget 写法在约 10 个 spec 中复用（`boxing-adr-0007-acceptance` / `boxing-conn-dsu` / `boxing-create-render-decouple` / `boxing-cred-encrypt` / `boxing-data-golden` / `boxing-debug` / `boxing-empty-state-buttons` / `boxing-migration-golden` / `boxing-state-sync` / `boxing-zoom-dblclick`）。本票只修 R3；**建议另立票**抽公共 helper（`test/helpers/onboarding.ts`，含 init 门 + 幂等关闭 + 命中断言），统一治理。
2. **G-A 出口仍取决于 main CI 复跑**：本票只提供本地证据链；CI 定谳按 §4.4 走。
3. **台账更新**：WORKFLOW §4.4 中本用例条目应在 main 全绿验证 run 出结果后按规则改 `closed` 并引用 run URL（**本票不擅自撤账**）。
4. 建议：CI `workers` 维持 2（现状）；如 hover 类面仍出现跨 OS flaky，再评估 `reducedMotion: 'reduce'` 与动画归零。
5. `?debug=1` 会打开该页面的完整 DEBUG 日志（含 console 输出）。若后续希望零噪声，可改为在页面上下文暴露一个只读的 "init done" 标志（产品侧一行改动），从而去掉对日志文本的耦合。

---

## 7. 账本与状态

- **A-043**: `current` → **implemented**（本票修绿 + 具名诊断 + 本地锚点；CI 复跑后按 §4.4 撤账）
- 报告路径: `.scratch/architecture-recovery/reports/89-report.md`
- 提交: GitButler 本票分支 `wave9-89-auto-expand-deflake`（`fix(auto-expand)` + `docs(ledger)` 两笔；未 push / 未开 PR，遵循 §4.2）
