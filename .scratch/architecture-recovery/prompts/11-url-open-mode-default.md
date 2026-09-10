# 窗口启动器 — 11 书签默认当前标签页

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/11-url-open-mode-default.md
- .scratch/architecture-recovery/issues/11-url-open-mode-default.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2）
- AGENTS.md
- docs/CONTEXT.md
- ntp/utils.js
- ntp/ntp.js（openBookmarkUrl）
- ntp/settings-ui.js
- ntp/popups.js

## 阻塞
None — can start immediately

## 本票 delta
默认与缺键 migrate → sameTab；保留显式 newTab；同步全部 fallback 与设置 UI。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None — can start immediately
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/11-url-open-mode-default-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
