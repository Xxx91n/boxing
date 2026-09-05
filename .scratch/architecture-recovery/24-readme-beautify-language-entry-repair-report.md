# 24R — README placeholder repair — Closure Report

- 生成: 2026-09-05
- 票: `.scratch/architecture-recovery/issues/24-readme-beautify-language-entry.md` (复核 FAIL 修复, 依据 prompts/24-readme-beautify-language-entry-repair.md)
- 窗口: Boxing architecture-recovery 子窗口 (票 24R)
- 阻塞复述: 票 24 原始改动遗留 — 11 个 locale (ar/de/es/fr/ja/ko/pt_BR/ru/th/vi/zh_TW) 各残留 2 处截图占位 NOTE 块; `24-25-26-review-verification.md` 判票 24 FAIL (criterion 2), 并指出票 24 报告错误声称 "其余 11 个文件无占位块"。
- 根因 (主 Agent 结论 vs 本次实物扫描): 票 24 的占位扫描正则只匹配中文/英文占位文案 (占位图/Replace this placeholder/此处为), 而 11 个残留文件的占位文案是各自语言 (阿拉伯/德/西/法/日/韩/葡/俄/泰/越/繁体), 正则漏检。本次以语言无关的 `> [!NOTE]` 行标记扫描为准, 与复核结论一致: FAIL 复现 (22 个 NOTE 块), 报告 §2.2 的 "14 文件 0 命中" 声明对该 11 文件不成立。
- 纪律: 只删 docs/i18n 下 11 个文件的两处占位 NOTE 块及其紧邻占位文案行; 未改源码/manifest/测试/扩展行为; 未改 gen-i18n-readme.js、未跑生成器、未生成仓库根目录 locale 文件; 根 README.md 本票未触碰。

## 1. 改动清单 (11 文件, 每 -6 行)

| 文件 | 改动 |
|---|---|
| `docs/i18n/README.{ar,de,es,fr,ja,ko,pt_BR,ru,th,vi,zh_TW}.md` | 各删除 2 处占位块 (L15-17 区域 + L47-49 区域): 空行 + `> [!NOTE]` + 本地化占位文案行; 各 -6 行 (126->120, th 124->118); 两处 `<picture>` 真实截图嵌入 (screenshot-1-canvas / screenshot-2-boxes) 逐文件断言保留 |

## 2. 任务书 delta 逐项验证

| # | 要求 | 证据 | 结论 |
|---|---|---|---|
| 1 | 只删 11 文件两处占位 NOTE 块及紧邻文案行 | 写前断言: 每文件恰 2 块、每块 2 行 (NOTE+文案)、前导空行在位; 逐块 splice(空行+NOTE+文案); 任一断言失败即 ABORT 不写盘 (实际 0 ABORT) | PASS |
| 2 | `> [!NOTE]` 占位提示 0 命中 | 全仓 14 文件复扫: `^> [!NOTE]` 总计 0 (根 README 原本 0; 1 处 `> [!TIP]` 为合法安装提示, 非占位, 保留) | PASS |
| 3 | 截图本地引用全部可解析 | 14 文件 395 个本地引用逐一 fs.existsSync 解析, 0 断链; 27 个 `<picture>` 嵌入保留 (根 1 logo + 13 locale × 2) | PASS |
| 4 | 每文件仍只有一个语言条 | 14 文件 `**Languages:`` 行恰 14 条 (1/文件); 页脚重复块标记全仓 0 命中 | PASS |
| 5 | 先独立复核主 Agent 检查结果, 再用 Node 脚本执行和复验 | 删除前独立实物扫描复现 FAIL (22 块, 逐文件逐行打印占位原文); 与复核 (24-25-26-review-verification.md §3) 一致; 结论以本次实物扫描为准 | PASS |
| 6 | 不改 gen-i18n-readme.js / 不跑生成器 / 不生成根目录 locale 文件 | 脚本 0 改动; 仓库根目录 README.*.md 仍只有 README.md; EN_BODY 锚点仍在 L50 (根 README 未触碰) | PASS |
| 7 | git diff --check 干净 + 报告落盘 | `git diff --check` 无输出 (删除后复验); 本报告落盘于指定路径 | PASS |

## 3. handoff 完成定义回归 (五项全绿)

1. 顶部唯一语言选择器 — 14/14 文件 1 条语言条, 页脚 0 (回归)。
2. 截图占位替换 + 链接解析 — 本次修复后达成: [!NOTE] 0、占位文案 0、395 引用 0 断链 (原 FAIL 项闭环)。
3. 命令与 package.json 一致 — 本票未触碰命令面 (回归)。
4. 本地化生成契约 — 脚本未动, 根 README 未动, 锚点 L50 (回归)。
5. git diff --check 干净 + 报告存在 — 双条件满足。

## 4. 版本控制

- 遵循 WORKFLOW §4.2: 修复经 `but amend` 并入票 24 所属 commit (`arch-recovery-24-readme-beautify` 分支), 不造 fixup 垃圾; 不 push。
- 教训记录 (供 WORKFLOW §6 回写): 占位/提示类扫描不得依赖具体语言文案关键词, 必须用结构标记 (`> [!NOTE]` 块标记) 做语言无关检测; 内容断言型验证的假阴性来自检测器覆盖面而非被测对象。
