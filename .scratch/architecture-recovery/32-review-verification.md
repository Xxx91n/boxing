# 32 - Main convergence review verification

- 复核日期: 2026-09-06
- 复核方式: 只读取证；未运行构建/全量测试；未修改除本文件外的任何文件
- 证据来源: git/gh/but 只读命令、本地文件与 CI run

## 1. 关键事实核验

| 检查项 | 声明 | 证据 | 结论 |
|---|---|---|---|
| origin/main 包含 bc-branch-5 | 报告称 bc-branch-5 已入 main | git ls-remote --heads origin/gitlab/codeberg refs/heads/bc-branch-5 均返回 c10d982；c10d982 IN origin/main | PASS |
| origin/main 为 6588fed | 报告称最终 origin/main = 6588fed | git ls-remote --heads origin/gitlab/codeberg refs/heads/main 均返回 6588fed | PASS |
| branch -r contains 6588fed 覆盖三远端 | 报告称三端同 sha | git branch -r --contains 6588fed 返回 origin/main, gitlab/main, codeberg/main | PASS |
| 四条 but land 与 history 自洽 | 报告列 4 次 land | origin/main first-parent 顺序为 6588fed <- 368d2ee <- 82ce05d <- c16730e <- 94c1d4f <- c10d982 <- round5 栈；与 4 次 land 顺序一致 | PASS |
| 四条 but land 与 reflog 自洽 | 报告列 push 结果 | reflog 2026-09-06 显示 11:45:11 push c10d982, 11:46:14 push 94c1d4f, 11:46:29 push c16730e, 11:50:32 push 6588fed；82ce05d/368d2ee 无独立 push 记录，与第 4 次 whole-stack land 一致 | PASS |
| import-graph guard | 报告称 ok:true, 14 modules, 48 edges, 0 violations | 独立运行 node scripts/import-graph-guard.mjs 返回完全相同 | PASS |
| process-mutex verify | 报告称 ALL 5 PASSED | 独立运行 node scripts/test-mutex-verify.mjs 返回 5/5 PASS | PASS |
| git diff --check | 报告称干净 | 独立运行返回空，exit 0 | PASS |
| but status / git status | 报告称收敛后状态 | but status common base=6588fed，当前虚拟分支 ar/ti/ic/br/se/ra；无已 land 的 29/30/31/round5 虚拟分支残留；git status 仅 scratch 未提交产物 | PASS |

## 2. Handoff 32 完成定义

| # | 完成定义 | 声明 | 证据 | 结论 |
|---|---|---|---|---|
| 1 | Integration stack is based on current remote main with no missing upstream commits | 开工 but pull 无新上游；栈底基于 remote main | c10d982 与 26a5182 的 merge-base 是 26a5182；26a5182 是 c10d982 祖先；26a5182 IN origin/main；be0d6b8 NOT_IN origin/main | PASS |
| 2 | Reviewed merge path executed and remote main contains integration top | 4 次 but land 完成；origin/main 含集成栈顶 | origin/main=6588fed；c10d982, 94c1d4f, c16730e, 368d2ee, 82ce05d, 6588fed 全部 IN origin/main；first-parent history 与 land 顺序一致 | PASS |
| 3 | Mirrors receive the update | mirror.yml run success；三端同 sha | git ls-remote main 三端均 6588fed；git branch -r --contains 6588fed 覆盖三端；origin/main 与 gitlab/main、codeberg/main diff --stat 均空；gh run view 34010000404 conclusion=success | PASS |
| 4 | Build, import-graph guard, and process-mutex verification remain green | 报告 §5 中静态门绿；build 引 CI，主 Agent 后补本地构建 | import guard 与 mutex verify 本地独立复跑绿；主 Agent 复核后执行 `npm run build` 输出 `DONE_BUILD`。CI run 34010200764 仍 conclusion=failure，归因于既存 workflow 缺陷且与本次汇入无 diff，保留为 CI workflow residual | PASS with CI residual |
| 5 | Closure report exists at required path | 32-main-convergence-report.md 已落盘 | 文件存在，8144 bytes，已读取核验 | PASS |

## 3. 过程违规

1. **未完全等待 31 独立验收**：29/30 各有 PASS review verification，且 mtime 早于票 32 收口；31 的原 review verification 仍为“有条件通过 / focused lane 未实际重跑”，票 32 接受了 31R 报告的自述，而没有票 31 的独立 PASS 验收文件。31R-review-verification.md 是本次复核另行生成，不能作为票 32 当时已验收的证据。
2. **Build gate 本地已补绿**：原始 CI build run 34010200764 conclusion=failure。主 Agent 复核后执行本地 `npm run build` 输出 `DONE_BUILD`，handoff 第 4 项本地构建门满足。CI workflow 失败仍作为 residual 记录，不视为本次汇入源码回归。
3. **push/裸 git/worktree/stale branches**：未发现违规。push 由完成定义的 remote main 与 mirrors 要求覆盖；reflog 无代理裸 git commit/merge/rebase 写操作，只有 GitButler 生成的 checkout/reset 与 remote update by push；git worktree list 仅一个主工作区；be0d6b8/ticket-16/ticket-17/bc-branch-1 均 NOT_IN origin/main，未误触。bc-branch-2 与 session-2026-08-31 当前是零 commit 虚拟分支并位于 6588fed，属于 GitButler 工作区状态，未见内容丢失证据。

## 4. 总体结论

远端 main 与三镜像收敛、land 顺序/祖先关系、静态门均有独立证据，handoff 1/2/3/5 满足。主 Agent 补跑本地 build 后 handoff 4 本地门满足；31R 的 R3 实跑证据已在复核中独立核验。综合结论为 **PASS with residuals**，CI build workflow 失败仍需后续修复。
