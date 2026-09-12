# Decision Ledger — Wave7 Flash / Release / 锐评 Grill

> 日期: 2026-09-12 · 规则: 一次一问；仅用户确认后的结论入账；grill 中不修源码
> 恢复入口: Temp handoff wave6 → W6-wave6-closeout → backlog B30–B39 → 本账本

## 覆盖自评（随轮更新）

- 轨道: 3/3 已纳入 D-001（闪现 / 发行收口 / 锐评）
- 已确认决策: 4
- 覆盖: 闪现验收+拆票门禁 ✓ · 锐评 triage ✓ · 发行（G-B 仍 ready-for-human 并行；README/CRED 等已入 triage）✓
- 整理: 去向对账 destination-reconciliation.md 无去向 0 · plan.md W7-SCOPE/T1–T7 + R1–R9 · CONTEXT.md 增补 zero-flash / paint-critical boot mirror · 未新开 ADR · 未立 GitHub issue · 未改源码
- 待定: 用户是否确认定稿 / 是否授权立 issue 与实施

## 决策表

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|
| D-004 | Q4 锐评 1–10 triage（立票 vs 仅记账；README 门禁矛盾与安全诚实项优先级） | 采纳 atomcode 合并表 | ①#1 README 收窄声明 P1 立票：Latest published=v2026.9.11；候选 draft/pre-release；CHANGELOG 补 9.11；禁写 main/2026.9.12 ready-to-use。②#2 Git 历史：无正式声明则条件 P2 立票，有则台账。③#3 CRED_APP_SECRET P1 立票：诚实标注（混淆级/改 _obf）或 per-install key 二选一；不做 passphrase 真加密重设计。④#4 WebDAV 私网文档化 + #5 版本串统一 = 各 P2 立票。⑤#8 债务标记合并一张 P2（footer add / syncProviderHint / __lastSaveError）；i18n 重复键不立票。⑥#6/#9/#10 台账；#7 不立票；#10 禁止变门禁，可月复核 | 负向：禁止扩 ADR-0017 合取；禁止把 V6 违规升级为 release-blocking；禁止宣称当前候选包可发行；#3 禁止在本票内做真加密架构重写 | current |
| D-003 | Q3 闪现拆票粒度 × 与发行门禁关系（A/B 一张/两张 × 1/2/3 阻塞关系） | 采纳 A+2（atomcode 调研推荐） | ①一张 P1 票承载 D-002 全部 AC（主题镜像+classic boot + 内容遮罩），不拆成主题/内容两票。②不修改 ADR-0017/WORKFLOW §4.4 的 G-A∧G-B∧G-C 合取；闪现不成为 tag 硬门禁。③与 G-B 并行：2026.9.13 候选可继续走 G1–G6；闪现 land 后进入后续 build，不回溯作废已通过的 G-B 数据路径证据。④可选软挂钩：闪现票自建证据目录，不勾进 G1–G6 | 负向：禁止设第四门禁 G-D；禁止因闪现未修宣称数据门禁失败；禁止未 land 时用旧包宣称闪现已修；若改主张「无闪现才允许 tag」须显式修订 ADR-0017，不得静默改执行卡 | current |
| D-002 | Q2「零闪现」验收标准（A 允许空白禁错误内容 / B 主题首帧正确 / C 最严不空白） | 采纳 A+B 合成（atomcode 调研推荐） | ①主题层强制：首帧可见像素必须已是记忆主题/明暗，禁 FART（beige→记忆色、亮→暗）；手段=已持久化 paint-critical 键（至少 theme/darkMode）镜像 localStorage + head classic 阻塞 boot 脚本同步应用；loadLayout 完成后仍以 boxingLayout 为准覆盖。②内容层强制：禁错误盒子/视口/可交互空壳；renderCanvas/enterLargeBox 完成前 canvas 以正确主题底色遮罩/inert。③票 AC：Chrome+Firefox 新开标签慢放无默认 beige、无亮暗跳变、无非记忆盒子可见帧；rememberLastPos 行为不变；清 localStorage 后允许一次性默认主题降级并记入说明 | 负向：不解耦/不延迟记忆主路径；完整 layout 不得再写 localStorage 当真源（否定 C）；禁 inline script（CSP script-src self）；不以拉长加载换完美；镜像不参与迁移/同步/导出 | current |
| D-001 | 本轮 grill 范围与优先级（A 闪现 / B 发行收口 / C 锐评 triage / D 组合） | All | 三轨全收：①闪现 bug 验收标准+修复方向口径烤透并立票 ②发行收口（G-B 继续 ready-for-human 并行；README 与门禁矛盾等票务卫生纳入）③锐评逐条裁定立票 vs 仅记账。主序默认：闪现 → 锐评 → 发行票务（G-B 本体仍由用户实机并行，不阻塞 grill） | grill 中不修源码；一次一问；结论必须落盘；G-B 未完成前禁 tag/禁宣称可发行；闪现修复不得解耦任何记忆功能 | current |

