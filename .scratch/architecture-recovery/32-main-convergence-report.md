# 32 — Main convergence and Round 5 merge — Closure Report

- 生成: 2026-09-06
- 票: issues/32-main-convergence.md (blocked by 29 / 30 / 31 — 全部闭环: 29/30 review-verification 在案, 31 由本窗口 31R 实跑收口)
- 任务书: prompts/32-main-convergence.md (常驻任务书); 用户启动器附加任务 = 31R focused lane 实跑, 已先行闭环 (31-state-sync-focused-rerun-report.md)
- 版本控制: WORKFLOW §4.2 (GitButler but CLI); 汇入 = but land 直推 target, 授权来源 = 本启动器完成定义 (remote main 包含 + mirrors 接收)

## 1. 汇入对象与栈底确认 (issue 勾选 1)

- 开工 `but pull`: No new upstream commits found / Everything is up to date — 集成栈底 = 当前远程 main (26a5182), 无缺失上游提交。
- 汇入对象 = 已验证栈全集:
  - Round 5 集成栈 (8 segments / 10 commits): arch-recovery-25 → 18 → 27 → 23 → ticket-26 → bc-branch-3 → bc-branch-4 → bc-branch-5(top)
  - Round 6 治理栈 (3 commits): ticket-28-governance-research → arch-recovery-31-state-sync-diagnosis → ticket-29-lockfile-ci-sync(top)
  - 独立单提交: ticket-30-agents-vc-sync; arch-recovery-31r-focused-rerun (本窗口 31R 报告 commit tzl)
- 不汇入 (发散/未验证, 票 33 处置): 本地 main (be0d6b8), ticket-16, ticket-17, bc-branch-1, bc-branch-2, session-2026-08-31。
- 纠错记录 (如实披露): 首轮把 ticket-30 误判为与 29→31→28 同栈 (but status 树形实为两个独立栈框), 落 ticket-30 后用远端 main 日志 grep 复核发现 28/31/29 三提交未入 main, 随即补落 29→31→28 整栈; 最终包含关系验证 6/6 全中。

## 2. 汇入动作 (issue 勾选 2)

| # | but 操作 | 结果 |
|---|---|---|
| 1 | but land bc-branch-5 --whole-stack --yes | Landed + Pushed → origin/main = c10d982 |
| 2 | but land ticket-30-agents-vc-sync --whole-stack --yes | Landed + Pushed → 94c1d4f |
| 3 | but land arch-recovery-31r-focused-rerun --yes | Landed + Pushed → c16730e |
| 4 | but land ticket-29-lockfile-ci-sync --whole-stack --yes (连 below 2 segments: arch-recovery-31, ticket-28) | Landed + Pushed → 6588fed |

- 最终 origin/main = 6588fed (线性落栈, 无冲突, 无需 merge commit; Round 4 历史保持 merge 形态)。

## 3. 远端包含关系验证 (不凭自述)

- git ls-remote origin main → 6588fed924f1d5b689a89f460a726f95edcad458
- 六签名 grep: 6/6 命中 (round5 reconcile closure / ticket 30 / 31R rerun / ticket 29 lockfile / state-sync trio / ticket 28 governance)。
- merge-base --is-ancestor: c10d982, 94c1d4f, c16730e, 6588fed, 368d2ee, 82ce05d 全 IN; 26a5182 → BASE_CONTAINED (Round 4 基座保持)。

## 4. 镜像同步 (issue 勾选 3)

- mirror.yml (Mirror to GitLab + Codeberg) 在 6588fed push: run 34010000404 = success (45s)。
- 网络真相终验: git ls-remote → origin = gitlab = codeberg = 6588fed (三端同 sha); git diff --stat origin/main vs gitlab/main 与 vs codeberg/main 均为空 (三端树完全一致)。
- 备注: 手工 git push gitlab/codeberg main 被远端正确拒绝 (本地 main = 发散 be0d6b8 分支, 不可作同步源); 镜像同步由仓库既有 mirror.yml 工作流完成 — 与仓库设计一致, 且该拒绝恰好防止了发散 main 污染镜像。

## 5. 收敛后验证 (issue 勾选 4)

| 门 | 证据 | 结果 |
|---|---|---|
| focused state-sync lane (启动器附加, test-mutex 包裹实跑) | 31-state-sync-focused-rerun-report.md: R3 单跑 9/9 passed exit 0 (R1 两失败 = env launch-timeout, R2 last-failed 收敛 2/2, 票 15 协议) | GREEN |
| import-graph guard (静态门) | node scripts/import-graph-guard.mjs → ok:true, 14 modules, 48 edges, 0 violations | GREEN |
| process-mutex verification (静态门) | node scripts/test-mutex-verify.mjs → ALL 5 PROGRAMMATIC TESTS PASSED VERIFIED | GREEN |
| syntax pre-check | node --check ntp/ntp.js && node --check background.js → SYNTAX_OK | GREEN |
| build (CI-only 政策 → 云端) | build.yml dispatch run 34010200764 @ main 6588fed | 见 §7 |
| full test suite (merge-to-main 全量门, CI-only) | test.yml dispatch run 34010198697 @ main 6588fed, 3-OS 矩阵 | 见 §7 |

