# 103 报告 — DESIGN.md hairline 语义修订（B67 / A-057）

> 窗口：Boxing Wave9.15 实施子窗口 · ticket 103 · covers A-057
> 必读清单 7 项**全部存在**：handoff 1640 B / issue 566 B / spec.md 2194 B / WORKFLOW.md 33454 B / ADR-0017 10313 B / docs-CONTEXT.md 32044 B / decision-ledger 18080 B
> 产物：`docs/DESIGN.md`（唯一源码面改动，+56/-2）· 本报告 · 账本 A-057 置 implemented · `docs/release-status.md` 欠账行同步
> 版本控制：WORKFLOW §4.2（GitButler，独立分支，不 push 不开 PR）

## 0. 开工复述（任务书 02 要求）

| 项 | 结论 |
|---|---|
| ① 阻塞关系 | `Blocked by: 102`。实测 102 = **done**（`reports/102-report.md` AC 2/2 全勾、A-056 账本 implemented、contrast-guard 8/8）→ 阻塞已解除。本票为**纯文档面**，不触碰 102/88 的 CSS 成果。103 自身被 W4 内 99/105/106 并行，无下游票依赖 103 |
| ② 必读路径 | 7 项全部存在（见页首）；唯一缺失项为待产出的 `reports/103-report.md` |
| ③ 通用调研三项 | atomcode 深度调研 / ADR+CONTEXT 心智模型回顾 / 工业级实现与测试策略对标 —— 见 §1，先行于实现 |

## 1. 调研摘要（handoff 通用三项，先行于实现）

### 1.1 atomcode 深度调研（串行 1 次）

调研问题：*弱分隔线（divider / hairline）描边 token 与交互控件边界（control boundary）描边 token 的职责划分、命名惯例，以及防误用的文档/门禁工业做法*。
**过程如实记录**：首轮 `atomcode -p` 在成稿前命中 5h 配额窗口上限（`[rate-limited] 5h window exhausted — resets around 21:17`），按 atomcode-research skill 的续跑锚定，未重开、未并行，窗口重置后单次 `atomcode -c` 续跑成稿（Sufficiency Gate：7 searches / 5 角度 / 8 full reads）。

| # | 结论 | 来源 |
|---|---|---|
| 1 | **divider 与 control boundary 必须是两个语义契约，而非同一 token 的两种用法**。ttoss `border.divider` 契约 = “purely structural; low emphasis”；`border.outline.control` = “defines control boundary”；命名法 `{family}.{role}.{context}`（role ∈ divider|outline|ring） | ttoss Design Tokens — Borders（全文已读） |
| 2 | Carbon 用 `$border-subtle`（分隔）/ `$border-strong`（控件边界）并随层配对，content-switcher 规格表逐行分列 Border 与 Divider；Polaris v11 把复合的 `--p-border-divider` **拆解废弃**，只留颜色 alias + Divider 组件 | Carbon Color Tokens / Polaris v11 迁移表 |
| 3 | SC 1.4.11 的关键限定词是 *required to identify*：边界**不是**辨识控件的必需视觉信息时不适用；若控件有其他辨识线索（文字标签排版 / 位置 / 阴影 / 间距），边界不落入强制范围 | DigitalA11Y 逐字镜像（W3C 原文 403 未直取）+ w3c/wcag discussions #3865 |
| 4 | 透明幽灵按钮 + 唯一虚线边框 = 边框即 *required to identify* 的全部信息 → 必须 ≥3:1；**虚线本身不豁免**（dashed 只是样式变体） | 同上 + testparty 1.4.11 指南（1.6:1 的 `#cccccc` 已列为 FAIL 样例） |
| 5 | **暗色是这类误用的“显影液”**：Carbon issue #14597 真实事故 —— `$border-subtle` 层配对错位，暗色主题下与背景同值 → 边界完全隐形。与本案 1.20:1 同机理 | carbon-design-system/carbon#14597（2023-09） |
| 6 | 防误用工业门禁为三/四层递进：文档层契约表 + 决策矩阵；**构建层**在 token 解析图上做静态校验；CI 层 per-property token lint；运行时 axe 兜底 | stylelint-plugin-carbon-tokens v5 / design-lint / Atlassian ensure-design-token-usage |
| 7 | axe-core 对**非文本**边界对比度自动化能力有限（`color-contrast` 主要面向文本），因此边界把关主要责任应放在构建层 | axe 官方规则文档 + testparty |
| 8 | 本案修复选项排序：**① 换 token（推荐）** > ② 补第二示能线索（合法但依赖人工裁量、门禁守不住） > ③ 仅加粗（不治根） | 综合 |

