# 报告 — 58 本地 main ref 与 origin/main 对齐（P2）

- 日期: 2026-09-12
- 票: issues/58-local-main-ref-align.md（覆盖 A-010 · Status: ready-for-agent → done）
- 执行授权: 用户通过 /goal 派发本票启动器（prompts/58-local-main-ref-align.md），授权实施本票对齐动作。

## 前后 ref（AC-4）

| 项 | 对齐前 | 对齐后 |
|---|---|---|
| 本地 `refs/heads/main` | `be0d6b887d93fad7c6bd2d147c01bf4c96d13e2f`（`docs(publishing): fill in Xxx91n placeholder in Pages URL`） | `ffa55f8ca27ae947a19578c86cad838b92e46a53`（`docs(t44): close-out report + issue 44 done`） |
| `origin/main` | `ffa55f8ca27ae947a19578c86cad838b92e46a53` | 同左（未动） |
| 分叉计数 `main...origin/main` | `6  175`（本地独有 6，远端独有 175） | `0  0` |

## 对齐动作（AC-2 可核验）

- 命令: `git update-ref refs/heads/main ffa55f8ca27ae947a19578c86cad838b92e46a53 be0d6b887d93fad7c6bd2d147c01bf4c96d13e2f`（CAS：旧值不匹配即拒绝）。
- 核验: `git rev-parse main origin/main` 两值相等；`git rev-list --left-right --count main...origin/main` = `0 0`。工作树文件未变（对齐的是 ref 指针，非检出内容）。

## 零内容损失证据（AC-3 未做破坏性重写）

本地 main 独有的 6 个提交逐对核验，全部为已推送改写件的内容重复（2026-08-22 README/publishing 批次曾以不同 SHA 重新推送）：

| 本地独有 | origin 对应 | patch-id |
|---|---|---|
| `00395ac` | `ec03ef4` | IDENTICAL |
| `001ec4b` | `c3b3868` | blob 级相同（24 个 docs/brand 资产 blob 全部同 hash；README 补丁实际改动相同，唯一差异为父提交上下文行——origin 父已带 TRANSLATIONS.md 后缀） |
| `c3d1aef` | `d6ff2cb` | IDENTICAL |
| `b53d2a9` | `26666a2` | IDENTICAL |
| `2b392f2` | `4234504` | IDENTICAL |
| `be0d6b8` | `3c55b1e` | IDENTICAL |

`git cherry main origin/main` 输出的 `+` 行均为该批重复件的不同 SHA 变体（origin 侧另有 5 个 `+` 条目属于远端侧独有的其他提交，不在本票范围）。

## 执行前安全检查

- `git worktree list`: 仅主工作区（HEAD=`gitbutler/workspace`），`main` 未被任何 worktree 检出 → ref 移动零检出冲突。
- GitButler 状态: `gitbutler.project.targetref=refs/remotes/origin/main`、`targetcommitid=ffa55f8…` —— 工作区本就以 origin/main 为基；陈旧本地 main 是改写推送后遗留的悬挂 ref。与票 45 教训一致（历史以远端为准）。
- 未触碰 origin/main 与任何 GitButler 虚分支（t49/t50/t51/t52/t53/t54/t55/t56/t57/t59 等均为其他票工作，未动）。

## 版本控制

遵循 WORKFLOW §4.2：`but diff` 确认改动后 `but commit` 本票报告与 issue 勾选；不 push、不开 PR。

## 残余风险

- 无。本地 main 现与 origin/main 一致；后续 `but`/CI 的 main 基线以 `ffa55f8` 为准。
- 注: ADR-0009/0017 复核日期 2026-10-12 未到，本票不涉及门禁状态变更。
