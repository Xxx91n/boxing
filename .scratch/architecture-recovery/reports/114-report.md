# 114 报告 — DESIGN.md Box/Zoom 表按代码现实校正（B74 / A-069）

> 窗口：Boxing Wave9.20 实施子窗口 · ticket 114 · covers A-069
> 必读清单 7 项全部存在：handoff 1691B / issue 517B / spec 2397B / WORKFLOW 36250B / ADR-0017 10313B / docs-CONTEXT 33188B / decision-ledger 25451B；handoff 扩展项 D 账本 8360B · plan 2320B 亦在
> 产物：`docs/DESIGN.md`（唯一文档面改动，+29/-23）· 本报告 · 账本 A-069 置 implemented · issue AC 2/2 · README W1 行翻 done
> 版本控制：WORKFLOW §4.2（GitButler，独立分支，不 push 不开 PR）

## 0. 开工复述（任务书「开工第一句」要求）

| 项 | 结论 |
|---|---|
| ① 阻塞关系 | `Blocked by: None`（issue 明示 can start immediately）。本票属 plan.md 段④「文档收口」，与同波 W1 并行票（107/109/110/111/112/113/115/116）无依赖；无下游票被本票阻塞 |
| ② 必读路径 | 9 项全部存在（见页首字节数） |
| ③ 通用调研三项 | atomcode 深度调研（ctx 包裹、串行 1 次）/ ADR+CONTEXT 心智模型回顾 / 工业对标 —— 见 §1，先行于实现 |

## 1. 调研摘要（handoff 通用三项，先行于实现）

### 1.1 atomcode 深度调研（串行 1 次）

调研问题：*设计系统文档与代码现实一致性的工业成熟做法：组件状态规格表如何防止与 CSS 实现漂移、文档侧偏差注记的命名与收口惯例、docs-as-code 机器校验策略*。
单次 `atomcode -p` 成稿（Sufficiency Gate：11 searches / 5 角度 / 12 full reads / 9+ domains），ctx 索引 source=atomcode（batch 2026-09-15 07:59）。

| # | 结论 | 来源 |
|---|---|---|
| 1 | 防漂移的根本机制是「单一契约源 + 双侧生成 + 三方比对」：文档与 CSS 同源于一份 JSON/YAML 契约；「靠纪律让文档跟上代码」不可训练，散文段落是漂移爬回之处 | Christine Vallaure（2026-07）· Southleft ds-contracts-poc（一手仓库） |
| 2 | 状态规格表最小结构已有社区收敛形态（anatomy / props / default / variants，state 绑定到具体 token） | Nathan Curtis “Components as Data” |
| 3 | 偏差注记收口惯例：结构化字段（规则/原因/证据/影响/owner/review date/resolution path）+ 双向链接 + 有过期日的临时许可而非永久豁免；**收口 ≠ 删除注记**，而是翻转状态 + 指向收口物（同 commit 完成）；resolution path 四类：silently safe / mechanically migratable / per-instance decision / deprecate+coexist | 0r8it “The Design System Exception Log”（2026-07）+ ADR supersession 惯例交叉 |
| 4 | docs-as-code 分层校验：确定性检查做 PR 硬门禁、语义做 advisory；「fail on 新增、warn on 存量」（tokenlint `--max-new 0` 净增量模式）；「could not evaluate ≠ passed」（exit 2 与 exit 1 区分） | MoxieDocs · tokenlint（一手）· Pronovix · Storybook 官方教程 |
| 5 | 状态表↔CSS 的终极校验是 computed-style 测量（真 Chromium 挂载回填契约）；中间态可自建「规格表 token 引用 ↔ CSS 类引用」断言脚本，无开箱即用件 | Southleft PoC |

**推荐与理由**：N-103-01/02 的 resolution path 属结论 3 的「更新文档」（mechanically migratable）——代码现实本就契约干净（§2），CSS 零改动，两表按代码现实校正，注记原地翻转为 closed 并指向本票（双向链接：103 登记 → 114 收口）。
**不采纳**：引入 JSON/YAML 契约管线、tokenlint、computed-style 校验脚本——超出文档票范围且 CRX-R-009 禁新增依赖；登记为建议 N-114-01。

### 1.2 ADR 与 docs/CONTEXT.md 心智模型回顾 — 冲突检查

