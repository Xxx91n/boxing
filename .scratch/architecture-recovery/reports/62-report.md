# 报告 — 62 Git 历史声明（条件）（P2）

- 日期: 2026-09-12
- 票: issues/62-git-history-declaration.md（覆盖 A-016 · Status: ready-for-agent → done）
- 执行授权: 用户通过 /goal 派发本票启动器（prompts/62-git-history-declaration.md）。
- 版本控制: 遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR）。

## 判定（AC-1）：仓库是否已有正式历史/证据链声明

**结论：无。** 判定证据（全部为工具实测，非幻觉）：

1. `grep -rn -iE '历史声明|证据链|history declaration|evidence chain|历史重写|history.surgery|force push' docs/ README.md` → 零命中。
2. 全仓 `git ls-files | grep -iE "declaration|历史"` → 零命中（无任何声明命名文件）。
3. CONTRIBUTING.md / SECURITY.md 存在但无 history/rewrite 相关行；docs/adr/ 18 个 ADR 中无 git 历史声明类 ADR（0009 数据韧性、0017 发行门禁均非历史声明）。
4. 散落的非正式记录存在但不成声明：票45/58 教训表（WORKFLOW.md §6「历史以远端为准」）、报告 35（发布面核验）、报告 48/49（CI run URL 引用）、报告 58（本地 main ref 对齐）。

## 处置（AC-3 分支：无 → 最小声明）

声明落点：`docs/history/README.md`（历史层 README，正 reader 是需要历史语境的 agent 与人）。

新增 `## Git history declaration (ticket 62, 2026-09-12)` 一节，两段式最小声明：

- **Authoritative history**：唯一权威历史线 = GitHub `origin/main`；本地 ref 与 GitButler workspace commit 可再生、永不为真源；禁 force-push / 历史手术；既有事实引用（票 58：六条陈旧重复 commit 以 patch-id 零内容损失方式消除）。
- **CI run URLs**：CI 证据 = `https://github.com/Xxx91n/boxing/actions/runs/<id>` run 页 + artifact 成对引用；URL 在仓库存续期可解析但不保证在历史重写下存活；当前具名基线 run：34626507101（票 48 残红台账，WORKFLOW.md）、34641377036（票 49 G-B 人工黄金路径）；URL 悬空时在引用文档内记录替换，不改历史。

影响面：代码零改动；不改写任何提交；未动其他票文件。

## AC 核对

- [x] 先判定仓库是否已有正式历史/证据链声明 → 判定：无（证据见上节）
- [ ] 有 → （不适用：判定为无，走最小声明分支）
- [x] 无 → 增加最小声明（何处、影响哪些 CI URL），不重写历史 → docs/history/README.md 新增一节，具名两条基线 run URL
- [x] 不做 force 历史手术 → 全程仅文档追加，无任何 git 历史操作

## 验证（可复核命令结果）

| 验证 | 命令/检查 | 结果 |
|---|---|---|
| BOM | 首字节读取 | `23 20 64`（# d），无 EF BB BF，UTF-8 无 BOM |
| CRLF | `\r\n` 计数 | 0（repo LF 契约保持） |
| git diff --check | 空白错误扫描 | clean |
| diff 范围 | `git diff --stat -- docs/history/README.md` | 1 file changed, +20/-0（纯追加，无删除/改写） |
| 片段断言 | 写后回读 | 'Git history declaration (ticket 62' / '34626507101' / '34641377036' / 'Authoritative history' 全部在位 |
| issue AC 勾选 | 回读断言 | 3 项 [x]，AC2（有→分支）保持未勾（不适用） |

## 调研来源

本票无新增调研问题（判定类票，_atomcode_ 不适用）；复用已索引结论并在文中注明：
- Wave5/6/7 已索引 atomcode 结论：报告 35（authoritative publication surface 核验，evidence chain closed）、报告 48/49（CI run URL 引用现状）。
- WORKFLOW.md §6 票 45/58 教训（历史以远端为准）为本声明的事实基础，非新调研。

## 残余风险

- 声明落历史层 README（docs/history/），不在 README.md 主页——如需对外可见可后置主 README 链接（非本票范围，不擅自扩面）。
- CI run URL 长期存续依赖仓库存续；声明已写明悬空处置（引用文档内记录替换）。
