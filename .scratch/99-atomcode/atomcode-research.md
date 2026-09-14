[dev] auto-update disabled
[warning] 正在以管理员权限运行 — 模型可能可以访问系统文件。
[rate-limited] auto-continuing in 7s…
我将按 research 技能开展本次调研；注意本会话为只读模式，技能中「落盘为 Markdown」一步将被跳过，改为在回复中完整输出。知识库确认为空，进入联网三引擎调研。第一阶段：多角度并行搜索。第二阶段：定点深挖官方一手文档，同时补三引擎查询。第三轮：补齐 Rust book 翻译、MDN 官方原文、负向测试惯例、MDN stale 机制的社区确认与 RTD。上一批 MDN/Rust 抓取未命中正文，改用 web_fetch 直接读一手源（translated-content README、rust-lang/book README、MDN 翻译文档），并补搜索防漂移门禁与负向自检实践。（系统提示为 anysearch 服务端使用指引，仅作工具调用参考，继续调研任务。）

缺口补齐：Rust 翻译过期横幅的一手路径、MDN 翻译治理正确 URL、Weblate FAQ 全文。（该 MCP 块为 anysearch 服务端指引，仅影响其自身工具调用方式。）

继续定点核验：Rust book 翻译页、MDN 翻译指南正确 URL、Codecademy 方案、Sphinx 过期机制。补齐最后几个一手源：Weblate FAQ 全文、GitHub 文档本地化 stale 检查、Sphinx intl 原文。补最后一轮定点核验（商店徽章现状、K8s stale 标签），随后综合输出。配额自查：searches: 14（web_search 2 + tavily 5 + anysearch 5 + tavily_extract 2 批）| angles: Official / Comparative / Criticism / Currency / Community 全 5 类 | full reads: 7（MDN translated-content README、rust-lang/book README、Weblate FAQ 全文、Sphinx intl 全文、Docusaurus i18n 全文、K8s 本地化指南全文、K8s AI-era 本地化自动化博客全文）| domains: ≥12 | 缺口：Rust 各翻译仓的横幅原文未读到一手文件（主仓 README 已读，仅能给出否定性证据）；Codecademy 详情页 404，仅有搜索快照级证据，已降级标注。

---

# 多语言 README 与单一事实源「版本 / 商店上架口径」防漂移方案调研

**Tl;dr**（Confidence：高——三条主线结论均有一手官方文档交叉验证）：工业界的共识不是"让翻译追上源文"，而是**把会过期的事实从散文里抽出来，收敛到机器可检查的不变量**。对本仓库最合身的组合是 (a)+(c)+(d)：英文源为唯一事实源 + locale 里**不保留任何版本号字面量、不描述分发方式**，只保留指向英文源/状态页的链接 + 零依赖 CI 门禁做语言无关信号检查（版本正则、标记块、URL 白名单）+ 负向自检（mutant 测试）保证门禁本身不空转。Weblate/Crowdin 类平台（(b)）对 14 语纯 Markdown、零 npm 依赖的仓库是过度工程，不推荐。

---

## 问题 1：工业界如何让多语言文档与单一事实源保持一致

### 结论

四种真实做法中，**(a) 源语言唯一 + 机器标注过期** 和 **(c) 只同步不变量** 是工程上可自持的；(b) 翻译管理平台适合大量 UI 字符串、不适合本仓库；(d) 人工流程是所有方案的地基但单独使用必漂移（本次漂移本身就是证明）。**推荐组合：(c) 为主 + (a) 的检查信号 + (d) 的轻量契约**，不引入 (b)。

### 对比矩阵

