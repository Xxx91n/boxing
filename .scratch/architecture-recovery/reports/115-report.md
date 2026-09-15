# 115 Report — B77 CHANGELOG 9.15 扩写

> Ticket 115 · Covers **A-070** · Boxing Wave9.20 实施子窗口 · 2026-09-15
> 基线 tip `a1acaaac` 线性追加（D-005②）· 版本控制遵循 WORKFLOW §4.2 · 目标版本 2026.9.20
> 报告结构: §1 通用调研摘要（先于实现）→ §2 实现与裁定 → §3 AC 对照 → §4 验证锚点 → §5 风险与具名 N 项

## §1 通用调研摘要（handoff「每票必做一次」三项）

### 1.1 atomcode 串行深度调研

| 项 | 值 |
|---|---|
| 载体 | `atomcode -p` 单问（未附角度/键名/域名提示，遵 skill 禁令）；`ctx_batch_execute` 包裹，`concurrency: 1`，`timeout: 600000` |
| 串行前提 | 本会话仅此一次 atomcode 调用（serial guardrail，无并行派发） |
| 问题（verbatim） | 「Industry best practice for maintaining a Keep-a-Changelog-style CHANGELOG.md in lockstep with per-release GitHub/store release notes: what content belongs in the changelog entry vs the release notes, how complete each section should be, and what verification/checklist process mature projects use to keep them aligned without duplicating or fabricating」 |
| 证据规模 | KaC 2.0.0 原文 + Common Changelog + git-lfs issue #4210 + donner/beagle/Nautobot 发布清单 + k8s/release#4381 + eesel/structured-changelog 实践调研；多源交叉，Confidence 高 |

**结论落摘（atomcode 原文分点）**

1. **SSOT 分工**：CHANGELOG.md 是完整、持续、面向所有人的**记录**（record）；GitHub/商店 Release Notes 是单次发布的**公告**（announcement）。KaC 2.0.0 官方立场——release notes 从 changelog **派生**而非双份维护；host 生成的 notes 是 vendor lock-in（「你离开那天就丢了」）。
2. **完整性红线**（KaC 反模式 "Inconsistent Changes"）：只记部分变化的 changelog 和没有一样危险——每个已发布版本必须有条目、notable 全覆盖；完整性 = notable 全覆盖 + 格式一致，**非逐 commit 罗列**（commit log 噪音明确禁止，Common Changelog §4.1）。
3. **允许不对称，禁止失同步**：release notes 可有 changelog 没有的升级步骤/动机叙述；changelog 可有用户不关心的细节。**失同步的定义 = 同一事实两处矛盾或一漏一有**——本票的「对齐」即按此口径核验。
4. **验证硬门禁**（donner/beagle/Nautobot/k8s 实证）：changelog 小节先于 tag 提交；release notes 内容取自 changelog 小节拷贝；自动化产出须有独立 ground-truth 命令对账（k8s first-parent 漏 PR 教训）。
5. **防编造三条纪律**：输入只取 curated 层（本票 = `docs/release-notes/2026.9.15.md`）；生成即草稿、人审即发布；数字/事实对账防工具静默吞变更。

**本票采用（推荐与理由）**：形态 A「CHANGELOG.md 为源」。9.15 已发行、release-notes 已存在 → 扩写方向 = 把 notes 全部要点**回写**进 changelog 小节（消除「一漏一有」），changelog 保持全量记录侧；新增内容 100% 可在 notes 逐字溯源（防编造纪律①），不新增 notes 之外的事实。

### 1.2 现有心智模型回顾（ADR / CONTEXT.md）与冲突审计

| 记录 | 内容 | 与本票关系 |
|---|---|---|
| ADR-0017 | 三门合取才可发行；三门未齐前禁 tag、禁宣称可发行 | 本票纯文档层扩写，不宣称任何门禁状态；Install 段新增 ADR-0017 指引与既有 Unreleased 段引用一致 |
| docs/CONTEXT.md `release gate` / `release status page` | 状态唯一权威 = release-status.md | 本票不动 release-status.md（A-068 / 票 113 面），零边界踩踏 |
| CHANGELOG.md 文件头 | Keep a Changelog 格式 + CalVer（自 2026.8.21） | 扩写沿用既有小节结构（Fixed/Improved/Internal/Install）与英文文案风格 |
| D-006 / A-P03 | 禁 agent 代签 G-B；9.15 不热修；未明令不 tag/push | 本票零触碰：不 tag、不 push、不改 9.15 商店包 |
| A-P01 | tip 仅在 a1acaaac 之上线性追加 | 本票提交为栈顶线性追加，无 root 导出 |

**冲突审计结论：零 revised**。本票不改变任何既有决策方向；CHANGELOG 扩写属事实补全（对齐 curated notes），不涉心智模型改向。

### 1.3 工业对标（实现与测试策略）

| 维度 | 工业做法（atomcode 核验） | Boxing 对齐动作 |
|---|---|---|
| SSOT 方向 | CHANGELOG 为源，notes 派生（KaC 2.0.0 / Common Changelog / git-lfs 实证） | notes 要点回写 changelog 小节，消除一漏一有 |
| 完整性 | notable 全覆盖；每个已发行版本有条目（KaC 红线） | §3 逐条对账表覆盖 notes 全部 12 要点 |
| 防编造 | 输入只取 curated 层，禁 raw diff 直喂 | 新增行逐条溯源 release-notes；零 ticket 号/版本号杜撰 |
| 验证 | 发布前 fact 对账 + compare 链接校验 + diff 检查 | §4：逐条对账表 + `git diff --check` + 字节级 LF/BOM 核验 |

## §2 实现与裁定