## atomcode 调研笔记（2026-09-12 · Q2 零闪现验收口径）

> 串行一次；已回顾 D-001（current）+ ADR-0002/0007/0012 + CONTEXT Theme/Storage/UX invariants + Wave4 ticket09 + 本仓 CSP/index.html/ntp.js init 实读。
> WebSearch 不可用；工业源经 webfetch：Chrome storage API、web.dev CRP、CSS-Tricks FART、MDN localStorage。

### 与 current 决策对照

| 账本 | 对照结论 |
|---|---|
| D-001 三轨全收 + 闪现不解耦记忆 | **无冲突**。推荐方案不拆 loadLayout/renderCanvas 记忆主路径；localStorage 仅为「已持久化设置」的首帧派生缓存，SoT 仍是 boxingLayout |
| Wave4 ticket09 render-before-persist | **不改向**。该不变量约束的是交互创建路径（先画后存）；冷启动 boot 是「先读后画」的另一类路径，应用 boot 门/预读单独治理，不把 ticket09 扩大解释 |
| ADR-0002 layout 用 storage.local | 无冲突。boot 缓存不是 layout 存储，不替代 ADR-0002 |
| ADR-0012 THEME_PACKS / applyTheme | 无冲突。首帧可复用同一 THEME_PACKS 数据源，禁止第二套主题真源 |
| 前轮 D-004 urlOpenMode 等 | 无关，不触发 revised |

**结论：无需把任何 current 标 revised；不新造与 D-001 对冲的 D-xxx。** 以下仅为 Q2 验收口径推荐，待你拍板后入账为 D-002。

### 工业界成熟心智模型（重点）

1. **FART（Flash of inAccurate coloR Theme）** — CSS-Tricks/行业标准命名。用户主题存在 cookie/localStorage/DB 时，若 JS 在首帧之后才读，必闪。标准解法：**在首帧前用阻塞脚本同步读偏好并加 class/setProperty**。评论区共识：小阻塞脚本的渲染代价远小于错误主题闪现。
2. **chrome.storage 永远异步** — Chrome 官方文档：Storage API asynchronous；并写明扩展 HTML 页可用 localStorage 但不推荐作主存储。工业用法：**主数据走 storage.local；仅 paint-critical 且已持久化的键镜像到 localStorage 作首帧缓存**。
3. **CRP（web.dev）** — 首帧由 HTML+CSS 决定；模块脚本（尤其多 import 图）跑在解析后。Boxing 的 ntp.js 是 type=module 且 import 面大 → Firefox 上首帧必然早于 applyTheme/renderCanvas。
4. **隐藏直到 ready** — 工业视为 force delay / hefty price；对内容重的 SPA/NTP 可接受，但应 **先有正确主题底色再揭开内容**，避免「白屏闪 → 再暗色」二次伤害。
5. **扩展 CSP 约束（本仓）** — script-src self，**禁止 inline script**。工业的 head inline theme 脚本必须改为 **外部 classic 阻塞脚本**（不可 type=module，module 默认 deferred，失去「首帧前」保证）。

### 本仓事实锚点

- 首帧：index.html body 直接可画，默认 beige token（design-system.css）；无 boot 门。
- 异步链：ntp.js L825 init → L836 await loadLayout → L837 await loadSettings（内含 applyTheme + ntp--dark，persist.js L200/L236）→ L1045 renderCanvas/enterLargeBox。
- 已有 sync 侧：LAST_ACTIVE_VIEW_KEY / TAB_VIEW_KEY 已在 localStorage（persist.js）——**boot 镜像模式本仓已存在先例**，不是新架构。
- 主题数据：THEME_PACKS 在 persist.js（5 包 × 9 warm + 3 accent × light/dark）；applyTheme 才写 CSS 变量。

