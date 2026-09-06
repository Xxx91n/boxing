# 31R — State-sync focused-lane rerun — Verification Report

- 生成: 2026-09-06
- 任务书: prompts/31-state-sync-flaky-diagnosis-rework.md (31R) + prompts/32-main-convergence.md (同窗口常驻任务书)
- 票: issues/31-state-sync-flaky-diagnosis.md (Status: needs-rework → done, 同轮落盘)
- 复核缺口闭合对象: 31-review-verification.md §2#2 — focused state-sync lane 未被票 31 实际重跑
- 版本控制: WORKFLOW §4.2 (GitButler but CLI, 独立分支, 不 push)

## 1. 执行记录 (test-mutex 包裹, node.js 入口, 全部实跑)

三次执行, 均从仓库根以单层 node 入口运行 (无嵌套 shell/heredoc), 均经 scripts/test-mutex.mjs 包裹; 工作树 = round5 栈顶 + round6 治理栈 (含票 29 lockfile 修复) + zz 文档的 union:

| # | 命令 (互斥包裹内) | 结果 | exit | 时长 |
|---|---|---|---|---|
| R1 主跑 | node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts test/tests/boxing-state-sync.spec.ts --project=chromium-extension | 7 passed / 2 failed | 1 | 3.0m |
| R2 收敛 | 同 R1 + --last-failed (票 15 协议) | 2 passed | 0 | 4.1s |
| R3 终验 | 同 R1 (干净全车道) | 9 passed | 0 | 13.3s |

- mutex 前置探测: lock free (无持有者, 无 stale recovery 行); 三次执行互不重叠, exit 75 拒绝语义未触发。
- test-results/.last-run.json (R3 后): status=passed, failedTests=[]。

## 2. R1 两失败的定谳 (environment-only, 与登记事件同类)

- 失败对: boxing-state-sync.spec.ts:115 (reload restores this tab view instead of shared last-active memory) 与 :129 (new tab restores last persisted view without consuming another tab refresh state)。
- 签名: TimeoutError: browserType.launch: Timeout 180000ms exceeded (ms-playwright/chromium-1234/chrome-win64) — 浏览器启动超时, 非 state-sync 断言失败。
- 关键对照: 三个已登记 host-incident 多标签测试 (:144 / :167 / :222) 在 R1 全绿; R2 立即收敛 (4.1s); R3 干净跑全绿 (13.3s) — 受害名单轮换 + 同代码秒级翻转, 与票 01/13/15/18/27 语料的宿主饱和签名一致 (README host-environment incident register 2026-09-05 事件同类)。
- 定谳: environment-only 瞬时宿主饱和, 非应用缺陷; 零产品/测试代码改动; 不新增登记 (与既有登记同类, 到期日维持 2026-10-06, 不自动延长)。
- 附注: R1 覆写 playwright-report/ 本地工件 (gitignored); 其 09-05 残留证据已在 31-review-verification.md 完成只读核验并记录于案, 覆写不损失已归档结论。

## 3. 完成定义逐项 (31R delta + handoff 31 #2)

| # | 要求 | 证据 | 结论 |
|---|---|---|---|
| 1 | 必须实际执行 focused state-sync lane, 不得用历史全量证据替代 | §1 三次实跑 (R1/R2/R3), 非引用存档 | PASS |
| 2 | 执行命令必须经 test-mutex 包裹, 禁止多窗口无互斥并发 | §1, node scripts/test-mutex.mjs playwright ... 包裹, preflight lock free | PASS |
| 3 | focused state-sync lane green | R3 单跑 9/9 passed exit 0; R1+R2 双跑覆盖 9/9 (票 15 协议) | PASS |
| 4 | issue 31 Status 改为 done | issues/31: **Status:** done (本报告同轮落盘; issue 文件按票 24-25-26 复核惯例保持 zz 未提交) | PASS |
| 5 | host-incident 到期日不自动延长 | README 登记本票零触碰, Due 2026-10-06 维持 | PASS |
| 6 | 报告落盘于指定路径 | 本文件 (.scratch/architecture-recovery/31-state-sync-focused-rerun-report.md) | PASS |

## 4. 约束遵循声明

- CI-only 政策 (2026-09-04) 与本票的关系: 31R 启动器与用户启动器均显式要求本窗口用 test-mutex 实际执行 focused state-sync lane, 该显式授权构成本地执行依据; CI-only 默认 (权威复跑归 CI) 不废 — 远端 main 落地后 test.yml 首次绿仍是登记行删除依据 (票 32 落地后取得)。
- 零代码改动: ntp/ background.js manifest.json test/ 全程未触碰; 本票产物仅本报告 + issue 31 状态行。
- WORKFLOW §4.2: 本报告经 but commit 落独立分支 arch-recovery-31r-focused-rerun, 不 push; zz 中 issue/handoff/prompt 与他窗产物不卷入提交 (票 05 hunk 认领教训)。

## 5. 残余 (报大脑)

1. CI 绿证据仍缺: README 登记行的删除条件 = CI chromium 车道绿 (绑定票 29 lockfile 修复), 取得路径 = 票 32 落地 main 后的 test.yml run; 本报告三跑为本地实跑证据, 不替代 CI 复验, 也不延长到期日。
2. R1 型宿主饱和在多窗口并行期持续存在 (R1 与其他窗口并行作业同宿主); 后续遇满载假失败按票 15 协议 (last-failed 收敛 + solo 终验) 处理, 勿怀疑代码。