| 既有心智模型 | 与本票关系 | 是否冲突 |
|---|---|---|
| ADR-0008 Phase 4：DESIGN.md 组件状态表须与代码现实对齐（曾校正 4 张表） | 本票正是该原则的执行：两张残表按代码现实校正 | 否（为其正名） |
| §Hairline 契约（ticket 103 / A-057，三档决策表） | 校正后 hairline 仅落在「允许」档：盒体为 `--color-elevated` 填充 + 标题/栏头辨识的容器收边；`.zoom-controls` 容器同理。`.zoom-btn` 无描边、示能由 `--color-ink-soft` 字形（9.78:1 ≥ 4.5:1）承担 | 否，契约不回退 |
| ADR-0011 `ntp/ntp.css` 构建产物禁止直接编辑 | 零 CSS 改动 | 否 |
| ADR-0017 三门合取；禁 agent 代签 G-B | 文档票，不涉及发行判定 | 否 |
| CONTEXT.md：CSS 实现细节不进 CONTEXT，DESIGN.md 为视觉设计系统唯一来源 | 全部落在 DESIGN.md，未外溢 | 否 |
| DESIGN.md §3/§5/§6 既有「(no xxx state)」列表头惯例 | §1 Disabled 列、§6 Active 列按同惯例改写 | 否（同文惯例） |

**冲突处理**：无冲突、无 revised —— 本票是把 103 的「具名待校正」执行到底，不改向任何既有决策。

### 1.3 工业级实现 / 测试策略对标

| 层 | 工业做法 | 本仓落地 |
|---|---|---|
| 状态规格一致性 | contract-first（JSON/YAML 三方比对）为终态；文档表逐格对代码现实为基线 | **本票落地**：逐格复核（§2）+ 表校正 + 注记闭环 |
| 偏差治理 | exception log：结构化字段 + review date + resolution path；append-only | **本票落地**：注记翻转 closed + 票号/日期双向链接，不删痕 |
| 机器校验 | 确定性门禁打底（link / contrast / token lint） | 已有：`contrast-guard` + `docs-link-guard` 复跑全绿（§5） |

## 2. 代码现实复核（逐格，非估算）

源：`ntp/base.css`（`.large-box` L455-484 / `.small-box` L937-968）· `ntp/settings.css`（`.zoom-controls` L271-287 / `.zoom-btn` L289-350）· `ntp/design-system.css`（token 值 L86-87）。

§1 Box 表（`.large-box` / `.small-box` 同形同值，BX-DUAL-WRITE 成立）：

| 格 | 旧表 | 代码现实 | 处置 |
|---|---|---|---|
| background | `--color-elevated` | elevated（L462/944） | 不变 |
| default 描边 | `--color-card-edge` | `1px solid var(--color-hairline)`（L463/945） | **校正** |
| hover 描边 | `--color-card-edge` | card-edge（L473/954） | 不变 |
| dragging 描边 | `--color-card-edge` | `var(--color-accent)`（L479/959） | **校正** |
| default shadow | `--shadow-1` | 无 box-shadow 声明 | **校正** none |
| dragging shadow | `--shadow-2` | `var(--shadow-pop)`（L478/958） | **校正** |
| hover z-index | 2 | 无声明（保持 1；全文件无 z-index:2） | **校正** (same) |
| border-radius | `--radius-tile` | `var(--radius-card)` = 18px（L464/946/482/962） | **校正** |
| Disabled 列 | surface/hairline/none/not-allowed/0/same | 全代码库无 box disabled 态 | **列改 (no disabled state)**，§3/§5 同惯例 |

§6 Zoom Controls 表（`ntp/settings.css`）：

| 格 | 旧表 | 代码现实 | 处置 |
|---|---|---|---|
| container background | `--color-elevated` | elevated（L278；dark L770 同 token） | 不变 |
| container border | （缺行） | `1px solid var(--color-hairline)`（L279） | **补行** |
| button color default | `--color-muted` | `--color-ink-soft`（L292；`.zoom-arrow` L318 同） | **校正** |
| button border | hairline/accent/accent | `border: 0`（L291），无 `:active` 规则 | **校正** none |
| Active (pressing) 列 | surface/ink/accent | 代码无 `:active` | **列改 (no :active rule)** |

附带校正：Radii 表 `--radius-card` usage 补 boxes、`--radius-tile` usage 改为真实消费方（popup items / settings-nav / theme-preset / inline popups & toasts）——token 定义不动。

## 3. 实现（唯一文档面改动：`docs/DESIGN.md`）

1. §1 Box 表 5 格校正 + Disabled 列按惯例改写 + N-103-01 注记翻转 closed。
2. §6 Zoom 表 2 格校正 + container border 补行 + Active 列按惯例改写 + N-103-02 注记翻转 closed。
3. Radii 表两行 usage 对齐代码现实（`--radius-card` / `--radius-tile`）。
4. 零 CSS / 零 JS / 零测试改动；注记保留票号与日期形成双向链接（103 登记 → 114 收口），append-only 不删痕。

## 4. AC 对照

| # | AC | 结论 | 证据 |
|---|---|---|---|
| 1 | N-103-01/02 收口 | **达成** | 两表逐格按代码现实校正（§2）；偏差注记原地翻转为 closed 注记（具名 ticket 114 / A-069 / B74 + 日期），非删除 |
| 2 | hairline 契约不回退 | **达成** | 契约段（DESIGN.md §52-71）零改动；校正后 hairline 出现位均属契约「允许」档；contrast-guard 8/8 PASS；零 CSS 改动 |