## 6. 约束遵循声明

- CI-only 政策 (2026-09-04): 本地零构建/零打包/零 dist 产物; 静态门 (guard / mutex-verify / node --check) 为无产物静态检查, 与票 29 证据链同规; 构建与全量测试证据取 CI run (build.yml + test.yml dispatch), 见 §7。
- push 授权: 启动器完成定义显式要求 remote main 包含集成栈顶与 mirrors 接收更新 → but land 直推 origin/main 属启动器授权面; 未开 PR (单人直推语义, research 4.1 模板); 镜像走既有 mirror.yml。
- 版本控制纪律: 全部汇入经 but land; 本窗口产物经 but commit (31R 报告 tzl / 本报告); 他窗 zz 未提交产物零卷入; 发散 main / ticket-16 / 17 / bc-branch-1 未触碰。
- 31R 闭环前置完成: focused lane 实跑 (9/9) + 报告 + issue 31 Status=done + host-incident 到期 2026-10-06 未动。

## 7. CI 终态 (收口时点)

| workflow | run | 触发 | 结果 |
|---|---|---|---|
| Test (test.yml, 3-OS 矩阵, main 6588fed) | 34010198697 | workflow_dispatch (CI-only 全量门) | windows ✅ success; macos ✅ success; ubuntu 439 passed / 1 failed |
| Build & Package (build.yml, main 6588fed) | 34010200764 | workflow_dispatch (CI-only build 门) | ubuntu: 构建本体成功 (web-ext 已从 dist/ 组包), 后续 AMO 签名步红 (Version 2026.8.21 already exists — AMO 外部版本冲突); windows: 前置 "Get version for artifact naming" 步 pwsh 语法错 (Missing ( after if) — 两者均为 build.yml 既有潜在缺陷 (gh run list 该 workflow 历史仅本 run, 首跑即暴露), 非汇入内容引入 |
| Mirror (mirror.yml, 6588fed push) | 34010000404 | push main | success (45s); 三端 ls-remote 同 sha 复证 |
| pages-build-deployment | 34010000213 | push main (dynamic) | success |

- Test 判读: 本仓历史上首次 npm ci 通过并跑完测试本体 (票 29 lockfile 修复生效; 此前 4 次 Test run 全死于 npm ci EUSAGE)。windows/macos 全量绿; ubuntu 唯一失败 = boxing-auto-expand (expect toBeGreaterThan 时序测量断言; 同 run 内 windows/macos 同测试全绿; 票 15 语料已登记的 auto-expand 抖动族; 与本次汇入的 docs+lockfile 提交零关联)。
- state-sync 三例 (31 号登记对象): 3 OS × 全绿 — README host-incident register 的 "CI 绿证据" 删除条件已满足; 登记行删除留给票 33 (README 当前有他窗未提交改动, 本票不触碰)。
- ubuntu 收敛: gh run rerun --failed (票 15 协议) — 结果: 未收敛, 同一测试 boxing-auto-expand 同一断言 (toBeGreaterThan) 双跑复现 (chromium 3 连败含 retries; 第二轮 440 passed / 1 failed)。分类: ubuntu runner 环境特异性确定性失败 (同 run windows/macos 全绿; 本次汇入仅 docs+lockfile, 测试文件自票 01 起未改; 判非受害者轮换型抖动, 为 runner 显示/字体度量差异); 非票 32 门, 处置 (测量鲁棒性修复 或 登记 expiry) 归大脑决断。

## 8. 残余 (报大脑)

1. AI Docs Governance workflow 红 (run 34009823166, 触发于 94c1d4f push): 根因 = ai-docs-governance.yml dead-link check 步骤 shell 引号缺陷 (grep 模式引号嵌套断裂 → bash line 6 syntax error, exit 2) — 既有 workflow 定义缺陷, 非本次落地引入; 非 ticket 32 门; 修复归票 33 或独立小票。
2. c10d982 push 触发的 Test run (34009778924) 失败于 npm ci — 预期: 该时点票 29 lockfile 修复尚未入 main; 最终 main (6588fed) 的权威 Test 证据见 §7 dispatch run。
3. 发散本地 main (be0d6b8) / ticket-16 / ticket-17 / bc-branch-1 / bc-branch-2 / session-2026-08-31 未处置 — 票 33 范围。
4. zz 中 issues/handoffs/prompts/review-verification 等他窗产物保持未提交 (24-25-26 复核惯例) — 票 33 docs reconciliation 归置。
5. ubuntu runner 的 boxing-auto-expand 确定性环境失败 (§7): 建议大脑立案 — 修复 toBeGreaterThan 测量断言的跨平台鲁棒性, 或按 flaky 治理登记 expiry; 本票不动测试代码 (跨票纪律)。