### Q2 三选项的工业映射

| 选项 | 工业对应 | 代价/收益 |
|---|---|---|
| A 允许空白，禁止错误内容 | content hide-until-ready | 实现最简；Firefox 空白更久；主题仍闪（除非叠加主题预读） |
| B 禁止空白感，主题必须首帧正确；内容可「出现」 | FART 标准解 + 内容异步 | 主题零闪；盒子从「无」到「有」但底色已对；**不闪错误盒子** |
| C 最严：既不闪错也不空白 | 同步预读完整记忆壳 | 需把盒子几何也镜像进 localStorage 或同步读——等于第二布局真源，**触碰「不解耦记忆」红线，工业也不推荐** |

### 推荐（供拍板，非已入账决策）

**推荐验收口径 = A + B 合成，明确否定 C 的布局双真源：**

1. **主题层（强制）**：首帧可见像素的背景/明暗/主题变量必须已是记忆态——禁止 beige→记忆色、亮→暗 的 FART。手段：paint-critical 键（至少 theme/darkMode，可选 fontSize）在 saveLayout 成功路径镜像到 localStorage；head 放 **classic 阻塞** boot-theme.js（CSP 合规）同步应用；loadLayout 完成后仍以 boxingLayout 为准覆盖（镜像只影响首帧，不参与迁移/同步）。
2. **内容层（强制）**：禁止出现**错误**盒子/错误视口/默认空壳与记忆不一致的可交互内容。手段：canvas/inner 在 renderCanvas/enterLargeBox 完成前保持不可见或 inert；背景已是正确主题色，因此「空」表现为正确底色而非错误 UI。
3. **否定项**：不解耦/不延迟记忆主路径；不把完整 layout 再写一份 localStorage 当真源；不用 inline script；不以「拉长加载」换 C 级完美。

**与你原话对齐**：「不要有任何闪现，直接就是原来的记忆功能」→ 首帧即正确主题+正确底色，内容就绪前不展示错误态；记忆功能本体不动。

**落地后验收句（建议写进票 AC）**：
- Chrome + Firefox 新开标签：连续录屏/慢放，**不得出现**默认 beige、亮色闪暗、或非记忆盒子的可见帧；
- 记忆开关（rememberLastPos）行为不变；
- 关闭扩展或清 localStorage 后首帧回退默认主题一次，随后 loadLayout 纠正——属可接受降级，须记入票说明。

### 残留不确定（实现期再钉，不阻塞 Q2）

- boot-theme.js 是否内嵌 THEME_PACKS 子集还是 import 完整 persist（module 延迟问题）——实现票再定，倾向 classic 脚本内嵌仅需的 5 包色值。
- 多标签 storage.onChanged 时镜像刷新义务。
- G-B 检查单是否增加「慢机 Firefox 无闪现」一项。

## atomcode 调研笔记（2026-09-12 · Q3 拆票 × 门禁关系）

> 串行一次；已回顾 D-001/D-002（current）+ ADR-0017 全文 + WORKFLOW §4.4 + evidence/49 G1–G6 执行卡 + G-B 候选包状态。
> 工业源：Google SRE Book ch.8 Release Engineering；web.dev CLS；本仓 G-B 六项实物。

### 与 current 决策对照

| 账本 | 对照结论 |
|---|---|
| D-001 三轨全收；G-B 完成前禁 tag | **无冲突**。闪现是否进 ADR-0017 门禁是独立裁决，不削弱既有 G-A/B/C 合取 |
| D-002 零闪现 = 主题层+内容层合成 AC | **无冲突**。合成 AC 支持「一张票」；拆两张会把一条用户症状切成半可用态 |
| ADR-0017 G-B = 数据安全黄金路径（安装/迁移/回滚/导入） | **无冲突**。推荐不扩大 ADR 门禁定义；避免把 UX 闪现写进「可发行」合取 |
| Wave6 D-009 G-B ready-for-human | 无冲突 |

