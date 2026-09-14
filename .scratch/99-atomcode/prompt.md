# 调研任务：多语言 README（14 语）与单一事实源「版本 / 商店上架口径」一致性的工业防漂移方案

## 背景（已发生事实，不要重复推导）

- Chrome MV3 + Firefox 浏览器扩展仓库（单仓、无框架、无打包、零运行时依赖，文档为纯 Markdown）。
- 仓库有 14 语 README：英文 `README.md` 为源（canonical），另有 13 份 `docs/i18n/README.<code>.md`（ar / de / es / fr / hi / ja / ko / pt_BR / ru / th / vi / zh_CN / zh_TW），由零依赖脚本 `scripts/gen-i18n-readme.js` 只维护语言切换器标记行，正文由人工翻译。
- 已发生漂移：英文源已改为「商店正式安装优先 / GitHub Releases 只是用户可见 changelog，不再随包分发 .xpi / .crx / Latest published store version 2026.9.12（AMO + Edge，as of 2026-09-13）」，而 13 份本地化 README 仍停留在旧口径「从 Release 包下载 boxing-chrome-<version>.zip / .crx、boxing-firefox-<version>.xpi；商店上架仍在推进中（Edge 进行中、CWS 延后、AMO 无公开列表）」。其中 hi 语还硬编码钉住 `2026.9.11`。
- 约束（不得违反）：① 只能做版本 / 商店口径对齐，禁止扩写为无关 i18n 重构；② 不引入 npm 依赖（CRX-R-009），零依赖 Node 脚本优先；③「可发行」由 ADR-0017 三门合取（G-A CI ∧ G-B 用户声明 ∧ G-C Pages）定义，文档不得宣称可发行、不得代签 G-B；④ 目标发行版本 2026.9.15，已发布版本 2026.9.12。

## 需要你回答（每问给「推荐 + 理由 + 可核验来源」）

1. 工业界如何让「多语言文档」与「单一事实源」保持一致、防止漂移？请对比至少 3 种真实做法：(a) 源语言 en 为唯一源 + 机器标注过期（MDN Web Docs 的 translation outdated / English-updated banner、Kubernetes 官网 localization 工作流与 stale-by-SHA 检查、Rust / Sphinx / Docusaurus i18n 的 outdated 机制）；(b) 翻译管理平台（Weblate、Crowdin、Transifex）驱动回写与源串变更传播；(c) 只同步「不变量」——版本号、URL、代码块、文件名等以占位符/变量或机器生成方式存在，翻译只覆盖散文；(d) 人工流程 + 检查单。逐项给出失败模式矩阵（各自何时仍会漂移）与推荐组合。

2. README 里「版本 / 上架状态」这类高频易过期信息，工业上的表述惯例是什么？对比：硬编码版本号字符串 vs shields.io 动态徽章（GitHub latest release / store 静态 badge）vs 指向 `/releases/latest` 的动态链接 vs 只写一行「published as of <日期>」并外链状态页。请说明各自在多语言场景下的维护成本与漂移风险，给出推荐（含是否应在本地化文件里保留版本号字面量）。

3. 如何用零依赖脚本 / CI 做「locale 文档漂移」门禁？请给出可核验的检查项设计（语言无关的检查手段：ASCII 文件名 / URL / 版本号正则 / 标记块存在性 / 章节数奇偶等）、退出码与误报控制策略，以及测试策略（负向自检 / mutant 测试：故意注入漂移应必失败）。并说明在 pretest 链上跑此类门禁的取舍。

## 输出要求

- 中文；按 3 问分节，每节先结论后论证；给出来源（项目 / 文档名 + 发布方 + 年份或可定位 URL）。
- 无法核验的写成「信息缺口」，不得编造。
- 最后给「对本仓库的具体建议」一节：① 13 份 locale README 应改到什么粒度（仅声明行 vs 整个 Install 段）；② 门禁脚本应检查哪些项；③ 后续防复发的维护契约。