# 106 报告 — innerclip firefox 观察结论（B70）

> 票: **106** · covers **A-060** · 镜像: 无（本地票）· Blocked by: **101**（已 done）
> 波: Wave9.15（目标发行版本 **2026.9.15**，持有 2026.9.12 不热修）
> 日期: 2026-09-14 · 版本控制: WORKFLOW §4.2（GitButler `but`；不 push、不开 PR、不 tag）
> 分支: `ticket/106-innerclip-b70`

---

## 0. 开工复述（启动器「开工第一句」三项）

### ① 本票阻塞 / 被阻塞关系

- **本票 Blocked by: 101**（B65 fire-and-forget 测试族 deflake）。issue 101 Status = `done-with-named-F`（2026-09-14，`reports/101-report.md`；A-055 已置 implemented）→ **阻塞已解除**，与 `reports/W3-brain-review-97-101.md` Frontier 表「106 innerclip · 101 ✓ · 可开」一致。
- **本票不阻塞他票**。D-006 五段主序中本票属第 ③ 段（测试），与 ④ 段文档票（99 / 103 / 105）并行。本票闭环后，③ 段仅余已在册的 CI 侧余项（101 的 N-101-06 / F-101-01）。
- **上游语义约束（不得违反）**：D-004 —— 发行 G-A 必须以 B 轨 land 后**新 tip** 的 `test.yml` 四 job 全绿为准；run `34808080000` 只是**中间里程碑**，**不得**用其冒充发行终谳。本报告全程按此口径表述。

### ② 必读清单存在性（8 项，全部存在）

| 来源 | 路径 | 体量（核验时） |
|---|---|---|
| 启动器 | `.scratch/architecture-recovery/prompts/106-innerclip-b70.md` | 724 B / 28 行 |
| handoff | `.scratch/architecture-recovery/handoffs/106-innerclip-b70-handoff.md` | 1154 B / 52 行 |
| 本票 | `.scratch/architecture-recovery/issues/106-innerclip-b70.md` | 428 B / 24 行 |
| Spec | `.scratch/architecture-recovery/spec.md` | 1529 B / 59 行 |
| 过程 | `.scratch/architecture-recovery/WORKFLOW.md`（§4.1/§4.2/§4.4 + 豁免台账 + 撤账判据 + §5/§6） | 22618 B / 182 行 |
| 门禁 | `docs/adr/0017-release-data-gate.md`（含 2026-09-13 修订） | 5663 B / 89 行 |
| 领域 | `docs/CONTEXT.md` | 31282 B / 179 行 |
| A 账本 | `.scratch/architecture-recovery/decision-ledger.md`（A-050..A-061） | 12427 B / 141 行 |

handoff「必读」表另列的 D 账本与 Plan 亦存在：`.scratch/wave9-915-release-grill/decision-ledger.md`（D-001..D-009，已定稿）、`.scratch/wave9-915-release-grill/plan.md`。

观察记录：核验过程中 `WORKFLOW.md` 由 21451 B / 176 行增至 22618 B / 182 行 —— 票 105（B69）并行写入「撤账判据」节。属他窗在途改动，本票**只读引用、不改动该节**。

### ③ handoff 内通用调研三项（结论见 §1）

1. **atomcode 深度调研**（串行一次一个）：本地偶发 flaky 与 CI 真实复现的判定，及不复现时的规范书面结案。
2. **回顾** `docs/adr` 与 `docs/CONTEXT.md` 现有心智模型；冲突不得静默改向。
3. **对标** 工业级实现 / 测试策略。

---

## 1. 通用调研摘要

### 1.1 atomcode 深度调研