**编辑对象**：`CHANGELOG.md` `## [2026.9.15]` 小节，且仅该小节（Unreleased / 9.12 及以下零触碰）。

**扩写 delta（每条 → release-notes 溯源）**：

- 小节导语：notes 首段「一次稳定性收口：跨标签星标同步修复、暗色对比度达标、WebDAV 同步升级为三路合并」→ 英文导语一句
- Fixed ①：星标同步条原文保留（已对齐）
- Fixed ②：补「empty canvas/box states」与「visible and clickable」（notes：空画布/空盒子…看得见也点得到）
- Fixed ③：补「on hover」语义（notes：悬停收起后重新进入）
- Fixed ④：具名 `.local`（notes：`.local` 等内网/本机地址…网址校验与导出路径）
- Improved：冲突副本落点具名「settings Data tab 可查看导出」（notes：可在 设置 → 数据区 查看与导出）
- Internal：一行拆三条——既有 e2e/凭据行保留；新增「主 lane 绿 + 残红台账仅剩具名 flaky」（notes 内部①）；新增「发行 zip 不再打包 .scratch 工作日志（打包卫生）」（notes 内部②）
- Install：新增「不再提供 .xpi/.crx，签名与更新由商店负责」；新增「`npm ci && npm run build` 本地构建 + 商店源码审核包 + 侧载 zip + `SHA256SUMS.txt` 校验」；新增「ADR-0017 门禁背景 + 文档区检查单」

## §3 AC 对照（issues/115-changelog-915-b77.md）

| AC | 状态 | 证据 |
|---|---|---|
| 与 docs/release-notes/2026.9.15.md 要点对齐扩写 | **达成** | 下方 12 行逐条对账表，notes 要点 100% 落位 |
| 不虚构未落地功能 | **达成** | 全部新增/改写行可在 release-notes 逐字溯源；无 ticket 号、版本号、功能名杜撰 |

**逐条对账表（notes 要点 → CHANGELOG 落点）**

| # | release-notes 要点 | CHANGELOG [2026.9.15] 落点 |
|---|---|---|
| 1 | 首段导语「一次稳定性收口」 | 小节导语（新增） |
| 2 | 跨标签星标同步 | Fixed 条 1（原有，已对齐） |
| 3 | 暗色空态按钮 7.73:1/4.45:1 | Fixed 条 2（扩写空态范围+可见可点） |
| 4 | 收起后再进入自动展开 | Fixed 条 3（补 hover 语义） |
| 5 | WebDAV 私网 .local opt-in 全链路 | Fixed 条 4（具名 .local + export path） |
| 6 | 三路合并 + 冲突副本 设置→数据区 查看导出 | Improved（落点具名 settings Data tab） |
| 7 | 首开零闪现 e2e + 凭据占位清扫 | Internal 条 1（原有） |
| 8 | CI 主 lane 全绿（含 data-golden）+ 残红仅具名 flaky | Internal 条 2（台账半句新增） |
| 9 | 不再提供 .xpi/.crx；签名与更新由商店负责 | Install 条 3（新增） |
| 10 | npm ci && npm run build；审核包 + 侧载 zip；SHA256SUMS | Install 条 4/5（新增） |
| 11 | ADR-0017 背景 + 发布检查单在文档区 | Install 条 6（新增） |
| 12 | 发行 zip 不打包 .scratch（打包卫生） | Internal 条 3（新增） |

## §4 验证锚点

- **diff 范围**：`CHANGELOG.md` 仅 [2026.9.15] 小节（commit numstat +37/-7；单 hunk @@ -16,22 +16,30 @@）
- **空白完整性**：`git diff --check` 对 CHANGELOG.md 零告警（diff --check 输出的 spec.md 行尾空格 / ledger EOF 空行两条属其他窗口在途改动，非本票文件）
- **字节完整性**：写入后核验 UTF-8 无 BOM、0 CRLF / 202 LF、9808 B（Node fs 字节级核验）
- **结构核验**：小节四段 Fixed/Improved/Internal/Install 齐；新增链接与既有条目同形（AMO/Edge/GitHub/privacy/ADR-0017）
- **账本**：A-070 → implemented；issue 115 Status → done + AC 双勾；README 波次表 115 行 → done
- **版本控制**：commit `wwy`（cb129b2f）@ `ticket/115-changelog-915-b77`（WORKFLOW §4.2；栈顶线性追加于 a1acaaac 之上，未 push/未 PR）

## §5 风险与具名 N 项

- 纯文档改动，零代码面风险。
- 与票 116（A-071 calver 9.20）边界：本票只扩写 [2026.9.15] 既有小节；[Unreleased] 段与 9.20 版本面属票 116 范围，未触碰。
- 具名残余：**无新增 N 项**。notes 中「签名与更新由商店负责」等句按原文语义转写，未超出 curated 源。

## §6 跨窗口收编披露（诚实记账）

- 本票 ledger 行（A-070）与票 109 在途的 A-064 行、票 113 在途的 A-068 行同处一个 hunk 区。为只收编本票行，按 gitbutler skill 的 same-hunk 隔离配方执行：临时把工作区 ledger 还原为 committed 基线 + 仅 A-070 改动 → commit → 再还原他窗口行。
- 竞态实报：隔离→提交之间票 109 窗口把 A-064 行翻为 implemented 落入同一 hunk，**被一并收进 commit wwy**。内容正确（即 109 窗口本意），唯归属记账在本票 commit 下。判据： surgical 剥离需 uncommit 整文件再隔离，竞态窗口更大且可能波及 113 仍在途的 A-068；保留 + 披露为低损选择。
- 票 113 的 A-068 行已按备份逐字还原为在途改动（but diff sq 现仅含 A-068 一条，归属正常）。
