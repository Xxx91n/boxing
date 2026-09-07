# 33 — Documentation and stale-branch reconciliation — Read-only review verification

- 复核日期: 2026-09-06
- 工作目录: `D:/Aworker/crx/boxing`
- 复核方式: 只读 `git` / `but` / Node；未修改本文件外的任何文件；未 push / commit / merge；未运行 build / 全量测试

## 0. 总体结论

票 33 的远端事实与本地修复大体成立：三镜像 `main` 均为 `6588fed`，README 单语言选择器、截图反忽略规则、5 张 PNG 跟踪、summary 矛盾修正、backlog 重算均得到独立证据。但报告自身存在两处硬伤：closure commit 被写成已悬空的 `27a984d`（实际分支头是 `f457746`），且 `.scratch/architecture-recovery/README.md` 状态表更新仍未提交。综合结论：**PASS with residuals（文档/分支对账本体通过，报告自述与过程门有缺口）**。

## 1. 关键事实核验

| 检查项 | 报告声明 | 复核证据 | 结论 |
|---|---|---|---|
| 三远端 `main` 仍为 `6588fed` | 三镜像 `main` 均 `6588fed` | `git ls-remote` 对 `origin`、`gitlab`、`codeberg` 的 `refs/heads/main` 均返回 `6588fed924f1d5b689a89f460a726f95edcad458` | PASS |
| `.gitignore` 新增 store screenshot 反忽略规则，5 张 PNG 可跟踪 | 已加 negation，5 PNG 已跟踪；远端仍有悬空引用 | 工作树 `.gitignore` 72-77 行含 `**/screenshot*.png`、`**/screenshot*.jpg` 及两条 `!docs/store-assets/screenshots/screenshot-*`；`git check-ignore -v` 对 5 PNG 无输出（未被忽略）；`git ls-files docs/store-assets/screenshots` 含 README + 5 PNG；`a8d37bf` 中 5 PNG 均为新增 | PASS（本地已提交，远端未落地属已记录的 residual） |
| `origin/main:README.md` 只有一个语言选择器 | 一个 selector，无重复 footer 块 | `git show origin/main:README.md` 的 `Languages:` 仅 1 行；`README-I18N` 出现 2 次（同一块的 START/END）。round6 报告所称 origin/main 重复 footer 块为 stale | PASS |
| round5 summary 的 “Nothing was pushed” 矛盾已删/修正 | 已替换为带证据的 dated correction | 工作树 summary 第 28 行只保留修正引用，不再是原断言；`git grep -n 'Nothing was pushed'` 仅 1 命中（即修正引文）。`origin/main:...summary` 第 26 行仍保留原句，与未 push 的 residual 一致 | PASS（本地已修，远端未落地） |
| backlog 已按证据重算 | 4 项 resolved + 1 项新发现，逐项引证 | 抽查：`quarantine-ref` 在 `test/playwright.quarantine.config.ts` 无命中；`README.md:178` 存在 Host-environment incident register；`origin/main:package-lock.json` 版本为 `2026.8.21`、lockfileVersion 3（非 3.7.0）；24R 修复报告存在且已跟踪；`.gitignore:72` 确为 `**/screenshot*.png` | PASS（核心证据成立，见下方计数不精确项） |
| stale branches disposition 只记录/保留，未擅自删除或改写历史 | 全部 RETAIN，未删除/改写 | 各分支仍存在且 SHA 与报告一致：`bc-branch-1`=`b920349`、本地 `main`=`be0d6b8`、`ticket-16`=`ddca844`、`ticket-17`=`e1dee80`、`arch-recovery-32`=`e097fbe`；`git diff --name-status 6588fed f457746` 无 `D`；33 分支在三个远端均无 head（未 push） | PASS（观察范围内无删除/改写） |
| `but status`、`git status --short`、`git branch -a -vv`、`git diff --check` | 已执行 | `git diff --check` 干净 exit 0；`but status` 显示 common base `6588fed`、虚拟分支 `ar [arch-recovery-33-docs-reconciliation]`；`git status --short` 显示 `M .scratch/architecture-recovery/README.md`、若干 `??` scratch 文件及 `D dev-chrome` | PASS（diff 检查干净；状态与报告 §7 的未提交 README 描述一致） |
| 两 commit `a8d37bf`、`27a984d` 存在且范围正确 | 两个 scoped commit，均基于 `6588fed` | `a8d37bf` 存在，父提交 `6588fed`，范围 = .gitignore + summary + backlog + 5 PNG，正确。`27a984d` 存在但父提交为 `a8d37bf`，且 `git branch -a --contains 27a984d` 为空（悬空）；实际分支头 `arch-recovery-33-docs-reconciliation`=`f457746`（父 `a8d37bf`，report 124 行 + issue），是 `27a984d` 的 9 行修订版 | PARTIAL（`a8d37bf` 正确；closure commit 记错 SHA，`27a984d` 已悬空） |

### 1.1 证据细节