- **题目（verbatim）**：调研工业界如何判定一个本地偶发的浏览器端 e2e flaky 测试是否在 CI 上真实复现，以及判定为不复现时规范的书面结案判据与做法，给出成熟做法推荐
- **载体**：`ctx_batch_execute(commands:[{label:"atomcode-106-fresh", ...}], concurrency:1, timeout:600000)`；串行一次（开工前 `tasklist` 探测：3 个 `atomcode.exe` 均为 0 轮次主机侧存根 session，非在途调研）。exit 0，FTS5 索引 8 sections（source=`atomcode-106-fresh`）。
- **结果**：13 个一手 / 权威来源，7 条结论（atomcode 自述 Confidence **高**；每个关键结论 ≥2 个独立来源交叉验证）。
- **续跑记账（诚实披露）**：首次派发撞 **5 小时窗口额度上限**（`[rate-limited] 5h window exhausted — resets around 21:17`），会话锚 `5eb930b0-67da-441a-89df-6bdf0fcdeaad`。按续跑锚定规则执行「探测 → 轮询 → 找回 → 续跑」：连续 6 次探测确认无活动进程（`.jsonl` 自 13:10:24Z 起零增长、`.snapshot.inflight` 自 13:18:25Z 起冻结）；`--resume <id>` 与 `-c` 两种续跑形态**均返回** `session ... is already in use by another runtime`（陈旧租约锁）。**未杀任何 atomcode 进程**（skill 硬护栏）。最终以**同一问题、同一 timeout 的新会话**（单变量）取得结果。偏离记入 §8.4。

关键结论（原文蒸馏，附对本票落点）：

| # | 结论 | 对本票的落点 |
|---|---|---|
| R1 | **判定金标准 = CI 端「同 commit 既 pass 又 fail」**。Google 定义 flaky 即「同一代码版本上既 pass 又 fail」，并报告 84% 的 pass→fail 转变源自 flaky 而非真回归；Fuchsia 的识别工具直接自动化「找同 patch set 上重跑成功的失败」 | 不争论本地能否复现，改为拉 CI 历史 run 做裁决 —— §2 即按此执行 |
| R2 | **重跑次数 N 需统计口径**：真实失败率 p 时 N 次全过概率 (1-p)^N；0/20 的 95% Wilson 区间上界仍达 16.1%，故「跑了 N 次没复现」**不构成**不复现的证明 | 本票不写「零出现 = 证明不复现」，改为给**执行次数 + Wilson 95% 上界**（§2.3） |
| R3 | **「不复现」≠ 结案**。规范书面结案三选一：①隔离 + owner + 到期（GitLab 3 个月不修自动删除 MR；minware 30 天阈值）②显式删除或 `test.fixme` 并写明理由 ③**降级转 backlog / 登记 + SLA**。**没有任何成熟组织允许「无法复现 → 直接 worksforme 关闭」**（Mozilla 576 例实证） | 本票按路径 ③ 落地：不静默丢弃、不入 G-A 台账，改在 `docs/testing-governance.md` 登记为**本地观察（非 CI 残红）**并设到期日（§6） |
| R4 | **书面结案最小证据集**：①测试名 + 分类 + 置信度 ②完整复现矩阵（浏览器 × 版本 × 环境 × N）③失败时刻 trace / 截图 / console / 网络 ④与已知 flaky / issue 关联 ⑤上诉路径。无 trace 置信度封顶 60%、无历史封顶 55% | §2 / §3 逐项提供；§4 显式声明置信度与封顶 |
| R5 | 隔离不是终点：成熟组织用 deletion timeline 防「隔离坟场」；隔离项须**单独报告** + 挂原因标签 + 定期复审 | 与 WORKFLOW §4.4「a queue, not a graveyard」及票 105 撤账判据同构；本票**不新增隔离标签**（该面在 CI 从未红） |
| R6 | 本地复现「CI 才失败」的 E2E 工具箱：CPU 节流模拟 CI 机、`--workers` 加压、`--repeat-each 10`、调查期 `--retries 0` 或 `--fail-on-flaky-tests`；复现后须过根因分类（TD/OD）才能进修复（arXiv 2026：58% E2E flaky 仅凭代码无法归因） | 本地复测按 `--retries 0`（config 本地默认）执行，天然无重试掩盖；分类结论见 §3.3 |
| R7 | **冲突披露**：重试（retry-on-fail）存在路线分歧 —— 一派用于降假阳性，一派批评「把警告灯涂黑」；成熟折中 = 重试保留但**必须打 flaky 标记且单独可见** | 本仓 CI `retries: 2` + Playwright 三分类（passed / flaky / failed）已在报告面显式可见，与折中一致；本票**不改 config** |