## 5. 锚点

| 类型 | 命令 / 位置 | 结果 |
|---|---|---|
| 对比度门禁 | `node scripts/contrast-guard.mjs` | 8/8 PASS（亮 9.78/3.81/5.04/5.04，暗 7.73/4.45/5.75/4.83）EXIT=0 |
| 文档死链门禁 | `node scripts/docs-link-guard.mjs` | 8 references / 0 dead EXIT=0 |
| migration-golden | `node scripts/migration-golden-guard.mjs` | 28/28 EXIT=0 |
| css-balance | `node scripts/css-balance-guard.mjs` | 6 source CSS balanced EXIT=0 |
| calver | `node scripts/calver-guard.mjs` | 8 面一致 2026.9.15 + 13 负向自检 EXIT=0 |
| onboarding | `node scripts/onboarding-guard.mjs` | 7/7 · 47 specs EXIT=0 |
| Markdown 结构自检 | 列数一致性 + 围栏配平 + 重复标题 | tables=20 malformed=0 · fences balanced · dupHeadings=none |
| 行尾/字节 | `git diff --check w920-tickets -- <本票面>` + BOM/CRLF 扫描 | EXIT=0 · BOM=false · CRLF=false（LF 保持） |
| 改动面 | `git diff --stat w920-tickets -- docs/DESIGN.md` | 1 file, +29/-23（零 CSS / 零 JS / 零测试） |

**pretest 链如实记录**：`npm run pretest` 在当前共享工作树 EXIT=1，两处红均非本票面——① import-graph CM-1：`test/tests/boxing-sync-bookmark-delete-tombstone.spec.ts` 未入 cluster-map（该文件为 107 窗口未提交新增 `lq`，属其在飞面）；② locale-readme BLOCK BX-LOCALE-006：root README `store_published 2026.9.15` vs release-status `published 2026.9.12`（113 在飞面）。本票改动文件不在两红影响面内，单跑其余 6 门全绿（上表）。

**e2e 适用性说明**：纯文档改动（无 CSS/JS/测试变更），运行时 e2e 不适用；以「确定性门禁全绿 + 零代码改动」为等价锚点（票 103 同款口径），不做豁免式宣称。

## 6. 残留与新增欠账（登记，不豁免）

| ID | 事项 | 处置 |
|---|---|---|
| N-114-01 | 调研建议（非欠账）：DESIGN.md 组件状态表向机器可校验契约演化（JSON/YAML 单一源，或 per-表 token 引用 lint；computed-style 测量为终态） | 建议项：需独立基建票；本仓已有 contrast-guard / docs-link-guard 承担确定性门禁层 |
| N-114-02 | 观察登记：§2 Button / §10 Checkbox 的 Disabled 列在全代码库无对应实现（规范前置列），本票仅在 §1 按惯例改写 | 不欠账：如需全表族统一口径另开文档票；本票不扩写 |

## 7. 完成定义自检（handoff）

- [x] AC 全勾（2/2 真实达成，非豁免）
- [x] 附实测锚点（§5：contrast 8/8 · link-guard 0 dead · migration 28/28 · css-balance · calver 8 面 · onboarding 7/7 · 结构自检 · diff --check）
- [x] 账本状态更新（A-069 置 implemented）
- [x] 报告落盘 `reports/114-report.md`
- [x] 版本控制遵循 WORKFLOW §4.2（独立分支，不 push、不开 PR）
- [x] 未对已推送 main 换 root；未 push/tag/force-push；未热修 9.15；未宣称三门合取；未代签 G-B；无第二次 root 导出（A-P01）

## 8. 版本控制实况（WORKFLOW §4.2）

分支：`ticket/114-design-box-zoom-b74`（`but branch new --above w920-tickets` 建栈于票务分支之上——依赖检查首轮拒绝裸 commit：README 行 11 / 账本行 156 / issue 行 9/13-14 依赖 `w920-tickets (rpk)`，按 Hint 堆叠后通过）。

| 提交 | 内容 |
|---|---|
| `zno`（sha 58005fff） | `docs/DESIGN.md`（两表校正 + Radii usage + 注记闭环）+ `reports/114-report.md` + `issues/114`（AC 2/2 · Status done）+ `decision-ledger.md` A-069 → implemented + `README.md` W1 行 → done |

- 栈位：base `a1acaaac` → `w920-tickets` → **本分支** → `ticket/112` → `ticket/111`（顶）；未改写任何他人提交。
- 未 push、未开 PR、未换 root、未 tag、未 force-push；未触碰其他窗口未提交改动（107/112/113/116 在飞文件全部留在 zz）。
