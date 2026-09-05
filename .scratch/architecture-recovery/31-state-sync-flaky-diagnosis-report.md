# 31 — Multi-tab state-sync failure diagnosis — Closure Report

- 生成: 2026-09-06 (证据采集跨 2026-09-05/06)
- 票: `.scratch/architecture-recovery/issues/31-state-sync-flaky-diagnosis.md`
- 窗口: Boxing architecture-recovery 子窗口 (票 31)
- 阻塞: 28 — Release merge and governance deep research (已闭环: `research-report-round6.md` + `28-review-verification.md` PASS with residuals; 其 §4.3 模板三为本票执行蓝图)
- 必读清单: prompts/31 + handoffs/31 + issues/31 + spec.md + WORKFLOW.md(§4.2) + round6-architecture-report.md + research-report-round6.md + test/tests/boxing-state-sync.spec.ts + test/playwright.config.ts + test/playwright.quarantine.config.ts — 全部读取; 其中 research-report-round6 (28KB) 按票31 相关面定向读取 (§0/1.1/2-矩阵B/3/4.3/6/7/8 + 全文标题图), 其余章节为票 28/29/32 模板, 非本票执行面
- 版本控制: WORKFLOW §4.2 (GitButler `but` CLI, 独立分支 `arch-recovery-31-state-sync-diagnosis`, 不 push)

## 1. 诊断对象

三个遗留多标签失败 (票 25 首报, 票 24-25-26 复核确认范围, 票 27 未触碰移交本票):

| # | 位置 | 测试标题 |
|---|---|---|
| F1 | boxing-state-sync.spec.ts:144 | two tabs synchronize creation and protect a view whose large box is deleted |
| F2 | boxing-state-sync.spec.ts:167 | concurrent creation in two tabs converges without losing either box |
| F3 | boxing-state-sync.spec.ts:222 | concurrent small-box creation converges and persists the merged children |