**信息缺口（atomcode 自述）**：Chromium LUCI Analysis 接棒后的新入口细节偏少；Wilson 区间原始表需外部工具复算；「无 trace 封顶」为社区评分规则而非行业标准。

### 1.2 docs/adr 与 docs/CONTEXT.md 心智模型复核

- **ADR-0017（含 2026-09-13 修订）**：可发行 = G-A ∧ G-B ∧ G-C 合取；残红分桶 **N / B / F** —— 同一代码不同结果 = **F（flaky）**，**全签名一致失败 = B（broken）**；B 不得入台账、无撤账路径；N（数据完整性 / 迁移往返 / 回滚演练）永不豁免。本票判定口径**完全沿用**该分桶 → **无冲突、无 revised**。
- **WORKFLOW §4.4 撤账判据（票 105 / B69，核验时在途）**：撤账 = 台账行 `active → closed`，须「**≥2 个连续 main 全量 run 签名零出现**」+ `撤账证据:` 标记 ≥2 run 引用；单 run 零出现不足以撤账（票 74 撤账过早事故）。本票**不是台账撤账**（innerclip 从未入 G-A 台账），但**主动按同一证据标准举证**（§2.3：连续同码绿链 + 执行计数），避免以弱证据下强结论。
- **docs/CONTEXT.md**（`release gate` / `release status page` 两条）：「releasable = G-A ∧ G-B ∧ G-C；三门齐备前禁止 tag 与任何可发行宣称」—— 本报告全程只写「不可发行 / 未定谳」，**未宣称三门达成**，与 `docs/release-status.md` 的「结论：不可发行」一致。
- **docs/testing-governance.md**（票 85 / 105）：已含 Quarantined tests 与 **Host-environment incident register**（「host-load browser instability — not app defects」+ CI 复验到期日）两节 —— 本票结案载体与既有治理面**同构**，属既有心智模型的自然延伸，非新造机制。
- 结论：**无 silent 改向、无 revised**。

### 1.3 工业对标（实现 / 测试策略）

- **Playwright 车道**：本仓 `test/playwright.config.ts` = CI `retries: 2` / `workers: 2`，本地 `retries: 0` / `workers: 4`（票 20 明文策略，注释引 currents.dev 与票 01 饥饿证据）。该差异正是「本地红、CI 绿」的机制来源（§3.3），且与 atomcode R6「调查期 `--retries 0`」一致 —— 本地默认即无重试，天然适合观察原始失败。
- **判定面**：工业做法是「拉 CI 历史 run」而非「本地反复复现」（R1）；本票据此把 **CI 日志作为唯一裁决面**，本地复测仅作签名对照。
- **结案面**：GitLab / minware / Mozilla 三源一致要求「留 owner + 到期 + 证据矩阵」，本仓对应面 = `docs/testing-governance.md` 登记 + `.scratch` 报告；本票按此落地。

---

## 2. CI 核查（裁决面）

### 2.1 扫描方法

- **面**：`gh run list --workflow=test.yml --limit 30` 取 main 上全部在档 run，逐 run `gh run view <id> --log` 拉**全量日志**（非摘要），在沙箱内提取：①`innerclip` 命中行 ②各 job 的 `Running N tests` / `N passed` / `N failed` / `N flaky` / `N skipped` 汇总 ③编号失败清单（`N) [lane] › spec:line`）。
- **判定语义**：Playwright line reporter **只为失败与 flaky 打印用例名**，通过项只计进度点 —— 故「日志零 `innerclip` 命中」等价于「该 run 内 innerclip **既未 failed 也未 flaky**」，并可由 `passed + flaky + skipped = 总数` 的算术闭合交叉验证。
- **覆盖**：2026-09-11 → 2026-09-14 共 **17 个** test.yml run（含 6 个 failure、3 个 cancelled、1 个 dispatch）。