**推荐与理由**：本仓已在 88/102 落地了**选项 ①**（换 token 配对），与调研推荐**完全一致** —— 本票据此只做文档闭环，不改 CSS。
**不采纳**：引入 stylelint / design-lint / axe-core（CRX-R-009 不新增依赖，且本票为文档票；构建层校验已由 `scripts/contrast-guard.mjs` 承担第 2 层）。

### 1.2 ADR 与 docs/CONTEXT.md 心智模型回顾 — 冲突检查

| 既有心智模型 | 与本票关系 | 是否冲突 |
|---|---|---|
| ADR-0008 三层 token；暗色只覆盖 Layer 2 语义层、组件 CSS 不逐主题分支 | 本票在**语义层契约**上写清 hairline 的职责边界，未新增组件级主题分支 | 否 |
| ADR-0008 Phase 4：DESIGN.md 组件状态表须与代码现实对齐（曾校正 4 张表） | 本票新增的 §2b 与 Button 表按**代码现实**书写（与 base.css / settings.css 一致） | 否（且为该原则的延续） |
| ADR-0011 `ntp/ntp.css` 是构建产物、禁止直接编辑 | 本票零 CSS 改动 | 否 |
| ADR-0017 三门合取；agent 不得代签 G-B | 本票为文档票，不涉及发行判定 | 否 |
| CONTEXT.md：CSS 实现细节不进 CONTEXT，DESIGN.md 为视觉设计系统唯一来源 | 本票全部落在 DESIGN.md，未外溢 | 否 |
| 票 88（A-042）暗色 bm-add-btn 改 `--color-muted` / `--color-ink-soft` | 本票把该修复**上升为成文契约**，并新增 §2b 表固化 | 否，且为其正名 |
| 票 102（A-056）亮色同配对 + `contrast-guard` 门禁 | 同上；本票在文档内指向该门禁 | 否，且为其正名 |
| **既有 DESIGN.md 组件状态表把 hairline 写成按钮默认描边（88 Q2 原发现）** | **本票修订对象**：改为「填充按钮可豁免 + ghost 按钮禁止」的二分契约 | **是 → 已 revised 并写入 DESIGN.md，呈报本票** |

**冲突处理**：按 handoff「冲突不得静默改向——记 revised 并呈报」，本次修订在 DESIGN.md 内以 `revised 2026-09-14 · ticket 103 / A-057 / B67` 显式标注，并在本报告 §3/§6 登记。

### 1.3 工业级实现 / 测试策略对标

| 层 | 工业做法 | 本仓落地 |
|---|---|---|
| 第 1 道（文档契约表） | ttoss：每个语义 token 一行 use-when / contract；Design systems 应文档化配对比值 | **本票落地**：DESIGN.md 新增「Hairline 与控件边界的语义契约」三档决策表 + 实测比值 |
| 第 2 道（构建期 token 解析图校验） | 在解析结果上断言控件边界 token 每主题 ≥3:1；divider 族显式豁免 | 已有：`scripts/contrast-guard.mjs`（票 102），从 CSS 源文件读真实契约，8/8 |
| 第 3 道（per-property lint） | stylelint-plugin-carbon-tokens v5 / design-lint `css-var-provenance` | **不引入**（CRX-R-009 + 本票为文档票）；登记为建议 N-103-03 |
| 第 4 道（运行时 axe） | @axe-core/playwright | **不引入**（axe 不覆盖 1.4.11，见 §1.1 结论 7） |

## 2. 实测数据（沙箱复算，非估算）

判定面为 `--color-elevated` / `--color-canvas` / `--color-canvas-2` 三种 surface 的**最坏值**（`--color-elevated`）。

| 配对 | 亮色 | 暗色 | 阈值 | 判定 |
|---|---|---|---|---|
| `--color-hairline` 描边 | **1.11:1** | **1.20:1** | ≥3:1（仅当边界为必需示能） | 作为**控件唯一边界**：FAIL；作为**装饰分隔线**：不适用 |
| `--color-muted` 描边 | 3.81:1 | 4.45:1 | ≥3:1 | PASS（留约 27% 抗锯齿余量） |
| `--color-ink-soft` 字形 | 9.78:1 | 7.73:1 | ≥4.5:1 | PASS |
| `--color-ink` 字形（`.btn`） | 12.11:1 | — | ≥4.5:1 | PASS（构成 SC 1.4.11 豁免依据） |
| `--color-card-edge` 描边 | 1.13:1 | — | — | 同为低强调装饰量级，不承担控件边界义务 |
| `--color-elevated` 填充 vs `--color-canvas` | 1.08:1 | — | — | 填充差几乎不可见 → **填充不能充当 `.btn` 的第二示能**，豁免只由文字（12.11:1）提供 |