失败签名 (票 25 报告 §残余#1, 三种运行模式一致): `Protocol error (Runtime.callFunctionOn): Internal server error, session closed` — chromium CDP 会话在测试中途死亡。

复现模式 (票 25 实测, 2026-09-05 上午):

1. wrapper 真实车道: 86 passed / 10 failed → 归约后 3 个唯一失败 = 本三例
2. 无 wrapper 直跑基线: 6 passed / 3 failed (同三例)
3. 单测单 worker: 仍失败 (solo 也死)

## 2. 分类证据链

(research §4.3 分类先行; 票 13 教训: 用证据定谳, 不按现象幻觉推理。本票全部证据为只读采集 — 既有工件、git 只读、gh 只读查询; CI-only 政策下零本地测试执行。)

### 证据腿 1 — 应用代码同一性 (缺陷假说证伪)

- `git diff 26a5182..bc-branch-5 -- ntp/ background.js manifest.json` → 空 (round4 main ↔ round5 栈顶)
- `git diff bc-branch-5 -- ntp/ background.js manifest.json` (对工作树) → 空
- `git log --all -- test/tests/boxing-state-sync.spec.ts` → 最后改动 `16e7204` (2026-08-31, 票01 收口)
- 推论: 绿观察 (票01 gate 3×411 绿 / 票20 chromium 全量 218 passed / 票27 FIN-FULL) 与红观察 (票25) 之间, 应用运行时代码与本 spec 完全同一 — 应用缺陷假说无代码载体。

### 证据腿 2 — 同日绿红对照 (同代码 + 同宿主 + 同日)

- 2026-09-05 上午 (票25): 三例红, 三模式含 solo。
- 2026-09-05 下午 (票27 收口 FIN-FULL): `npm test` 全量 444 tests (两项目, mutex, workers=4) → 438 passed / 3 skipped / 3 failed, **state-sync 三例全绿**; 仅有的 3 失败 = `boxing-accent-theme` ×3 `browserType.launch: Timeout 180000ms` (满载资源饥饿签名, 不同文件)。
- FIN-SOLO: last-failed 收敛 3/3 绿 (7.1s); `test-results/.last-run.json` status=passed (2026-09-05 15:35)。
- 推论: 同一份代码同一天内红→绿翻转, 且红时段伴随他文件浏览器启动超时 — 满足 flaky 判定, 排除确定性应用缺陷。

### 证据腿 3 — 宿主不稳工件 (本机只读取证)

- `playwright-report/data/` 残留失败附件 (mtime 2026-09-05 14:20): 3 × `boxing-accent-theme`, `browserType.launch: Timeout 180000ms` — chromium-1234 当日存在根本起不来的时段 (宿主级)。
- `ms-playwright/chromium-1234` 构建目录 mtime 2026-08-03 (浏览器二进制无漂移)。
- 既有语料: 票01 (8 核 workers 饿死, 受害名单逐轮轮换), 票13 (firefox 有头冷启动 ~22s, pw:api 时间线判别协议), 票15 (纯文档票 firefox 37/419 假失败, last-failed 收敛 + solo 终验), 票18, 票27 残余#1 (同族现象复现: workers≥2 受害名单轮换, ≥6 个未触碰 main-lane test 假失败, solo 全绿 ×N)。

### 证据腿 4 — CI 通道现状 (权威车道证据边界)

- `gh run list --workflow test.yml`: 全部 4 次历史 run 均在 `npm ci` 步骤红 (2026-08-21 46s / 09-02 28s / 09-02 26s / 09-04 27s) — CI 从未跑到测试本体。
- lockfile 静态取证: `26a5182` 与 `bc-branch-5` 的 package-lock.json `crx3` 命中数均为 0 (缺 `crx3@1.1.3` + 6 传递依赖, 票29 修复对象); 工作树 lockfile (+98 行, crx3 命中 4) 为票29 并行窗在修的未提交状态。
- 推论: 当前任何既有远端 ref 上 test.yml 均无法通过安装, CI 聚焦复跑被票29 阻塞 — 登记到期复验 (§4), 不伪造 CI 证据, 不空耗 runner 复证已知安装红。

## 3. 分类结论

| # | 分类 | 依据 | 处置 |
|---|---|---|---|
| F1 | environment-only (宿主负载浏览器不稳事件, 2026-09-05) | 证据腿 1-4 | 治理登记, 到期 2026-10-06 |
| F2 | 同上 | 同上 | 同上 |
| F3 | 同上 | 同上 | 同上 |

- 无应用缺陷 → 本票零产品代码/测试代码改动 (票 delta: 不拿全量失败换通过 — 无需修复)。
- 不打 `@quarantine` 标签: 三例当前通过且必须留在主车道 (主 config 已无 grepInvert, 标签不再排除车道); 标签语义 = 到期 repair-or-retire 默认退役, 对宿主事件错配。登记为 README 治理表 host-incident 节行, 到期 = CI 绿证据日。

## 4. 治理登记 (落盘物)

- `README.md` `## Quarantined tests` 节新增 `### Host-environment incident register`: 三行 (Registered 2026-09-06, Due 2026-10-06)。
- 登记规则: 票29 修复 lockfile 后 CI chromium 车道绿即删行; 到期无 CI 绿证据则下次治理 pass 强制重新分类 (缺陷修复或标签隔离), 不自动延长。

## 5. 完成定义逐项验证 (handoff)

| # | 完成定义 | 证据 | 结论 |
|---|---|---|---|
| 1 | Every remaining failure has a log-backed classification | §1 签名与三种复现模式 + §2 四证据腿 + §3 逐例结论 | PASS |
| 2 | Application defects are fixed and the focused state-sync lane is green | 无应用缺陷 (证据腿 1 证伪); 聚焦车道最近一次已存档执行 = 票27 FIN-FULL (2026-09-05, 两项目全量, chromium state-sync 三例绿) + FIN-SOLO; 新鲜 CI 复跑被票29 阻塞 → §4 到期复验在案 (CI-only 政策: 子窗口不本地自证, 权威复跑归大脑) | PASS (CI 复验登记在案) |
| 3 | Environment-only remainders are registered with a due date | README host-incident 登记, Due 2026-10-06, 不自动延长 | PASS |
| 4 | Closure report exists at the required path | 本文件 | PASS |

Issue 勾选映射: 复现签名→§1; 分类→§3; 修复与车道绿→§5#2; 到期登记→§4; 聚焦车道+报告→§5#2/#4。五项全勾。

## 6. 约束遵循声明

- 本票 delta 三条: 无证据的"环境问题"结论被禁止 → 分类全部锚定四证据腿; 每个失败只能修复或登记到期 → 三例登记 2026-10-06, 无自动延长; 修复后聚焦车道复跑 → 无修复面, 车道绿取最近存档车道运行 + CI 到期复验 (不拿全量失败换通过: 零代码改动)。
- CI-only build policy (2026-09-04): 本票本地零测试/构建执行; 证据全部来自既有工件只读、git 只读、gh 只读查询。沿票25/27 先例, 权威 CI 复跑由大脑在票29 修复后执行。
- WORKFLOW §4.2: GitButler `but commit`, 独立分支, 不 push; scratch README 状态行 hunk 级认领 (票05 教训), 他窗未提交内容 (票28 残余注记行) 不卷入。
- handoff 建议 skills ($implement/$code-review/$handoff): 本会话 skill 注册表未暴露 (user-invocable 类, 人工未调用); 本票零代码改动 → implement/code-review 无适用面; 本报告承担 handoff 职能。如实登记。
- BX-EXPLORE-003: 本机无 codegraph CLI (票25 残余#3 同况); 本票改动全为文档/治理文件, 无源码符号索引漂移面。

## 7. 残余 (报大脑)

1. CI 聚焦复验阻塞于票29 (lockfile): 票29 落地并由大脑推送 CI 验证分支后, 重跑 chromium 车道 (含 state-sync 三例) 作为本登记第一次 CI 绿证据; 若红, 按登记规则重新分类。
2. 宿主负载假失败为持续风险 (票01/13/15/18/27 语料): 多窗口并行期本机浏览器车队饱和; 后续遇满载假失败按票15 协议 (last-failed 收敛 + solo 终验), 勿怀疑代码。
3. issues/31 勾选与 prompts/handoffs 保持 zz 未提交 (24-25-26 复核 §6 记录的既定惯例); 本票仅提交归属本会话的产物。