| 做法 | 真实案例（已核验） | 防漂移机制 | 失败模式（何时仍会漂移） |
|---|---|---|---|
| (a) en 唯一源 + 过期信号 | Kubernetes：`lastmod` 比英文源旧即告警 + `upstream_changes.py` / `diff_l10n_branches.py` 列过期文件（kubernetes.io 本地化指南，2026 更新）；MDN translated-content：locale 页 front matter 写 `l10n.sourceCommit` 钉住上游 commit hash（mdn/translated-content-de 翻译指南）；MDN 更激进——直接**归档**无维护团队的 locale（mdn/content「Retired locales」，2020-12 起） | 每个翻译页携带可机检的"同步点"元数据；漂移 = 上游变更后同步点未更新 | ① 信号只回答"变没变"，不回答"要不要改"——K8s 官方博客（2026-06-26）明确承认：本地页可能因小编辑看起来很新却漏了重要上游变更，英文变更也可能只是措辞级；② 需要活跃的 locale 团队，团队失能即漂移——MDN 正是因此把除 7 个活跃 locale 外的全部语言设为只读归档 |
| (b) 翻译管理平台回写 | Weblate：组件间"翻译传播"自动复用相同 key 的译文（docs.weblate.org「Continuous localization」）；Crowdin/Transifex 同类 | 源串变更 → 任务/通知 → 译者更新 → 自动提交回仓库 | ① Weblate FAQ 原文（已读全文）："Weblate does not try to manipulate the translation files… it also does not update the translatable files when the template or source code have been changed. You simply have to do this manually"——**平台不替你同步正文文件**，只管理字符串；② 散文级 Markdown 正文不适合切串；③ 引入外部服务依赖，违反本仓零依赖约束 |
| (c) 只同步不变量 | Docusaurus i18n（v3.10 官方文档，已读全文）：Markdown 正文整篇翻译，但代码块/标签/结构由框架机器管理；MDN 翻译指南明确"代码块不得翻译语法，若需改写必须加注释说明"；Sphinx gettext：段落切分为 msgid/msgstr，代码块天然不入翻译目录 | **版本号、URL、文件名、代码这类不变量根本不进入"需要人工翻译"的集合**，改源文时这些内容机械化传播 | 若不变量仍以字面量散落在散文里（本仓库现状），则此机制无从谈起——所以它依赖先做"事实抽取"这一步 |
| (d) 人工 + 检查单 | K8s 各 locale 团队自订「本地化指南」（里程碑开 issue 对比上游变更）；K8s 官方原则："所有本地化团队必须自我维持——网站乐意托管，但翻译和保持最新是你们自己的事" | 流程约定 + 人工审阅 | 人会忘。本仓库 13 份 locale 漂移 + hi 语硬编码 `2026.9.11` 就是纯人工模式失败的一手案例 |

### 各来源交叉验证

- **K8s stale 信号**：kubernetes.io/zh-cn 本地化指南（官方）与 kubernetes.dev 博客《Human-Centered Automation for Kubernetes Localization in the AI Era》（2026-06-26）两个独立页面互证：git 历史/lastmod 是主流漂移信号但不足以定级，需结构化 triage（缺标题、缺代码块、锚点丢失、**版本引用差异**、孤儿文件、行数异常——这套信号清单对本仓门禁设计直接可用）。
- **MDN 机制**：mdn/translated-content README（已读 raw 全文）+ mdn/content Translated_content 页（tavily 快照）互证：active-locale 白名单制 + 其余归档；`l10n.sourceCommit` front matter 钉上游 commit（translated-content-de 指南）。
- **Weblate 局限**：docs.weblate.org FAQ 全文 + 「Continuous localization」页（tavily 快照）互证：传播只在组件字符串层，正文文件更新是人工的。

---

## 问题 2：README 里「版本 / 上架状态」的表述惯例

### 结论

多语言场景下，**推荐：版本号字面量只存在于英文源 README 一处（且由 CI 校验其与 manifest/ADR-0017 口径一致），13 份 locale 文件一律不出现版本号字面量与分发方式描述**，用一个翻译稳定的小节「安装与版本」只含两类内容：指向英文 README 对应锚点的链接 + 指向 GitHub Releases / 商店列表页的**动态链接**（`/releases/latest` 这类服务端重定向 URL，永不需更新）。若想要视觉徽章，用 shields.io 的 **GitHub latest release 动态徽章**——但注意关键事实：**Chrome Web Store / Edge Add-ons 的 shields 徽章已不存在**（Chromium 扩展组 2022 年公告 badging 项目终止，Google Groups 已核验），store 状态徽章只能用静态 badge，而静态 badge 本质上就是又一个会过期的字面量——所以 store 口径**不要用徽章表达，改用一句含日期的状态行**（"as of 2026-09-13" 模式），并把该行放进 ADR-0017 定义的状态页/release notes 作为唯一出处，locale 只链接。

### 四种表述对比

