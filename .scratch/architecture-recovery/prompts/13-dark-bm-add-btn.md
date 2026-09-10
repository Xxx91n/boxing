# 窗口启动器 — 13 黑暗模式加书签按钮亮色

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/13-dark-bm-add-btn.md
- .scratch/architecture-recovery/issues/13-dark-bm-add-btn.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2）
- AGENTS.md
- docs/adr/0011-ntp-css-build-artifact.md
- docs/css-dual-write-convention.md
- docs/CONTEXT.md
- ntp/base.css
- ntp/settings.css

## 阻塞
None — can start immediately

## 本票 delta
dark 下 .bm-add-btn 重置 background 为 transparent；收紧旧 .ntp--dark .bm-add-row button 亮色遗产；不改 ntp.css / JS。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 不编辑 ntp/ntp.css（ADR-0011 构建产物）。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None — can start immediately
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/13-dark-bm-add-btn-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