上述 1.11 / 3.81 / 9.78 / 1.20 / 4.45 / 7.73 与票 102 报告 §2、票 88 CSS 注释**逐项一致**（本票独立复算复核通过）。

## 3. 实现（唯一源码面改动：`docs/DESIGN.md`）

1. **新增 normative 段**「Hairline 与控件边界的语义契约（revised 2026-09-14 · ticket 103 / A-057 / B67）」：三档决策表（非交互分隔线 / 交互控件附加描边 / 交互控件唯一示能边界），明确**禁止** hairline 承担后者，并给出替代 token 与实测比值。
2. **修订 §2 Button 表**：按代码现实校正 hover/active 文字与描边（原表写 `--color-card-edge` 作 hover 文字，代码未改 color），并加 hairline 适用性脚注 —— `.btn` 是**填充 + 文字 12.11:1**，命中 SC 1.4.11 豁免，故 hairline 作为**附加**描边保留。
3. **新增 §2b Ghost / 透明填充按钮（`.bm-add-row .bm-add-btn`）**：`--color-muted` 边界 + `--color-ink-soft` 字形，与 88（暗）/ 102（亮）实际修复**逐字对齐**；标注 `contrast-guard` 锁死。
4. **§1 Box / §6 Zoom Controls 加代码现实偏差注记**（N-103-01 / N-103-02），不静默改向。
5. **Industry Benchmark 段补工业对标四条**（ttoss / Carbon / Polaris / Carbon #14597），使 revised 有据可依。

结构自检：20 张表列数一致（`malformed=0`）、代码围栏配平、无重复标题、LF 无 BOM。

## 4. AC 对照

| # | AC | 结论 | 证据 |
|---|---|---|---|
| 1 | DESIGN.md 有明确 hairline 修订说明 | **达成** | 新增契约段（三档决策表 + 替代 token + 实测比值 + 门禁指针）+ §2 脚注 + §2b 表；段标题显式标注 `revised 2026-09-14 · ticket 103 / A-057 / B67` |
| 2 | 与暗色 token 修正不矛盾 | **不矛盾，且为其成文正名** | §2b 与暗色 `ntp/settings.css` ticket 88 注释（hairline 1.20:1 → muted 4.45:1 / ink-soft 7.73:1）**逐项一致**；暗色 CSS 零改动；`contrast-guard` 暗色 4 项仍 PASS（§5）；契约段「暗色」列与亮色列并列呈现，两主题共用同一 token 配对 |

## 5. 锚点

| 类型 | 命令 / 位置 | 结果 |
|---|---|---|
| 门禁（全套） | `npm run pretest` | import-graph 0 违规 / migration-golden 28/28 / css-balance OK / calver 8 面一致（含 13 例负向自检）/ onboarding 7/7 · 46 specs 零反模式 —— **全绿 EXIT=0** |
| 对比度门禁 | `node scripts/contrast-guard.mjs` | 8/8 PASS（亮 9.78/3.81/5.04/5.04，暗 7.73/4.45/5.75/4.83）`EXIT=0` |
| 文档死链门禁 | `node scripts/docs-link-guard.mjs` | 8 references / **0 dead** `EXIT=0` |
| Markdown 结构自检 | 列数一致性 + 围栏配平 + 重复标题 | tables=20 **malformed=0**；fences balanced；dupHeadings=none |
| 改动面 | `git --no-pager diff --stat -- docs/DESIGN.md` | **1 file changed, 56 insertions(+), 2 deletions(-)**（零 CSS / 零 JS / 零测试改动） |
| 字节完整性 | 首字节 + CRLF 扫描 | BOM=false，CRLF=false（LF 保持，符合 `.gitattributes`） |
| 行尾检查 | `git diff --check` | `DIFFCHECK_OK` |

**e2e 适用性说明**：本票为纯文档改动（无 CSS/JS/测试变更），运行时 e2e 不适用；以「门禁全绿 + 零代码改动」为等价锚点，不做豁免式宣称。

## 6. 残留与新增欠账（登记，不豁免）