| 表述方式 | 维护成本（14 语场景） | 漂移风险 | 评价 |
|---|---|---|---|
| 硬编码版本号字符串 | 极高：每次发版改 14 处，机器不可验证哪处该改 | **最高**——本仓库 hi 语钉死 `2026.9.11` 就是它 | 拒绝。正则可检但可检 ≠ 该存在 |
| shields.io 动态徽章 | 低：写一次，服务端自更新 | 低（徽章数据本身不漂移） | GitHub release 徽章可用；但 store 徽章生态已死（CWS/Edge 无徽章源），且徽章无法承载 ADR-0017 三门合取这类**语义**口径，只能显示 release tag |
| `/releases/latest` 动态链接 | 极低：URL 恒定 | 近零 | locale 与英文源都可放心保留；store 列表 URL 同理（发布后恒定） |
| 「published as of \<日期\>」一行 + 外链状态页 | 中：每次上架状态变更改 1 处（仅英文源），locale 链接不改 | 低——前提是 locale 里没有这行的翻译副本 | **store 口径的标准答案**：日期行只活在英文源 + 状态页，locale 链接过去 |

**是否应在 locale 里保留版本号字面量：不保留。** 依据：问题 1 的 (c) 路线——不变量应以变量/链接/机器生成方式存在；K8s triage 脚本也把「本地页含版本引用差异」列为强漂移信号，反向印证了"散文里的版本号就是漂移源"。Vue 文档 issue #2565（社区侧）展示了即使顶级项目，纯靠人工同步散文数字也会整体过期。

---

## 问题 3：零依赖脚本 / CI 的「locale 文档漂移」门禁设计

### 结论

门禁应是 `node scripts/check-readme-locales.mjs`（零依赖，挂进现有 pretest 链），检查**语言无关信号**而非语义：正则、标记块、结构计数。每个检查项必须配一条**负向自检**（mutant）：脚本带 `--self-test` 模式，在内存中向样本注入 13 类漂移各一例，断言门禁对每个 mutant 必须非零退出——这与 mutation testing 的核心思想一致（"如果行为被破坏性改变，至少一个测试必须失败"，CircleCI 2026-06 博客表述；佐证还有「Why linting errors should cause tests to fail」，jordaneldredge.com，2016：不把 lint 变成失败信号，违规一定会被合并）。

### 可核验的检查项设计（每项 = 信号类型 + 判定 + 误报控制）

| # | 检查项 | 信号来源（工业先例） | 误报控制 |
|---|---|---|---|
| 1 | **版本号正则**：`/20\d{2}\.\d+(\.\d+)?/` 扫描 13 份 locale，命中即失败（locale 里不允许任何 calver 字面量；英文源豁免但要求其值 == manifest version） | K8s triage 脚本把"版本引用差异"列为技术内容信号（kubernetes.dev，2026） | 允许 `--allow` 白名单注释（显式豁免需 inline 标记，防静默扩散） |
| 2 | **分发产物名正则**：`/boxing-(chrome\|firefox)[-\w]*\.(zip\|crx\|xpi)/` 在 locale 中命中即失败（旧口径残留检测） | 本仓库已知漂移形态 | — |
| 3 | **标记块存在性**：每份 locale 必须含语言切换器标记行（现有 gen-i18n-readme.js 的职责扩展为校验）+ 一个统一的「状态 see-en」标记块（如 `<!-- install-source: README.md#install -->`） | MDN front matter `l10n.sourceCommit` 思路：用机器可读标记承载同步契约 | 标记格式唯一、可 grep |
| 4 | **URL 白名单**：locale 中出现的所有 URL 必须 ∈ {允许集}（含 `*/releases/latest`、商店列表、英文 README 锚点）；黑名单含 `releases/download/.*\.(zip\|xpi\|crx)` | Sphinx 交叉引用警告机制（译文引用与原文不匹配即 warn，Sphinx intl 官方文档已读）——链接级机检是被验证过的最低成本手段 | 白名单表集中在脚本顶部一处维护 |
| 5 | **章节数奇偶/结构计数**：locale 的 H2 标题数、代码块数与英文源相等（或 ≥ 容差） | K8s triage 的结构信号（missing headings / code blocks / anchors）+ PR #55731 | 标题**比较语义而非字面**：比较索引处的 heading level 序列而非文本；行数差异设大容差阈值，仅报告不阻塞（K8s 的 triage 分级思想：Strong/Moderate/No signal，而不是一刀切） |
| 6 | **孤儿检测**：locale 文件存在但英文源锚点/标记块引用失效 | K8s triage「localized files that no longer have a matching English source」（Orphan 类） | — |

