# 窗口启动器 — 03 store-i18n (__MSG_ 多语言商店检测) [复核后重发]

身份: Boxing 子窗口实施代理, 只做本票, 不跨票。

## 背景 (首脑复核)

Wave1 复核结论: 本票 **NOT-STARTED** — 无分支、无报告、extensionName/Description 0/14、manifest 仍硬编码。从零实施。
复核报告: .scratch/architecture-recovery/reports/40-wave1-brain-review.md

## 必读 (动手前全部读完)

- .scratch/architecture-recovery/handoffs/03-store-i18n.md
- .scratch/architecture-recovery/issues/03-store-i18n.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md (仅 §4.2 版本控制、§4.3 调研纪律)
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0005-build-time-i18n-and-css-validation.md
- docs/store-assets/store-listings-2026-09.md
- .scratch/architecture-recovery/reports/40-wave1-brain-review.md

## 阻塞

None — can start immediately

## 本票 delta

路径锚点: _locales/*/messages.json (14), manifest.json, docs/store-assets/store-listings-2026-09.md。
1. 14 locale 各增加 extensionName + extensionDescription (desc <=132 字符, Edge 硬限)。
2. manifest name/description 改为 __MSG_extensionName__ / __MSG_extensionDescription__。
3. 跑 A7 校验 + npm run build 确认 14-locale parity。
4. 注意: 04 已在同批 locale 加过 syncGroupShared — 勿删该键; 只追加 extension* 两键。
5. en 的 extensionDescription 可复用现有 131 字符英文; 其余语言逐个精简撰写。

## 硬约束

- 版本控制表述只写「遵循 WORKFLOW §4.2」, 禁止在本文件或回复中出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时: 先读本票 handoff 内的 atomcode 提示词, 用 ctx_batch_execute 串行调用 atomcode-research; 并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交; 不动其他票文件。
- 分支并行: 与 01/02/04/05/06 各分支互不影响, 只写本票文件。

## 开工第一句 (必须先输出)

1. 复述阻塞状态: None — can start immediately
2. 复述必读清单 (逐条路径)
3. 复述首脑复核结论: 本票 NOT-STARTED, 从零实施
4. 然后才开始读文件/改代码

## 质检要求

提交前先自检一次复核主 Agent 的检查结果 (0/14 键、硬编码 manifest), 再执行修复/实施。
自检命令形态: node 读 14 个 messages.json 统计 extensionName/extensionDescription 计数 + 读 manifest name/description。

## 完成时

- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/03-store-i18n-report.md
- 报告须含: 14 locale 键计数证据、manifest 前后对比、每语言 description 字符长度表
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
