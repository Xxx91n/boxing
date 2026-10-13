# Round-3 测试基建问题登记 — 2026-10-13

> **裁决已落（2026-10-13，用户"那就无头吧，采纳你推荐的就行"）**：R3-01+R3-03→D-012（firefox 车道整体转 headless + 解 4 条 skip）；R3-02→D-013（观察项零动作）；R3-04→D-014（实施 test-evidence.mjs）。实施契约见 spec.md S-12/S-13。
> 上游：handoffs/next-round.md §1.1（4 项开工输入）+ §1.2（登记格式）+ §6（流程：登记→用户逐条确认入账→实施）。
> 本文件 = 登记载体。每项含：浏览器/项目、测试标题、复现次数、最小日志、隔离后是否消失、建议 owner + 处置选项。
> 复跑环境：Windows 本机、Playwright 1.62.1、chromium-1243 / firefox-1538、tip `8e3c853f`（but branch wave-1011-round3）。
> 探针脚本：`.scratch/wave10-1011-grill/probes/ff-native-input-probe.mjs`、`ext-liveness-probe.mjs`（可复跑）。

## 基线复跑结果（本轮新测）

| 车道 | 命令 | 结果 |
|---|---|---|
| chromium-extension 全量 | `node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts --project=chromium-extension` | **355 passed / 1 skipped / 0 failed**（2.9m） |
| firefox-extension 全量 | 同上 `--project=firefox-extension` | **351 passed / 5 skipped / 0 failed**（3.4m） |

> 口径漂移实证（即项④动机）：Round-2 报告记 "Chromium 356 passed"，今复跑为 355+1skip——`test.skip(true)`（data-golden undici 行，2026-09-11 起就在）此前未被计入 skip 栏，历史报告把总数 356 当作 passed。总分仍 356，结论无实质翻转，但口径已漂移。

### Firefox 5 个 skipped 的精确身份（--reporter=json 抽取）

| # | spec | 测试标题 | skip 形态 |
|---|---|---|---|
| 1 | boxing-focus-steal | native dblclick on empty canvas center does not select text or steal focus | describe 级 `browserName==='firefox'` skip（playwright#16095 类） |
| 2 | boxing-focus-steal | native dblclick on canvas-empty title text directly | 同上 |
| 3 | boxing-focus-steal | selection cleared after renderCanvas | 同上 |
| 4 | boxing-title-select-all | D-003: mouse drag makes a partial selection (native) | 单测 `browserName==='firefox'` skip |
| 5 | boxing-data-golden | gate 3: undici keep-alive reuse across two syncs | `test.skip(true)` 无条件（MV3 fetch 无 undici 面；**非 firefox 问题**，chromium 同跳） |

---

## R3-01 Firefox native input 挂起（playwright#16095 类）现状裁决

- **浏览器/项目**：firefox-extension（headed、persistent ctx、`-no-remote`、file:// mock 车道）
- **测试标题**：上表 skip #1–#4（#5 与本项无关）
- **复现次数**：探针 3/3 轮复现 wedge（headed）；0/3（headless）
- **最小日志**（`node probes/ff-native-input-probe.mjs both`，每操作 15s 硬超时）：
  ```
  [headed] round1: move=OK drag-seq=STALL>15000ms mouse.dblclick=STALL>15000ms locator.click=OK locator.dblclick=OK
  [headed] round2: move=STALL>15000ms drag-seq=STALL ... locator.click=OK locator.dblclick=OK
  [headed] round3: move=STALL drag-seq=STALL mouse.dblclick=STALL locator.click=OK locator.dblclick=OK
  [headless] round1-3: move/drag-seq/mouse.dblclick/locator.click/locator.dblclick 全 OK
  ```
- **隔离后是否消失**：headed 车道 wedge 依旧且渐进劣化（首个 move 可过、随后全挂）；**headless 车道全净**；`locator.click/dblclick` 在 headed 下幸存（分发路径不同），但 `mouse.down/move/up` 拖拽序列无 locator 等价物。
- **处置选项**（待用户裁决，三选一或组合）：
  - A 维持现状 waiver：Chromium 保原生覆盖、Firefox 走合成孪生（focus-steal 已有）/Chromium 限定（title-select-all 已有）——零改动但 Firefox 永无原生输入证明；
  - B 新增 headless Firefox 专用 lane（`firefox-headless` project + 解 skip 条件化 `!isHeadless`）：探针已证 headless 原生输入全净，4 条 skip 可恢复真原生覆盖；代价=多一个 lane ~1min；
  - C 把可改写操作迁 locator.*：click/dblclick 可行，drag-seq（局部拖选）无等价物 → 只能覆盖一半，不推荐单用。
- **建议 owner**：agent（选项落地任一均可代办）

## R3-02 Chromium `conflict-copy-readout` 并行负载 flake