**结论：无需 revised，无需新造对冲 D-xxx。** 以下为 Q3 推荐，待拍板入账 D-003。

### 本仓 G-B 现状（实物）

G1 全新安装零 console 错误 · G2 建改拖缩重开完整 · G3 导入无静默覆盖 · G4 升级 COW+无冻结 · G5 回滚演练 · G6 具权限者确认风险/回滚预案。

**六项全是数据完整性/安装正确性，无 FOUC/闪现项。**

**关键约束：G-B 候选包已备好** — 2026.9.13 · run 34641377036 · 解包于 D:/gb-2026.9.13。该 zip **不含**闪现修复。若把闪现写成 G-B 阻断项 → 此候选作废，须 land 闪现 → 重 build → 重走双浏览器六项。

### 工业界成熟心智模型（重点）

1. **SRE Release Engineering（Google）** — 发行门禁服务「可重复构建 + 测试与发布目标一致 + canary + 可回滚」；rollout 按 **risk profile** 分级。UX 级首帧闪现不在 release gate 必要条件内；「Push on Green」指的是测试绿，不是零视觉缺陷。
2. **门禁纯度** — ADR-0017 因数据丢失事故而生：门禁回答「会不会毁数据/装不上/回不去」，不回答「好不好看」。把 FART 塞进 G-B 会稀释事故门禁的审计语义，且每次 UX 微调都可能触发重跑黄金路径。
3. **CLS/Core Web Vitals** — 视觉稳定性是产品指标，商店审核不以 FOUC 一票否决。行业把它当 **P1 缺陷票 + 发布后观察**，极少当 tag 硬门禁。
4. **拆票粒度** — 可独立交付/独立回滚才拆（Wave6 容灾 α/β：回滚 UI vs 导出信封域不同）。主题预读与内容遮罩：**同一文件面**（index.html / boot 脚本 / ntp.js init / saveLayout 镜像）、**同一用户症状**（「闪现」）、**同一验收手法**（慢放录屏）。只上一半会出现「主题对了但盒子闪错」或「遮罩了但底色错」——比不修更糟。工业与本仓先例都指向 **一张票**。
5. **候选包沉没成本** — 已 build 的 2026.9.13 若因 UX 票作废，会重演「门禁等代码」串行阻塞；SRE 偏好让数据门禁与可选 UX 增强 **并行车道**。

### Q3 选项映射

| 组合 | 含义 | 工业评分 |
|---|---|---|
| A+1 | 一张票；闪现进 ADR 门禁、阻塞 tag | 低：门禁被 UX 扩权；候选包作废；与事故门禁定位冲突 |
| B+1 | 两张票；闪现阻塞 tag | 低：更碎 + 同上 |
| **A+2** | **一张票；不阻塞 ADR tag 门禁；与 G-B 并行 land** | **高：门禁纯度 + 症状完整交付 + 不作废候选** |
| A+3 | 一张票；写进 G-B 执行卡但不改 ADR | 中：实际仍阻塞 G-B 完成（执行卡勾不完），与 2 仅纸面差别 |
| B+2 | 两张票；不阻塞 tag | 中：可并行但半态风险 |

### 推荐（供拍板，非已入账决策）

**推荐 = A + 2：**

1. **一张票**承载 D-002 全部 AC（主题层镜像+classic boot + 内容层遮罩）；标题建议「fix(ntp): new-tab zero-flash (FART + content mask)」；P1。
2. **不修改 ADR-0017 / WORKFLOW §4.4 的 G-A/B/C 合取定义**；闪现 **不** 成为 tag 硬门禁。
3. **与 G-B 并行**：用户可继续在 2026.9.13 候选上走 G1–G6；闪现票 land 后若希望进入「将来的发行包」，属下一轮 build 的内容，不回溯作废已通过的 G-B 数据路径证据（除非升级/回滚演练发现闪现修复引入回归——那走缺陷票，不走门禁改写）。
4. **可选软挂钩（不进合取）**：闪现票自身 AC 含 Chrome+Firefox 慢放人工项；证据目录可放 `.scratch/architecture-recovery/evidence/<ticket>-flash/`，与 G-B 证据并列，**不**勾进 G1–G6。
5. **负向**：禁止把「零闪现」写成第四门禁 G-D；禁止因闪现未修而宣称「数据门禁失败」；禁止在未 land 闪现时用旧包宣称闪现已修。