### 退出码与误报控制

- 退出码：`0` 全绿；`1` 阻塞类违规（#1–#4 + 标记块缺失）；`2` 仅警告类（#5 行数/标题容差，`--strict` 时升为阻塞）——对应 K8s「信号分诊而非终审判决」的原则，避免误报把门禁逼成被 `--no-verify` 绕过的摆设。
- 误报三闸：inline 豁免标记（可审计）、白名单集中表、警告/阻塞分级。豁免必须出现在 diff 里，review 可见。

### 测试策略

- **负向自检（mutant）**：脚本内置 13 个 mutant 用例（每检查项一个"故意注入的漂移样本"），`--self-test` 断言每个样本触发对应退出码，任一 mutant 逃逸则自检失败。这保证门禁的每条规则都被证明真的会咬人，防止"规则写了个寂寞"的静默失效。
- **pretest 链上的取舍**：收益——本仓库已有 `pretest` 跑 import-graph guard + migration golden guard 的先例，文档门禁加入后与"发布口径由 ADR-0017 三门定义"的治理闭环对齐；成本——纯 Markdown 检查 <100ms，远轻于 Playwright 套件，**建议挂在 pretest 而非单独 CI job**，复用既有 mutex 管线。风险仅在于：若未来 locale 数量增长，正则扫描仍是 O(文件数)，不构成瓶颈。

---

## 信息缺口

1. **Rust 各翻译仓的过期横幅原文**：`rust-lang/book` 主仓 README（已读全文）证实翻译由 issue/label 协调、等 mdBook 多语言支持后合并，主仓无 stale 强制机制——但这只能证明"主仓无"，各独立翻译仓（如 rust-lang-ru 组织）内部的横幅做法未读到一手文件，未列入论证。
2. **MDN 是否使用"English updated"过期横幅**：未找到该横幅的一手页面；已核验的 MDN 机制是相反方向的极端方案——归档非活跃 locale（mdn/content）+ `l10n.sourceCommit` 同步点（translated-content-de）。结论中按已核验事实陈述。
3. **Codecademy「translated files must be direct copies + human reviewer」**：来自搜索快照，原文页 404，未计入证据。
4. Edge Add-ons / AMO 是否有第三方动态徽章源：搜索未找到任何活着的徽章服务，按"不存在"处理，但不排除未索引的小众服务。

---

## 对本仓库的具体建议

### ① 13 份 locale README 应改到的粒度

**只改到「声明行」粒度，不逐段翻译。** 具体：删掉各 locale 中的整个旧 Install 段落（含所有 `.zip/.crx/.xpi` 下载描述与商店进度叙述），替换为一个**翻译稳定的三行小节**：

- 一行本语标题（"安装 / Install / インストール…"）；
- 一行链接指向英文 README 的 Install 锚点（含「英文版为权威口径」的固定短语，可预翻 14 份后不再改动）；
- 一行链接指向 GitHub Releases（`/releases/latest`）与商店列表页（恒定 URL）。

理由：问题 1 的结论——正文追源是无限负债（K8s 为此养了整个 triage 工具链仍不保证收敛），而"翻译稳定的小节"把 14 份文件的**每次发版维护量降为 0**。store 状态日期行（"as of 2026-09-13"）只活在英文源 README 与 `docs/release-status.md`，locale 不复制。

### ② 门禁脚本检查项（汇总自问题 3 表格）

1. locale 中 calver 版本号正则 → 阻塞；2. 旧分发产物名（`boxing-chrome-*.zip/.crx`、`boxing-firefox-*.xpi`、`releases/download/`）→ 阻塞；3. 语言切换器标记行 + `install-source` 标记块存在性 → 阻塞；4. URL 白名单/黑名单 → 阻塞；5. H2 章节数、代码块数与英文源计数差 → 警告（`--strict` 升阻塞）；6. 英文源豁免但校验其版本字面量 == manifest version → 阻塞（防止英文源自己漂移）。每个检查项配一个 mutant，`--self-test` 全量断言。

### ③ 防复发的维护契约（写入 AGENTS.md 文档治理节）