- **浏览器/项目**：chromium-extension（headed、file:// mock 车道）
- **测试标题**：`Ticket 79 — conflict-copy readout (list + single export)` 全部 4 用例（AC1/AC1-neg/AC2/AC3）
- **复现次数**：本轮 **0 次复现**——矩阵如下：
  | 跑法 | 命令要点 | 结果 |
  |---|---|---|
  | A 隔离串行 | `--workers=1 --repeat-each=10` | 40/40 |
  | B 自并行 | `--workers=4 --repeat-each=10` | 40/40 |
  | C 跨 spec 负载 | conflict+settings-persist+title-select-all `--workers=4 --repeat-each=3` | 102/102 |
  | D 全量并行 | 全 suite `--project=chromium-extension` | 355/0 内含本 spec |
- **最小日志**：无失败日志可附（零复现）；Round-2 原始签名=并行负载下偶发、隔离+重跑收敛（reports/2026-10-06-report.md §7）。
- **隔离后是否消失**：是（隔离/并行/全量均绿）——资源争用**本地未证实**；分类维持 flaky/环境性观察项。
- **备注**：`conflict-copy-readout` 不匹配 waiver-ledger NEVER_QUARANTINE 正则，但语义上属数据完整性邻近面（归档副本 UI 读出），若未来复红应先复现分界再谈豁免。
- **建议 owner**：agent（观察项；若用户要更严可定 CI 重复矩阵 nightly）

## R3-03 双浏览器 headed/headless 分层策略（评估项）

- **性质**：策略评估，非产品回归。
- **事实底稿**：
  - 现状：`headless:false` 全局；CI 三 OS 矩阵（ubuntu 走 xvfb-run，macos/windows 原生 headed），workers=2 CI / 4 本地；firefox 车道无扩展加载（`-no-remote` + file:// mock）；chromium 车道 `--load-extension=<repo root>` + `--allow-file-access-from-files`。
  - 本轮实测耗时（headed）：chromium 全量 2.9m、firefox 全量 3.4m。
  - 探针增量事实：headless firefox 原生输入全净（R3-01）；headless 车道与 file:// mock 的 `__boxingDebug` 活体覆盖面无冲突（mock 车道本来就不是真扩展上下文，headedness 不影响其断言面）。
  - 真实扩展启动覆盖现状：chromium 车道 `--load-extension` 已提供（本轮 ext-liveness-probe 在 dist 产物上再证 SW+NTP+__boxingDebug 全活）；firefox 车道从未加载扩展（Playwright 不支持 ff 扩展装载），真实 firefox 启动靠 web-ext/人工。
- **决策点**（待用户裁决）：是否引入 headless lane 缩减耗时/解锁 R3-01-B；是否保持主 lane headed（headed 捕捉窗口管理器类 bug——R3-01 就是 headed-only 缺陷，全转 headless 会失去这类 bug 的暴露面）。
- **建议 owner**：agent 提案 + 用户定夺

## R3-04 证据口径自动化（实施项）

- **性质**：测试基建改进。
- **缺口**：当前无结构化结果产物入库——主 config `reporter:'html'`，行尾手抄 pass/fail/skip 进报告；`.last-run.json` 只进 CI artifact；waiver 台账（WORKFLOW §4.4 表）与单次 run 计数无桥接。口径漂移已在 R3 基线实证（356 vs 355+1）。
- **已实证机制**：`--reporter=json` 输出完整结构化结果（本登记 §"Firefox 5 skipped 身份"即由 json reporter 抽取，stats: expected/skipped/unexpected/flaky）。
- **方案轮廓**（待确认后实施）：`scripts/test-evidence.mjs`——包裹 playwright json reporter + `git rev-parse HEAD` + 项目名 + waiver 台账行快照 + 计时 → 产出标准化 evidence 块（markdown 表）供报告直接引用；可作为 `test-mutex.mjs` 的可选 wrapper 或独立 post-run 脚本。
- **建议 owner**：agent

---

## 验收闭环（本轮，零源码改动）

| 标准 | 证据 |
|---|---|
| 编译通过 | `node --check ntp/ntp.js && node --check background.js` exit 0 |
| 打包通过 | `npm run build` → DONE_BUILD；chrome zip/crx + firefox zip/xpi 产出；[STALE_DIST] 自动重建 |
| 启动并测活 | chromium：ext-liveness-probe → extensionId 出现、NTP chrome-extension:// 起、`__boxingDebug` live、#canvas 在、0 console error → **LIVENESS: PASS**；firefox：`web-ext run --firefox=<playwright binary>` → "Installed as a temporary add-on"+真 firefox 进程 → PASS（注：本机无系统 Firefox，用 playwright 二进制代；用户侧 about:debugging 路径不变） |
| 每平台 test 闭环 | chromium 355+1skip/0；firefox 351+5skip/0（skip 全部已登记身份） |

## 下一步（§6 流程）

逐条请用户裁决：R3-01 选 A/B/C；R3-02 维持观察或加 nightly 矩阵；R3-03 是否引 headless lane；R3-04 是否实施 test-evidence.mjs。确认条目进 decision-ledger（新 D-xxx）+ spec 后再实施。P-19/P-20 暂不评估。
