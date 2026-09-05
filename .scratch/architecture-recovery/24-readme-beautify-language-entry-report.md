# 24 — README beautify and language entry reposition — Closure Report

- 生成: 2026-09-05
- 票: `.scratch/architecture-recovery/issues/24-readme-beautify-language-entry.md`
- 窗口: Boxing architecture-recovery 子窗口 (票 24)
- 阻塞项核验: 票 23 (Mental model deep research) 已闭环 — `.scratch/architecture-recovery/research-report-round5.md` 存在且 `23-review-verification.md` 最终判定 PASS; 其 §5.2 为本票执行蓝图。
- 纪律: 只改 README 信息架构、截图引用、语言入口位置; 未改扩展行为/源码/manifest/测试; 版本控制遵循 WORKFLOW §4.2 (GitButler 独立分支 `arch-recovery-24-readme-beautify`, 不 push)。

## 1. 改动清单 (15 文件, 全部为 markdown)

| 文件 | 改动 |
|---|---|
| `README.md` (根) | ① 顶部语言条末尾并入 `— see [TRANSLATIONS.md](TRANSLATIONS.md)`; ② 快速导航新增 Development / Governance 两个锚点 (`#development` / `#quarantined-tests`); ③ `### Quarantined tests` 升为独立 `## Quarantined tests` 小节 (治理表获得 TOC 锚点, 票 27 收口时在该表上继续); ④ 删除页脚 `README-I18N:START:FOOTER` 重复语言块 |
| `docs/i18n/README.<13 locales>.md` | 每个文件: ① 删除页脚 `README-I18N:START:FOOTER` 重复语言块; ② TRANSLATIONS.md 链接 (沿用各文件原 href, 均为 `../../TRANSLATIONS.md`) 并入顶部语言条末尾; ③ 全部 13 个 locale 的过时截图占位 NOTE 已清除 (票 24 初版漏掉 11 个 locale 的占位 NOTE，由 24R 修复闭环; zh_CN 与 hi 初版已各清 2 处) (`> [!NOTE]` + 占位文案; 其上方 `<picture>` 均已指向真实 PNG, 属于陈旧提示残留) |

## 2. 完成定义逐项验证 (handoff)

| # | Acceptance criterion | 证据 | 结论 |
|---|---|---|---|
| 1 | Exactly one language selector at the top | 14 文件机械扫描: 每文件 `**Languages:**` 行恰 1 条且均含 TRANSLATIONS.md 链接; `README-I18N:START:FOOTER` / `END:FOOTER` 全仓 0 命中; `^> Translations:` 0 命中 | PASS |
| 2 | Existing screenshots replace placeholder notes; all local image links resolve | 票 24 初版漏掉 11 个 locale 的占位 NOTE，由 24R 修复闭环; 修复后占位文案 (占位图/Replace this placeholder/此处为) 14 文件 0 命中; 5 张 PNG (screenshot-1-canvas/2-boxes/3-connections/4-settings/5-bookmarks) 在根 README 全部被引用; 14 文件共 61+27×13 个本地引用 (href/src/srcset/markdown) 逐一 fs.existsSync 解析, 0 断链 | PASS |
| 3 | Install/usage/privacy/development commands remain true to package.json | README 引用的命令 {install, build, dev:chrome, dev:firefox, dev:chrome:no-build, dev:firefox:no-build, test, test:quarantine} 与 package.json scripts 逐一对照, 0 缺失; 命令文本本次未改动 | PASS |
| 4 | Localized README generation remains compatible / explicitly verified | `scripts/gen-i18n-readme.js` 本票未改动; 以脚本同款提取逻辑对改后 README.md 做沙箱模拟: 首个 `## `=L50 `## What Makes It Different` (锚点未漂移), EN_BODY 147 行, 不含 README-I18N 标记, 含 `## Quarantined tests` — 契约兼容且页脚重复不再进入共享正文。预存漂移如实记录: 脚本输出路径为仓库根 (`path.join(ROOT, 'README.xx.md')`) 而实际人工翻译文件在 docs/i18n/ (TRANSLATIONS.md 所载契约), 该漂移先于本票存在, 属脚本与文档布局的历史失配; 本票按 delta 不动脚本, 未运行生成器以免在根目录凭空造出 13 个文件。建议后续票处理脚本与 docs/i18n 布局对齐 | PASS (explicitly verified) |
| 5 | git diff --check clean + closure report exists | `git diff --check` 无输出 (改动前后各验一次均干净); 本报告落盘于指定路径 | PASS |

## 3. issue checklist 逐项对照

- [x] Keep one language selector at the top and remove the footer duplicate — 14 文件验证 (§2.1)。
- [x] Use the existing five PNG screenshots in the README without inventing new claims — 5 张 PNG 引用齐备, 未新增任何功能/数据声明, 未使用生成图片。
- [x] Preserve the real install, usage, privacy, and development commands — 命令集与 package.json 对照 (§2.3)。
- [x] Keep the localized README generation contract compatible — EN_BODY 提取模拟 + 漂移记录 (§2.4)。
- [x] Verify local links, image paths, line endings, and git diff --check — 0 断链; 全部文件 LF (0 CR 字节)、UTF-8 无 BOM、单尾换行; git diff --check 干净。
- [x] Write the closure report named in the handoff — 即本文件。

## 4. 研究蓝图执行对照 (research-report-round5.md §5.2)

| 蓝图要点 | 执行 |
|---|---|
| 1. 顶部语言条保留, 删除页脚重复; TRANSLATIONS.md 并入顶部条 | 已执行 (根 + 13 locale) |
| 2. 治理表独立小节 + TOC 锚点 | 已执行 (`## Quarantined tests` + 导航 Governance/Development 锚点); 表内容为 2026-09-03 基线 14/14 绿, 票 27 收口时同步更新 |
| 3. "太长好过太短", 不删内容 | 未删除任何叙述性内容, 仅去重语言链接与占位提示 |
| 4. 三层文档分离保持 | 根 README / AGENTS.md / docs/history 未交叉污染 |
| 5. 可选增强 (CI badge / Who's-using) | 未实施 (蓝图标注不阻塞收口) |

## 5. 验证方法说明

- 本票为纯文档票: 验证走 spec.md Testing Decisions 指定的 path resolution / link checks / byte checks / git diff --check, 不跑 Playwright 套件 (票 15 先例: 文档票无 dist 契约面); 无本地构建产物产生 (CI-only 构建纪律合规)。
- 全部文件编辑经 Node fs 以 LF 写入, 写后复读断言内容一致; 14 文件二次全量机械扫描 (BOM/CRLF/尾换行/占位/页脚/语言条计数/引用解析/锚点闭合) 全绿。
- `codegraph sync` 已执行 (BX-EXPLORE-003), 索引不覆盖 markdown, 报告 "Already up to date"。

## 6. 移交事项 (供大脑窗口收口审查)

1. 票 24 初版漏掉 11 个 locale 的占位 NOTE，由 24R 修复闭环; 修复后 docs/i18n 全部 13 个 locale 的截图引用与页脚已与本票统一。
2. `boxing-v3.spec.ts` 的 README 内容断言 (Boxing/Language/Canvas/Zoom/Bookmark) 全部保留, 不受本次改动影响。
3. 票 27 收口时请继续维护 `## Quarantined tests` 独立小节 (锚点 `#quarantined-tests`) 与快速导航。
4. gen-i18n-readme.js 与 docs/i18n 布局的预存失配 (§2.4) 建议单列后续处理, 本票未越权修复。