**残留不确定**：若你坚持「必须带着无闪现才允许 tag」，则等价 A+1，须 **显式修订 ADR-0017**（新决策+复核日），不能只改执行卡静默加项——那时 D-003 应记录该扩权并触发 ADR 修订票。

## atomcode 调研笔记（2026-09-12 · Q4 锐评 1–10 triage）

> 串行一次；已回顾 D-001/D-002/D-003（current）+ ADR-0017 + 本仓 README/credentials/sync-engine/ntp.js 实物 grep。
> atomcode 完成：searches 13 · full reads 10 · 信源含 GitHub Docs releases、shields.io #4439/#10968、OWASP A04/CWE-321、kiln cd2886f、almamesh ebc837e、Google SRE 复盘文化。

### 与 current 决策对照

| 账本 | 对照结论 |
|---|---|
| D-001 三轨全收含锐评/README 卫生 | **无冲突**，triage 正是本轨 |
| D-002/D-003 闪现 | 无关，不触发 |
| D-003 禁扩 ADR-0017 门禁 | **无冲突**：atomcode 明确 #10 过程违规不得变成 release-blocking |
| D-001 G-B 前禁宣称可发行 | **无冲突**：README 修复=收窄声明到已存在事实，不是宣称新包可发行 |

**结论：无需 revised。** 以下为推荐合并稿，待拍板入账 D-004。

### 工业主线

用户可见假陈述 → 本波立票改真；债务/事实 → 台账；流程违规升级为门禁 → 违反 D-003。

### 推荐 triage 表（与我 Q4 初稿差异已标）

| # | 点 | 处置 | 优先级 | 相对 Q4 初稿 |
|---|---|---|---|---|
| 1 | README 徽章/Ready-to-use vs ADR-0017 | 立票：收窄声明（Latest published v2026.9.11；候选 draft/pre-release；shields 默认排除 pre-release）+ CHANGELOG 补 9.11 条目 | **P1** | 初稿 P0→atomcode P1（已有公开包，非从零假声明） |
| 2 | Git 历史/平行宇宙 | 若无正式历史声明则 P2 立票（CI URL 悬空）；已有声明则台账 | P2 条件立票 | 初稿纯台账→条件立票 |
| 3 | CRED_APP_SECRET | 立票：**诚实标注**（混淆级/改 _obf）或 per-install key 二选一；**不做** passphrase 真加密重设计 | **P1** | 初稿 P2→P1（CWS 评审撞点） |
| 4 | WebDAV 私网未文档化 | P2：README Privacy 写明；opt-in 后置 | P2 立票 | 同 |
| 5 | 版本串 v3.7.8/v3.1 | P2：统一用户可见版本串到 calver/manifest | P2 立票 | 同 |
| 6 | 性能债 | 台账/backlog；未来第一刀=搜索 debounce | 台账 | 同 |
| 7 | popup/ 零改动 | 不立票 | — | 同 |
| 8 | footer add / syncProviderHint / __lastSaveError 等 | **合并一张 P2**（用户可见错字+导出污染）；**i18n 重复键不立票**（注释禁止盲清） | P2 | 细化 |
| 9 | .scratch / README 工作日志 | 台账，发行后 docs 里程碑 | 台账 | 同 |
| 10 | V6 违规仅归档 | 台账+月复核；**禁止**变门禁；可复用 waiver-ledger 模式波后治理 | 台账 | 同 |

### README 专项工业姿势（#1 实现约束，立票时写入 AC）

1. 声明范围收窄到已存在事实：「Latest published release: v2026.9.11；后续构建须过 G-A/B/C」
2. 候选保持 draft；通过后可 pre-release canary；shields github/v/release 默认排除 pre-release
3. CHANGELOG 补 v2026.9.11；可选 CI 派生徽章（kiln 模式）
4. 负向：不得写「当前 main/2026.9.12 包 ready-to-use」

### 信息缺口（不阻塞 D-004）

- CWS 拒稿判例未抓原文；上架前复核「混淆」措辞
- CRED 若含高价值 token 可升 P1 已是 P1
- .scratch 占比未脚本复算
