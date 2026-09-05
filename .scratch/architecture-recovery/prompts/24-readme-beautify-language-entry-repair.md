# Prompt 24R — README placeholder repair

身份：你是 Boxing architecture-recovery 子窗口，只负责修复票 24 的 11 个 locale 截图占位残留，不修改源码、manifest、测试或扩展行为。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/24-readme-beautify-language-entry.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/24-readme-beautify-language-entry.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/prompts/24-readme-beautify-language-entry.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/24-readme-beautify-language-entry-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/24-25-26-review-verification.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/docs/i18n
- D:/Aworker/crx/boxing/README.md

本票 delta：
- 只删除 docs/i18n 下 ar、de、es、fr、ja、ko、pt_BR、ru、th、vi、zh_TW 这 11 个文件里两处截图占位 NOTE 块及其紧邻占位文案行。
- 删除后全仓机械扫描必须满足：`> [!NOTE]` 占位提示 0 命中，截图本地引用全部可解析，每文件仍只有一个语言条，页脚重复块 0 命中。
- 先独立复核主 Agent 的检查结果，再用 Node 脚本执行和复验，不接受自述通过；若与主 Agent 结论不一致，以本次实物扫描为准并记录。
- 不改 gen-i18n-readme.js、不跑生成器、不生成仓库根目录的 13 个 locale 文件。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（24 原始票 + 复核 FAIL 项）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/24-readme-beautify-language-entry-repair-report.md，并返回路径与逐项验证结果。