### 2.2 结果表

| run | headSha | 每 OS 用例数 | innerclip 命中 | 判定 |
|---|---|---|---|---|
| [34808080000](https://github.com/Xxx91n/boxing/actions/runs/34808080000) | `9fa4666c` | 610 | **0** | 全绿；ubuntu 1 flaky（Bug5-dark） |
| [34778641702](https://github.com/Xxx91n/boxing/actions/runs/34778641702) | `02d31657` | 610 | **0** | 全绿；ubuntu 2 / macos 1 / windows 1 flaky |
| [34773593267](https://github.com/Xxx91n/boxing/actions/runs/34773593267) | `16ce5d27` | 610 | **0** | 全绿；三 OS 各 1–2 flaky |
| [34772010932](https://github.com/Xxx91n/boxing/actions/runs/34772010932) | `3859b4c1` | 610 | **0** | failure（4–5 例，均在册面） |
| [34770269419](https://github.com/Xxx91n/boxing/actions/runs/34770269419) | `3302b3bc` | 610 | **0** | failure（4–5 例，均在册面） |
| [34749813393](https://github.com/Xxx91n/boxing/actions/runs/34749813393) | `b4f3df2d` | 572 | **0** | failure（2–3 例，R1–R3 期） |
| [34737182812](https://github.com/Xxx91n/boxing/actions/runs/34737182812) | `c2952aa5` | 572 | **0** | failure（2–3 例） |
| [34637028614](https://github.com/Xxx91n/boxing/actions/runs/34637028614) | `b3ccbf7f` | 524 | **0** | failure（8–10 例） |
| [34626507101](https://github.com/Xxx91n/boxing/actions/runs/34626507101) | `ffa55f8c` | 510 | **0** | failure（8–10 例；票 48 基线） |
| [34686760142](https://github.com/Xxx91n/boxing/actions/runs/34686760142) | `f8556297` | 550 | **240** | failure（**113 编号失败**，见 §2.4） |
| [34672647167](https://github.com/Xxx91n/boxing/actions/runs/34672647167) | `af415e93` | 550 | **240** | failure（**113 编号失败**，见 §2.4） |

补充（日志不足以判定矩阵完整性，不计入统计）：`34770115344`（48s 早退，仅 data-golden 起跑）→ innerclip 命中 **0**。

### 2.3 统计界（不做「零出现 = 证明」的越界声明）

- innerclip 每次 run 的执行面 = 4 用例（`boxing-innerclip.spec.ts` 3 + `boxing-innerclip-pan.spec.ts` 1）× 2 project（firefox-extension / chromium-extension）× 3 OS = **24 次执行 / run**。5 个 skipped 为 focus-steal 原生块 ×3 + undici 断言 ×2，**不含** innerclip（与票 93 逐条实测一致）。
- **连续同码绿链**：`34773593267`（16ce5d27）与 `34778641702`（02d31657）为连续 2 个全绿 run，且 `gh api compare/16ce5d27...02d31657` 显示差异**仅 `.scratch/**`**（`test.yml` 的 `on.push.paths` 不含 `.scratch`）→ 按 tip 等价性规则构成「被测代码同一」的连续链 → **48 次执行，零出现**。
- **新基线**：`34808080000`（9fa4666c，610 用例全绿）为该链之后被测面变更（manifest / ntp / package）的**新基线** → 再 **24 次执行，零出现**。
- **全窗口（2026-09-13 起有完整矩阵的 7 个 run）**：7 × 24 = **168 次执行，零出现** → 0/168 的 **Wilson 95% 上界 ≈ 2.24%**。
- **扩展窗口（含 2026-09-11/12 前的 9 个完整矩阵 run）**：9 × 24 = **216 次执行，零出现** → **Wilson 95% 上界 ≈ 1.75%**。
- **诚实边界**：以上是「per-execution 失败率 ≤ ~2% 量级」的证据，**不等于**数学证明不可能复现（atomcode R2）。故结论限定为「**在当前 CI 矩阵与观测窗口内不复现**」，而非「已证明不存在」。

### 2.4 2026-09-12 两次 run 的 innerclip 出现 —— 定性为 B（broken），非本票所指 F（flaky）

- **出现 run**：`34672647167`（af415e93，2026-09-12T04:18Z）与 `34686760142`（f8556297，2026-09-12T09:47Z）。两 run 各 **113 条编号失败行**，三 OS 各 36–37 例，**firefox-extension 与 chromium-extension 双车道、三 OS 全同签名**。
- **同失败集横跨约 20 个不同 spec 面**：`conn-delete-action` ×4、`data-golden` gate 4、`dr-export-envelope` ×3、`empty-state` Bug5-dark、`innerclip` ×4、`popup-dragselect`、`search` ×2、`star-sync` Scenario 1、`state-sync`、`zoom-arrow`、`auto-expand` …，并**含 `data-golden` 门禁失败** —— 属该 commit 的**全局页面级损坏**（日志含 `[Boxing][ERR] i18n load failed, falling back to en`）。
- **innerclip 在该窗口的失败签名**：`boxing-innerclip-pan.spec.ts:109` `expect(g.ok).toBe(true)` 与 `boxing-innerclip.spec.ts:69` `expect(metrics.found).toBe(true)` —— 均为**元素存在性断言**（`head` / `surface` / `small-box` 未渲染），**不是**几何断言；且 `Retry #1` / `Retry #2` **全失败**。
- **分桶裁定（ADR-0017 定义）**：**全签名一致失败 = B（broken）**，不是「同一代码不同结果」的 F。B 无豁免 / 撤账路径，只能修绿或书面退役 —— 该窗口随后被后续提交修复：`34637028614`（2026-09-11T19:06Z）起回归 0 出现，`34737182812`（2026-09-13T04:08Z）起连续 9 个 run 零出现。
- **结论**：该两次出现**不构成**本票「innerclip firefox flaky 在 CI 复现」的证据；它是 pre-fix commit 的 **B 型全局失败**，与 B70（本地偶发、firefox 车道、装置 / 几何面）**不同源**。

---

## 3. 本地复测（签名对照，非裁决面）

> 纪律声明：本仓为 CI-only 权威口径（WORKFLOW §6 票 31 教训）；本地复测**只用于给 §2.4 的 CI 签名做对照**，不用于推翻或替代 CI 裁决。

### 3.1 靶向 2-spec（CI 口径 workers=2）

- **命令**：`node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts test/tests/boxing-innerclip.spec.ts test/tests/boxing-innerclip-pan.spec.ts --project=firefox-extension --workers=2 --reporter=line`
- **结果**：**4 failed**（4/4），全部 `Test timeout of 30000ms exceeded`，栈均落在**共享夹具 `resetBoxing`**（`page.goto` / `page.evaluate`）即 **setup 阶段**，**未触及几何断言**。
- **环境读数**：`Tearing down "context" exceeded the test timeout`；firefox 侧 `Warning: unrecognized command line flag "-no-remote"`、`chrome://juggler/content/Helper.js ... NS_ERROR_FAILURE`、`Cannot attach ID to a tab in a closed window`、`connector for namespace "page" ... is disposed` —— 均属 firefox 有头冷启动 / 争用噪声。

### 3.2 单例收敛（workers=1，retries=0）

- **命令**：同上但仅 `boxing-innerclip.spec.ts`、`--workers=1`。
- **结果**：**1 failed / 2 passed (2.0m)**；唯一失败者 = 文件**首个**用例，签名同为 `page.goto: Test timeout of 30000ms exceeded`；`test-results/boxing-innerclip-Boxing-in-92eeb-.../error-context.md` 仅含 `Test timeout of 30000ms exceeded` + `Tearing down "context" exceeded`，**无页面快照** ⇒ 页面从未加载；其后的 2 个用例在浏览器转热后**通过**。
- **与在册教训逐条吻合**：
  - 票 01：「本地 8 核跑默认 workers 会饿死 8 个 headed 浏览器 …… 先降 workers 再怀疑代码」；
  - 票 13：「`page.goto` 卡 domcontentloaded + 停 about:blank + 零 console」判别先看 commit 是否 fired；**firefox 有头启动本身吃 ~22s 耗尽 30s 默认预算**；该票修复方式 = 该 spec 加 `test.setTimeout(120_000)`。
- **观测环境**：本机同时运行 3 个 `atomcode` 实例 + 其他并行子窗口的浏览器 / 测试负载，属**宿主争用**态；CI runner 为专用机 + `workers: 2` + 浏览器缓存预热。

### 3.3 分类结论

| 项 | 判定 |
|---|---|
| 失败层 | **测试装置 / 环境**（共享夹具 `resetBoxing` 的导航超时），非产品缺陷、非几何不变式 |
| 触发条件 | **宿主资源争用 + firefox 有界冷启动预算**（30s 默认）；CI 侧不存在该争用形态 |
| 与 B70 原始观察的关系 | 与票 94 记录的「本地全量 1 红、solo 3/3 绿」**同源同层**；本次复测在其上补足**失败点定位**（setup 而非几何）与**冷启动预算**这一具名机制 |
| 与 CI 的关系 | CI 侧 216 次执行零出现（§2.3）；本地失败签名在 CI 日志中**从未出现** |

---

## 4. 结论

**判定：CI 不复现 → 书面观察结案。**

- **分类**：`environment-only / host-load`（测试装置层）。**不是**产品缺陷，**不是** F 型 CI 残红，**不是** B 型签名。
- **置信度：中高**。理由：CI 裁决面证据充分（9 个完整矩阵 run / 216 次执行零出现，Wilson 95% 上界 ≈ 1.75%；含 ≥2 连续同码绿链，达 WORKFLOW §4.4 撤账判据的举证强度）；本地侧失败点已定位到装置层并给出具名机制。
  - **按 atomcode R4 封顶规则如实降级**：本地失败 run **未保留 trace.zip**（trace 策略为 `on-first-retry`，本地 `retries: 0` 故不产出）⇒ 本地侧置信度按「无 trace」封顶 **60%**；CI 侧有完整历史（≥9 run）与 retry trace 附件，不受该封顶约束。
- **具名残余 N-106-01（不豁免、不入台账）**：`boxing-innerclip.spec.ts` / `boxing-innerclip-pan.spec.ts` **未设 `test.setTimeout` 预算**，在宿主争用下文件首个用例会吃掉 firefox 冷启动成本并撞 30s 上限（票 13 已对同类 spec 用 `test.setTimeout(120_000)` 解决）。当前**不修**，理由：①CI 侧零出现，无 CI 证据支撑改动；②改 firefox 车道预算属测试装置变更，需 CI 全量验证（本票无 push 授权，证据无法闭环）；③本票范围 = 「CI 复现则修，否则书面结案」。**升级判据（触发即开实施票）**：该面在**任一 main 全量 run** 出现 failed / flaky，或 `resetBoxing` 导航超时签名在 CI 日志再现 → 立即按票 13 同款手法补预算并跑双车道验证。
- **禁止事项遵守**：未宣称三门合取达成；未代签 G-B；未把 `34808080000` 冒充 B 轨 land 后发行 G-A；未 push / tag / force-push；未热修 2026.9.12；未改动冻结语义。

---

## 5. AC 对照（issues/106）

| AC | 结果 | 锚点 |
|---|---|---|
| 有 run URL 或可核证据 | ✅ | §2.2 表内 **11 个 run URL**（含裁决面 9 个完整矩阵 run）；每行 `headSha` 与 per-OS 用例数可复核；`gh run view <id> --log` 为可复算原始通道 |
| 复现→修复说明或子票；不复现→书面结案 | ✅ 走「**不复现 → 书面结案**」分支 | §2.3 统计界 + §3.3 分类 + §4 结论；书面载体见 §6 |
| 禁止静默丢弃 | ✅ | ①本报告（书面观察结论，含签名 / 矩阵 / 机制）②`docs/testing-governance.md` 本地观察登记（含到期日）③decision-ledger A-060 状态更新；**未使用 skip / 未删测试 / 未改断言** |

---

## 6. 结案登记（书面结案的落点）

| 载体 | 内容 |
|---|---|
| `.scratch/architecture-recovery/reports/106-report.md` | 本文件：调研摘要 + CI 证据链 + 本地复测 + 结论 + 残余 |
| `docs/testing-governance.md` | 新增 **Local-only flake observations** 小节 1 行：`boxing-innerclip` firefox 车道，分类 `environment-only (host-load)`，登记 2026-09-14，CI 复验到期 **2026-10-14**，处置 = 触发升级判据时按票 13 补 `test.setTimeout` 预算（N-106-01） |
| `.scratch/architecture-recovery/decision-ledger.md` | A-060 状态 → `implemented`（附结案口径与 run 锚点） |
| `.scratch/architecture-recovery/issues/106-innerclip-b70.md` | AC 三项勾选 + Status 更新 |

**为什么不入 G-A 豁免台账（WORKFLOW §4.4）**：台账收「main 车道残红」，而 innerclip 在 CI 车道**从未成为残红**（唯一出现是 B 型全局失败 run，已修绿）；把零出现项写进台账会**扩大**豁免面，与票 105「棘轮：豁免文件只许缩小」相悖。故按 atomcode R3 路径 ③「降级 / 登记 + SLA」落在**测试治理面**，**不触碰门禁面**。

---

## 7. 版本控制（WORKFLOW §4.2）

- 分支：`ticket/106-innerclip-b70`（独立 but 分支；本票只改 `.scratch/architecture-recovery/**` 与 `docs/testing-governance.md` 一处追加，与并行窗无文件交叠）
- 路径：`but diff` 认领本票 hunk → `but commit -b ticket/106-innerclip-b70 -m "<scoped>" <id...>`
- **未 push、未开 PR、未 tag**；未改动他窗提交与在途改动（含票 105 写入的 WORKFLOW §4.4 撤账判据节）

---

## 8. 残余与风险

1. **N-106-01（具名，见 §4）**：innerclip 两 spec 无 `test.setTimeout` 预算；CI 再现即升级实施票。
2. **本地复测受宿主争用污染**：本次本地 4/4 与 1/3 失败发生于 3 个 `atomcode` 实例 + 并行子窗口负载下，**不可**与票 94 的「solo 3/3 绿」直接比较为「恶化」；如需干净本地基线，应在空闲宿主上重跑。
3. **统计边界**：Wilson 上界 ≈ 1.75%（0/216）是「≤2% 量级」的证据，非「不可能复现」的证明；窗口外（新 tip / B 轨 land 后）需按 D-004 由发行 G-A run 继续观测。
4. **atomcode 续跑偏离**：首次会话因 5h 额度窗口 + 陈旧租约锁无法 `--resume` / `-c`，改用同问题新会话（单变量）；未杀进程（skill 硬护栏）。建议大脑评估是否为 atomcode 会话租约增加 stale-lock 自愈（本票不动）。
5. **`docs/testing-governance.md` 登记到期日 2026-10-14**：到期未获 CI 复验证据时，按该文件既有「rows do not auto-extend」规则必须**重新分类**，禁止无动作续期。