| ID | 事项 | 实测 | 处置 |
|---|---|---|---|
| N-103-01 | DESIGN.md §1 Box 表 default `border-color` 写 `--color-card-edge`，代码 `.large-box`/`.small-box` 为 `1px solid var(--color-hairline)`（hover 才切 card-edge）；`border-radius` 代码为 `--radius-card` 而非 `--radius-tile` | hairline 1.11:1 / card-edge 1.13:1，二者同为低强调量级 | **本票不改**（早于本票，且涉及「容器边界是否承担示能」的产品判定）；已在 DESIGN.md 内加注记，建议随专项票按 ADR-0008 Phase 4 原则按代码现实校正 |
| N-103-02 | DESIGN.md §6 Zoom Controls 表「button border = hairline / hover accent」，代码 `.zoom-btn` 为 `border: 0`（hover 仅改 background/color） | 代码无描边 | **本票不改**；已加注记并说明：按本票新契约，透明填充的 `.zoom-btn` 即使补描边也**不得**用 hairline |
| N-103-03 | 调研建议：给 10 张组件状态表补一列「WCAG 1.4.11 义务（适用/不适用 + 原因）」，把 divider 与 control 的义务差异机器可读化 | 需先清 N-103-01/02 的代码现实偏差 | **建议项（非欠账）**，本票不做：在已登记漂移的表上写死义务会固化错误；建议专项票「先按代码现实校正 → 再统一补列」 |
| N-103-04 | atomcode 首轮命中 5h 配额上限（`resets around 21:17`） | 已按续跑锚定单次 `-c` 成稿，未重开、未并行 | 记录在案；后续同会话多票调研应预留配额 |
| N-103-05 | `.scratch/architecture-recovery/README.md` W4 波次表 103 行（`ready-for-agent` → `done`）**未能提交**：GitButler 依赖检查报 `line 14 depends on wave915-grill-settle (xxx)`，已尝试 4 种分支放置（新建锚定 wave915 / `--above wave915-grill-settle` ×2 / `--above ticket/97-release-status-rui6`）均被拒，依赖不可通过堆叠满足 |
  为避免给并行窗口（99/105/106）留下悬挂 hunk，**本窗口已将该行回退为原值**；权威状态以已提交的 `decision-ledger.md` A-057 与 docs 层 `docs/release-status.md` A-057 为准。集成窗口在 wave915-grill-settle 侧落定后可直接把该行改为 `**done**（AC 2/2 · 报告 reports/103-report.md）` |
| 阻塞项 96 | docs-gov dead-link 仍 `implemented-pending-ci` | 本地 guard 绿，CI 具名 F 待 push | 本窗口不代闭环、不代签 |

## 7. 完成定义自检（handoff）

- [x] AC 全勾（无 F/N 需标注；AC1/2 均为真实达成，非豁免）
- [x] 附 CI/实测锚点（§5：pretest 5 门 / contrast-guard 8/8 / docs-link-guard 0 dead / Markdown 结构自检 / diff --check）
- [x] 账本状态更新（A-057 置 implemented，见 `.scratch/architecture-recovery/decision-ledger.md`）
- [x] 报告落盘 `reports/103-report.md`
- [x] 版本控制遵循 WORKFLOW §4.2（独立分支，不 push、不开 PR）
- [x] 未对已推送 main 换 root；未 push/tag/force-push；未做 9.12 热修；未用 run 34808080000 冒充发行 G-A；未宣称三门合取达成；未代签 G-B

## 8. 版本控制实况（WORKFLOW §4.2）

分支：`ticket/103-design-hairline-b67`（新建 `but branch new --anchor wave915-grill-settle`，后因依赖链 `but move --above ticket/97-release-status-rui6`）。

| 提交 | 内容 |
|---|---|
| `klt` | 主改动：`docs/DESIGN.md`（hairline 契约段 + §2 校正 + §2b + §1/§6 注记 + 工业对标）+ `reports/103-report.md` + `issues/103-design-hairline-b67.md`（AC 2/2 勾、Status done） |
| `kqo` | 账本：`decision-ledger.md` A-057 置 implemented + `docs/release-status.md` A-057 欠账行置 implemented |

- **分支堆叠（如实记录）**：首轮 `but commit` 被 GitButler 依赖检查拒绝（README / 账本 / 状态页行分别依赖 `wave915-grill-settle (xxx)` 与 `ticket/97-release-status-rui6 (twk)`）；已按官方 Hint 先 `--anchor wave915-grill-settle` 建分支、再 `but move --above` 调整位置，账本与状态页成功提交（`kqo`）。**未改写任何他人提交**。
- **N-103-05**：README W4 波次表行依赖不可通过堆叠满足，本窗口已回退该行（不占用他人 hunk），并具名登记；结论以本报告 §4 与已提交的账本 / 状态页为准。
- 未 push、未开 PR、未换 root、未 tag、未 force-push。