- `git ls-files docs/store-assets/screenshots` 返回 6 项：`README.md` + `screenshot-1-canvas.png` 至 `screenshot-5-bookmarks.png`。
- `git ls-tree origin/main -- docs/store-assets/screenshots/` 只返回 `README.md`，确认远端仍无 5 PNG。
- `origin/main:README.md` 仅引用 `screenshot-1` 与 `screenshot-2`（各 2 次），工作树 README 引用全部 5 张。backlog 中 “five store screenshots … default-branch README rendered broken images” 的计数不精确：默认分支实际只引用 2 张，工作树分支才引用 5 张。
- 33 分支未推送到任何远端：`git ls-remote --heads origin|gitlab|codeberg arch-recovery-33-docs-reconciliation` 均无输出。

## 2. Handoff 33 完成定义

| 完成定义 | 声明 | 证据 | 结论 |
|---|---|---|---|
| User decision for each stale local branch is recorded and applied | 每分支 RETAIN，未做破坏性操作 | 报告 §3 表格；各分支仍存在；33 分支 diff 无删除；三远端无 33 分支 | PASS（决策来源为 launcher 指令 + WORKFLOW §4.2，非逐分支显式用户裁决，来源偏弱） |
| The pushed-state contradiction is removed | 已替换修正 | 工作树 summary 仅保留修正引文；远端仍为旧句直到 push | PASS（本地完成，远端 residual） |
| Default README keeps one language selector and real screenshot references | 单 selector；截图引用修复并跟踪 | 工作树与 origin/main 均 1 个 `Languages:`；5 PNG 已跟踪；工作树 README 引用 5 张；远端引用 2 张且 PNG 悬空 | PASS with residual（远端落地等待 push） |
| Status table and backlog are recomputed from evidence | 已重算 | backlog 四项 resolved 证据抽查通过；issue 状态 done；status table 行 33 已写入磁盘 | PASS（但 status table 更新未提交，见过程违规） |
| Closure report exists at required path | 文件存在 | `33-docs-branch-reconciliation-report.md` 存在，9895 bytes，124 行，UTF-8 无 BOM | PASS |

## 3. 过程违规

1. **未等 32 验收**：票 33 报告 §1 以 status table 的 `done-with-residual` 自述作为开启依据，未引用任何 32 独立验收。`32-review-verification.md` 当前为 `??` 未跟踪、从未提交，票 33 报告也未引用它。虽该文件磁盘 mtime 早于 33 提交，但它不构成已提交的验收门。结论：存在过程缺口。

2. **越权提交**：未发现 push / PR（三远端均无 33 分支 head），提交 committer 为 `GitButler <gitbutler@gitbutler.com>`，机制符合 WORKFLOW §4.2。但在 32 独立验收未落盘时即提交，且报告把 closure commit 记为已悬空的 `27a984d`，实际分支头是 `f457746`；报告称“两 commit 均直接基于 6588fed”对 `27a984d` 不成立（其父为 `a8d37bf`）。结论：提交门未闭合且自述失实。

3. **裸 git**：三个 33 相关 commit 的 committer 均为 GitButler；未发现裸 git commit / merge / rebase 写操作。报告取证使用只读 `git ls-remote/show/ls-tree/check-ignore/cherry`，非写违规。结论：未发现裸 git 写违规。

4. **worktree**：`git worktree list` 仅返回 `D:/Aworker/crx/boxing 04a42bf [gitbutler/workspace]` 一个主工作区。结论：未发现 worktree 违规。

5. **删除未核实工作**：所有 stale branches 均保留且 SHA 与报告一致；`git diff --name-status 6588fed f457746` 无 `D`。工作树 `D dev-chrome` 未提交且无证据归属票 33。结论：未发现票 33 删除/改写未核实工作。

6. **未落 README 状态**：报告 §7 自认 `.scratch/architecture-recovery/README.md` 的 status-table 更新留在未提交 hunk；`git status --short` 显示 `M .scratch/architecture-recovery/README.md`，`git diff --name-only 6588fed f457746` 也不含该文件。结论：status table 重算只在工作树，未落入 33 提交，属未完成项。

## 4. 其他发现

- 报告 §2 称 workspace tip 为 `499f2ef`；当前 HEAD 为 `04a42bf`（GitButler Workspace Commit，6 个父提交）。`499f2ef` 存在但是较早的 workspace commit，报告描述已不是当前状态。
- 报告 §7 的 commit 自述与实际分支头不一致：`27a984d` 已悬空，真实 closure commit 为 `f457746`。

## 5. 总体结论

票 33 对三远端 `6588fed`、README 单语言入口、截图反忽略与 5 PNG 跟踪、summary 矛盾修正、backlog 重算、stale branches 保留等核心交付均有独立只读证据，handoff 完成定义 5 项全部通过或带 residual。需修正/补交的是报告自身 commit SHA 与 workspace tip 自述，以及未提交的 `.scratch/architecture-recovery/README.md` 状态更新。未发现 push / PR / worktree / 裸 git 写操作 / 删除未核实工作。