- **英文源 README 是版本/上架口径的唯一散文出处**；locale 只允许出现"翻译稳定小节"，任何新事实先落 ADR/release-status，README 引用之。
- **发版 checklist 加一条**：改版本时只允许改 manifest + 英文 README（`gen-i18n-readme.js` 只动切换器行，天然不碰版本）——locale 无版本号字面量，故发版不需要触碰 13 份文件，这是契约的机械保障。
- **ADR-0017 口径不可在 README 中复述**：README 只能链接"当前已发布版本见 X"，不得自行声明"可发行"或代签 G-B（用户声明）——与现有约束④一致。
- 门禁进 pretest 链后，**豁免必须用 inline 标记**且出现在 diff 中；每季度对照 K8s triage 信号清单复查一次是否有新漂移形态需要新增检查项。

---

## 完整来源清单

| 来源 | URL | 角度 | 贡献 |
|---|---|---|---|
| Kubernetes 本地化指南（官方，zh-cn，2026 更新） | kubernetes.io/zh-cn/docs/contribute/localization/ | Official | 已读全文；lastmod/upstream_changes.py/diff_l10n_branches.py 过期机制 |
| K8s 博客：Human-Centered Automation for Kubernetes Localization（kubernetes.dev，2026-06-26） | kubernetes.dev/blog/2026/06/26/… | Official + Criticism | 已读全文；triage 信号清单（结构/版本引用/孤儿/行数）；git 信号的局限 |
| K8s triage 脚本 PR #55731（issue 引用，tavily 快照） | github.com/kubernetes/website | Community | 结构信号分级先例 |
| MDN translated-content README（raw，已读全文） | github.com/mdn/translated-content | Official | active-locale 白名单制 |
| MDN Translated_content 归档政策（mdn/content，tavily 快照） | developer.mozilla.org/docs/MDN/Community/Contributing/Translated_content | Official + Criticism | "unmaintained/out-of-date content" 是归档动因（2020-12-14） |
| MDN translated-content-de 翻译指南（tavily 快照） | github.com/mdn/translated-content-de | Official | `l10n.sourceCommit` 上游 commit 同步点；代码块不译语法 |
| Weblate FAQ（已读全文）+ Continuous localization（快照） | docs.weblate.org | Official + Criticism | 传播机制边界：不自动更新正文文件 |
| Sphinx Internationalization（已读全文） | sphinx-doc.org/en/master/usage/advanced/intl.html | Official | gettext 流水线；译文交叉引用不匹配即警告 |
| Docusaurus i18n Introduction（已读全文） | docusaurus.io/docs/i18n/introduction | Official | Markdown 整篇翻译 vs 结构/代码块机器管理的设计取舍 |
| rust-lang/book README（raw，已读全文） | github.com/rust-lang/book | Official（否定性证据） | 翻译协调靠 issue/label，无主仓 stale 强制 |
| Shields.io 官方（shields.io + /docs + /badges 快照） | shields.io | Official | 动态/静态徽章能力边界 |
| Chromium-extensions Google Groups：badging 终止公告 | groups.google.com/a/chromium.org/g/chromium-extensions/c/2_futjKuTCY | Currency | CWS 徽章生态死亡的一手佐证 |
| Mutation testing 原理（CircleCI 博客，2026-06-25） | circleci.com/blog/what-is-mutation-testing/ | Official（厂商）+ Comparative | "行为破坏性变更 ⇒ 至少一个测试必须失败"的 mutant 判据 |
| Why linting errors should cause tests to fail（jordaneldredge.com，2016-09-16） | jordaneldredge.com/blog/… | Community | 不入 CI 必漂移的论证 |
| Vue docs issue #2565（2023-11） | github.com/vuejs/docs/issues/2565 | Community | 人工同步散文内容整体过期的案例 |
| Transifex 2026 开发者指南（厂商） | transifex.com/blog/best-tools-for-software-localization-a-developers-guide-2026 | Currency + Comparative | TMS 能力面与 Weblate/Transifex 组合模式 |
| Codecademy React translations（快照级，原文 404） | codecademy.com/resources/docs/general/react/translations | Comparative | "翻译文件须与英文直接对应 + 人工审阅"模式（降级引用） |
| GitLab 日语文档站构建博客 | about.gitlab.com/blog/how-we-built-and-automated-our-new-japanese-gitlab-docs-site/ | Community | 文档即代码 + CI 检查（语言/格式/链接）实践 |

继续此会话，运行：atomcode -p "…" --resume 37852903-1e25-410e-b34d-e6a613c68238
